const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { idValidation } = require('../middleware/validation');

// Protected routes
router.get('/', auth, notificationController.getAllNotifications);
router.get('/:id', auth, ...idValidation, notificationController.getNotificationById);
router.post('/', auth, checkRole(['admin']), notificationController.createNotification);
router.put('/:id', auth, ...idValidation, notificationController.updateNotification);
router.delete('/:id', auth, ...idValidation, notificationController.deleteNotification);

module.exports = router;
