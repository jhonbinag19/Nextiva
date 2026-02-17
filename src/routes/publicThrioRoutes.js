const express = require('express');
const axios = require('axios');
const config = require('../config/config');
const { authenticateWithThrio } = require('../controllers/authController');
const logger = require('../utils/logger');

const router = express.Router();

const parseBasicAuth = (authHeader) => {
  if (!authHeader) return null;
  const [scheme, token] = String(authHeader).split(' ');
  if (scheme !== 'Basic' || !token) return null;
  let decoded;
  try {
    decoded = Buffer.from(token, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const sep = decoded.indexOf(':');
  if (sep === -1) return null;
  return { username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
};

const extractLeadPayload = (body) => {
  if (!body || typeof body !== 'object') return {};
  if (body.lead && typeof body.lead === 'object') return body.lead;

  const { outboundListId, outbound_list_id, username, password, thrioUsername, thrioPassword, ...rest } = body;
  return rest;
};

const leadsUpsert = async (req, res, outboundListId) => {
  try {
    const basic = parseBasicAuth(req.headers.authorization);
    const username = basic?.username || req.body?.username || req.body?.thrioUsername || null;
    const password = basic?.password || req.body?.password || req.body?.thrioPassword || null;

    if (!username || !password) {
      return res.status(401).json({ success: false, message: 'username and password are required (Basic auth or JSON body)' });
    }

    if (!outboundListId) {
      return res.status(400).json({ success: false, message: 'outboundListId is required (URL param or JSON body)' });
    }

    const authResult = await authenticateWithThrio(username, password);
    if (!authResult || !authResult.success || !authResult.accessToken) {
      return res.status(401).json({ success: false, message: 'Invalid Thrio credentials', details: authResult?.message || authResult?.error });
    }

    const url = `${config.api.thrio.baseUrl}/data/api/types/outboundlist/${outboundListId}/leadsupsert`;
    const payload = extractLeadPayload(req.body);

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${authResult.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });

    return res.status(response.status || 200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error('Public leadsupsert failed', { message: error.message, status: error.response?.status });
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to upsert lead',
      data: error.response?.data
    });
  }
};

router.post('/public/outboundlist/:outboundListId/leadsupsert', async (req, res) => {
  return leadsUpsert(req, res, req.params.outboundListId);
});

router.post('/public/outboundlist/leadsupsert', async (req, res) => {
  const outboundListId = req.body?.outboundListId || req.body?.outbound_list_id || null;
  return leadsUpsert(req, res, outboundListId);
});

module.exports = router;
