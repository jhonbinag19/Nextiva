const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config/config');

/**
 * Thrio Proxy Middleware
 * Handles all Thrio API connections through a centralized proxy/interceptor
 * Provides connection pooling, token management, and error handling
 */
class ThrioProxy {
  constructor() {
    this.baseURL = config.api.thrio.baseUrl;
    this.tokenEndpoint = config.api.thrio.tokenEndpoint;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.credentials = null;
    
    // Create axios instance with interceptors
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.api.thrio.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Setup request interceptor
    this.client.interceptors.request.use(
      (config) => this.handleRequest(config),
      (error) => Promise.reject(error)
    );
    
    // Setup response interceptor
    this.client.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );
    
    logger.info('Thrio Proxy initialized');
  }
  
  /**
   * Set authentication credentials
   * @param {string} username - Thrio username
   * @param {string} password - Thrio password
   */
  setCredentials(username, password) {
    this.credentials = { username, password };
    logger.info('Thrio credentials set for user:', username?.substring(0, 3) + '***');
  }
  
  /**
   * Check if token is valid and not expired
   * @returns {boolean} Token validity
   */
  isTokenValid() {
    if (!this.accessToken) return false;
    if (!this.tokenExpiry) return true; // Assume valid if no expiry set
    
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 minute buffer
    return now < (this.tokenExpiry - buffer);
  }
  
  /**
   * Authenticate with Thrio and get access token
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate() {
    if (!this.credentials) {
      throw new Error('No Thrio credentials set. Call setCredentials() first.');
    }
    
    try {
      logger.info('Authenticating with Thrio API...');
      
      // Use Basic Auth for token endpoint as per Postman collection
      const auth = Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString('base64');
      
      const response = await axios.get(`${this.baseURL}${this.tokenEndpoint}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        },
        timeout: 30000
      });
      
      if (response.data && response.data.token) {
        this.accessToken = response.data.token;
        this.refreshToken = response.data.refreshToken;
        
        // Set token expiry (default to 1 hour if not provided)
        const expiresIn = response.data.expiresIn || 3600;
        this.tokenExpiry = Date.now() + (expiresIn * 1000);
        
        logger.info('Thrio authentication successful');
        
        return {
          success: true,
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresIn: expiresIn,
          clientLocation: response.data.clientLocation,
          location: response.data.location
        };
      }
      
      throw new Error('Invalid response from Thrio authentication');
      
    } catch (error) {
      logger.error('Thrio authentication failed:', error.message);
      
      // Reset tokens on auth failure
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      
      throw new Error(`Thrio authentication failed: ${error.message}`);
    }
  }
  
  /**
   * Request interceptor - adds authentication and handles token refresh
   * @param {Object} config - Axios request config
   * @returns {Object} Modified request config
   */
  async handleRequest(config) {
    // Skip auth for token endpoint
    if (config.url?.includes(this.tokenEndpoint)) {
      return config;
    }
    
    // Ensure we have a valid token
    if (!this.isTokenValid()) {
      await this.authenticate();
    }
    
    // Add authorization header
    if (this.accessToken) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }
    
    // Add request ID for tracking
    config.headers['X-Request-ID'] = `thrio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('Thrio request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      hasAuth: !!config.headers.Authorization
    });
    
    return config;
  }
  
  /**
   * Response interceptor - handles successful responses
   * @param {Object} response - Axios response
   * @returns {Object} Response data
   */
  handleResponse(response) {
    logger.debug('Thrio response:', {
      status: response.status,
      url: response.config?.url,
      requestId: response.config?.headers['X-Request-ID']
    });
    
    return response;
  }
  
  /**
   * Error interceptor - handles authentication errors and retries
   * @param {Object} error - Axios error
   * @returns {Promise} Rejected promise or retry
   */
  async handleError(error) {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      logger.warn('Thrio 401 error, attempting token refresh...');
      
      try {
        // Clear current token and re-authenticate
        this.accessToken = null;
        await this.authenticate();
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
        return this.client(originalRequest);
        
      } catch (authError) {
        logger.error('Token refresh failed:', authError.message);
        throw new Error('Thrio authentication failed after retry');
      }
    }
    
    // Handle other errors
    logger.error('Thrio API error:', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url
    });
    
    throw error;
  }
  
  /**
   * Make a proxied request to Thrio API
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint (relative to base URL)
   * @param {Object} data - Request data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async request(method, endpoint, data = null, options = {}) {
    try {
      const config = {
        method: method.toLowerCase(),
        url: endpoint,
        ...options
      };
      
      if (data && ['post', 'put', 'patch'].includes(config.method)) {
        config.data = data;
      } else if (data && config.method === 'get') {
        config.params = data;
      }
      
      const response = await this.client(config);
      return response.data;
      
    } catch (error) {
      logger.error(`Thrio ${method} ${endpoint} failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * GET request through proxy
   */
  async get(endpoint, params = null, options = {}) {
    return this.request('GET', endpoint, params, options);
  }
  
  /**
   * POST request through proxy
   */
  async post(endpoint, data = null, options = {}) {
    return this.request('POST', endpoint, data, options);
  }
  
  /**
   * PUT request through proxy
   */
  async put(endpoint, data = null, options = {}) {
    return this.request('PUT', endpoint, data, options);
  }
  
  /**
   * DELETE request through proxy
   */
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, null, options);
  }
  
  /**
   * Get current connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      hasCredentials: !!this.credentials,
      hasToken: !!this.accessToken,
      tokenValid: this.isTokenValid(),
      tokenExpiry: this.tokenExpiry,
      baseURL: this.baseURL
    };
  }
}

// Create singleton instance
const thrioProxy = new ThrioProxy();

module.exports = {
  ThrioProxy,
  thrioProxy
};