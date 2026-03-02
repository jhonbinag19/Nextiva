const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Create a pre-configured axios client for the Thrio API.
 * Mirrors the createApiClient pattern used for GoHighLevel.
 *
 * @param {string} token          - Thrio Bearer access token
 * @param {string} [clientLocation] - Optional clientLocation from auth response
 * @param {string} [baseUrl]      - Override base URL (defaults to config)
 * @returns {import('axios').AxiosInstance}
 */
const createThrioClient = (token, clientLocation = null, baseUrl = null) => {
  if (!token) {
    throw new Error('Thrio access token is required');
  }

  const resolvedBase = baseUrl || config.api.thrio.baseUrl;

  const headers = {
    Authorization: token,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  // Note: clientLocation is preserved for reference but not sent as a header.
  // Thrio docs only require Authorization: Bearer <token>.

  const client = axios.create({
    baseURL: resolvedBase,
    headers,
    timeout: config.api.thrio.timeout || 30000
  });

  client.interceptors.request.use(request => {
    logger.debug('Thrio request:', {
      method: request.method?.toUpperCase(),
      url: request.baseURL + request.url
    });
    return request;
  });

  client.interceptors.response.use(
    response => {
      logger.debug('Thrio response:', { status: response.status, url: response.config?.url });
      return response;
    },
    error => {
      logger.error('Thrio API error:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      });
      throw error;
    }
  );

  return client;
};

module.exports = { createThrioClient };
