const express = require('express');
const router = express.Router();
const authController = require('../controllers/improvedAuthController');
const auth = require('../middleware/auth');
const authValidator = require('../validators/authValidator');

// Routes - Authentication
router.post('/register', authValidator.register, authController.register);
router.post('/login', authValidator.login, authController.login);
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, authValidator.updateProfile, authController.updateProfile);
router.post('/request-field-owner', auth, authValidator.requestFieldOwner, authController.requestFieldOwnerRole);

// Routes - Public
router.get('/public/profile/:id', authController.getPublicProfile);

module.exports = router;
