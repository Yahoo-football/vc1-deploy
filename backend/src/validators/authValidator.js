/**
 * Authentication Validators
 * Handles input validation for authentication endpoints
 */

/**
 * Validate registration data
 */
// Validate register before continuing.
const validateRegister = (req, res, next) => {
  const { username, email, password, firstName, lastName, phone, role } = req.body;
  const errors = [];
  
  // Required fields
  if (!username || username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Valid email is required');
  }
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (!firstName || firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters long');
  }
  
  if (!lastName || lastName.trim().length < 2) {
    errors.push('Last name must be at least 2 characters long');
  }
  
  // Optional fields validation
  if (phone && !/^\+?[\d\s-()]+$/.test(phone)) {
    errors.push('Invalid phone number format');
  }
  
  if (role && !['admin', 'field_owner', 'player', 'captain', 'guest'].includes(role)) {
    errors.push('Invalid role. Must be one of: admin, field_owner, player, captain, guest');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};

/**
 * Validate login data
 */
// Validate login before continuing.
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Valid email is required');
  }
  
  if (!password) {
    errors.push('Password is required');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};

/**
 * Validate profile update data
 */
// Validate update profile before continuing.
const validateUpdateProfile = (req, res, next) => {
  const { username, email, firstName, lastName, phone, password } = req.body;
  const errors = [];
  
  // Optional fields validation
  if (username && username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Valid email is required');
  }
  
  if (firstName && firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters long');
  }
  
  if (lastName && lastName.trim().length < 2) {
    errors.push('Last name must be at least 2 characters long');
  }
  
  if (phone && !/^\+?[\d\s-()]+$/.test(phone)) {
    errors.push('Invalid phone number format');
  }
  
  if (password && password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};


const validateFieldOwnerRequest = (req, res, next) => {
  try {
    const { fieldName, location } = req.body || {};
    const errors = [];

    if (!fieldName || !String(fieldName).trim()) {
      errors.push('Field name is required');
    }
    if (!location || !String(location).trim()) {
      errors.push('Location is required');
    }

    if (errors.length > 0) {
      console.log('[Validator] Validation failed:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    console.log('[Validator] Validation passed');
    next();
  } catch (error) {
    console.error('[Validator] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Validation error: ' + error.message
    });
  }
};

module.exports = {
  register: validateRegister,
  login: validateLogin,
  updateProfile: validateUpdateProfile,
  requestFieldOwner: validateFieldOwnerRequest
};
