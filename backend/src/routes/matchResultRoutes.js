const express = require('express');
const router = express.Router();
const matchResultController = require('../controllers/matchResultController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { idValidation } = require('../middleware/validation');

// Protected routes
router.get('/', auth, matchResultController.getAllMatchResults);
router.get('/:id', auth, ...idValidation, matchResultController.getMatchResultById);
router.post('/', auth, checkRole(['captain', 'field_owner', 'admin']), matchResultController.createMatchResult);
router.put('/:id', auth, checkRole(['captain', 'field_owner', 'admin']), ...idValidation, matchResultController.updateMatchResult);
router.delete('/:id', auth, checkRole(['captain', 'field_owner', 'admin']), ...idValidation, matchResultController.deleteMatchResult);

module.exports = router;
