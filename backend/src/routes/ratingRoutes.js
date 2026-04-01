const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { idValidation } = require('../middleware/validation');

// Protected routes
router.get('/', auth, ratingController.getAllRatings);
router.get('/match-history', auth, checkRole(['captain', 'admin']), ratingController.getMatchHistoryForRating);
router.get('/:id', auth, ...idValidation, ratingController.getRatingById);
router.post('/opponent', auth, checkRole(['captain', 'admin']), ratingController.createOpponentRating);
router.post('/', auth, checkRole(['player', 'captain', 'admin']), ratingController.createRating);
router.put('/:id', auth, checkRole(['player', 'captain', 'admin']), ...idValidation, ratingController.updateRating);
router.delete('/:id', auth, checkRole(['player', 'captain', 'admin']), ...idValidation, ratingController.deleteRating);

module.exports = router;
