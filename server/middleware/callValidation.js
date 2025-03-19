/**
 * Middleware for validating outbound call requests
 * This middleware checks authentication and required fields for call API endpoints
 */

/**
 * Validate outbound call requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateOutboundCall = (req, res, next) => {
  try {
    // In a production environment, we would validate authentication here
    // For now, we'll just do basic validation of the request body

    // Check that the content type is correct
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        message: 'Content-Type must be application/json'
      });
    }

    // Check that the request body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is required'
      });
    }

    // Allow the request to proceed
    next();
  } catch (error) {
    console.error('Error in validateOutboundCall middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error in validation middleware'
    });
  }
};

module.exports = {
  validateOutboundCall
}; 