const { goHighLevelService } = require('../services/goHighLevelService');
const logger = require('../utils/logger');

/**
 * Get all leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getAllLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Get leads from GoHighLevel using marketplace access token
    const response = await goHighLevelService.getLeads({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      page,
      limit,
      sortBy,
      sortOrder
    });
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in getAllLeads:', error);
    next(error);
  }
};

/**
 * Get lead by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get lead from GoHighLevel using marketplace access token
    const response = await goHighLevelService.getLeadById({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      leadId: id
    });
    
    if (!response.success) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in getLeadById for lead ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Create a new lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createLead = async (req, res, next) => {
  try {
    const leadData = req.body;
    
    // Create lead in GoHighLevel using marketplace access token
    const response = await goHighLevelService.createLead({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      leadData
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error in createLead:', error);
    next(error);
  }
};

/**
 * Update a lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadData = req.body;
    
    // Update lead in GoHighLevel using marketplace access token
    const response = await goHighLevelService.updateLead({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      leadId: id,
      leadData
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in updateLead for lead ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Delete a lead
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Delete lead from GoHighLevel using marketplace access token
    const response = await goHighLevelService.deleteLead({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      leadId: id
    });
    
    if (!response.success) {
      return res.status(400).json(response);
    }
    
    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in deleteLead for lead ${req.params.id}:`, error);
    next(error);
  }
};

/**
 * Search leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const searchLeads = async (req, res, next) => {
  try {
    const { query, filters, page = 1, limit = 20 } = req.query;
    
    // Search leads in GoHighLevel using marketplace access token
    const response = await goHighLevelService.searchLeads({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      query,
      filters,
      page,
      limit
    });
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in searchLeads:', error);
    next(error);
  }
};

/**
 * Bulk create leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const bulkCreateLeads = async (req, res, next) => {
  try {
    const { leads } = req.body;
    
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, message: 'Leads array is required and must not be empty' });
    }
    
    // Bulk create leads in GoHighLevel using marketplace access token
    const response = await goHighLevelService.bulkCreateLeads({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      leads
    });
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in bulkCreateLeads:', error);
    next(error);
  }
};

/**
 * Bulk update leads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const bulkUpdateLeads = async (req, res, next) => {
  try {
    const { leads } = req.body;
    
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, message: 'Leads array is required and must not be empty' });
    }
    
    // Bulk update leads in GoHighLevel using marketplace access token
    const response = await goHighLevelService.bulkUpdateLeads({
      accessToken: req.user.ghlAccessToken,
      locationId: req.user.locationId,
      leads
    });
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in bulkUpdateLeads:', error);
    next(error);
  }
};

module.exports = {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  searchLeads,
  bulkCreateLeads,
  bulkUpdateLeads
};
