const jwt = require('jsonwebtoken');
const { User } = require('../models');

const resolveUserFromToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Always resolve latest role/status from DB so role upgrades apply immediately.
  // Fallback for legacy databases that may not have `users.status` yet.
  let user;
  try {
    user = await User.findByPk(decoded.id, {
      attributes: ['id', 'role', 'status']
    });
  } catch (dbError) {
    const missingStatusColumn =
      /unknown column/i.test(dbError?.message || '') &&
      /status/i.test(dbError?.message || '');

    if (!missingStatusColumn) {
      throw dbError;
    }

    user = await User.findByPk(decoded.id, {
      attributes: ['id', 'role']
    });
  }

  if (!user) {
    const error = new Error('Invalid token user.');
    error.statusCode = 401;
    throw error;
  }

  if (user.status && user.status !== 'active') {
    const error = new Error('Account is not active.');
    error.statusCode = 401;
    throw error;
  }

  return {
    id: user.id,
    role: user.role
  };
};

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Invalid token format. Expected: Bearer <token>' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. Token is empty.' 
      });
    }

    req.user = await resolveUserFromToken(token);
    next();
  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({
        error: error.message
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.' 
      });
    } else {
      console.error('Authentication error:', error);
      return res.status(500).json({ 
        error: 'Internal server error during authentication.' 
      });
    }
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return next();
    }

    req.user = await resolveUserFromToken(token);
    next();
  } catch (error) {
    if (error.statusCode === 401 || error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      req.user = null;
      return next();
    }

    console.error('Optional authentication error:', error);
    return next();
  }
};

auth.optionalAuth = optionalAuth;

module.exports = auth;
