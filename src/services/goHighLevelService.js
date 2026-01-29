const axios = require('axios');
const logger = require('../utils/logger');

// Base URL for GoHighLevel API
const GHL_API_BASE_URL = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';

/**
 * Create axios instance for GoHighLevel API
 * @param {string} apiKey - API key for authentication
 * @returns {Object} Axios instance
 */
const createApiClient = (apiKey) => {
  return axios.create({
    baseURL: GHL_API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Version': '2021-07-28'
    },
    timeout: 30000 // 30 seconds timeout
  });
};

/**
 * Handle API errors
 * @param {Error} error - Axios error object
 * @returns {Object} Standardized error response
 */
const handleApiError = (error) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    logger.error('GoHighLevel API error response:', {
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers
    });
    
    return {
      success: false,
      statusCode: error.response.status,
      message: error.response.data.message || 'GoHighLevel API error',
      errors: error.response.data.errors || []
    };
  } else if (error.request) {
    // The request was made but no response was received
    logger.error('GoHighLevel API no response:', { request: error.request });
    
    return {
      success: false,
      statusCode: 503,
      message: 'No response from GoHighLevel API',
      errors: ['Service unavailable']
    };
  } else {
    // Something happened in setting up the request that triggered an Error
    logger.error('GoHighLevel API request error:', { message: error.message });
    
    return {
      success: false,
      statusCode: 500,
      message: 'Error setting up request to GoHighLevel API',
      errors: [error.message]
    };
  }
};

/**
 * Map Nextiva lead data to GoHighLevel contact format
 * @param {Object} leadData - Nextiva lead data
 * @returns {Object} GoHighLevel contact data
 */
const mapLeadToContact = (leadData) => {
  return {
    firstName: leadData.firstName,
    lastName: leadData.lastName,
    email: leadData.email,
    phone: leadData.phone,
    source: leadData.source,
    tags: leadData.tags || [],
    customFields: leadData.customFields || {},
    // Add any additional mapping as needed
  };
};

/**
 * Map Nextiva list data to GoHighLevel tag format
 * @param {Object} listData - Nextiva list data
 * @returns {Object} GoHighLevel tag data
 */
const mapListToTag = (listData) => {
  return {
    name: listData.name,
    description: listData.description || '',
    color: listData.color || '#3498db'
  };
};

/**
 * GoHighLevel Service
 */
const goHighLevelService = {
  /**
   * Validate API key with GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  validateApiKey: async (apiKey) => {
    try {
      const client = createApiClient(apiKey);
      const response = await client.get('/locations/me');
      
      return {
        success: true,
        userId: response.data.userId,
        locationId: response.data.id,
        locationName: response.data.name,
        companyId: response.data.companyId
      };
    } catch (error) {
      logger.error('Error validating GoHighLevel API key:', error);
      return { success: false };
    }
  },
  
  /**
   * Sync lead to GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  syncLead: async ({ apiKey, locationId, leadData }) => {
    try {
      const client = createApiClient(apiKey);
      const contactData = mapLeadToContact(leadData);
      
      // Check if contact exists by email or phone
      let existingContact = null;
      
      if (contactData.email) {
        const searchResponse = await client.get(`/contacts/lookup`, {
          params: {
            locationId,
            email: contactData.email
          }
        });
        
        if (searchResponse.data.contacts && searchResponse.data.contacts.length > 0) {
          existingContact = searchResponse.data.contacts[0];
        }
      }
      
      if (!existingContact && contactData.phone) {
        const searchResponse = await client.get(`/contacts/lookup`, {
          params: {
            locationId,
            phone: contactData.phone
          }
        });
        
        if (searchResponse.data.contacts && searchResponse.data.contacts.length > 0) {
          existingContact = searchResponse.data.contacts[0];
        }
      }
      
      let response;
      
      if (existingContact) {
        // Update existing contact
        response = await client.put(`/contacts/${existingContact.id}`, {
          ...contactData,
          locationId
        });
      } else {
        // Create new contact
        response = await client.post('/contacts', {
          ...contactData,
          locationId
        });
      }
      
      return {
        success: true,
        contact: response.data.contact,
        message: existingContact ? 'Contact updated in GoHighLevel' : 'Contact created in GoHighLevel'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Delete lead from GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  deleteLead: async ({ apiKey, locationId, leadId }) => {
    try {
      const client = createApiClient(apiKey);
      
      // First, find the contact in GoHighLevel by external ID (leadId)
      const searchResponse = await client.get(`/contacts`, {
        params: {
          locationId,
          query: leadId
        }
      });
      
      if (!searchResponse.data.contacts || searchResponse.data.contacts.length === 0) {
        return {
          success: false,
          message: 'Contact not found in GoHighLevel'
        };
      }
      
      const contactId = searchResponse.data.contacts[0].id;
      
      // Delete the contact
      await client.delete(`/contacts/${contactId}`, {
        params: { locationId }
      });
      
      return {
        success: true,
        message: 'Contact deleted from GoHighLevel'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Bulk sync leads to GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  bulkSyncLeads: async ({ apiKey, locationId, leads }) => {
    try {
      const client = createApiClient(apiKey);
      const contacts = leads.map(lead => ({
        ...mapLeadToContact(lead),
        locationId
      }));
      
      const response = await client.post('/contacts/bulk', {
        contacts,
        locationId
      });
      
      return {
        success: true,
        results: response.data.results,
        message: 'Contacts synced to GoHighLevel'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Sync list to GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  syncList: async ({ apiKey, locationId, listData }) => {
    try {
      const client = createApiClient(apiKey);
      const tagData = mapListToTag(listData);
      
      // Check if tag exists
      const tagsResponse = await client.get('/tags', {
        params: { locationId }
      });
      
      const existingTag = tagsResponse.data.tags.find(tag => tag.name === tagData.name);
      
      let response;
      
      if (existingTag) {
        // Update existing tag
        response = await client.put(`/tags/${existingTag.id}`, {
          ...tagData,
          locationId
        });
      } else {
        // Create new tag
        response = await client.post('/tags', {
          ...tagData,
          locationId
        });
      }
      
      return {
        success: true,
        tag: response.data.tag,
        message: existingTag ? 'Tag updated in GoHighLevel' : 'Tag created in GoHighLevel'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Delete list from GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  deleteList: async ({ apiKey, locationId, listId }) => {
    try {
      const client = createApiClient(apiKey);
      
      // First, get the list details to find the tag name
      const listResponse = await axios.get(`${process.env.NEXTIVA_API_BASE_URL}/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!listResponse.data.data) {
        return {
          success: false,
          message: 'List not found in Nextiva'
        };
      }
      
      const listName = listResponse.data.data.name;
      
      // Find the tag in GoHighLevel
      const tagsResponse = await client.get('/tags', {
        params: { locationId }
      });
      
      const existingTag = tagsResponse.data.tags.find(tag => tag.name === listName);
      
      if (!existingTag) {
        return {
          success: false,
          message: 'Tag not found in GoHighLevel'
        };
      }
      
      // Delete the tag
      await client.delete(`/tags/${existingTag.id}`, {
        params: { locationId }
      });
      
      return {
        success: true,
        message: 'Tag deleted from GoHighLevel'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Sync leads to a list in GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  syncLeadsToList: async ({ apiKey, locationId, listId, leadIds }) => {
    try {
      const client = createApiClient(apiKey);
      
      // First, get the list details to find the tag name
      const listResponse = await axios.get(`${process.env.NEXTIVA_API_BASE_URL}/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!listResponse.data.data) {
        return {
          success: false,
          message: 'List not found in Nextiva'
        };
      }
      
      const listName = listResponse.data.data.name;
      
      // Find the tag in GoHighLevel
      const tagsResponse = await client.get('/tags', {
        params: { locationId }
      });
      
      const existingTag = tagsResponse.data.tags.find(tag => tag.name === listName);
      
      if (!existingTag) {
        // Create the tag if it doesn't exist
        const createTagResponse = await client.post('/tags', {
          name: listName,
          locationId
        });
        
        existingTag = createTagResponse.data.tag;
      }
      
      // For each lead, find the contact in GoHighLevel and add the tag
      const results = [];
      
      for (const leadId of leadIds) {
        try {
          // Get lead details from Nextiva
          const leadResponse = await axios.get(`${process.env.NEXTIVA_API_BASE_URL}/leads/${leadId}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!leadResponse.data.data) {
            results.push({
              leadId,
              success: false,
              message: 'Lead not found in Nextiva'
            });
            continue;
          }
          
          const lead = leadResponse.data.data;
          
          // Find contact in GoHighLevel
          let contactId = null;
          
          if (lead.email) {
            const searchResponse = await client.get(`/contacts/lookup`, {
              params: {
                locationId,
                email: lead.email
              }
            });
            
            if (searchResponse.data.contacts && searchResponse.data.contacts.length > 0) {
              contactId = searchResponse.data.contacts[0].id;
            }
          }
          
          if (!contactId && lead.phone) {
            const searchResponse = await client.get(`/contacts/lookup`, {
              params: {
                locationId,
                phone: lead.phone
              }
            });
            
            if (searchResponse.data.contacts && searchResponse.data.contacts.length > 0) {
              contactId = searchResponse.data.contacts[0].id;
            }
          }
          
          if (!contactId) {
            // Create contact if not found
            const contactData = mapLeadToContact(lead);
            const createResponse = await client.post('/contacts', {
              ...contactData,
              locationId
            });
            
            contactId = createResponse.data.contact.id;
          }
          
          // Add tag to contact
          await client.post(`/contacts/${contactId}/tags`, {
            locationId,
            tagIds: [existingTag.id]
          });
          
          results.push({
            leadId,
            success: true,
            message: 'Lead added to tag in GoHighLevel'
          });
        } catch (error) {
          results.push({
            leadId,
            success: false,
            message: error.message || 'Error syncing lead to GoHighLevel'
          });
        }
      }
      
      return {
        success: true,
        results,
        message: 'Leads synced to list in GoHighLevel'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Remove a lead from a list in GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  removeLeadFromList: async ({ apiKey, locationId, listId, leadId }) => {
    try {
      const client = createApiClient(apiKey);
      
      // First, get the list details to find the tag name
      const listResponse = await axios.get(`${process.env.NEXTIVA_API_BASE_URL}/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!listResponse.data.data) {
        return {
          success: false,
          message: 'List not found in Nextiva'
        };
      }
      
      const listName = listResponse.data.data.name;
      
      // Find the tag in GoHighLevel
      const tagsResponse = await client.get('/tags', {
        params: { locationId }
      });
      
      const existingTag = tagsResponse.data.tags.find(tag => tag.name === listName);
      
      if (!existingTag) {
        return {
          success: false,
          message: 'Tag not found in GoHighLevel'
        };
      }
      
      // Get lead details from Nextiva
      const leadResponse = await axios.get(`${process.env.NEXTIVA_API_BASE_URL}/leads/${leadId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!leadResponse.data.data) {
        return {
          success: false,
          message: 'Lead not found in Nextiva'
        };
      }
      
      const lead = leadResponse.data.data;
      
      // Find contact in GoHighLevel
      let contactId = null;
      
      if (lead.email) {
        const searchResponse = await client.get(`/contacts/lookup`, {
          params: {
            locationId,
            email: lead.email
          }
        });
        
        if (searchResponse.data.contacts && searchResponse.data.contacts.length > 0) {
          contactId = searchResponse.data.contacts[0].id;
        }
      }
      
      if (!contactId && lead.phone) {
        const searchResponse = await client.get(`/contacts/lookup`, {
          params: {
            locationId,
            phone: lead.phone
          }
        });
        
        if (searchResponse.data.contacts && searchResponse.data.contacts.length > 0) {
          contactId = searchResponse.data.contacts[0].id;
        }
      }
      
      if (!contactId) {
        return {
          success: false,
          message: 'Contact not found in GoHighLevel'
        };
      }
      
      // Remove tag from contact
      await client.delete(`/contacts/${contactId}/tags/${existingTag.id}`, {
        params: { locationId }
      });
      
      return {
        success: true,
        message: 'Lead removed from tag in GoHighLevel'
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Sync list from Nextiva to GoHighLevel
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  syncListToGhl: async ({ apiKey, locationId, listData }) => {
    try {
      // First, sync the list as a tag
      const syncTagResponse = await goHighLevelService.syncList({ apiKey, locationId, listData });
      
      if (!syncTagResponse.success) {
        return syncTagResponse;
      }
      
      // Then, get all leads in the list and sync them to GoHighLevel
      const leadsResponse = await axios.get(`${process.env.NEXTIVA_API_BASE_URL}/lists/${listData.id}/leads`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 100 // Adjust as needed
        }
      });
      
      if (!leadsResponse.data.data || !Array.isArray(leadsResponse.data.data)) {
        return {
          success: true,
          message: 'List synced to GoHighLevel, but no leads found to sync',
          tag: syncTagResponse.tag
        };
      }
      
      const leads = leadsResponse.data.data;
      const leadIds = leads.map(lead => lead.id);
      
      // Sync leads to the list
      await goHighLevelService.syncLeadsToList({ apiKey, locationId, listId: listData.id, leadIds });
      
      return {
        success: true,
        message: `List and ${leads.length} leads synced to GoHighLevel`,
        tag: syncTagResponse.tag
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  /**
   * Sync list from GoHighLevel to Nextiva
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} Response data
   */
  syncListFromGhl: async ({ apiKey, locationId, listId }) => {
    try {
      const client = createApiClient(apiKey);
      
      // First, get the list details from Nextiva
      const listResponse = await axios.get(`${process.env.NEXTIVA_API_BASE_URL}/lists/${listId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!listResponse.data.data) {
        return {
          success: false,
          message: 'List not found in Nextiva'
        };
      }
      
      const listName = listResponse.data.data.name;
      
      // Find the tag in GoHighLevel
      const tagsResponse = await client.get('/tags', {
        params: { locationId }
      });
      
      const existingTag = tagsResponse.data.tags.find(tag => tag.name === listName);
      
      if (!existingTag) {
        return {
          success: false,
          message: 'Tag not found in GoHighLevel'
        };
      }
      
      // Get all contacts with this tag from GoHighLevel
      const contactsResponse = await client.get(`/contacts/tag/${existingTag.id}`, {
        params: { locationId }
      });
      
      if (!contactsResponse.data.contacts || !Array.isArray(contactsResponse.data.contacts)) {
        return {
          success: true,
          message: 'No contacts found with this tag in GoHighLevel'
        };
      }
      
      const contacts = contactsResponse.data.contacts;
      
      // For each contact, create or update a lead in Nextiva and add to the list
      const results = [];
      
      for (const contact of contacts) {
        try {
          // Check if lead exists in Nextiva by email or phone
          let leadId = null;
          
          if (contact.email) {
            const searchResponse = await axios.post(`${process.env.NEXTIVA_API_BASE_URL}/leads/search`, {
              email: contact.email
            }, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (searchResponse.data.data && searchResponse.data.data.length > 0) {
              leadId = searchResponse.data.data[0].id;
            }
          }
          
          if (!leadId && contact.phone) {
            const searchResponse = await axios.post(`${process.env.NEXTIVA_API_BASE_URL}/leads/search`, {
              phone: contact.phone
            }, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (searchResponse.data.data && searchResponse.data.data.length > 0) {
              leadId = searchResponse.data.data[0].id;
            }
          }
          
          // Map contact data to lead data
          const leadData = {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            source: 'GoHighLevel',
            customFields: contact.customFields || {}
          };
          
          let response;
          
          if (leadId) {
            // Update existing lead
            response = await axios.put(`${process.env.NEXTIVA_API_BASE_URL}/leads/${leadId}`, leadData, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });
          } else {
            // Create new lead
            response = await axios.post(`${process.env.NEXTIVA_API_BASE_URL}/leads`, leadData, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });
            
            leadId = response.data.data.id;
          }
          
          // Add lead to list
          await axios.post(`${process.env.NEXTIVA_API_BASE_URL}/lists/${listId}/leads`, {
            leadIds: [leadId]
          }, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          results.push({
            contactId: contact.id,
            leadId,
            success: true,
            message: 'Contact synced to Nextiva and added to list'
          });
        } catch (error) {
          results.push({
            contactId: contact.id,
            success: false,
            message: error.message || 'Error syncing contact to Nextiva'
          });
        }
      }
      
      return {
        success: true,
        message: `${results.filter(r => r.success).length} contacts synced from GoHighLevel to Nextiva`,
        results
      };
    } catch (error) {
      return handleApiError(error);
    }
  }
};

const getThrioCredentials = async (locationId, apiKey) => {
  try {
    const client = createApiClient(apiKey);
    let username = null;
    let password = null;

    try {
      const customValuesResponse = await client.get(`/locations/${locationId}/customValues`);
      const customValues = customValuesResponse.data?.customValues || customValuesResponse.data || [];
      const valuesArray = Array.isArray(customValues) ? customValues : [];

      const byName = new Map(
        valuesArray
          .filter(v => v && typeof v === 'object')
          .map(v => [String(v.name || '').toLowerCase(), v])
      );

      const usernameValue =
        byName.get('username') ||
        byName.get('nextiva_thrio_username') ||
        byName.get('thrio_username') ||
        byName.get('thrio username') ||
        byName.get('nextiva username') ||
        byName.get('nextiva_thrio_user');
      const passwordValue =
        byName.get('password') ||
        byName.get('nextiva_thrio_password') ||
        byName.get('thrio_password') ||
        byName.get('thrio password') ||
        byName.get('nextiva password') ||
        byName.get('nextiva_thrio_pass');

      username = usernameValue?.value || null;
      password = passwordValue?.value || null;
    } catch (error) {
      logger.warn('Failed to read location customValues', { locationId, message: error.message });
    }

    if (username && password) {
      return {
        success: true,
        credentials: { username, password, locationId }
      };
    }

    const response = await client.get(`/locations/${locationId}`);

    const locationData = response.data?.location || response.data || {};
    const customFields = locationData.customFields || {};

    username =
      username ||
      customFields.nextiva_thrio_username ||
      customFields.thrio_username ||
      customFields.nextivaUsername ||
      customFields.thrioUsername;

    password =
      password ||
      customFields.nextiva_thrio_password ||
      customFields.thrio_password ||
      customFields.nextivaPassword ||
      customFields.thrioPassword;

    if (!username || !password) {
      return {
        success: false,
        message: 'Thrio credentials not found for this location'
      };
    }

    return {
      success: true,
      credentials: { username, password, locationId }
    };
  } catch (error) {
    logger.error('Failed to retrieve Thrio credentials', { locationId, message: error.message });
    return handleApiError(error);
  }
};

const upsertLocationCustomValue = async ({ apiKey, locationId, name, value }) => {
  const client = createApiClient(apiKey);
  const listResponse = await client.get(`/locations/${locationId}/customValues`);
  const customValues = listResponse.data?.customValues || listResponse.data || [];
  const valuesArray = Array.isArray(customValues) ? customValues : [];

  const existing = valuesArray.find(v => String(v?.name || '').toLowerCase() === String(name).toLowerCase());
  if (existing?.id) {
    const updateResponse = await client.put(`/locations/${locationId}/customValues/${existing.id}`, { name, value });
    return updateResponse.data;
  }

  const createResponse = await client.post(`/locations/${locationId}/customValues`, { name, value });
  return createResponse.data;
};

const setThrioCredentials = async (locationId, apiKey, { username, password }) => {
  try {
    if (!locationId || !apiKey) {
      return { success: false, message: 'locationId and apiKey are required' };
    }
    if (!username || !password) {
      return { success: false, message: 'username and password are required' };
    }

    await upsertLocationCustomValue({ apiKey, locationId, name: 'nextiva_thrio_username', value: username });
    await upsertLocationCustomValue({ apiKey, locationId, name: 'nextiva_thrio_password', value: password });
    await upsertLocationCustomValue({ apiKey, locationId, name: 'username', value: username });
    await upsertLocationCustomValue({ apiKey, locationId, name: 'password', value: password });

    return { success: true };
  } catch (error) {
    logger.error('Failed to store Thrio credentials in location customValues', { locationId, message: error.message });
    return handleApiError(error);
  }
};

module.exports = {
  goHighLevelService,
  getThrioCredentials,
  setThrioCredentials
};
