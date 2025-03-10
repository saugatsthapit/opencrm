import { transporter } from '../config/email.js';
import { supabase } from '../config/supabase.js';

const TRACKING_DOMAIN = process.env.VITE_APP_URL || 'http://localhost:8000';
console.log(`Using tracking domain: ${TRACKING_DOMAIN}`);

// Check if the tracking domain is accessible
const checkTrackingDomain = async () => {
  try {
    console.log(`Checking if tracking domain is accessible: ${TRACKING_DOMAIN}`);
    const response = await fetch(`${TRACKING_DOMAIN}/api/v1/email/test-tracking`, { method: 'HEAD' }).catch(err => {
      console.warn(`Tracking domain check failed: ${err.message}`);
      return { ok: false };
    });
    
    if (response.ok) {
      console.log(`Tracking domain is accessible: ${TRACKING_DOMAIN}`);
    } else {
      console.warn(`Tracking domain may not be accessible: ${TRACKING_DOMAIN}`);
      console.warn(`This could cause tracking pixels and link tracking to fail.`);
      console.warn(`Make sure the domain is publicly accessible from the internet.`);
    }
  } catch (error) {
    console.warn(`Error checking tracking domain: ${error.message}`);
  }
};

// Run the check (but don't block startup)
setTimeout(checkTrackingDomain, 5000);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// In-memory store for local tracking events
const localTrackingStore = {
  opens: new Map(),
  clicks: new Map()
};

// Helper to add a local tracking event
const addLocalTrackingEvent = (type, trackingId, data = {}) => {
  const store = type === 'open' ? localTrackingStore.opens : localTrackingStore.clicks;
  
  if (!store.has(trackingId)) {
    store.set(trackingId, []);
  }
  
  store.get(trackingId).push({
    timestamp: new Date().toISOString(),
    ...data
  });
  
  console.log(`Added local ${type} tracking event for ID: ${trackingId}`);
  console.log(`Current ${type} events for this ID:`, store.get(trackingId));
};

// Helper to get local tracking events
export const getLocalTrackingEvents = (type, trackingId) => {
  const store = type === 'open' ? localTrackingStore.opens : localTrackingStore.clicks;
  return store.get(trackingId) || [];
};

const wrapLinksWithTracking = (content, trackingId) => {
  console.log(`Wrapping links with tracking for ID: ${trackingId}`);
  
  const wrappedContent = content.replace(
    /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi,
    (match, url, rest) => {
      const encodedUrl = encodeURIComponent(url);
      const trackingUrl = `${TRACKING_DOMAIN}/api/v1/email/click/${trackingId}?url=${encodedUrl}`;
      console.log(`Original URL: ${url}`);
      console.log(`Tracking URL: ${trackingUrl}`);
      return `<a href="${trackingUrl}"${rest}>`;
    }
  );
  
  return wrappedContent;
};

const addTrackingPixel = (content, trackingId) => {
  const trackingPixel = `<img src="${TRACKING_DOMAIN}/api/v1/email/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
  console.log(`Adding tracking pixel for ID: ${trackingId}`);
  console.log(`Tracking pixel URL: ${TRACKING_DOMAIN}/api/v1/email/open/${trackingId}`);
  return content + trackingPixel;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendEmailWithRetry = async (mailOptions, retries = 0) => {
  try {
    console.log('Attempting to send email:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      attempt: retries + 1
    });

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info);
    return info;
  } catch (error) {
    console.error('Email send error:', {
      code: error.code,
      message: error.message,
      attempt: retries + 1
    });

    if (retries < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY * Math.pow(2, retries)}ms...`);
      await delay(RETRY_DELAY * Math.pow(2, retries));
      return sendEmailWithRetry(mailOptions, retries + 1);
    }
    throw error;
  }
};

export const sendEmail = async (to, subject, content, placeholders, leadSequenceId = null, stepId = null) => {
  try {
    console.log('Starting email send process for:', { to, subject });

    // Check authentication state
    const { data: authData } = await supabase.auth.getSession();
    console.log('Current auth state:', {
      hasSession: !!authData?.session,
      userId: authData?.session?.user?.id || 'Not authenticated'
    });

    // Replace placeholders in content
    let finalContent = content;
    Object.entries(placeholders).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      finalContent = finalContent.replace(new RegExp(placeholder, 'g'), value);
    });

    // Create tracking record
    let tracking;
    try {
      const { data, error } = await supabase
        .from('email_tracking')
        .insert({
          lead_sequence_id: leadSequenceId,
          step_id: stepId,
          email: to,
          subject,
        })
        .select()
        .single();

      if (error) {
        console.error('Tracking record creation failed:', error);
        
        // Try a direct SQL approach if RLS is the issue
        if (error.code === '42501') {
          console.log('Attempting to bypass RLS with rpc call...');
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_email_tracking', {
            p_lead_sequence_id: leadSequenceId,
            p_step_id: stepId,
            p_email: to,
            p_subject: subject
          });
          
          if (rpcError) {
            console.error('RPC tracking creation failed:', rpcError);
            throw rpcError;
          }
          
          tracking = rpcData;
          console.log('Created tracking record via RPC:', tracking);
        } else {
          throw error;
        }
      } else {
        tracking = data;
        console.log('Created tracking record:', tracking);
      }
    } catch (trackingError) {
      console.error('All tracking creation attempts failed:', trackingError);
      
      // Create a local tracking object to continue with email sending
      tracking = {
        tracking_id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        id: null,
        email: to,
        subject
      };
      console.log('Using local tracking as fallback:', tracking);
    }

    // Add tracking to email
    finalContent = wrapLinksWithTracking(finalContent, tracking.tracking_id);
    finalContent = addTrackingPixel(finalContent, tracking.tracking_id);

    // Prepare email options
    const mailOptions = {
      from: {
        name: "Saugat Sthapit",
        address: process.env.VITE_EMAIL_USER
      },
      to,
      subject,
      html: finalContent,
      // Add additional headers for better delivery
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    // Send mail with retry logic
    await sendEmailWithRetry(mailOptions);

    // Update tracking record with sent status if we have a valid ID
    if (tracking.id) {
      const { error: updateError } = await supabase
        .from('email_tracking')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', tracking.id);

      if (updateError) {
        console.error('Failed to update tracking record:', updateError);
      }
    }

    return tracking;
  } catch (error) {
    console.error('Error in sendEmail:', error);
    throw error;
  }
};

export const verifyEmailConfig = async () => {
  try {
    console.log('Verifying email configuration...');
    await transporter.verify();
    console.log('Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('Email verification error:', error);
    throw error;
  }
};

export const handleBounce = async (trackingId, reason) => {
  try {
    const { error } = await supabase
      .from('email_tracking')
      .update({
        bounced_at: new Date().toISOString(),
        bounce_reason: reason
      })
      .eq('tracking_id', trackingId);

    if (error) throw error;
  } catch (error) {
    console.error('Error handling bounce:', error);
    throw error;
  }
};

export const handleOpen = async (trackingId) => {
  try {
    console.log(`Handling email open for tracking ID: ${trackingId}`);
    
    // Check if this is a local tracking ID (fallback from failed DB insertion)
    if (trackingId.startsWith('local-')) {
      console.log(`Using in-memory store for local tracking ID: ${trackingId}`);
      addLocalTrackingEvent('open', trackingId);
      return;
    }
    
    const { error } = await supabase
      .from('email_tracking')
      .update({
        opened_at: new Date().toISOString()
      })
      .eq('tracking_id', trackingId)
      .is('opened_at', null);

    if (error) {
      console.error('Error updating open tracking:', error);
      
      // If it's an RLS issue, try using RPC
      if (error.code === '42501') {
        console.log('Attempting to bypass RLS for open tracking...');
        const { error: rpcError } = await supabase.rpc('update_email_tracking_open', {
          p_tracking_id: trackingId
        });
        
        if (rpcError) {
          console.error('RPC open tracking failed:', rpcError);
          // Fall back to in-memory tracking
          addLocalTrackingEvent('open', trackingId);
        } else {
          console.log(`Successfully updated open tracking via RPC for ID: ${trackingId}`);
        }
      } else {
        // Fall back to in-memory tracking for other errors
        addLocalTrackingEvent('open', trackingId);
        console.log(`Falling back to in-memory tracking due to error: ${error.message}`);
      }
    } else {
      console.log(`Successfully updated open tracking for ID: ${trackingId}`);
    }
  } catch (error) {
    console.error('Error handling open:', error);
    // Fall back to in-memory tracking for unexpected errors
    addLocalTrackingEvent('open', trackingId);
    console.log(`Falling back to in-memory tracking due to unexpected error: ${error.message}`);
  }
};

export const handleClick = async (trackingId, url, userAgent, ipAddress) => {
  try {
    console.log(`Handling link click for tracking ID: ${trackingId}, URL: ${url}`);
    
    // Check if this is a local tracking ID (fallback from failed DB insertion)
    if (trackingId.startsWith('local-')) {
      console.log(`Using in-memory store for local tracking ID: ${trackingId}`);
      addLocalTrackingEvent('click', trackingId, { url, userAgent, ipAddress });
      return;
    }
    
    const { error } = await supabase
      .from('email_link_clicks')
      .insert({
        email_tracking_id: trackingId,
        url,
        user_agent: userAgent,
        ip_address: ipAddress
      });

    if (error) {
      console.error('Error inserting click tracking:', error);
      
      // If it's an RLS issue, try using RPC
      if (error.code === '42501') {
        console.log('Attempting to bypass RLS for click tracking...');
        const { error: rpcError } = await supabase.rpc('create_email_link_click', {
          p_email_tracking_id: trackingId,
          p_url: url,
          p_user_agent: userAgent,
          p_ip_address: ipAddress
        });
        
        if (rpcError) {
          console.error('RPC click tracking failed:', rpcError);
          // Fall back to in-memory tracking
          addLocalTrackingEvent('click', trackingId, { url, userAgent, ipAddress });
        } else {
          console.log(`Successfully inserted click tracking via RPC for ID: ${trackingId}`);
        }
      } else {
        // Fall back to in-memory tracking for other errors
        addLocalTrackingEvent('click', trackingId, { url, userAgent, ipAddress });
        console.log(`Falling back to in-memory tracking due to error: ${error.message}`);
      }
    } else {
      console.log(`Successfully inserted click tracking for ID: ${trackingId}`);
    }
  } catch (error) {
    console.error('Error handling click:', error);
    // Fall back to in-memory tracking for unexpected errors
    addLocalTrackingEvent('click', trackingId, { url, userAgent, ipAddress });
    console.log(`Falling back to in-memory tracking due to unexpected error: ${error.message}`);
  }
};