const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

const postLeadToOutboundList = async (req, res, outboundListId) => {
  try {
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }
    const url = `${baseUrl}/data/api/types/outboundlist/${outboundListId}/leadsupsert`;
    const response = await axios.post(url, req.body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });
    res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('Outbound list lead creation failed', { message: error.message, status: error.response?.status });
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create lead'
    });
  }
};

const createCampaignOutboundList = async (req, res) => {
  try {
    const baseUrl = req.user?.thrioBaseUrl || config.api.thrio.baseUrl;
    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }
    const url = `${baseUrl}/data/api/types/campaignoutboundlist`;
    const response = await axios.post(url, req.body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });
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

module.exports = {
  createLeadDynamic,
  createLeadFixed,
  createCampaignOutboundList
};
