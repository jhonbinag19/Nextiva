const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/config');
const { goHighLevelService, getThrioCredentials, setThrioCredentials } = require('../services/goHighLevelService');
const { nextivaCrmService } = require('../services/nextivaCrmService');

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
    const tokenResponse = await axios.post(
      tokenUrl,
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
      },
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
    const { username, password, apiKey, locationId } = req.body || {};

    const ghlApiKey = apiKey || req.headers['x-ghl-api-key'] || null;
    const ghlLocationId = locationId || req.headers['x-ghl-location-id'] || req.headers['x-location-id'] || null;

    if (!ghlApiKey || !ghlLocationId) {
      return res.status(400).json({ success: false, message: 'GHL apiKey and locationId are required' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'JWT_SECRET is not configured' });
    }

    const ghlValidation = await goHighLevelService.validateApiKey(ghlApiKey);
    if (ghlValidation?.success && ghlValidation.locationId && ghlValidation.locationId !== ghlLocationId) {
      return res.status(401).json({ success: false, message: 'GHL apiKey does not match locationId' });
    }

    let credsUsername = username || null;
    let credsPassword = password || null;

    if (!credsUsername || !credsPassword) {
      const stored = await getThrioCredentials(ghlLocationId, ghlApiKey);
      if (!stored?.success) {
        return res.status(401).json({ success: false, message: 'Stored Thrio credentials not found for location', details: stored?.message });
      }
      credsUsername = stored.credentials.username;
      credsPassword = stored.credentials.password;
    }

    const thrioAuthResult = await authenticateWithThrio(credsUsername, credsPassword);
    if (!thrioAuthResult?.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Thrio credentials',
        details: thrioAuthResult?.message || thrioAuthResult?.error
      });
    }

    const expiresInSeconds = Math.max(60, Math.min(Number(thrioAuthResult.expiresIn) || 3600, 86400));

    const tokenPayload = {
      username: credsUsername,
      locationId: ghlLocationId,
      ghlLocationId: ghlLocationId,
      ghlAccessToken: ghlApiKey,
      thrioAccessToken: thrioAuthResult.accessToken,
      thrioBaseUrl: config.api.thrio.baseUrl,
      authorities: thrioAuthResult.authorities || []
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: expiresInSeconds });

    let refreshToken;
    if (process.env.JWT_REFRESH_SECRET) {
      refreshToken = jwt.sign(
        {
          username: credsUsername,
          locationId: ghlLocationId,
          ghlLocationId: ghlLocationId,
          ghlAccessToken: ghlApiKey,
          thrioRefreshToken: thrioAuthResult.refreshToken || null
        },
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
        username: credsUsername,
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
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }
    
    // Verify refresh token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
      }
      
      const { username, userId } = decoded;
      
      // Generate new JWT token
      const newToken = jwt.sign(
        { 
          username,
          userId
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.status(200).json({
        success: true,
        token: newToken,
        expiresIn: 86400, // 24 hours in seconds
        tokenType: 'Bearer'
      });
    });
  } catch (error) {
    logger.error('Error in refreshToken:', error);
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

    if (logger && logger.info) {
      logger.info('External authentication validation attempt', {
        username: username ? username.substring(0, 3) + '***' : undefined,
        hasPassword: !!password,
        hasApiKey: !!apiKey,
        hasLocationId: !!locationId
      });
    }

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
          if (logger && logger.info) {
            logger.info('Successfully fetched credentials from GoHighLevel for location:', locationId);
          }
        } else if (logger && logger.warn) {
          logger.warn('Failed to fetch credentials from GoHighLevel, using provided credentials');
        }
      } catch (fetchError) {
        if (logger && logger.error) {
          logger.error('Error fetching credentials from GoHighLevel:', fetchError.message);
        }
      }
    }

    const thrioAuthResult = await authenticateWithThrioRealAPI(credentialsToUse.username, credentialsToUse.password);

    if (!thrioAuthResult || !thrioAuthResult.success) {
      const errorMessage = thrioAuthResult?.message || 'Authentication failed';
      if (logger && logger.error) {
        logger.error('Thrio authentication failed:', errorMessage);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials for Thrio API',
        error: 'INVALID_THRIO_CREDENTIALS',
        details: errorMessage
      });
    }

    process.env.THRIO_USERNAME = credentialsToUse.username;
    process.env.THRIO_PASSWORD = credentialsToUse.password;
    process.env.THRIO_ACCESS_TOKEN = thrioAuthResult.accessToken;
    if (thrioAuthResult.refreshToken) {
      process.env.THRIO_REFRESH_TOKEN = thrioAuthResult.refreshToken;
    }

    if (apiKey && locationId) {
      const storeResult = await setThrioCredentials(locationId, apiKey, {
        username: credentialsToUse.username,
        password: credentialsToUse.password
      });
      if (!storeResult?.success) {
        logger.warn('Failed to store Thrio credentials to GHL location', { locationId, message: storeResult?.message });
      }
    }

    if (logger && logger.info) {
      logger.info('Authentication successful for user:', credentialsToUse.username || 'unknown');
    }

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
          thrioToken: thrioAuthResult.accessToken,
          tokenType: thrioAuthResult.tokenType,
          expiresIn: thrioAuthResult.expiresIn,
          authorities: thrioAuthResult.authorities,
          scope: thrioAuthResult.scope
        }
      }
    });

  } catch (error) {
    const safeMessage = error && typeof error === 'object' && error.message ? String(error.message) : 'Unknown error';
    if (logger && logger.error) {
      logger.error('Error in validateExternalAuth:', safeMessage);
    } else {
      console.error('Error in validateExternalAuth:', safeMessage);
    }

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
    const { authBaseUrl, baseUrl, tokenEndpoint } = config.api.thrio;
    const tokenUrl = `${authBaseUrl || baseUrl}${tokenEndpoint}`;
    
    if (logger && logger.info) {
      logger.info('Attempting REAL Thrio authentication for user:', username || 'unknown');
    } else {
      console.log('Attempting REAL Thrio authentication for user:', username || 'unknown');
    }
    
    // Make request to Thrio token-with-authorities endpoint
    // Convert data to URL encoded format for form submission
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('grant_type', 'password');
    formData.append('client_id', 'thrio-client');
    
    const response = await axios.post(
      tokenUrl,
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: config.api.thrio.timeout
      }
    );
    
    if (response.data && response.data.access_token) {
      if (logger && logger.info) {
        logger.info('REAL Thrio authentication successful for user:', username || 'unknown');
      } else {
        console.log('REAL Thrio authentication successful for user:', username || 'unknown');
      }
      return {
        success: true,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type || 'Bearer',
        authorities: response.data.authorities || [],
        scope: response.data.scope,
        demo: false,
        source: 'real_thrio_api'
      };
    } else {
      if (logger && logger.error) {
        logger.error('REAL Thrio authentication failed: No access token in response');
      } else {
        console.error('REAL Thrio authentication failed: No access token in response');
      }
      return {
        success: false,
        message: 'Invalid response from Thrio authentication',
        error: 'NO_ACCESS_TOKEN',
        demo: false,
        source: 'real_thrio_api'
      };
    }
    
  } catch (error) {
    // Safely handle the error object
    const errorMessage = error && typeof error === 'object' && error.message ? error.message : 'Unknown authentication error';
    if (logger && logger.error) {
      logger.error('REAL Thrio authentication error:', errorMessage);
    } else {
      console.error('REAL Thrio authentication error:', errorMessage);
    }
    
    if (error && typeof error === 'object' && error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (logger && logger.error) {
        logger.error('REAL Thrio authentication error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else {
        console.error('REAL Thrio authentication error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      
      return {
        success: false,
        statusCode: error.response.status,
        message: error.response.data && (error.response.data.message || error.response.data.error) || 'Thrio authentication failed',
        error: error.response.data && error.response.data.error || 'AUTHENTICATION_FAILED',
        demo: false,
        source: 'real_thrio_api'
      };
    } else if (error && typeof error === 'object' && error.request) {
      // The request was made but no response was received
      if (logger && logger.error) {
        logger.error('REAL Thrio authentication no response:', { request: error.request });
      } else {
        console.error('REAL Thrio authentication no response:', { request: error.request });
      }
      
      return {
        success: false,
        statusCode: 503,
        message: 'No response from Thrio authentication service',
        error: 'SERVICE_UNAVAILABLE',
        demo: false,
        source: 'real_thrio_api'
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      const setupErrorMessage = error && typeof error === 'object' && error.message ? error.message : 'Unknown request error';
      if (logger && logger.error) {
        logger.error('REAL Thrio authentication request error:', { message: setupErrorMessage });
      } else {
        console.error('REAL Thrio authentication request error:', { message: setupErrorMessage });
      }
      
      return {
        success: false,
        statusCode: 500,
        message: 'Error setting up request to Thrio authentication',
        error: 'REQUEST_SETUP_ERROR',
        demo: false,
        source: 'real_thrio_api'
      };
    }
  }
};

const authenticateWithThrio = async (username, password) => {
  return await authenticateWithThrioRealAPI(username, password);
};

module.exports = {
  initiateOAuth,
  handleOAuthCallback,
  verifyToken,
  getToken,
  refreshToken,
  validateExternalAuth,
  authenticateWithThrio,
  authenticateWithThrioRealAPI
};
