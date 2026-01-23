const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { usersSmsRoot, usersSmsWildcard } = require('../controllers/usersApiController');

router.all('/users/api/sms', authenticate, usersSmsRoot);
router.all('/users/api/sms/*', authenticate, usersSmsWildcard);

module.exports = router;
