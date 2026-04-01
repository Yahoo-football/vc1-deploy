const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');
const { responseCache } = require('../middleware/cache');

router.get('/overview', auth, responseCache(30), analyticsController.getAnalyticsOverview);
router.get('/report.csv', auth, analyticsController.getAnalyticsCsv);

module.exports = router;
