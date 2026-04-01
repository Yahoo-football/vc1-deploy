const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const { searchValidation } = require('../middleware/validation');

router.get('/stats', auth, dashboardController.getDashboardStats);
router.get('/search', auth, searchValidation, dashboardController.searchResources);

module.exports = router;
