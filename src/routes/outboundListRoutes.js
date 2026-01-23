const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { createLeadDynamic, createLeadFixed, createCampaignOutboundList } = require('../controllers/outboundListController');

router.post('/data/api/types/outboundlist/:outboundListId/lead', authenticate, createLeadDynamic);

router.post('/data/api/types/outboundlist/693c3a02a1e63d1632b8830b/lead', authenticate, createLeadFixed('693c3a02a1e63d1632b8830b'));
router.post('/data/api/types/outboundlist/693c3a27fdf2523859bc31ea/lead', authenticate, createLeadFixed('693c3a27fdf2523859bc31ea'));
router.post('/data/api/types/outboundlist/693c3a3f17aad25152e139b9/lead', authenticate, createLeadFixed('693c3a3f17aad25152e139b9'));
router.post('/data/api/types/outboundlist/693c3a5584c45a1b7bac8d96/lead', authenticate, createLeadFixed('693c3a5584c45a1b7bac8d96'));
router.post('/data/api/types/outboundlist/693c3a6d08e5134207591087/lead', authenticate, createLeadFixed('693c3a6d08e5134207591087'));
router.post('/data/api/types/outboundlist/64da53c8bd2e2743914906a1/lead', authenticate, createLeadFixed('64da53c8bd2e2743914906a1'));

router.post('/data/api/types/campaignoutboundlist', authenticate, createCampaignOutboundList);

module.exports = router;
