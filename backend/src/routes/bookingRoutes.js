const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');

const checkRole = require('../middleware/role');
const { bookingValidation, idValidation } = require('../middleware/validation');

// Public route for landing page statistics (no auth required)
router.get('/public/stats', bookingController.getPublicBookingStats);
router.get('/public/schedule', bookingController.getPublicBookingSchedule);

router.post('/', auth, checkRole(['captain']), ...bookingValidation.create, bookingController.createBooking);
router.get('/', auth, bookingController.getBookings);
router.get('/schedule', auth, bookingController.getBookingSchedule);
router.get('/open-matches', auth, bookingController.getOpenMatches);
router.get('/:id', auth, ...idValidation, bookingController.getBookingById);
router.put('/:id', auth, ...idValidation, bookingController.updateBookingStatus);
router.patch('/:id/confirm-match', auth, checkRole(['field_owner', 'admin']), ...idValidation, bookingController.confirmMatchTeams);
router.patch('/:id/open-for-opponents', auth, ...idValidation, bookingController.toggleOpenForOpponents);
router.post('/:id/join-requests', auth, ...idValidation, bookingController.requestJoinMatch);
router.get('/:id/join-requests', auth, ...idValidation, bookingController.getBookingJoinRequests);
router.patch('/:id/join-requests/:requestId', auth, ...idValidation, bookingController.respondToJoinRequest);
router.patch('/:id/cancel-matched-opponent', auth, ...idValidation, bookingController.cancelMatchedOpponent);

module.exports = router;
