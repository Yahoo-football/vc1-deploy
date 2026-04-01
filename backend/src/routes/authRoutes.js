const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const improvedAuthController = require('../controllers/improvedAuthController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { userValidation } = require('../middleware/validation');
const authValidator = require('../validators/authValidator');
const { roleRequestPaymentUpload, validateUploadedFile } = require('../middleware/upload');

router.post('/forgot-password', authController.requestPasswordOtp);
router.post('/forgot-password/verify', authController.verifyPasswordOtp);
router.post('/forgot-password/reset', authController.resetPasswordWithOtp);
router.post('/forgot-password-link', authController.requestPasswordResetLink);
router.post('/reset-password', authController.resetPasswordWithToken);

router.post('/register', userValidation.register, authController.register);
router.post('/login', userValidation.login, authController.login);
router.get('/google/config', authController.getGoogleAuthConfig);
router.post('/google', authController.googleAuth);
router.get('/profile', auth, authController.getProfile);
router.get('/profile/stats', auth, authController.getProfileStats);
router.put('/profile', auth, userValidation.updateProfile, authController.updateProfile);
router.post('/change-password', auth, userValidation.changePassword, authController.changePassword);
router.get('/role-requests', auth, authController.getRoleRequests);
router.post(
  '/role-requests',
  auth,
  roleRequestPaymentUpload.single('paymentProof'),
  validateUploadedFile,
  userValidation.requestRoleUpgrade,
  authController.requestRoleUpgrade
);
router.delete('/role-requests/:id', auth, authController.cancelRoleRequest);
router.get('/admin/role-requests', auth, checkRole(['admin']), authController.getAllRoleRequestsForAdmin);
router.patch('/admin/role-requests/:id/review', auth, checkRole(['admin']), authController.reviewRoleRequest);
router.post('/profile/avatar', auth, authController.uploadProfileAvatar);
router.delete('/profile/avatar', auth, authController.deleteProfileAvatar);
router.post('/request-field-owner', auth, authValidator.requestFieldOwner, improvedAuthController.requestFieldOwnerRole);

// Diagnostic endpoint to test the route
router.get('/test-request-field-owner', auth, (req, res) => {
  res.json({ 
    message: 'Field owner request endpoint is accessible',
    userId: req.user?.id 
  });
});

module.exports = router;
