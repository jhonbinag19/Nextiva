const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');

/**
 * @route GET /api/auth/oauth/initiate
 * @desc Initiate GoHighLevel OAuth flow
 * @access Public
 */
router.get('/oauth/initiate', authController.initiateOAuth);

/**
 * @route GET /api/auth/callback
 * @desc Handle OAuth callback and exchange code for token
 * @access Public
 */
router.get('/callback', authController.handleOAuthCallback);

/**
 * @route GET /api/auth/verify
 * @desc Verify authentication token
 * @access Private
 */
router.get('/verify', authenticate, authController.verifyToken);

router.post('/token', authController.getToken);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh authentication token
 * @access Public
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route POST /api/auth/validate
 * @desc Validate external authentication credentials for GoHighLevel marketplace
 * @access Public
 */
router.post('/validate', authController.validateExternalAuth);

module.exports = router;
