const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const paymentController = require('../controllers/paymentController');

// Get payment configuration
router.get('/config', auth, paymentController.getPaymentConfig);

// Handle Stripe webhooks
router.post('/webhook', paymentController.handleStripeWebhook);

module.exports = router;

