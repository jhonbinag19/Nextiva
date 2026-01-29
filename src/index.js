const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const corsConfig = require('./config/corsConfig');
const routes = require('./routes');
const outboundListRoutes = require('./routes/outboundListRoutes');
const logger = require('./utils/logger');
const config = require('./config/config');

// Environment variables are loaded in config module

// Create Express app
const app = express();
const PORT = config.port;

// Apply middleware
app.use(helmet()); // Security headers
app.use(cors(corsConfig)); // CORS configuration
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // HTTP request logging

// Apply routes
app.use('/api', routes);
app.use('/', outboundListRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be after routes)
app.use(errorHandler);

// Start server only in non-serverless environments (local development)
// In serverless environments like Vercel, the server is started automatically
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  });
} else {
  logger.info(`Server running in serverless mode (Vercel)`); 
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Don't crash the server in production
  if (config.nodeEnv === 'development') {
    process.exit(1);
  }
});

module.exports = app;
