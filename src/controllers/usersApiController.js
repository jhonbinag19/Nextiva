const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

const proxyUsersSms = async (req, res, extraPath = '') => {
  try {
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }

    const path = `/users/api/sms${extraPath ? `/${extraPath}` : ''}`;
    const url = `${baseUrl}${path}`;

    const method = (req.method || 'GET').toLowerCase();
    const axiosConfig = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      params: req.query,
      timeout: config.api.thrio.timeout
    };

    if (!['get', 'head'].includes(method)) {
      axiosConfig.data = req.body;
    }

    const response = await axios(axiosConfig);
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
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }

    const path = `/workflows/api/webform${extraPath ? `/${extraPath}` : ''}`;
    const url = `${baseUrl}${path}`;

    const method = (req.method || 'GET').toLowerCase();
    const axiosConfig = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      params: req.query,
      timeout: config.api.thrio.timeout
    };

    if (!['get', 'head'].includes(method)) {
      axiosConfig.data = req.body;
    }

    const response = await axios(axiosConfig);
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
