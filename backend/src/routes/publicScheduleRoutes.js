const express = require('express');
const router = express.Router();
const publicScheduleController = require('../controllers/publicScheduleController');

router.get('/', publicScheduleController.getPublicSchedule);

module.exports = router;
