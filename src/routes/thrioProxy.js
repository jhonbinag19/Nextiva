const express = require('express');
const { thrioProxy } = require('../middleware/thrioProxy');
const { logger } = require('../utils/logger');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

/**
 * Thrio Proxy Routes
 * These routes act as a tunnel between the frontend and Thrio API
 * All requests are authenticated and proxied through our middleware
 */

/**
 * Initialize Thrio connection with credentials
 * POST /api/thrio-proxy/init
 */
router.post('/init', authenticate, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }
    
    // Set credentials in proxy
    thrioProxy.setCredentials(username, password);
    
    // Authenticate to get initial token
    const authResult = await thrioProxy.authenticate();
    
    logger.info('Thrio proxy initialized for user:', req.user?.id);
    
    res.json({
      success: true,
      message: 'Thrio proxy initialized successfully',
      data: {
        clientLocation: authResult.clientLocation,
        location: authResult.location,
        expiresIn: authResult.expiresIn
      }
    });
    
  } catch (error) {
    logger.error('Thrio proxy init failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize Thrio connection',
      details: error.message
    });
  }
});

/**
 * Get Thrio connection status
 * GET /api/thrio-proxy/status
 */
router.get('/status', authenticate, (req, res) => {
  try {
    const status = thrioProxy.getStatus();
    
    res.json({
      success: true,
      data: {
        connected: status.hasCredentials && status.hasToken,
        tokenValid: status.tokenValid,
        tokenExpiry: status.tokenExpiry,
        baseURL: status.baseURL
      }
    });
    
  } catch (error) {
    logger.error('Thrio status check failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get Thrio status'
    });
  }
});

/**
 * Proxy GET requests to Thrio API
 * GET /api/thrio-proxy/get/*
 */
router.get('/get/*', authenticate, async (req, res) => {
  try {
    const endpoint = req.params[0]; // Get the wildcard path
    const params = req.query;
    
    logger.debug('Proxying GET request to Thrio:', endpoint);
    
    const data = await thrioProxy.get(endpoint, params);
    
    res.json({
      success: true,
      data: data
    });
    
  } catch (error) {
    logger.error('Thrio GET proxy failed:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Thrio API request failed',
      details: error.message
    });
  }
});

/**
 * Proxy POST requests to Thrio API
 * POST /api/thrio-proxy/post/*
 */
router.post('/post/*', authenticate, async (req, res) => {
  try {
    const endpoint = req.params[0];
    const data = req.body;
    
    logger.debug('Proxying POST request to Thrio:', endpoint);
    
    const result = await thrioProxy.post(endpoint, data);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Thrio POST proxy failed:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Thrio API request failed',
      details: error.message
    });
  }
});

/**
 * Proxy PUT requests to Thrio API
 * PUT /api/thrio-proxy/put/*
 */
router.put('/put/*', authenticate, async (req, res) => {
  try {
    const endpoint = req.params[0];
    const data = req.body;
    
    logger.debug('Proxying PUT request to Thrio:', endpoint);
    
    const result = await thrioProxy.put(endpoint, data);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Thrio PUT proxy failed:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Thrio API request failed',
      details: error.message
    });
  }
});

/**
 * Proxy DELETE requests to Thrio API
 * DELETE /api/thrio-proxy/delete/*
 */
router.delete('/delete/*', authenticate, async (req, res) => {
  try {
    const endpoint = req.params[0];
    
    logger.debug('Proxying DELETE request to Thrio:', endpoint);
    
    const result = await thrioProxy.delete(endpoint);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Thrio DELETE proxy failed:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Thrio API request failed',
      details: error.message
    });
  }
});

/**
 * Generic proxy route for any HTTP method
 * ALL /api/thrio-proxy/request
 */
router.all('/request', authenticate, async (req, res) => {
  try {
    const { method, endpoint, data, params } = req.body;
    
    if (!method || !endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Method and endpoint are required'
      });
    }
    
    logger.debug(`Proxying ${method.toUpperCase()} request to Thrio:`, endpoint);
    
    let result;
    const requestData = method.toLowerCase() === 'get' ? params : data;
    
    switch (method.toLowerCase()) {
      case 'get':
        result = await thrioProxy.get(endpoint, requestData);
        break;
      case 'post':
        result = await thrioProxy.post(endpoint, requestData);
        break;
      case 'put':
        result = await thrioProxy.put(endpoint, requestData);
        break;
      case 'delete':
        result = await thrioProxy.delete(endpoint);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported HTTP method: ${method}`
        });
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Thrio generic proxy failed:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Thrio API request failed',
      details: error.message
    });
  }
});

/**
 * Health check for Thrio proxy
 * GET /api/thrio-proxy/health
 */
router.get('/health', (req, res) => {
  const status = thrioProxy.getStatus();
  
  res.json({
    success: true,
    message: 'Thrio proxy is running',
    data: {
      proxyActive: true,
      hasCredentials: status.hasCredentials,
      tokenValid: status.tokenValid,
      uptime: process.uptime()
    }
  });
});

module.exports = router;