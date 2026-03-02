const express = require('express');
const axios = require('axios');
const config = require('../config/config');
const { authenticate } = require('../middleware/authenticate');
const logger = require('../utils/logger');

const router = express.Router();

const leadsUpsert = async (req, res, outboundListId) => {
  try {
    if (!outboundListId) {
      return res.status(400).json({ success: false, message: 'outboundListId is required' });
    }

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

    return res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('leadsupsert failed', { message: error.message, status: error.response?.status });
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to upsert lead',
      data: error.response?.data
    });
  }
};

// /api/public/{{contact.dialer_list_id}}/leadsupsert
router.post('/public/:outboundListId/leadsupsert', authenticate, (req, res) => {
  return leadsUpsert(req, res, req.params.outboundListId);
});

// /api/public/outboundlist/{{contact.dialer_list_id}}/leadsupsert
router.post('/public/outboundlist/:outboundListId/leadsupsert', authenticate, (req, res) => {
  return leadsUpsert(req, res, req.params.outboundListId);
});

// /api/public/outboundlist/leadsupsert — outboundListId in body
router.post('/public/outboundlist/leadsupsert', authenticate, (req, res) => {
  const outboundListId = req.body?.outboundListId || req.body?.outbound_list_id || null;
  return leadsUpsert(req, res, outboundListId);
});

module.exports = router;
