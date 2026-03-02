const logger = require('../utils/logger');
const config = require('../config/config');
const jwt = require('jsonwebtoken');
const { getThrioCredentials } = require('../services/goHighLevelService');
const { authenticateWithThrio } = require('../controllers/authController');
const credentialStore = require('../services/credentialStore');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || null;
    const locationId =
      req.headers['x-ghl-location-id'] ||
      req.headers['x-location-id'] ||
      (req.query ? (req.query.locationId || req.query.ghlLocationId) : null) ||
      (req.body ? (req.body.locationId || req.body.ghlLocationId) : null) ||
      null;
    let ghlApiKey =
      req.headers['x-ghl-api-key'] ||
      (req.query ? (req.query.ghlApiKey || req.query.apiKey) : null) ||
      (req.body ? (req.body.ghlApiKey || req.body.apiKey) : null) ||
      null;

    // ── Path 1 (primary): JWT Bearer token ──
    // The JWT already contains thrioAccessToken and all GHL context.
    if (authHeader) {
      const [scheme, tokenValue] = authHeader.split(' ');

      if (scheme === 'Bearer' && tokenValue && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
          req.user = {
            ...decoded,
            username: decoded.username,
            locationId: decoded.locationId || decoded.ghlLocationId || null,
            ghlLocationId: decoded.ghlLocationId || decoded.locationId || null,
            ghlAccessToken: decoded.ghlAccessToken || null,
            apiKey: decoded.ghlAccessToken || null,
            thrioAccessToken: decoded.thrioAccessToken || null,
            thrioBaseUrl: decoded.thrioBaseUrl || config.api.thrio.baseUrl
          };
          return next();
        } catch {
          // JWT verification failed — fall through to Path 2
        }
      }

      // ── Path 2: Bearer token is a GHL API key + location header ──
      // Fetch stored Thrio credentials from GHL sub-location and authenticate.
      if (scheme === 'Bearer' && tokenValue && locationId) {
        ghlApiKey = ghlApiKey || tokenValue;
      }
    }

    // ── Path 2 (fallback): Location ID (+ optional GHL API key) ──
    // Fetch stored Thrio credentials from Redis (primary) or GHL (fallback).
    if (!locationId) {
      return res.status(401).json({
        success: false,
        message: 'Authorization required. Use Bearer <JWT> from POST /api/auth/token, or provide X-GHL-Location-Id header.'
      });
    }

    let stored = await credentialStore.getCredentials(locationId);
    if (!stored?.success && ghlApiKey) {
      stored = await getThrioCredentials(locationId, ghlApiKey);
    }
    if (!stored?.success) {
      return res.status(401).json({
        success: false,
        message: 'Thrio credentials not found for this location. Use POST /api/auth/validate to store credentials first.',
        details: stored?.message
      });
    }

    const authResult = await authenticateWithThrio(stored.credentials.username, stored.credentials.password);
    if (!authResult?.success) {
      return res.status(401).json({ success: false, message: 'Stored Thrio credentials are invalid', details: authResult?.message || authResult?.error });
    }

    req.user = {
      username: stored.credentials.username,
      thrioAccessToken: authResult.accessToken,
      thrioBaseUrl: authResult.location || authResult.clientLocation || config.api.thrio.baseUrl,
      thrioClientLocation: authResult.clientLocation || null,
      thrioLocation: authResult.location || null,
      locationId,
      apiKey: ghlApiKey || stored.credentials.ghlApiKey || null,
      ghlAccessToken: ghlApiKey || stored.credentials.ghlApiKey || null,
      ghlLocationId: locationId,
    };

    next();
  } catch (error) {
    logger.error('Error in authenticate middleware:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

module.exports = {
  authenticate
};
