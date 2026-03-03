const logger = require('../utils/logger');
const { createThrioClient } = require('../services/thrioService');

const proxyUsersSms = async (req, res, extraPath = '') => {
  try {
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }

    const client = createThrioClient(token, req.user?.thrioClientLocation, req.user?.thrioBaseUrl);
    const path = `/users/api/sms${extraPath ? `/${extraPath}` : ''}`;
    const method = (req.method || 'GET').toLowerCase();

    // Strip auth-only fields before forwarding to Thrio
    let body = req.body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const { locationId, ghlLocationId, ...rest } = body;
      body = rest;
    }

    const axiosConfig = { method, url: path, params: req.query };
    if (!['get', 'head'].includes(method)) {
      axiosConfig.data = body;
    }

    const response = await client(axiosConfig);
    res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('Users SMS proxy request failed', { message: error.message, status: error.response?.status });
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Users SMS proxy failed',
      data: error.response?.data
    });
  }
};

const usersSmsRoot = async (req, res) => {
  return proxyUsersSms(req, res, '');
};

const usersSmsWildcard = async (req, res) => {
  const extra = req.params[0] || '';
  return proxyUsersSms(req, res, extra);
};

const proxyWorkflowsWebform = async (req, res, extraPath = '') => {
  try {
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }

    const client = createThrioClient(token, req.user?.thrioClientLocation, req.user?.thrioBaseUrl);
    const path = `/workflows/api/webform${extraPath ? `/${extraPath}` : ''}`;
    const method = (req.method || 'GET').toLowerCase();

    // Strip auth-only fields before forwarding to Thrio
    let body = req.body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const { locationId, ghlLocationId, ...rest } = body;
      body = rest;
    }

    const axiosConfig = { method, url: path, params: req.query };
    if (!['get', 'head'].includes(method)) {
      axiosConfig.data = body;
    }

    const response = await client(axiosConfig);
    res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('Workflows webform proxy request failed', { message: error.message, status: error.response?.status });
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Workflows webform proxy failed',
      data: error.response?.data
    });
  }
};

const workflowsWebformRoot = async (req, res) => {
  return proxyWorkflowsWebform(req, res, '');
};

const workflowsWebformWildcard = async (req, res) => {
  const extra = req.params[0] || '';
  return proxyWorkflowsWebform(req, res, extra);
};

module.exports = {
  usersSmsRoot,
  usersSmsWildcard,
  workflowsWebformRoot,
  workflowsWebformWildcard
};
