const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');
const { goHighLevelService, getThrioCredentials, setThrioCredentials, upsertLocationCustomValue } = require('../services/goHighLevelService');
const credentialStore = require('../services/credentialStore');

/**
 * Initiate GoHighLevel OAuth flow
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const initiateOAuth = (req, res) => {
  try {
    const { clientId, oauthUrl, redirectUri } = config.api.ghl;
    
    if (!clientId || !redirectUri) {
      return res.status(500).json({
        success: false,
        message: 'OAuth configuration missing. Please check GHL_CLIENT_ID and GHL_REDIRECT_URI environment variables.'
      });
    }
    
    // Required scopes for marketplace app
    const scopes = [
      'contacts.readonly',
      'contacts.write',
      'locations.readonly',
      'users.readonly'
    ].join(' ');
    
    const authUrl = `${oauthUrl}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    
    res.status(200).json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL to complete OAuth flow'
    });
  } catch (error) {
    logger.error('Error in initiateOAuth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate OAuth flow'
    });
  }
};

/**
 * Handle OAuth callback and exchange code for token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const handleOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }
    
    const { clientId, clientSecret, tokenUrl, redirectUri } = config.api.ghl;
    
    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: 'OAuth configuration missing'
      });
    }
    
    // Exchange authorization code for access token
    const formData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri
    });
    
    const tokenResponse = await axios.post(
      tokenUrl,
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
    
    if (!access_token) {
      return res.status(401).json({
        success: false,
        message: 'Failed to obtain access token'
      });
    }
    
    // Validate the token by making a test API call
    const validationResult = await goHighLevelService.validateApiKey(access_token);
    
    if (!validationResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token received'
      });
    }

    // Store the GHL access token as a custom value in the sub-location
    // so workflow actions can reference it via {{custom_values.ghl_access_token}}
    const locationId = validationResult.locationId;
    try {
      await upsertLocationCustomValue({ apiKey: access_token, locationId, name: 'ghl_access_token', value: access_token });
      if (refresh_token) {
        await upsertLocationCustomValue({ apiKey: access_token, locationId, name: 'ghl_refresh_token', value: refresh_token });
      }
      logger.info('Stored GHL access token as custom value for location:', locationId);
    } catch (storeErr) {
      logger.warn('Failed to store GHL access token as custom value:', storeErr.message);
    }
    
    // Generate JWT token for our API
    const jwtToken = jwt.sign(
      {
        ghlAccessToken: access_token,
        ghlRefreshToken: refresh_token,
        locationId: validationResult.locationId,
        scope: scope,
        tokenExpiry: Date.now() + (expires_in * 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Generate refresh token for our API
    const apiRefreshToken = jwt.sign(
      {
        ghlRefreshToken: refresh_token,
        locationId: validationResult.locationId
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(200).json({
      success: true,
      token: jwtToken,
      refreshToken: apiRefreshToken,
      expiresIn: 86400, // 24 hours in seconds
      tokenType: 'Bearer',
      location: {
        id: validationResult.locationId,
        name: validationResult.locationName
      },
      scope: scope
    });
  } catch (error) {
    logger.error('Error in handleOAuthCallback:', error);
    
    if (error.response && error.response.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization code'
      });
    }
    
    next(error);
  }
};

/**
 * Verify authentication token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyToken = (req, res) => {
  // If request reaches here, token is valid (verified by authenticate middleware)
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
};

const getToken = async (req, res, next) => {
  try {
    const { apiKey, locationId } = req.body || {};

    const ghlApiKey = apiKey || req.headers['x-ghl-api-key'] || null;
    const ghlLocationId = locationId || req.headers['x-ghl-location-id'] || req.headers['x-location-id'] || null;

    if (!ghlLocationId) {
      return res.status(400).json({ success: false, message: 'locationId is required' });
    }

    // Try Redis first (primary), then GHL custom values (fallback)
    let stored = await credentialStore.getCredentials(ghlLocationId);

    if (!stored?.success && ghlApiKey) {
      stored = await getThrioCredentials(ghlLocationId, ghlApiKey);
    }

    if (!stored?.success) {
      return res.status(401).json({
        success: false,
        message: 'Thrio credentials not found for this location. Use POST /api/auth/validate to store credentials first.',
        details: stored?.message
      });
    }

    // Authenticate with Thrio using the stored credentials
    const thrioAuthResult = await authenticateWithThrio(stored.credentials.username, stored.credentials.password);
    if (!thrioAuthResult?.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Thrio credentials',
        details: thrioAuthResult?.message || thrioAuthResult?.error
      });
    }

    const expiresInSeconds = Math.max(60, Math.min(Number(thrioAuthResult.expiresIn) || 3600, 86400));

    const tokenPayload = {
      username: stored.credentials.username,
      locationId: ghlLocationId,
      ghlLocationId: ghlLocationId,
      ghlAccessToken: ghlApiKey || stored.credentials.ghlApiKey || null,
      thrioAccessToken: thrioAuthResult.accessToken,
      thrioBaseUrl: thrioAuthResult.location || thrioAuthResult.clientLocation || config.api.thrio.baseUrl,
      thrioClientLocation: thrioAuthResult.clientLocation || null,
      thrioLocation: thrioAuthResult.location || null,
      authorities: thrioAuthResult.authorities || []
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: expiresInSeconds });

    let refreshToken;
    if (process.env.JWT_REFRESH_SECRET) {
      refreshToken = jwt.sign(
        { locationId: ghlLocationId, ghlLocationId: ghlLocationId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );
    }

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      expiresIn: expiresInSeconds,
      tokenType: 'Bearer',
      user: {
        username: stored.credentials.username,
        locationId: ghlLocationId,
        authorities: thrioAuthResult.authorities || []
      }
    });
  } catch (error) {
    logger.error('Error in getToken:', error);
    next(error);
  }
};

/**
 * Refresh authentication token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const handleRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken: tokenFromBody } = req.body;
    
    if (!tokenFromBody) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }
    
    // Verify refresh token
    jwt.verify(tokenFromBody, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
      }
      
      const ghlLocationId = decoded.ghlLocationId || decoded.locationId;

      if (!ghlLocationId) {
        return res.status(401).json({ success: false, message: 'Refresh token is missing location context' });
      }

      // Fetch stored Thrio credentials from Redis (primary) or GHL (fallback)
      let stored = await credentialStore.getCredentials(ghlLocationId);
      if (!stored?.success && decoded.ghlAccessToken) {
        stored = await getThrioCredentials(ghlLocationId, decoded.ghlAccessToken);
      }
      if (!stored?.success) {
        return res.status(401).json({
          success: false,
          message: 'Thrio credentials not found. Re-validate via POST /api/auth/validate.',
          details: stored?.message
        });
      }

      // Re-authenticate with Thrio using stored credentials
      const thrioAuthResult = await authenticateWithThrio(stored.credentials.username, stored.credentials.password);
      if (!thrioAuthResult?.success) {
        return res.status(401).json({
          success: false,
          message: 'Failed to re-authenticate with Thrio',
          details: thrioAuthResult?.message || thrioAuthResult?.error
        });
      }

      const expiresInSeconds = Math.max(60, Math.min(Number(thrioAuthResult.expiresIn) || 3600, 86400));

      // Generate new JWT with fresh Thrio token
      const newToken = jwt.sign(
        { 
          username: stored.credentials.username,
          locationId: ghlLocationId,
          ghlLocationId,
          ghlAccessToken: stored.credentials.ghlApiKey || null,
          thrioAccessToken: thrioAuthResult.accessToken,
          thrioBaseUrl: thrioAuthResult.location || thrioAuthResult.clientLocation || config.api.thrio.baseUrl,
          thrioClientLocation: thrioAuthResult.clientLocation || null,
          thrioLocation: thrioAuthResult.location || null,
          authorities: thrioAuthResult.authorities || []
        },
        process.env.JWT_SECRET,
        { expiresIn: expiresInSeconds }
      );
      
      res.status(200).json({
        success: true,
        token: newToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer'
      });
    });
  } catch (error) {
    logger.error('Error in handleRefreshToken:', error);
    next(error);
  }
};

/**
 * Validate external authentication credentials for GoHighLevel marketplace
 * This endpoint is called by GoHighLevel to validate user credentials during app installation
 * It fetches credentials from GoHighLevel and authenticates against Thrio API to verify the credentials
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const validateExternalAuth = async (req, res) => {
  try {
    const { username, password, apiKey, locationId } = req.body;

    logger.info('External authentication validation attempt', {
      username: username ? username.substring(0, 3) + '***' : undefined,
      hasPassword: !!password,
      hasApiKey: !!apiKey,
      hasLocationId: !!locationId
    });

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
        error: 'MISSING_CREDENTIALS'
      });
    }

    let credentialsToUse = { username, password };

    if (apiKey && locationId) {
      try {
        const storedCredentials = await getThrioCredentials(locationId, apiKey);
        if (storedCredentials && storedCredentials.success) {
          credentialsToUse = {
            username: storedCredentials.credentials.username,
            password: storedCredentials.credentials.password
          };
          logger.info('Successfully fetched credentials from GoHighLevel for location:', locationId);
        } else {
          logger.warn('Failed to fetch credentials from GoHighLevel, using provided credentials');
        }
      } catch (fetchError) {
        logger.error('Error fetching credentials from GoHighLevel:', fetchError.message);
      }
    }

    const thrioAuthResult = await authenticateWithThrioRealAPI(credentialsToUse.username, credentialsToUse.password);

    if (!thrioAuthResult || !thrioAuthResult.success) {
      const errorMessage = thrioAuthResult?.message || 'Authentication failed';
      logger.error('Thrio authentication failed:', errorMessage);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials for Thrio API',
        error: 'INVALID_THRIO_CREDENTIALS',
        details: errorMessage
      });
    }

    // Primary: store in Redis (always works, no GHL dependency)
    if (locationId) {
      const redisResult = await credentialStore.storeCredentials(locationId, {
        username: credentialsToUse.username,
        password: credentialsToUse.password
      }, apiKey || null);
      if (!redisResult?.success) {
        logger.warn('Failed to store credentials in Redis', { locationId, message: redisResult?.message });
      }
    }

    // Backup: also store in GHL custom values (best-effort, may fail if key expired)
    if (apiKey && locationId) {
      try {
        await setThrioCredentials(locationId, apiKey, {
          username: credentialsToUse.username,
          password: credentialsToUse.password
        });
      } catch (ghlErr) {
        logger.warn('Failed to store credentials in GHL (non-critical)', { locationId, message: ghlErr.message });
      }
    }

    logger.info('Authentication successful for user:', credentialsToUse.username || 'unknown');

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        authenticated: true,
        user: {
          username: credentialsToUse.username,
          authenticated: true,
          timestamp: new Date().toISOString(),
          thrioAuthenticated: true,
          tokenType: thrioAuthResult.tokenType,
          expiresIn: thrioAuthResult.expiresIn,
          authorities: thrioAuthResult.authorities,
          scope: thrioAuthResult.scope
        }
      }
    });

  } catch (error) {
    const safeMessage = error && typeof error === 'object' && error.message ? String(error.message) : 'Unknown error';
    logger.error('Error in validateExternalAuth:', safeMessage);

    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      error: 'SERVER_ERROR'
    });
  }
};

/**
 * Authenticate with Thrio API - Real API call (no demo logic)
 * This function only attempts real authentication against the Thrio API
 * @param {string} username - Thrio username
 * @param {string} password - Thrio password
 * @returns {Object} Authentication result with success status and tokens
 */
const authenticateWithThrioRealAPI = async (username, password) => {
  try {
    const { baseUrl, tokenEndpoint } = config.api.thrio;
    const tokenUrl = `${baseUrl}${tokenEndpoint}`;

    logger.info('Authenticating with Thrio API for user:', username || 'unknown');

    // Use Basic Auth GET — matches Postman collection and ThrioProxy middleware
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const response = await axios.get(tokenUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      timeout: config.api.thrio.timeout
    });

    if (response.data && response.data.token) {
      logger.info('Thrio authentication successful for user:', username || 'unknown');
      return {
        success: true,
        accessToken: response.data.token,
        refreshToken: response.data.refreshToken || null,
        expiresIn: response.data.expiresIn || 3600,
        tokenType: 'Bearer',
        authorities: response.data.authorities || [],
        scope: response.data.scope || null,
        clientLocation: response.data.clientLocation || null,
        location: response.data.location || null
      };
    }

    logger.error('Thrio authentication failed: no token in response');
    return {
      success: false,
      message: 'Invalid response from Thrio authentication',
      error: 'NO_TOKEN'
    };

  } catch (error) {
    const errorMessage = error?.message || 'Unknown authentication error';
    logger.error('Thrio authentication error:', {
      message: errorMessage,
      status: error?.response?.status,
      data: error?.response?.data
    });

    return {
      success: false,
      statusCode: error?.response?.status || (error?.request ? 503 : 500),
      message: error?.response?.data?.message || error?.response?.data?.error || errorMessage,
      error: error?.response?.data?.error || 'AUTHENTICATION_FAILED'
    };
  }
};

const authenticateWithThrio = async (username, password) => {
  return await authenticateWithThrioRealAPI(username, password);
};

/**
 * Diagnostic endpoint — shows full auth context and optionally tests a Thrio call
 * Requires authenticate middleware (GHL sub-location, Basic Auth, or JWT)
 *
 * Query params:
 *   outboundListId  — if provided, makes a live POST to Thrio leadsupsert with {}
 *                     so you can see the exact Thrio 403/error body
 */
const thrioAuthTest = async (req, res) => {
  try {
    const token = req.user?.thrioAccessToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No Thrio access token — authentication did not complete' });
    }

    const authContext = {
      username: req.user?.username || null,
      locationId: req.user?.locationId || null,
      ghlLocationId: req.user?.ghlLocationId || null,
      thrioBaseUrl: req.user?.thrioBaseUrl || config.api.thrio.baseUrl,
      thrioClientLocation: req.user?.thrioClientLocation || null,
      thrioLocation: req.user?.thrioLocation || null,
      thrioAccessToken: token.substring(0, 30) + '...',
      authorities: req.user?.authorities || []
    };

    // Optional: test the actual leadsupsert call to surface Thrio's exact error
    const testOutboundListId = req.query.outboundListId || req.body?.outboundListId || null;
    let thrioTestResult = null;

    if (testOutboundListId) {
      const { createThrioClient } = require('../services/thrioService');
      const client = createThrioClient(token, req.user?.thrioClientLocation, req.user?.thrioBaseUrl);
      try {
        const response = await client.post(
          `/data/api/types/outboundlist/${testOutboundListId}/leadsupsert`,
          req.body?.testPayload || {}
        );
        thrioTestResult = { status: response.status, data: response.data, success: true };
      } catch (thrioErr) {
        thrioTestResult = {
          success: false,
          status: thrioErr.response?.status,
          thrioError: thrioErr.response?.data,
          message: thrioErr.message,
          url: `${authContext.thrioBaseUrl}/data/api/types/outboundlist/${testOutboundListId}/leadsupsert`,
          headersSent: {
            Authorization: `Bearer ${token.substring(0, 20)}...`,
            'X-Client-Location': req.user?.thrioClientLocation || '(not set)'
          }
        };
      }
    }

    return res.status(200).json({
      success: true,
      authContext,
      thrioTest: thrioTestResult
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  initiateOAuth,
  handleOAuthCallback,
  verifyToken,
  getToken,
  refreshToken: handleRefreshToken,
  validateExternalAuth,
  thrioAuthTest,
  authenticateWithThrio,
  authenticateWithThrioRealAPI
};
