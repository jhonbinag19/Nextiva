const { goHighLevelService } = require('../services/goHighLevelService');
const logger = require('../utils/logger');

/**
 * Get all lists
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getAllLists = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Get lists from GoHighLevel using marketplace access token
    const response = await goHighLevelService.getLists({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      page,
      limit,
      sortBy,
      sortOrder
    });
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in getAllLists:', error);
    next(error);
  }
};

/**
 * Get list by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getListById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get list from GoHighLevel using marketplace access token
    const response = await goHighLevelService.getListById({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listId: id
    });
    
    if (!response.success) {
      return res.status(404).json({ success: false, message: 'List not found' });
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in getListById for list ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Create a new list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createList = async (req, res, next) => {
  try {
    const listData = req.body;
    
    // Create list in GoHighLevel using marketplace access token
    const response = await goHighLevelService.createList({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listData
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error in createList:', error);
    next(error);
  }
};

/**
 * Update a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const listData = req.body;
    
    // Update list in GoHighLevel using marketplace access token
    const response = await goHighLevelService.updateList({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listId: id,
      listData
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in updateList for list ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Delete a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteList = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Delete list from GoHighLevel using marketplace access token
    const response = await goHighLevelService.deleteList({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listId: id
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in deleteList for list ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Get all leads in a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getListLeads = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Get leads in list from GoHighLevel using marketplace access token
    const response = await goHighLevelService.getListLeads({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listId: id,
      page,
      limit
    });
    
    if (!response.success) {
      return res.status(response.statusCode || 404).json(response);
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in getListLeads for list ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Add leads to a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const addLeadsToList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { leadIds } = req.body;
    
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Lead IDs array is required and must not be empty' });
    }
    
    // Add leads to list in GoHighLevel using marketplace access token
    const response = await goHighLevelService.addLeadsToList({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listId: id,
      leadIds
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in addLeadsToList for list ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Remove a lead from a list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const removeLeadFromList = async (req, res, next) => {
  try {
    const { id, leadId } = req.params;
    
    // Remove lead from list in GoHighLevel using marketplace access token
    const response = await goHighLevelService.removeLeadFromList({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listId: id,
      leadId
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in removeLeadFromList for list ${req.params.id} and lead ${req.params.leadId}:`, error);
    next(error);
  }
};

/**
 * Refresh list data from GoHighLevel
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const syncList = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get fresh list data from GoHighLevel using marketplace access token
    const response = await goHighLevelService.getListById({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      listId: id
    });
    
    if (!response.success) {
      return res.status(404).json({ success: false, message: 'List not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'List data refreshed successfully',
      list: response.list
    });
  } catch (error) {
    logger.error(`Error in syncList for list ${req.params.id}:`, error);
    next(error);
  }
};

module.exports = {
  getAllLists,
  getListById,
  createList,
  updateList,
  deleteList,
  getListLeads,
  addLeadsToList,
  removeLeadFromList,
  syncList
};
