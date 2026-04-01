const fs = require('fs');
const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors interactions.
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file?.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded file after validation error:', cleanupError);
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

const userValidation = {
  register: [
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ max: 50 })
      .withMessage('First name must be less than 50 characters'),
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    body('phone')
      .optional()
      .matches(/^[0-9+\-\s()]{7,20}$/)
      .withMessage('Please provide a valid phone number'),
    body('role')
      .optional()
      .isIn(['guest', 'player', 'captain', 'field_owner', 'admin'])
      .withMessage('Role must be one of: guest, player, captain, field_owner, admin'),
    handleValidationErrors
  ],
  
  login: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ],

  updateProfile: [
    body('email')
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('firstName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('First name must be less than 50 characters'),
    body('lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name must be less than 50 characters'),
    body('phone')
      .optional({ checkFalsy: true })
      .matches(/^[0-9+\-\s()]{7,20}$/)
      .withMessage('Please provide a valid phone number'),
    body('address')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Address must be less than 500 characters'),
    body('dateOfBirth')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('Please provide a valid date'),
    body('gender')
      .optional({ checkFalsy: true })
      .isIn(['male', 'female', 'other'])
      .withMessage('Gender must be one of: male, female, other'),
    handleValidationErrors
  ],

    requestRoleUpgrade: [
      body('requestedRole')
        .notEmpty()
        .withMessage('Requested role is required')
        .isIn(['captain', 'field_owner'])
        .withMessage('Requested role must be captain or field_owner'),
      body('paymentAcknowledged')
        .custom((value) => value === true || value === 'true')
        .withMessage('Payment acknowledgement is required'),
      body('paymentAccountName')
        .notEmpty()
        .withMessage('Payment account name is required')
        .isLength({ min: 2, max: 80 })
        .withMessage('Payment account name must be between 2 and 80 characters'),
      body('paymentPhone')
        .notEmpty()
        .withMessage('Payment phone is required')
        .matches(/^[0-9+\-\s()]{7,20}$/)
        .withMessage('Please provide a valid payment phone number'),
      body('paymentReference')
        .optional()
        .isString()
        .isLength({ max: 120 })
        .withMessage('Payment reference must be a string up to 120 characters'),
    body('note')
      .optional({ checkFalsy: true })
      .isLength({ max: 500 })
      .withMessage('Note must be less than 500 characters'),
    handleValidationErrors
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Please confirm your new password')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('New passwords do not match'),
    handleValidationErrors
  ]
};

const fieldValidation = {
  create: [
    body('name')
      .notEmpty()
      .withMessage('Field name is required')
      .isLength({ max: 100 })
      .withMessage('Field name must be less than 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('address')
      .notEmpty()
      .withMessage('Address is required'),
    body('pricePerHour')
      .isFloat({ min: 0 })
      .withMessage('Price per hour must be a positive number'),
    body('discountPercent')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Discount percent must be between 0 and 100'),
    body('status')
      .optional()
      .isIn(['available', 'unavailable', 'maintenance'])
      .withMessage('Status must be available, unavailable, or maintenance'),
    body('capacity')
      .isInt({ min: 1 })
      .withMessage('Capacity must be a positive integer'),
    handleValidationErrors
  ]
};

const bookingValidation = {
  create: [
    body('fieldId')
      .isInt({ min: 1 })
      .withMessage('Field ID must be a positive integer'),
    body('startTime')
      .isISO8601()
      .withMessage('Start time must be a valid date'),
    body('endTime')
      .isISO8601()
      .withMessage('End time must be a valid date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startTime)) {
          throw new Error('End time must be after start time');
        }
        return true;
      }),
    body('teamId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Team ID must be a positive integer'),
    handleValidationErrors
  ]
};

const teamValidation = {
  create: [
    body('name')
      .notEmpty()
      .withMessage('Team name is required')
      .isLength({ max: 100 })
      .withMessage('Team name must be less than 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    handleValidationErrors
  ],
  invite: [
    body('email')
      .notEmpty()
      .withMessage('email is required')
      .isEmail()
      .withMessage('email must be valid')
      .normalizeEmail(),
    handleValidationErrors
  ]
};

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
  handleValidationErrors
];

const searchValidation = [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters long'),
  query('type')
    .optional()
    .isIn(['users', 'fields', 'teams'])
    .withMessage('Type must be one of: users, fields, teams'),
  handleValidationErrors
];

module.exports = {
  userValidation,
  fieldValidation,
  bookingValidation,
  teamValidation,
  idValidation,
  searchValidation,
  handleValidationErrors
};
