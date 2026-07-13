// Define a global error handling middleware
// In Express, an error handler MUST have exactly these 4 parameters (err, req, res, next)
// If you omit 'next', Express will treat it as a regular middleware and errors will bypass it
const errorHandler = (err, req, res, next) => {
  // Log the error message to the server console for debugging purposes
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Determine the appropriate HTTP status code. 
  // Default to 500 (Internal Server Error) if the error object doesn't specify one.
  const statusCode = err.statusCode || 500;
  
  // Determine the error message to send back to the client
  const message = err.message || 'Internal Server Error';

  // Send a structured JSON error response to the client
  res.status(statusCode).json({
    error: message,
    path: req.path,
    // Include a timestamp so the client knows exactly when the error occurred
    timestamp: new Date().toISOString(),
  });
};

// Export the error handler to be used as the LAST middleware in app.js
module.exports = errorHandler;