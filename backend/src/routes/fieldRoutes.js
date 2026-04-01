const express = require('express');
const router = express.Router();
const fieldController = require('../controllers/fieldController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { fieldValidation, idValidation } = require('../middleware/validation');

// Public routes
router.get('/', fieldController.getFields);

// Field Owner/Admin convenience route
router.get('/my-fields', auth, checkRole(['field_owner', 'admin']), fieldController.getMyFields);
router.get('/:id/ratings', ...idValidation, fieldController.getFieldRatings);
router.get('/:id', ...idValidation, fieldController.getField);

// Protected routes (Field Owner, Admin)
router.post('/:id/rate', auth, checkRole(['player', 'captain', 'admin']), ...idValidation, fieldController.rateField);
router.post('/', auth, checkRole(['field_owner', 'admin']), ...fieldValidation.create, fieldController.createField);
router.put('/:id', auth, checkRole(['field_owner', 'admin']), ...idValidation, ...fieldValidation.create, fieldController.updateField);
router.post('/:id/images', auth, checkRole(['field_owner', 'admin']), ...idValidation, fieldController.uploadFieldImages);
router.delete('/:id/images/:imageId', auth, checkRole(['field_owner', 'admin']), ...idValidation, fieldController.deleteFieldImage);
router.patch('/:id/images/:imageId/cover', auth, checkRole(['field_owner', 'admin']), ...idValidation, fieldController.setFieldCoverImage);
router.delete('/:id', auth, checkRole(['field_owner', 'admin']), ...idValidation, fieldController.deleteField);

module.exports = router;
