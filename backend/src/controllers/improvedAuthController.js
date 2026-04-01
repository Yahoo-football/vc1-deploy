const authService = require('../services/authService');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Improved Auth Controller
 * Only handles HTTP requests/responses
 * Business logic is delegated to authService
 */

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  try {
    const userData = req.body;
    const user = await authService.register(userData);
    
    res.status(201).json({
      success: true,
      data: user,
      message: 'User registered successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
const login = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    const result = await authService.login(email, password, ip);
    
    res.json({
      success: true,
      data: result,
      message: 'Login successful'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
});

/**
 * GET /api/auth/profile
 * Get user profile
 */
const getProfile = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await authService.getProfile(userId);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || 'Profile not found'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;
    
    const user = await authService.updateProfile(userId, updateData);
    
    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Profile update failed'
    });
  }
});

/**
 * POST /api/auth/request-field-owner
 * Request field owner role
 */
const requestFieldOwnerRole = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const requestData = req.body || {};
    console.log('Field owner request submitted by user:', userId);
    
    const result = await authService.requestFieldOwnerRole(userId, requestData);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Field owner role request submitted successfully'
    });
  } catch (error) {
    console.error('Field owner request error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Request failed',
      error: error.message
    });
  }
});

/**
 * GET /api/auth/public/profile/:id
 * Get public profile
 */
const getPublicProfile = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await authService.getPublicProfile(userId);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || 'Profile not found'
    });
  }
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  requestFieldOwnerRole,
  getPublicProfile
};
