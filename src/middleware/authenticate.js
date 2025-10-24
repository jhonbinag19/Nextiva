const logger = require('../utils/logger');
const config = require('../config/config');
const jwt = require('jsonwebtoken');
const { getThrioCredentials } = require('../services/goHighLevelService');
const { authenticateWithThrio } = require('../controllers/authController');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || null;
    const locationId = req.headers['x-ghl-location-id'] || req.headers['x-location-id'] || null;
    const ghlApiKey = req.headers['x-ghl-api-key'] || null;

    let username = null;
    let password = null;
    const headerUsername = req.headers['x-thrio-username'] || req.headers['x-nextiva-username'] || null;
    const headerPassword = req.headers['x-thrio-password'] || req.headers['x-nextiva-password'] || null;

    if (authHeader) {
      const [scheme, tokenOrCreds] = authHeader.split(' ');

      if (scheme === 'Bearer' && tokenOrCreds && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(tokenOrCreds, process.env.JWT_SECRET);
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
        }
      }

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
      } else if (scheme === 'Bearer' && tokenOrCreds && headerUsername && headerPassword) {
      username = headerUsername;
      password = headerPassword;
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
        message: 'Invalid authorization format. Use Bearer <jwt>, or provide X-GHL-API-Key and X-GHL-Location-Id, or use Basic <base64(username:password)>'
      });
    }
    } else if (ghlApiKey && locationId) {
      const stored = await getThrioCredentials(locationId, ghlApiKey);
      if (!stored.success) {
        return res.status(401).json({ success: false, message: 'Stored credentials not found for location', details: stored.message });
      }
      username = stored.credentials.username;
      password = stored.credentials.password;
    } else {
      return res.status(401).json({ success: false, message: 'Authorization is required' });
    }

    if (!username || !password) {
      return res.status(401).json({ success: false, message: 'Username and password are required' });
    }
    if (!locationId || !ghlApiKey) {
      return res.status(401).json({ success: false, message: 'X-GHL-API-Key and X-GHL-Location-Id headers are required' });
    }

    const authResult = await authenticateWithThrio(username, password);
    if (!authResult.success) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', details: authResult.message || authResult.error });
    }

    req.user = {
      username,
      thrioAccessToken: authResult.accessToken,
      thrioBaseUrl: config.api.thrio.baseUrl,
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
