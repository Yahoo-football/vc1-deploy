const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { userValidation, idValidation } = require('../middleware/validation');

// Public routes
router.post('/register', ...userValidation.register, userController.createUser);

// Protected routes
router.get('/', auth, checkRole(['admin']), userController.getAllUsers);

// allow search for any authenticated user (used by captains when inviting)
router.get('/search', auth, userController.searchUsers);

router.get('/:id', auth, checkRole(['admin']), ...idValidation, userController.getUserById);
router.put('/:id', auth, checkRole(['admin']), ...idValidation, userController.updateUser);
router.delete('/:id', auth, checkRole(['admin']), ...idValidation, userController.deleteUser);

module.exports = router;
