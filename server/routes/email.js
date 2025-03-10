import express from 'express';
import { getEmailConfig } from '../config/email.js';
import { sendEmail, verifyEmailConfig, handleOpen, handleClick, handleBounce, getLocalTrackingEvents } from '../services/emailService.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.get('/config', (req, res) => {
  const config = getEmailConfig();
  res.json(config);
});

router.post('/send', async (req, res) => {
  try {
    const { to_email, subject, html_content, placeholders, lead_sequence_id, step_id } = req.body;
    const tracking = await sendEmail(to_email, subject, html_content, placeholders, lead_sequence_id, step_id);
    res.json({ success: true, message: 'Email sent successfully', tracking });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email',
      error: error.message 
    });
  }
});

router.post('/test', async (req, res) => {
  try {
    await verifyEmailConfig();
    res.json({ success: true, message: 'Email configuration is valid' });
  } catch (error) {
    console.error('Email configuration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Invalid email configuration',
      error: error.message 
    });
  }
});

// Tracking endpoints
router.get('/open/:trackingId', async (req, res) => {
  try {
    const trackingId = req.params.trackingId;
    console.log(`==== EMAIL OPEN REQUEST ====`);
    console.log(`Received email open tracking request for ID: ${trackingId}`);
    console.log(`Request headers:`, req.headers);
    console.log(`Request IP: ${req.ip}`);
    console.log(`Request path: ${req.path}`);
    console.log(`Request query:`, req.query);
    console.log(`==== END EMAIL OPEN REQUEST ====`);
    
    await handleOpen(trackingId);
    
    // Return a 1x1 transparent GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(pixel);
    console.log(`Successfully served tracking pixel for ID: ${trackingId}`);
  } catch (error) {
    console.error('Error tracking open:', error);
    // Still return a pixel to avoid breaking the email client
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length
    });
    res.end(pixel);
  }
});

router.get('/click/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;

    console.log(`==== EMAIL CLICK REQUEST ====`);
    console.log(`Received link click tracking request for ID: ${trackingId}, URL: ${url}`);
    console.log(`User agent: ${userAgent}, IP: ${ipAddress}`);
    console.log(`Request headers:`, req.headers);
    console.log(`Request path: ${req.path}`);
    console.log(`Request query:`, req.query);
    console.log(`==== END EMAIL CLICK REQUEST ====`);

    await handleClick(trackingId, url, userAgent, ipAddress);
    
    const decodedUrl = decodeURIComponent(url);
    console.log(`Redirecting to: ${decodedUrl}`);
    res.redirect(decodedUrl);
  } catch (error) {
    console.error('Error tracking click:', error);
    // Still redirect to avoid breaking the user experience
    if (req.query.url) {
      res.redirect(decodeURIComponent(req.query.url));
    } else {
      res.status(500).json({ error: 'Failed to track click and no URL provided' });
    }
  }
});

router.post('/bounce', async (req, res) => {
  try {
    const { trackingId, reason } = req.body;
    await handleBounce(trackingId, reason);
    res.json({ success: true });
  } catch (error) {
    console.error('Error handling bounce:', error);
    res.status(500).json({ error: 'Failed to handle bounce' });
  }
});

// Add a new endpoint to get tracking data
router.get('/tracking/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    console.log(`Retrieving tracking data for ID: ${trackingId}`);
    
    let dbTracking = null;
    let dbClicks = [];
    
    // If it's not a local tracking ID, try to get data from the database
    if (!trackingId.startsWith('local-')) {
      // Get tracking data from database
      const { data: tracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('tracking_id', trackingId)
        .single();
      
      if (trackingError) {
        console.error('Error retrieving tracking data:', trackingError);
      } else {
        dbTracking = tracking;
        
        // Get click data from database
        const { data: clicks, error: clicksError } = await supabase
          .from('email_link_clicks')
          .select('*')
          .eq('email_tracking_id', trackingId);
        
        if (clicksError) {
          console.error('Error retrieving click data:', clicksError);
        } else {
          dbClicks = clicks;
        }
      }
    }
    
    // Get in-memory tracking data
    const localOpens = getLocalTrackingEvents('open', trackingId);
    const localClicks = getLocalTrackingEvents('click', trackingId);
    
    res.json({
      trackingId,
      database: {
        tracking: dbTracking,
        clicks: dbClicks
      },
      inMemory: {
        opens: localOpens,
        clicks: localClicks
      }
    });
  } catch (error) {
    console.error('Error retrieving tracking data:', error);
    res.status(500).json({ error: 'Failed to retrieve tracking data' });
  }
});

// Add a test endpoint for tracking domain check
router.head('/test-tracking', (req, res) => {
  res.status(200).end();
});

router.get('/test-tracking', (req, res) => {
  res.status(200).json({ success: true, message: 'Tracking domain is accessible' });
});

export default router;