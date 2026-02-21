const express = require('express');
const axios = require('axios');
const { thrioProxy } = require('../middleware/thrioProxy');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/authenticate');
const config = require('../config/config');

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
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing Thrio access token' });
    }

    const url = `${baseUrl}/${String(endpoint || '').replace(/^\/+/, '')}`;
    const response = await axios.get(url, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });

    res.status(response.status || 200).json({ success: true, data: response.data });
    
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
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing Thrio access token' });
    }

    const url = `${baseUrl}/${String(endpoint || '').replace(/^\/+/, '')}`;
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });

    res.status(response.status || 200).json({ success: true, data: response.data });
    
  } catch (error) {
    if (logger && logger.error) {
      logger.error('Thrio POST proxy failed:', error.message);
    } else {
      console.error('Thrio POST proxy failed:', error.message);
    }
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
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing Thrio access token' });
    }

    const url = `${baseUrl}/${String(endpoint || '').replace(/^\/+/, '')}`;
    const response = await axios.put(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });

    res.status(response.status || 200).json({ success: true, data: response.data });
    
  } catch (error) {
    if (logger && logger.error) {
      logger.error('Thrio PUT proxy failed:', error.message);
    } else {
      console.error('Thrio PUT proxy failed:', error.message);
    }
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
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing Thrio access token' });
    }

    const url = `${baseUrl}/${String(endpoint || '').replace(/^\/+/, '')}`;
    const response = await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });

    res.status(response.status || 200).json({ success: true, data: response.data });
    
  } catch (error) {
    if (logger && logger.error) {
      logger.error('Thrio DELETE proxy failed:', error.message);
    } else {
      console.error('Thrio DELETE proxy failed:', error.message);
    }
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
    
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing Thrio access token' });
    }

    const url = `${baseUrl}/${String(endpoint || '').replace(/^\/+/, '')}`;
    const lower = String(method).toLowerCase();

    let response;
    if (lower === 'get') {
      response = await axios.get(url, {
        params: params || {},
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        timeout: config.api.nextiva.timeout
      });
    } else if (lower === 'post') {
      response = await axios.post(url, data || {}, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: config.api.nextiva.timeout
      });
    } else if (lower === 'put') {
      response = await axios.put(url, data || {}, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: config.api.nextiva.timeout
      });
    } else if (lower === 'delete') {
      response = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        timeout: config.api.nextiva.timeout
      });
    } else {
      return res.status(400).json({ success: false, error: `Unsupported HTTP method: ${method}` });
    }

    res.status(response.status || 200).json({ success: true, data: response.data });
    
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
