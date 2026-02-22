const axios = require('axios');
const logger = require('../utils/logger');
const { createApiError } = require('../utils/errorUtils');

// Base URL for Nextiva API
const NEXTIVA_API_BASE_URL = process.env.NEXTIVA_API_BASE_URL || 'https://api.thrio.com';

/**
 * Refresh Thrio access token using refresh token
 * @returns {Promise<Object>} Refresh result
 */
const refreshThrioToken = async () => {
  try {
    const refreshToken = process.env.THRIO_REFRESH_TOKEN;
    const username = process.env.THRIO_USERNAME;
    const password = process.env.THRIO_PASSWORD;
    
    if (!refreshToken && !username) {
      throw new Error('No refresh token or username available for token refresh');
    }
    
    // If we have username/password, re-authenticate
    if (username && password) {
      // Import the authentication function from authController
      const { authenticateWithThrio } = require('../controllers/authController');
      const result = await authenticateWithThrio(username, password);
      
      if (result.success) {
        process.env.THRIO_ACCESS_TOKEN = result.accessToken;
        if (result.refreshToken) {
          process.env.THRIO_REFRESH_TOKEN = result.refreshToken;
        }
        logger.info('Thrio token refreshed successfully using username/password');
        return { success: true, accessToken: result.accessToken };
      }
      
      throw new Error('Failed to refresh token using username/password');
    }
    
    // If we only have refresh token, use it (implementation depends on Thrio API)
    // This is a placeholder - implement based on Thrio's refresh token endpoint
    logger.warn('Refresh token only flow not implemented yet');
    throw new Error('Refresh token only flow not implemented');
    
  } catch (error) {
    logger.error('Failed to refresh Thrio token:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get Thrio access token from environment or provided credentials
 * @param {string} apiKey - Optional API key (fallback to environment token)
 * @returns {string} Access token
 */
const getThrioAccessToken = (apiKey) => {
  // Priority: provided apiKey > environment token > throw error
  if (apiKey) {
    return apiKey;
  }
  
  const envToken = process.env.THRIO_ACCESS_TOKEN;
  if (envToken) {
    return envToken;
  }
  
  throw new Error('No Thrio access token available. Please provide apiKey or set THRIO_ACCESS_TOKEN environment variable.');
};

/**
 * Create axios instance for Nextiva API
 * @param {string} apiKey - API key for authentication (optional, will use environment token if not provided)
 * @returns {Object} Axios instance
 */
const createApiClient = (apiKey) => {
  const accessToken = getThrioAccessToken(apiKey);
  
  return axios.create({
    baseURL: NEXTIVA_API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    },
    timeout: 30000 // 30 seconds timeout
  });
};

/**
 * Handle API errors with automatic token refresh on 401
 * @param {Error} error - Axios error object
 * @param {Function} retryFunction - Function to retry the original request
 * @returns {Object} Standardized error response
 */
const handleApiError = async (error, retryFunction) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    
    // Handle 401 Unauthorized - attempt to refresh token and retry
    if (error.response.status === 401 && retryFunction) {
      logger.info('Received 401 error, attempting to refresh Thrio token');
      
      const refreshResult = await refreshThrioToken();
      if (refreshResult.success) {
        logger.info('Token refreshed successfully, retrying original request');
        // Retry the original request with new token
        try {
          return await retryFunction();
        } catch (retryError) {
          logger.error('Retry after token refresh failed:', retryError.message);
          // Fall through to normal error handling
        }
      } else {
        logger.error('Failed to refresh token:', refreshResult.error);
      }
    }
    
    logger.error('Nextiva API error response:', {
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers
    });
    
    return {
      success: false,
      statusCode: error.response.status,
      message: error.response.data.message || 'Nextiva API error',
      errors: error.response.data.errors || []
    };
  } else if (error.request) {
    // The request was made but no response was received
    logger.error('Nextiva API no response:', { request: error.request });
    
    return {
      success: false,
      statusCode: 503,
      message: 'No response from Nextiva API',
      errors: ['Service unavailable']
    };
  } else {
    // Something happened in setting up the request that triggered an Error
    logger.error('Nextiva API request error:', { message: error.message });
    
    return {
      success: false,
      statusCode: 500,
      message: 'Error setting up request to Nextiva API',
      errors: [error.message]
    };
  }
};

/**
 * Nextiva CRM Service
 */
const nextivaCrmService = {
  /**
   * Get all leads
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  getLeads: async ({ apiKey, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' }) => {
    const makeRequest = async () => {
      const client = createApiClient(apiKey);
      const response = await client.get('/leads', {
        params: {
          page,
          limit,
          sortBy,
          sortOrder
        }
      });
      
      return {
        success: true,
        leads: response.data.data,
        pagination: response.data.pagination
      };
    };
    
    try {
      return await makeRequest();
    } catch (error) {
      return await handleApiError(error, makeRequest);
    }
  },
  
  /**
   * Get lead by ID
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  getLeadById: async ({ apiKey, leadId }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.get(`/leads/${leadId}`);
      
      return {
        success: true,
        lead: response.data.data
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Create a new lead
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  createLead: async ({ apiKey, leadData }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.post('/leads', leadData);
      
      return {
        success: true,
        lead: response.data.data,
        message: 'Lead created successfully'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Update a lead
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  updateLead: async ({ apiKey, leadId, leadData }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.put(`/leads/${leadId}`, leadData);
      
      return {
        success: true,
        lead: response.data.data,
        message: 'Lead updated successfully'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Delete a lead
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  deleteLead: async ({ apiKey, leadId }) => {
    try {
      const client = createApiClient(apiKey);
      await client.delete(`/leads/${leadId}`);
      
      return {
        success: true,
        message: 'Lead deleted successfully'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Search leads by criteria
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  searchLeads: async ({ apiKey, searchCriteria, page = 1, limit = 20 }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.post('/leads/search', searchCriteria, {
        params: { page, limit }
      });
      
      return {
        success: true,
        leads: response.data.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Bulk create leads
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  bulkCreateLeads: async ({ apiKey, leads }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.post('/leads/bulk', { leads });
      
      return {
        success: true,
        leads: response.data.data,
        message: 'Leads created successfully',
        failedLeads: response.data.failedLeads || []
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Bulk update leads
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  bulkUpdateLeads: async ({ apiKey, leads }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.put('/leads/bulk', { leads });
      
      return {
        success: true,
        leads: response.data.data,
        message: 'Leads updated successfully',
        failedLeads: response.data.failedLeads || []
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Get all lists
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  getLists: async ({ apiKey, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.get('/lists', {
        params: {
          page,
          limit,
          sortBy,
          sortOrder
        }
      });
      
      return {
        success: true,
        lists: response.data.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Get list by ID
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  getListById: async ({ apiKey, listId }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.get(`/lists/${listId}`);
      
      return {
        success: true,
        list: response.data.data
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Create a new list
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  createList: async ({ apiKey, listData }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.post('/lists', listData);
      
      return {
        success: true,
        list: response.data.data,
        message: 'List created successfully'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Update a list
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  updateList: async ({ apiKey, listId, listData }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.put(`/lists/${listId}`, listData);
      
      return {
        success: true,
        list: response.data.data,
        message: 'List updated successfully'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Delete a list
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  deleteList: async ({ apiKey, listId }) => {
    try {
      const client = createApiClient(apiKey);
      await client.delete(`/lists/${listId}`);
      
      return {
        success: true,
        message: 'List deleted successfully'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Get all leads in a list
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  getListLeads: async ({ apiKey, listId, page = 1, limit = 20 }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.get(`/lists/${listId}/leads`, {
        params: { page, limit }
      });
      
      return {
        success: true,
        leads: response.data.data,
        pagination: response.data.pagination
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Add leads to a list
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  addLeadsToList: async ({ apiKey, listId, leadIds }) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.post(`/lists/${listId}/leads`, { leadIds });
      
      return {
        success: true,
        message: 'Leads added to list successfully',
        addedLeads: response.data.addedLeads || [],
        failedLeads: response.data.failedLeads || []
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Remove a lead from a list
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  removeLeadFromList: async ({ apiKey, listId, leadId }) => {
    try {
      const client = createApiClient(apiKey);
      await client.delete(`/lists/${listId}/leads/${leadId}`);
      
      return {
        success: true,
        message: 'Lead removed from list successfully'
      };
    } catch (error) {
      return handleApiError(error);
    }
  }
};

module.exports = {
  nextivaCrmService
};
