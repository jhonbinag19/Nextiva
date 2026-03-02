/**
 * CORS configuration options
 */
const config = require('./config');

const corsOptions = {
  // Allow requests from any origin in development
  // In production, this should be restricted to specific domains
  origin: config.nodeEnv === 'production'
    ? config.cors.allowedOrigins || ['https://app.gohighlevel.com']
    : '*',
  
  // Allow these HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Allow these headers in requests
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  
  // Allow credentials (cookies, authorization headers, etc.)
  credentials: true,
  
  // Cache preflight requests for 1 hour (3600 seconds)
  maxAge: 3600,
  
  // Expose these headers to the client
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining']
};

module.exports = corsOptions;