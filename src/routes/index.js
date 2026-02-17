const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const leadRoutes = require('./leadRoutes');
const listRoutes = require('./listRoutes');
const usersApiRoutes = require('./usersApiRoutes');
const thrioProxyRoutes = require('./thrioProxy');
const outboundListRoutes = require('./outboundListRoutes');
const workflowsRoutes = require('./workflowsRoutes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/lists', listRoutes);
router.use('/', usersApiRoutes);
router.use('/thrio-proxy', thrioProxyRoutes);
router.use('/', outboundListRoutes);
router.use('/', workflowsRoutes);

module.exports = router;
