// Define a middleware function that takes request (req), response (res), and the next function in the chain
const requestLogger = (req, res, next) => {
  // Record the exact time the request arrived at the server
  const startTime = Date.now();

  // Listen for the 'finish' event on the response object, which triggers when the response is fully sent back to the client
  res.on('finish', () => {
    // Calculate how long the request took by subtracting the start time from the current time
    const duration = Date.now() - startTime;
    
    // Retrieve the 'content-length' header from the response to know the payload size, default to '-' if not present
    const bodySize = res.getHeader('content-length') || '-';
    
    // Print a formatted log string containing timestamp, HTTP method, URL path, status code, duration, and payload size
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms) | ${bodySize} bytes`
    );
  });

  // Call the next() function to pass control to the next middleware or route handler; otherwise, the request will hang
  next();
};

// Export the middleware function so it can be imported and used in the main app.js file
module.exports = requestLogger;