const express = require('express');
const router = express.Router();
const publicTeamController = require('../controllers/publicTeamController');
const auth = require('../middleware/auth');
const { idValidation } = require('../middleware/validation');

// Public team browsing (safe fields only)
router.get('/', auth.optionalAuth, publicTeamController.getPublicTeams);
router.get('/:id/matches', auth.optionalAuth, ...idValidation, publicTeamController.getPublicTeamMatchHistory);
router.get('/:id', auth.optionalAuth, ...idValidation, publicTeamController.getPublicTeamById);

module.exports = router;

