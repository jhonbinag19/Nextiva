const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { createLeadDynamic, createCampaignOutboundList, resetLead } = require('../controllers/outboundListController');

router.post('/data/api/types/outboundlist/:outboundListId/lead', authenticate, createLeadDynamic);
router.post('/data/api/types/outboundlist/:outboundListId/leadsupsert', authenticate, createLeadDynamic);
router.put('/data/api/types/outboundlist/:outboundListId/resetlead/:leadId', authenticate, resetLead);

router.post('/api/outboundlist/:outboundListId/lead', authenticate, createLeadDynamic);
router.post('/api/outboundlist/:outboundListId/leadsupsert', authenticate, createLeadDynamic);

router.post('/data/api/types/campaignoutboundlist', authenticate, createCampaignOutboundList);

module.exports = router;
