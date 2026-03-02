const express = require('express');
const config = require('../config/config');
const { authenticate } = require('../middleware/authenticate');
const logger = require('../utils/logger');
const { createThrioClient } = require('../services/thrioService');

const router = express.Router();

const leadsUpsert = async (req, res, outboundListId) => {
  try {
    if (!outboundListId) {
      return res.status(400).json({ success: false, message: 'outboundListId is required' });
    }

    const token = req.user?.thrioAccessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing Thrio access token' });
    }

    // Strip auth-only fields before forwarding to Thrio
    let payload = req.body;
    if (Array.isArray(payload)) {
      payload = payload.map(({ locationId, ghlLocationId, ...lead }) => lead);
    } else if (payload && typeof payload === 'object') {
      const { locationId, ghlLocationId, ...rest } = payload;
      payload = rest;
    }

    const client = createThrioClient(token, req.user?.thrioClientLocation, req.user?.thrioBaseUrl);
    const response = await client.post(
      `/data/api/types/outboundlist/${outboundListId}/leadsupsert`,
      payload
    );

    return res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('leadsupsert failed', {
      message: error.message,
      status: error.response?.status,
      thrioError: error.response?.data,
      outboundListId,
      payloadSent: JSON.stringify(payload).substring(0, 500)
    });
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to upsert lead',
      thrioError: error.response?.data || null,
      debug: {
        outboundListId,
        thrioUrl: `${req.user?.thrioBaseUrl || 'https://nextiva.thrio.io'}/data/api/types/outboundlist/${outboundListId}/leadsupsert`,
        thrioStatus: error.response?.status || null,
        payloadSent: payload
      }
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

// Debug echo — returns exactly what was received (no auth). Remove after debugging.
router.post('/public/debug-echo', (req, res) => {
  res.status(200).json({
    success: true,
    received: {
      headers: {
        contentType: req.headers['content-type'],
        authorization: req.headers.authorization ? 'present' : 'missing',
        xGhlLocationId: req.headers['x-ghl-location-id'] || null,
        xLocationId: req.headers['x-location-id'] || null
      },
      query: req.query,
      bodyType: typeof req.body,
      bodyIsArray: Array.isArray(req.body),
      body: req.body,
      url: req.originalUrl
    }
  });
});

module.exports = router;
