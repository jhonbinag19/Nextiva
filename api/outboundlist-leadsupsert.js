const axios = require('axios');
const config = require('../src/config/config');
const { getThrioCredentials } = require('../src/services/goHighLevelService');
const { authenticateWithThrio } = require('../src/controllers/authController');

const json = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const getBody = (req) => {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-GHL-API-Key, X-GHL-Location-Id, X-Thrio-Username, X-Thrio-Password');
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { success: false, message: 'Method not allowed' });
  }

  const locationId = req.headers['x-ghl-location-id'] || req.headers['x-location-id'] || null;
  const ghlApiKey = req.headers['x-ghl-api-key'] || null;
  const headerUsername = req.headers['x-thrio-username'] || req.headers['x-nextiva-username'] || null;
  const headerPassword = req.headers['x-thrio-password'] || req.headers['x-nextiva-password'] || null;

  if (!locationId || !ghlApiKey) {
    return json(res, 401, { success: false, message: 'X-GHL-API-Key and X-GHL-Location-Id headers are required' });
  }

  const body = getBody(req);
  const outboundListId = body.outboundListId || body.outbound_list_id || (req.query ? req.query.outboundListId : null) || null;
  if (!outboundListId) {
    return json(res, 400, { success: false, message: 'outboundListId is required (in JSON body or querystring)' });
  }

  const leadPayload = body.lead && typeof body.lead === 'object'
    ? body.lead
    : Object.keys(body).reduce((acc, key) => {
      if (key === 'outboundListId' || key === 'outbound_list_id') return acc;
      acc[key] = body[key];
      return acc;
    }, {});

  let username = headerUsername;
  let password = headerPassword;

  if (!username || !password) {
    const stored = await getThrioCredentials(locationId, ghlApiKey);
    if (!stored || !stored.success) {
      return json(res, 401, { success: false, message: 'Stored credentials not found for location', details: stored ? stored.message : 'Unknown error' });
    }
    username = stored.credentials.username;
    password = stored.credentials.password;
  }

  const authResult = await authenticateWithThrio(username, password);
  if (!authResult || !authResult.success) {
    return json(res, 401, { success: false, message: 'Invalid Thrio credentials', details: authResult ? authResult.message : 'Authentication failed' });
  }

  const baseUrl = config.api.thrio.baseUrl;
  const url = `${baseUrl}/data/api/types/outboundlist/${outboundListId}/leadsupsert`;

  try {
    const response = await axios.post(url, leadPayload, {
      headers: {
        Authorization: `Bearer ${authResult.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: config.api.nextiva.timeout
    });

    return json(res, response.status || 200, { success: true, data: response.data });
  } catch (error) {
    const status = error && error.response && error.response.status ? error.response.status : 500;
    return json(res, status, {
      success: false,
      message: (error && error.response && error.response.data && error.response.data.message) || (error && error.message) || 'Failed to upsert lead',
      data: error && error.response ? error.response.data : undefined
    });
  }
};
