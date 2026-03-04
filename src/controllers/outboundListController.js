const logger = require('../utils/logger');
const { createThrioClient } = require('../services/thrioService');

const postLeadToOutboundList = async (req, res, outboundListId) => {
  try {
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }
    const client = createThrioClient(token, req.user?.thrioClientLocation, req.user?.thrioBaseUrl);
    const response = await client.post(`/data/api/types/outboundlist/${outboundListId}/leadsupsert`, req.body);
    res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('Outbound list lead creation failed', {
      message: error.message,
      status: error.response?.status,
      thrioError: error.response?.data,
      outboundListId,
      hasClientLocation: !!req.user?.thrioClientLocation
    });
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create lead',
      thrioError: error.response?.data,
      debug: {
        outboundListId,
        thrioUrl: `${req.user?.thrioBaseUrl || 'https://nextiva.thrio.io'}/data/api/types/outboundlist/${outboundListId}/leadsupsert`,
        hasClientLocation: !!req.user?.thrioClientLocation,
        clientLocation: req.user?.thrioClientLocation || null
      }
    });
  }
};

const createCampaignOutboundList = async (req, res) => {
  try {
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }
    const client = createThrioClient(token, req.user?.thrioClientLocation, req.user?.thrioBaseUrl);
    const response = await client.post('/data/api/types/campaignoutboundlist', req.body);
    res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('Campaign outbound list request failed', { message: error.message, status: error.response?.status });
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to process campaign outbound list'
    });
  }
};

const createLeadDynamic = async (req, res) => {
  const { outboundListId } = req.params;
  return postLeadToOutboundList(req, res, outboundListId);
};

const createLeadFixed = (outboundListId) => {
  return async (req, res) => {
    return postLeadToOutboundList(req, res, outboundListId);
  };
};

const resetLead = async (req, res) => {
  const { outboundListId, leadId } = req.params;
  try {
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }
    const client = createThrioClient(token, req.user?.thrioClientLocation, req.user?.thrioBaseUrl);
    const response = await client.put(
      `/data/api/types/outboundlist/${outboundListId}/resetlead/${leadId}`,
      req.body && Object.keys(req.body).length ? req.body : undefined
    );
    res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('Reset lead failed', {
      message: error.message,
      status: error.response?.status,
      thrioError: error.response?.data,
      outboundListId,
      leadId
    });
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to reset lead',
      thrioError: error.response?.data,
      debug: {
        outboundListId,
        leadId,
        thrioUrl: `${req.user?.thrioBaseUrl || 'https://nextiva.thrio.io'}/data/api/types/outboundlist/${outboundListId}/resetlead/${leadId}`
      }
    });
  }
};

module.exports = {
  createLeadDynamic,
  createLeadFixed,
  createCampaignOutboundList,
  resetLead
};
