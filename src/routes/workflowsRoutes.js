const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { workflowsWebformRoot, workflowsWebformWildcard } = require('../controllers/usersApiController');

router.all('/workflows/api/webform', authenticate, workflowsWebformRoot);
router.all('/workflows/api/webform/*', authenticate, workflowsWebformWildcard);

module.exports = router;
