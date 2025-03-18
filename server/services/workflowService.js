const { supabase } = require('../config/supabase.js');
const { sendEmail } = require('./emailService.js');
const { placeCall } = require('./callService.js');

const calculateNextExecution = (waitTime, waitUnit) => {
  const nextExecution = new Date();
  
  switch (waitUnit) {
    case 'minutes':
      nextExecution.setMinutes(nextExecution.getMinutes() + waitTime);
      break;
    case 'hours':
      nextExecution.setHours(nextExecution.getHours() + waitTime);
      break;
    default: // days
      nextExecution.setDate(nextExecution.getDate() + waitTime);
  }

  return nextExecution;
};

const processEmailStep = async (step, leadSequence, lead) => {
  if (!lead.email) {
    throw new Error('Lead email is required for email step');
  }

  const placeholders = {
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    fullName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    email: lead.email || '',
    company: lead.company_name || '',
    title: lead.title || '',
    location: lead.location || '',
    linkedin: lead.linkedin || ''
  };

  const subject = Object.entries(placeholders).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{{${key}}}`, 'g'), value),
    step.configuration.subject || ''
  );

  const message = Object.entries(placeholders).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{{${key}}}`, 'g'), value),
    step.configuration.message || ''
  );

  // Send email with tracking
  await sendEmail(
    lead.email,
    subject,
    message,
    placeholders,
    leadSequence.id,
    step.id
  );
};

// New function to process call steps
const processCallStep = async (step, leadSequence, lead) => {
  console.log(`Processing call step for lead ${lead.id}`);
  
  // Validate lead has a phone number
  if (!lead.phone) {
    throw new Error('Lead phone number is required for call step');
  }
  
  // Prepare script with placeholders
  const placeholders = {
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    fullName: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    email: lead.email || '',
    company: lead.company_name || '',
    title: lead.title || '',
    location: lead.location || '',
    linkedin: lead.linkedin || ''
  };
  
  // Replace placeholders in script
  const processText = (text) => {
    if (!text) return '';
    return Object.entries(placeholders).reduce(
      (processed, [key, value]) => processed.replace(new RegExp(`{{${key}}}`, 'g'), value),
      text
    );
  };
  
  const scriptConfig = step.configuration;
  const callScript = {
    greeting: processText(scriptConfig.greeting),
    introduction: processText(scriptConfig.introduction),
    talking_points: (scriptConfig.talking_points || []).map(point => processText(point)),
    questions: (scriptConfig.questions || []).map(question => processText(question)),
    closing: processText(scriptConfig.closing),
    caller_phone_number: scriptConfig.caller_phone_number,
    ai_model: scriptConfig.ai_model || 'gpt-4',
    voice: scriptConfig.voice || 'shimmer'
  };
  
  // Place the call
  await placeCall(lead.phone, lead, callScript, leadSequence.id, step.id);
};

const updateLeadSequence = async (leadSequenceId, updateData) => {
  try {
    const { error } = await supabase
      .from('lead_sequences')
      .update(updateData)
      .eq('id', leadSequenceId);

    if (error) throw error;
  } catch (error) {
    console.error(`Error updating lead sequence ${leadSequenceId}:`, error);
    throw error;
  }
};

const getNextStep = (currentStep, steps, decisionPath) => {
  const step = steps[currentStep];
  
  // If a decision path is chosen, use its next step
  if (decisionPath) {
    const path = step.configuration.paths.find(p => p.id === decisionPath);
    // If path is End or path's next step is null, end the sequence
    if (path?.label === 'End' || path?.next_step === null) {
      return -1; // Signal to end sequence
    }
    return path?.next_step ?? currentStep + 1;
  }
  
  // Otherwise, move to next step
  return currentStep + 1;
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

const retryWithBackoff = async (operation, retries = 0) => {
  try {
    return await operation();
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)));
      return retryWithBackoff(operation, retries + 1);
    }
    throw error;
  }
};

const processWorkflowSteps = async () => {
  try {
    console.log('Starting workflow processing...');
    
    // Get all active sequences
    const { data: sequences, error: sequencesError } = await retryWithBackoff(() => 
      supabase
        .from('sequences')
        .select('*')
        .eq('enabled', true)
    );

    if (sequencesError) {
      console.error('Error fetching sequences:', sequencesError);
      throw sequencesError;
    }

    console.log(`Found ${sequences.length} active sequences.`);

    for (const sequence of (sequences || [])) {
      console.log(`Processing sequence ID: ${sequence.id}`);
      try {
        // Get sequence steps
        const { data: steps, error: stepsError } = await retryWithBackoff(() => 
          supabase
            .from('sequence_steps')
            .select('*')
            .eq('sequence_id', sequence.id)
            .order('step_order')
        );

        if (stepsError) {
          console.error(`Error fetching steps for sequence ID ${sequence.id}:`, stepsError);
          throw stepsError;
        }

        console.log(`Found ${steps.length} steps for sequence ID: ${sequence.id}`);

        // Get leads due for processing
        const { data: leadSequences, error: leadsError } = await retryWithBackoff(() => 
          supabase
            .from('lead_sequences')
            .select(`
              id,
              lead_id,
              sequence_id,
              current_step,
              status,
              next_execution,
              decision_path,
              lead:leads (
                id,
                first_name,
                last_name,
                email,
                title,
                company_name,
                location,
                linkedin,
                phone
              )
            `)
            .eq('sequence_id', sequence.id)
            .in('status', ['pending', 'in_progress'])
            .lte('next_execution', new Date().toISOString())
            .is('paused_at', null)
        );

        if (leadsError) {
          console.error(`Error fetching leads for sequence ID ${sequence.id}:`, leadsError);
          throw leadsError;
        }

        console.log(`Found ${leadSequences.length} leads due for processing in sequence ID: ${sequence.id}`);

        for (const leadSequence of (leadSequences || [])) {
          console.log(`Processing lead sequence ID: ${leadSequence.id}, current step: ${leadSequence.current_step}`);
          const currentStep = steps?.[leadSequence.current_step];
          if (!currentStep) {
            console.warn(`No current step found for lead sequence ID: ${leadSequence.id}`);
            continue;
          }

          try {
            // Process step based on type
            switch (currentStep.step_type) {
              case 'email':
                console.log(`Processing email step for lead sequence ID: ${leadSequence.id}`);
                await processEmailStep(currentStep, leadSequence, leadSequence.lead);
                break;
              case 'call':
                console.log(`Processing call step for lead sequence ID: ${leadSequence.id}`);
                await processCallStep(currentStep, leadSequence, leadSequence.lead);
                break;
              // Manual steps (linkedin) are handled by the UI
              default:
                console.warn(`Unsupported step type: ${currentStep.step_type} for lead sequence ID: ${leadSequence.id}`);
            }

            const nextStep = getNextStep(leadSequence.current_step, steps, leadSequence.decision_path);
            console.log(`Next step for lead sequence ID: ${leadSequence.id} is ${nextStep}`);
            
            // If nextStep is -1 or we've reached the end, complete the sequence
            if (nextStep === -1 || nextStep >= steps.length) {
              console.log(`Completing lead sequence ID: ${leadSequence.id}`);
              await updateLeadSequence(leadSequence.id, {
                status: 'completed',
                next_execution: null,
                last_executed: new Date().toISOString(),
                error_message: null,
                decision_path: null
              });
              continue;
            }

            // Calculate next execution time
            const waitTime = currentStep.configuration.wait_time || 1;
            const waitUnit = currentStep.configuration.wait_time_unit || 'days';
            const nextExecution = calculateNextExecution(waitTime, waitUnit);

            console.log(`Updating lead sequence ID: ${leadSequence.id} to next step: ${nextStep}, next execution: ${nextExecution.toISOString()}`);

            // Update lead sequence
            await updateLeadSequence(leadSequence.id, {
              current_step: nextStep,
              status: 'in_progress',
              next_execution: nextExecution.toISOString(),
              last_executed: new Date().toISOString(),
              error_message: null,
              decision_path: null // Clear decision path after using it
            });

          } catch (error) {
            console.error(`Error processing step for lead sequence ${leadSequence.id}:`, error);
            
            await updateLeadSequence(leadSequence.id, {
              status: 'failed',
              error_message: error.message
            });
          }
        }
      } catch (error) {
        console.error(`Error processing sequence ${sequence.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in workflow processing:', error);
  }
};

module.exports = { processWorkflowSteps, calculateNextExecution };