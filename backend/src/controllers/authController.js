const { Op } = require('sequelize');
const { User, Team, TeamMember, Field, Booking, RoleRequest } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Magic number signatures for common image formats
const FILE_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
};

// Validate file signature before continuing.
const validateFileSignature = (buffer, mimetype) => {
  const signatures = FILE_SIGNATURES[mimetype];
  if (!signatures) return false;
  return signatures.some(signature => {
    return signature.every((byte, index) => buffer[index] === byte);
  });
};
const serverConfig = require('../config/serverConfig');
const { getRoleUpgradeConfig } = require('../config/roleUpgradeConfig');
const { createInAppNotification } = require('../utils/notify');
const { sendEmail } = require('../utils/emailService');
const { getUploadDir, resolveManagedUploadPath } = require('../utils/storagePaths');
const crypto = require('crypto');
const axios = require('axios');

const DEFAULT_AVATAR_PATH = '/uploads/profile/default_profile.jpg';
const LEGACY_DEFAULT_AVATAR_PATH = '/uploads/profile/defualt_profile.jpg';
const REQUESTABLE_ROLES_BY_USER_ROLE = {
  player: ['captain', 'field_owner'],
  captain: ['field_owner']
};

const ROLE_REQUEST_LABELS = {
  captain: 'captain',
  field_owner: 'field owner'
};

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_RESENDS = 3;
const otpStore = new Map();

const RESET_TTL_MS = 30 * 60 * 1000;
const resetTokenStore = new Map();

const normalizeIdentifier = (value = '') => String(value).trim().toLowerCase();

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const getGoogleClientId = () =>
  String(process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim();

const sanitizeUsernamePart = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);

const buildUniqueGoogleUsername = async ({ email, firstName, lastName }) => {
  const emailPrefix = sanitizeUsernamePart(String(email || '').split('@')[0]);
  const firstPart = sanitizeUsernamePart(firstName);
  const lastPart = sanitizeUsernamePart(lastName);
  const base =
    [firstPart, lastPart].filter(Boolean).join('') ||
    emailPrefix ||
    `player${Date.now()}`;

  let candidate = base.slice(0, 30) || `player${Date.now()}`;
  let suffix = 0;

  while (true) {
    const existing = await User.findOne({ where: { username: candidate } });
    if (!existing) return candidate;
    suffix += 1;
    const suffixText = String(suffix);
    const trimmedBase = base.slice(0, Math.max(3, 30 - suffixText.length));
    candidate = `${trimmedBase}${suffixText}`;
  }
};

const verifyGoogleIdToken = async (idToken) => {
  const response = await axios.get(GOOGLE_TOKENINFO_URL, {
    params: { id_token: idToken },
    timeout: 10000
  });

  const payload = response.data || {};
  const expectedAudience = getGoogleClientId();

  if (!expectedAudience) {
    throw new Error('Google sign-in is not configured on the server.');
  }

  if (expectedAudience && payload.aud !== expectedAudience) {
    throw new Error('Google token audience mismatch.');
  }

  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('Google email is not verified.');
  }

  return payload;
};

const findUserByIdentifier = async (identifier) => {
  if (!identifier) return null;
  return User.findOne({
    where: {
      [Op.or]: [
        { email: identifier },
        { phone: identifier }
      ]
    }
  });
};
const serializeRoleRequest = (roleRequest) => ({
  id: roleRequest.id,
  requestedRole: roleRequest.requestedRole,
  status: roleRequest.status,
  feeAmountUsd: Number(roleRequest.feeAmountUsd || 0),
  paymentStatus: roleRequest.paymentStatus || 'paid',
  paymentReference: roleRequest.paymentReference || '',
  paymentAccountName: roleRequest.paymentAccountName || '',
  paymentPhone: roleRequest.paymentPhone || '',
  paymentScreenshotUrl: roleRequest.paymentScreenshotUrl || '',
  paymentPaidAt: roleRequest.paymentPaidAt,
  note: roleRequest.note || '',
  reviewedBy: roleRequest.reviewedBy,
  reviewedAt: roleRequest.reviewedAt,
  createdAt: roleRequest.createdAt,
  updatedAt: roleRequest.updatedAt
});

const buildUploadedAssetPath = (filePath = '') => {
  const uploadRoot = path.join(process.cwd(), serverConfig.upload.destination || 'uploads');
  const relativePath = path.relative(uploadRoot, filePath || '');
  if (!relativePath || relativePath.startsWith('..')) {
    return '';
  }

  return `/uploads/${relativePath.replace(/\\/g, '/')}`;
};

const resolveUploadedAssetAbsolutePath = (assetPath = '') => {
  const normalizedAssetPath = String(assetPath || '').trim();
  if (!normalizedAssetPath.startsWith('/uploads/')) {
    return '';
  }

  const relativePath = normalizedAssetPath.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
  return path.join(process.cwd(), serverConfig.upload.destination || 'uploads', relativePath);
};

const cleanupUploadedFile = (filePath = '') => {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (cleanupError) {
    console.error('Failed to clean up uploaded file:', cleanupError);
  }
};

const cleanupRoleRequestPaymentProof = (roleRequest) => {
  const absolutePath = resolveUploadedAssetAbsolutePath(roleRequest?.paymentScreenshotUrl);
  cleanupUploadedFile(absolutePath);
};

const getAllowedRequestedRoles = (currentRole) => REQUESTABLE_ROLES_BY_USER_ROLE[currentRole] || [];

// Support register for this module.
const register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone, role } = req.body;
    
    // Enhanced validation
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Please provide all required fields: username, email, password, firstName, lastName.' 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Username validation
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters.' });
    }

    // Check if user exists (prevent user enumeration with generic message)
    const existingUser = await User.findOne({ where: { email } });
    const existingUsername = await User.findOne({ where: { username } });

    if (existingUser || existingUsername) {
      return res.status(400).json({ error: 'Email or username already in use.' });
    }

    // Hash password with stronger salt rounds
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      role: role || 'player'
    });

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Return user data without password
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };

    res.status(201).json({ user: userResponse, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

// Support login for this module.
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Please provide email and password.' 
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(400).json({ error: 'Account is not active. Please contact support.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Return user data without password
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    res.json({ user: userResponse, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
};

const getGoogleAuthConfig = async (req, res) => {
  const clientId = getGoogleClientId();

  return res.json({
    enabled: Boolean(clientId),
    clientId: clientId || null
  });
};

const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required.' });
    }

    const googleProfile = await verifyGoogleIdToken(credential);
    const email = normalizeIdentifier(googleProfile.email);

    if (!email) {
      return res.status(400).json({ error: 'Google account email is missing.' });
    }

    let user = await User.findOne({ where: { email } });

    if (user) {
      if (user.status !== 'active') {
        return res.status(400).json({ error: 'Account is not active. Please contact support.' });
      }

      const updatePayload = {
        lastLogin: new Date(),
        emailVerified: true
      };

      if (!user.avatarUrl && googleProfile.picture) {
        updatePayload.avatarUrl = googleProfile.picture;
      }

      await user.update(updatePayload);
    } else {
      const firstName = String(googleProfile.given_name || googleProfile.name || 'Google').trim();
      const lastName = String(googleProfile.family_name || 'User').trim();
      const username = await buildUniqueGoogleUsername({
        email,
        firstName,
        lastName
      });
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      user = await User.create({
        username,
        email,
        password: hashedPassword,
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        role: 'player',
        status: 'active',
        emailVerified: true,
        avatarUrl: googleProfile.picture || null,
        lastLogin: new Date()
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    return res.json({ user: userResponse, token });
  } catch (error) {
    console.error('Google auth error:', error?.response?.data || error);
    return res.status(500).json({
      error:
        error?.response?.status === 400
          ? 'Invalid Google sign-in token.'
          : error.message || 'Internal server error during Google authentication.'
    });
  }
};
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { 
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error while fetching profile.' });
  }
};

// Update profile in local state.
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, firstName, lastName, phone, address, dateOfBirth, gender, avatarUrl } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update user with provided fields
    const updateData = {};
    if (email !== undefined && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email is already in use.' });
      }
      updateData.email = String(email).trim();
    }
    if (firstName !== undefined) updateData.firstName = String(firstName).trim();
    if (lastName !== undefined) updateData.lastName = String(lastName).trim();
    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
    if (address !== undefined) updateData.address = address ? String(address).trim() : null;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    if (updateData.firstName !== undefined && !updateData.firstName) {
      return res.status(400).json({ error: 'First name is required.' });
    }

    if (updateData.lastName !== undefined && !updateData.lastName) {
      return res.status(400).json({ error: 'Last name is required.' });
    }

    await user.update(updateData);

    // Return updated user without password
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({ 
      message: 'Profile updated successfully.', 
      user: userResponse 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      const message = error.errors?.[0]?.message || 'Invalid profile data.';
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: 'Internal server error while updating profile.' });
  }
};

const getProfileStats = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'role', 'createdAt']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const role = user.role;
    const userId = user.id;

    let totalBookings = 0;
    let confirmedBookings = 0;
    let teamsManaged = 0;

    if (role === 'field_owner') {
      const fields = await Field.findAll({
        where: { ownerId: userId },
        attributes: ['id'],
        raw: true
      });
      const fieldIds = fields.map((f) => f.id);

      if (fieldIds.length > 0) {
        const bookings = await Booking.findAll({
          where: { fieldId: { [Op.in]: fieldIds } },
          attributes: ['status', 'teamId', 'opponentTeamId'],
          raw: true
        });

        totalBookings = bookings.length;
        confirmedBookings = bookings.filter(
          (b) => b.status === 'confirmed' || b.status === 'completed'
        ).length;

        const teamIds = new Set();
        for (const b of bookings) {
          if (b.teamId) teamIds.add(Number(b.teamId));
          if (b.opponentTeamId) teamIds.add(Number(b.opponentTeamId));
        }
        teamsManaged = teamIds.size;
      }
    } else if (role === 'captain') {
      const [captainedTeams, myBookings] = await Promise.all([
        Team.count({ where: { captainId: userId } }),
        Booking.findAll({
          where: { createdBy: userId },
          attributes: ['status'],
          raw: true
        })
      ]);
      teamsManaged = captainedTeams;
      totalBookings = myBookings.length;
      confirmedBookings = myBookings.filter(
        (b) => b.status === 'confirmed' || b.status === 'completed'
      ).length;
    } else {
      const [myBookings, myTeams] = await Promise.all([
        Booking.findAll({
          where: { createdBy: userId },
          attributes: ['status'],
          raw: true
        }),
        TeamMember.count({
          where: { userId, status: 'accepted', isActive: true }
        })
      ]);

      totalBookings = myBookings.length;
      confirmedBookings = myBookings.filter(
        (b) => b.status === 'confirmed' || b.status === 'completed'
      ).length;
      teamsManaged = myTeams;
    }

    const created = new Date(user.createdAt);
    const yearsActive =
      Number.isNaN(created.getTime())
        ? 0
        : Number(Math.max(0, (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));

    const fieldEfficiency = totalBookings > 0 ? Math.round((confirmedBookings / totalBookings) * 100) : 0;

    res.json({
      success: true,
      data: {
        role,
        totalBookings,
        confirmedBookings,
        teamsManaged,
        yearsActive,
        fieldEfficiency,
        memberSince: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'
      }
    });
  } catch (error) {
    console.error('Get profile stats error:', error);
    res.status(500).json({ error: 'Internal server error while fetching profile stats.' });
  }
};
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (sameAsCurrent) {
      return res.status(400).json({ error: 'New password must be different from current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hashedPassword });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error while changing password.' });
  }
};

const requestPasswordOtp = async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body?.identifier);
    if (!identifier) {
      return res.status(400).json({ error: 'Email or phone is required.' });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const existing = otpStore.get(identifier);
    const resendCount = existing?.resendCount || 0;
    if (resendCount >= OTP_MAX_RESENDS) {
      return res.status(429).json({ error: 'OTP resend limit reached. Please try again later.' });
    }

    const otp = generateOtpCode();
    const expiresAt = Date.now() + OTP_TTL_MS;
    otpStore.set(identifier, {
      otp,
      expiresAt,
      attempts: 0,
      resendCount: resendCount + 1
    });

    if (identifier.includes('@')) {
      await sendEmail({
        to: identifier,
        subject: 'Your OTP code',
        text: `Your OTP code is ${otp}. It expires in 5 minutes.`,
        html: `<p>Your OTP code is <strong>${otp}</strong>. It expires in 5 minutes.</p>`
      });
    } else {
      console.log(`[otp] SMS OTP issued for ${identifier}`);
    }

    res.json({ message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('Request password OTP error:', error);
    res.status(500).json({ error: 'Internal server error while sending OTP.' });
  }
};

const verifyPasswordOtp = async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body?.identifier);
    const otp = String(req.body?.otp || '').trim();
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Identifier and OTP are required.' });
    }

    const entry = otpStore.get(identifier);
    if (!entry) {
      return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(identifier);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(identifier);
      return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
    }

    if (entry.otp !== otp) {
      entry.attempts += 1;
      otpStore.set(identifier, entry);
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    res.json({ message: 'OTP verified.' });
  } catch (error) {
    console.error('Verify password OTP error:', error);
    res.status(500).json({ error: 'Internal server error while verifying OTP.' });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body?.identifier);
    const otp = String(req.body?.otp || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ error: 'Identifier, OTP, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const entry = otpStore.get(identifier);
    if (!entry) {
      return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(identifier);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (entry.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hashedPassword });
    otpStore.delete(identifier);

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error while resetting password.' });
  }
};

const requestPasswordResetLink = async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body?.identifier);
    if (!identifier) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + RESET_TTL_MS;
    resetTokenStore.set(token, { userId: user.id, expiresAt });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your password',
      text: `Reset your password using this link: ${resetLink}`,
      html: `<p>Reset your password using this link:</p><p><a href="${resetLink}">${resetLink}</a></p>`
    });

    res.json({
      message: 'Password reset link sent.',
      resetLink: process.env.NODE_ENV !== 'production' ? resetLink : undefined
    });
  } catch (error) {
    console.error('Request reset link error:', error);
    res.status(500).json({ error: 'Internal server error while sending reset link.' });
  }
};

const resetPasswordWithToken = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const entry = resetTokenStore.get(token);
    if (!entry) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    if (Date.now() > entry.expiresAt) {
      resetTokenStore.delete(token);
      return res.status(400).json({ error: 'Reset token expired.' });
    }

    const user = await User.findByPk(entry.userId);
    if (!user) {
      resetTokenStore.delete(token);
      return res.status(404).json({ error: 'Account not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password: hashedPassword });
    resetTokenStore.delete(token);

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error while resetting password.' });
  }
};
const uploadProfileAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const maxAvatarSize = serverConfig.upload.maxSize;
    const uploadDir = getUploadDir('profile');
    fs.mkdirSync(uploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: (innerReq, file, cb) => cb(null, uploadDir),
      filename: (innerReq, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `user_${userId}_${Date.now()}${ext}`);
      }
    });

    const upload = multer({
      storage,
      limits: { fileSize: maxAvatarSize },
      fileFilter: (innerReq, file, cb) => {
        if (!serverConfig.isAllowedImageUpload(file)) {
          return cb(new Error('Invalid file type'));
        }
        cb(null, true);
      }
    }).single('avatar');

    upload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMb = Math.round(maxAvatarSize / (1024 * 1024));
          return res.status(400).json({ error: `Avatar image must be ${maxMb}MB or smaller` });
        }
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file signature to prevent malicious uploads
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const isValid = validateFileSignature(fileBuffer.slice(0, 10), req.file.mimetype);

        if (!isValid) {
          // Delete the invalid file
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            error: 'File content does not match the declared type. Upload rejected for security reasons.'
          });
        }
      } catch (validationError) {
        console.error('File signature validation error:', validationError);
        try {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Failed to cleanup invalid file:', cleanupError);
        }
        return res.status(500).json({ error: 'File validation failed' });
      }

      try {
        if (
          user.avatarUrl &&
          typeof user.avatarUrl === 'string' &&
          user.avatarUrl.startsWith('/uploads/') &&
          user.avatarUrl !== DEFAULT_AVATAR_PATH &&
          user.avatarUrl !== LEGACY_DEFAULT_AVATAR_PATH
        ) {
          const previousAbsolutePath =
            resolveUploadedAssetAbsolutePath(user.avatarUrl) || resolveManagedUploadPath(user.avatarUrl);

          if (previousAbsolutePath && fs.existsSync(previousAbsolutePath)) {
            fs.unlinkSync(previousAbsolutePath);
          }
        }
      } catch (unlinkError) {
        // Ignore unlink errors
      }

      const avatarUrl = `/uploads/profile/${req.file.filename}`;
      await user.update({ avatarUrl });

      const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        address: user.address,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        avatarUrl: user.avatarUrl,
        status: user.status,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      res.json({
        message: 'Avatar uploaded successfully.',
        avatarUrl,
        user: userResponse
      });
    });
  } catch (error) {
    console.error('Upload profile avatar error:', error);
    res.status(500).json({ error: 'Internal server error while uploading avatar.' });
  }
};

// Support delete profile avatar for this module.
const deleteProfileAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    try {
      if (
        user.avatarUrl &&
        typeof user.avatarUrl === 'string' &&
        user.avatarUrl.startsWith('/uploads/') &&
        user.avatarUrl !== DEFAULT_AVATAR_PATH &&
        user.avatarUrl !== LEGACY_DEFAULT_AVATAR_PATH
      ) {
        const previousAbsolutePath =
          resolveUploadedAssetAbsolutePath(user.avatarUrl) || resolveManagedUploadPath(user.avatarUrl);

        if (previousAbsolutePath && fs.existsSync(previousAbsolutePath)) {
          fs.unlinkSync(previousAbsolutePath);
        }
      }
    } catch (unlinkError) {
      // Ignore unlink errors
    }

    await user.update({ avatarUrl: null });

    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      message: 'Avatar removed successfully.',
      user: userResponse
    });
  } catch (error) {
    console.error('Delete profile avatar error:', error);
    res.status(500).json({ error: 'Internal server error while deleting avatar.' });
  }
};

// Get role requests for the current flow.
const getRoleRequests = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'role']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const requests = await RoleRequest.findAll({
      where: { requesterId: user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      currentRole: user.role,
      availableRoles: getAllowedRequestedRoles(user.role),
      upgradePlans: Object.fromEntries(
        getAllowedRequestedRoles(user.role)
          .map((roleKey) => [roleKey, getRoleUpgradeConfig(roleKey)])
          .filter(([, value]) => Boolean(value))
      ),
      hasPendingRequest: requests.some((request) => request.status === 'pending'),
      requests: requests.map(serializeRoleRequest)
    });
  } catch (error) {
    console.error('Get role requests error:', error);
    res.status(500).json({ error: 'Internal server error while fetching role requests.' });
  }
};

// Request role upgrade from the API.
const requestRoleUpgrade = async (req, res) => {
  try {
    const {
      requestedRole,
      note,
      paymentAcknowledged,
      paymentReference,
      paymentAccountName,
      paymentPhone
    } = req.body;
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'username', 'firstName', 'lastName', 'role']
    });

    if (!user) {
      cleanupUploadedFile(req.file?.path);
      return res.status(404).json({ error: 'User not found.' });
    }

    const allowedRoles = getAllowedRequestedRoles(user.role);
    if (!allowedRoles.includes(requestedRole)) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({
        error: 'Your current account cannot request that role.'
      });
    }

    const upgradePlan = getRoleUpgradeConfig(requestedRole);
    if (!upgradePlan) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({ error: 'Upgrade plan is not available.' });
    }

    if (paymentAcknowledged !== true && paymentAcknowledged !== 'true') {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({
        error: `Payment confirmation is required before requesting ${ROLE_REQUEST_LABELS[requestedRole]} access.`
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Please upload your payment screenshot before submitting the upgrade request.'
      });
    }

    const existingPendingRequest = await RoleRequest.findOne({
      where: {
        requesterId: user.id,
        status: 'pending'
      }
    });

    if (existingPendingRequest) {
      cleanupUploadedFile(req.file?.path);
      return res.status(400).json({
        error: `You already have a pending request to become a ${ROLE_REQUEST_LABELS[existingPendingRequest.requestedRole]}.`
      });
    }

    const roleRequest = await RoleRequest.create({
      requesterId: user.id,
      requestedRole,
      feeAmountUsd: upgradePlan.feeUsd,
      paymentStatus: 'paid',
      paymentReference: paymentReference?.trim() || `ROLE-${requestedRole.toUpperCase()}-${Date.now()}`,
      paymentAccountName: paymentAccountName?.trim() || null,
      paymentPhone: paymentPhone?.trim() || null,
      paymentScreenshotUrl: buildUploadedAssetPath(req.file.path),
      paymentPaidAt: new Date(),
      note: note?.trim() || null
    });

    const admins = await User.findAll({
      where: { role: 'admin', status: 'active' },
      attributes: ['id']
    });

    if (admins.length > 0) {
      const requesterName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email;

      await Promise.allSettled(
        admins.map((admin) =>
          createInAppNotification({
            userId: admin.id,
            type: 'system',
            title: `${requestedRole === 'captain' ? 'Captain' : 'Field owner'} role request`,
            message: `${requesterName} submitted ${ROLE_REQUEST_LABELS[requestedRole]} payment proof for $${upgradePlan.feeUsd}.`,
            metadata: {
              event: 'role_request',
              requestId: roleRequest.id,
              requesterId: user.id,
              requestedRole,
              feeAmountUsd: upgradePlan.feeUsd,
              paymentStatus: 'paid',
              paymentScreenshotUrl: roleRequest.paymentScreenshotUrl,
              status: 'pending'
            }
          })
        )
      );
    }

    res.status(201).json({
      message: `Your payment proof for ${ROLE_REQUEST_LABELS[requestedRole]} access has been submitted. Admins will verify it now.`,
      roleRequest: serializeRoleRequest(roleRequest)
    });
  } catch (error) {
    cleanupUploadedFile(req.file?.path);
    console.error('Request role upgrade error:', error);
    res.status(500).json({ error: 'Internal server error while submitting role request.' });
  }
};

// Check whether cel role request is allowed.
const cancelRoleRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Invalid request id.' });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'username', 'firstName', 'lastName']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const roleRequest = await RoleRequest.findOne({
      where: {
        id: requestId,
        requesterId: user.id
      }
    });

    if (!roleRequest) {
      return res.status(404).json({ error: 'Role request not found.' });
    }

    if (roleRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending role requests can be deleted.' });
    }

    const requestedRole = roleRequest.requestedRole;

    await roleRequest.destroy();
    cleanupRoleRequestPaymentProof(roleRequest);

    const admins = await User.findAll({
      where: { role: 'admin', status: 'active' },
      attributes: ['id']
    });

    if (admins.length > 0) {
      const requesterName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email;

      await Promise.allSettled(
        admins.map((admin) =>
          createInAppNotification({
            userId: admin.id,
            type: 'system',
            title: `${requestedRole === 'captain' ? 'Captain' : 'Field owner'} role request cancelled`,
            message: `${requesterName} deleted their ${ROLE_REQUEST_LABELS[requestedRole]} request.`,
            metadata: {
              event: 'role_request_cancelled',
              requestId,
              requesterId: user.id,
              requestedRole,
              status: 'cancelled'
            }
          })
        )
      );
    }

    res.json({
      message: `Your ${ROLE_REQUEST_LABELS[requestedRole]} request has been deleted.`
    });
  } catch (error) {
    console.error('Cancel role request error:', error);
    res.status(500).json({ error: 'Internal server error while deleting role request.' });
  }
};

// Get all role requests for admin for the current flow.
const getAllRoleRequestsForAdmin = async (req, res) => {
  try {
    const statusFilter = req.query.status;
    const where = {};
    if (['pending', 'approved', 'rejected'].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const requests = await RoleRequest.findAll({
      where,
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'status', 'phone', 'address', 'dateOfBirth', 'avatarUrl']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username', 'email', 'firstName', 'lastName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ requests });
  } catch (error) {
    console.error('Get all role requests for admin error:', error);
    res.status(500).json({ error: 'Internal server error while fetching role requests.' });
  }
};

// Support review role request for this module.
const reviewRoleRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { action, note } = req.body;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Invalid request id.' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject.' });
    }

    const roleRequest = await RoleRequest.findByPk(requestId, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'role']
        }
      ]
    });

    if (!roleRequest) {
      return res.status(404).json({ error: 'Role request not found.' });
    }

    if (roleRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This role request has already been reviewed.' });
    }

    if (!['paid', 'waived'].includes(roleRequest.paymentStatus)) {
      return res.status(400).json({ error: 'This role request cannot be approved until payment is completed.' });
    }

    const isApproved = action === 'approve';
    roleRequest.status = isApproved ? 'approved' : 'rejected';
    roleRequest.reviewedBy = req.user.id;
    roleRequest.reviewedAt = new Date();
    roleRequest.note = note?.trim() ? note.trim() : roleRequest.note;
    await roleRequest.save();

    if (isApproved && roleRequest.requester) {
      await roleRequest.requester.update({ role: roleRequest.requestedRole });
    }

    if (roleRequest.requester?.id) {
      await createInAppNotification({
        userId: roleRequest.requester.id,
        type: 'system',
        title: `${roleRequest.requestedRole === 'captain' ? 'Captain' : 'Field owner'} payment ${isApproved ? 'verified' : 'failed'}`,
        message: isApproved
          ? `Your payment was verified. You are now becoming a ${ROLE_REQUEST_LABELS[roleRequest.requestedRole]}.`
          : `Your payment verification failed for ${ROLE_REQUEST_LABELS[roleRequest.requestedRole]} access.`,
        metadata: {
          event: 'role_request_reviewed',
          requestId: roleRequest.id,
          requestedRole: roleRequest.requestedRole,
          status: roleRequest.status
        }
      });
    }

    res.json({
      message: isApproved
        ? 'Payment verified and role upgrade approved successfully.'
        : 'Payment verification failed and the role request was rejected.',
      roleRequest: serializeRoleRequest(roleRequest)
    });
  } catch (error) {
    console.error('Review role request error:', error);
    res.status(500).json({ error: 'Internal server error while reviewing role request.' });
  }
};

module.exports = {
  register,
  login,
  getGoogleAuthConfig,
  getProfile,
  getProfileStats,
  updateProfile,
  changePassword,
  requestPasswordOtp,
  verifyPasswordOtp,
  resetPasswordWithOtp,
  requestPasswordResetLink,
  resetPasswordWithToken,
  getRoleRequests,
  requestRoleUpgrade,
  cancelRoleRequest,
  getAllRoleRequestsForAdmin,
  reviewRoleRequest,
  googleAuth,
  uploadProfileAvatar,
  deleteProfileAvatar
};
