const { Booking, Field, Team } = require('../models');

// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Check if Stripe is properly configured
 */
// Check stripe configuration before continuing.
const checkStripeConfiguration = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Stripe secret key is not configured - payment features will be limited');
    return false;
  }
  
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    console.warn('Stripe publishable key is not configured - payment features will be limited');
    return false;
  }
  
  return true;
};

/**
 * Check if user is authorized to pay for a specific booking
 */
// Check payment authorization before continuing.
const checkPaymentAuthorization = async (booking, user) => {
  const isBooker = booking.createdBy === user.id;
  const isAdmin = user.role === 'admin';
  
  return { isBooker, isAdmin, isAuthorized: isBooker || isAdmin };
};

/**
 * Validate booking payment eligibility
 */
// Validate booking for payment before continuing.
const validateBookingForPayment = (booking) => {
  const errors = [];
  
  // Check if booking exists
  if (!booking) {
    errors.push('Booking not found');
    return { isValid: false, errors };
  }
  
  // Check if booking is confirmed (only confirmed bookings can be paid)
  if (booking.status !== 'confirmed') {
    errors.push('Only confirmed bookings can be paid for');
  }
  
  // Check if booking has a total price
  if (!booking.totalPrice || booking.totalPrice <= 0) {
    errors.push('Invalid booking amount');
  }
  
  return { isValid: errors.length === 0, errors };
};

/**
 * Create Stripe checkout session for booking payment
 */
// Create stripe checkout session for the current flow.
const createStripeCheckoutSession = async (booking, successUrl, cancelUrl) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: booking.creator?.email || undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Booking for ${booking.field?.name || 'Field'}`,
            description: `Date: ${new Date(booking.startTime).toLocaleDateString()} - ${new Date(booking.endTime).toLocaleDateString()}`,
            images: booking.field?.images?.slice(0, 1) || []
          },
          unit_amount: Math.round(booking.totalPrice * 100) // Convert to cents
        },
        quantity: 1
      }
    ],
    metadata: {
      bookingId: booking.id.toString(),
      fieldId: booking.fieldId.toString(),
      userId: booking.createdBy.toString()
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes expiry
  });
  
  return session;
};

/**
 * GET /api/payments/config
 * Get Stripe configuration for frontend
 * Returns publishable key and payment settings
 */
const getPaymentConfig = asyncHandler(async (req, res) => {
  try {
    // ========================================
    // CHECK STRIPE CONFIGURATION
    // ========================================
    
    const isConfigured = checkStripeConfiguration();
    
    // ========================================
    // RETURN PAYMENT CONFIGURATION
    // ========================================
    
    res.json({
      success: true,
      data: {
        isConfigured,
        publishableKey: isConfigured ? process.env.STRIPE_PUBLISHABLE_KEY : null,
        currency: 'usd',
        supportedPaymentMethods: isConfigured ? ['card'] : [],
        sessionTimeoutMinutes: 30,
        message: isConfigured ? 'Payment system is ready' : 'Payment system is not configured'
      }
    });

  } catch (error) {
    console.error('Get payment config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events
 * Processes payment success, failure, and other events
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
  try {
    // ========================================
    // VERIFY WEBHOOK SIGNATURE
    // ========================================
    
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn('Stripe webhook secret not configured, skipping signature verification');
    }
    
    let event;
    try {
      if (webhookSecret) {
        if (!process.env.STRIPE_SECRET_KEY) {
          return res.status(503).json({
            success: false,
            message: 'Payment system is not configured'
          });
        }

        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const signedPayload = Buffer.isBuffer(req.body) ? req.body : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        event = stripe.webhooks.constructEvent(signedPayload, sig, webhookSecret);
      } else if (Buffer.isBuffer(req.body)) {
        const rawBody = req.body.toString('utf8').trim();
        if (!rawBody) {
          return res.status(400).json({
            success: false,
            message: 'Webhook payload is required'
          });
        }

        event = JSON.parse(rawBody);
      } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        event = req.body;
      } else if (typeof req.body === 'string' && req.body.trim()) {
        event = JSON.parse(req.body);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Webhook payload is required'
        });
      }
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ 
        success: false, 
        message: 'Webhook signature verification failed' 
      });
    }

    if (!event || !event.type) {
      return res.status(400).json({
        success: false,
        message: 'Webhook event type is required'
      });
    }
    
    // ========================================
    // PROCESS WEBHOOK EVENT
    // ========================================
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handlePaymentSuccess(event.data.object);
        break;
        
      case 'checkout.session.expired':
        await handlePaymentExpired(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
        
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
    
    res.json({ success: true, received: true });

  } catch (error) {
    console.error('Handle webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message
    });
  }
});

// ========================================
// WEBHOOK EVENT HANDLERS
// ========================================

/**
 * Handle successful payment completion
 */
// Handle payment success interactions.
const handlePaymentSuccess = async (session) => {
  try {
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      console.error('Payment success webhook: No booking ID in metadata');
      return;
    }
    
    // Update booking status to paid
    await Booking.update(
      { status: 'paid', paidAt: new Date() },
      { where: { id: bookingId } }
    );
    
    console.log(`Payment successful for booking ${bookingId}`);
  } catch (error) {
    console.error('Handle payment success error:', error);
  }
};

/**
 * Handle expired payment session
 */
// Handle payment expired interactions.
const handlePaymentExpired = async (session) => {
  try {
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      console.error('Payment expired webhook: No booking ID in metadata');
      return;
    }
    
    console.log(`Payment session expired for booking ${bookingId}`);
    // No action needed - booking remains confirmed
  } catch (error) {
    console.error('Handle payment expired error:', error);
  }
};

/**
 * Handle payment failure
 */
// Handle payment failure interactions.
const handlePaymentFailure = async (paymentIntent) => {
  try {
    console.log(`Payment failed: ${paymentIntent.id}`);
    // No action needed - booking remains confirmed
  } catch (error) {
    console.error('Handle payment failure error:', error);
  }
};

// ========================================
// EXPORT ALL CONTROLLER FUNCTIONS
// ========================================

module.exports = {
  getPaymentConfig,
  handleStripeWebhook
};


