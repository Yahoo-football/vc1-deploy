const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const ownerMvpController = require('../controllers/ownerMvpController');

router.get('/matches', auth, checkRole(['field_owner']), ownerMvpController.getOwnerMvpMatches);
router.patch('/matches/:bookingId/mvp', auth, checkRole(['field_owner']), ownerMvpController.setOwnerMatchMvp);

module.exports = router;
