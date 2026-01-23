const logger = require('../utils/logger');
const config = require('../config/config');
const { nextivaCrmService } = require('../services/nextivaCrmService');
const { getThrioCredentials } = require('../services/goHighLevelService');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Authorization header is missing' });
    }

    const [scheme, tokenOrCreds] = authHeader.split(' ');
    const locationId = req.headers['x-ghl-location-id'] || req.headers['x-location-id'] || null;
    const ghlApiKey = req.headers['x-ghl-api-key'] || null;

    let username = null;
    let password = null;

    if (scheme === 'Basic' && tokenOrCreds) {
      let decodedCreds;
      try {
        decodedCreds = Buffer.from(tokenOrCreds, 'base64').toString('utf8');
      } catch {
        return res.status(401).json({ success: false, message: 'Invalid Basic credentials encoding' });
      }
      const sepIndex = decodedCreds.indexOf(':');
      if (sepIndex === -1) {
        return res.status(401).json({ success: false, message: 'Invalid Basic credentials format' });
      }
      username = decodedCreds.substring(0, sepIndex);
      password = decodedCreds.substring(sepIndex + 1);
    } else if (scheme === 'Bearer' && tokenOrCreds && ghlApiKey && locationId) {
      const stored = await getThrioCredentials(locationId, ghlApiKey);
      if (!stored.success) {
        return res.status(401).json({ success: false, message: 'Stored credentials not found for location', details: stored.message });
      }
      username = stored.credentials.username;
      password = stored.credentials.password;
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use Basic <base64(username:password)> or Bearer with X-GHL-API-Key and X-GHL-Location-Id'
      });
    }

    if (!username || !password) {
      return res.status(401).json({ success: false, message: 'Username and password are required' });
    }
    if (!locationId || !ghlApiKey) {
      return res.status(401).json({ success: false, message: 'X-GHL-API-Key and X-GHL-Location-Id headers are required' });
    }

    const validation = await nextivaCrmService.validateCredentials(username, password);
    if (!validation.success) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', details: validation.error });
    }

    req.user = {
      username,
      thrioAccessToken: validation.token,
      thrioBaseUrl: validation.location || validation.clientLocation || config.api.thrio.baseUrl,
      locationId,
      apiKey: ghlApiKey,
      ghlAccessToken: ghlApiKey,
      ghlLocationId: locationId
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
