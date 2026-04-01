const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV !== 'production';

const isLocalRequest = (ip = '') => {
  const normalizedIp = String(ip).trim();
  return normalizedIp === '::1' || normalizedIp === '127.0.0.1' || normalizedIp === '::ffff:127.0.0.1';
};

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment && isLocalRequest(req.ip),
    handler: (req, res) => {
      console.warn('Rate limit exceeded:', {
        ip: req.ip,
        url: req.url,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      res.status(429).json({
        success: false,
        message: message || 'Too many requests, please try again later'
      });
    }
  });
};

// General API rate limiting
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  isDevelopment ? 1000 : 100, // Relaxed in dev, strict in production
  'Too many requests from this IP, please try again after 15 minutes'
);

// Strict rate limiting for authentication routes
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  isDevelopment ? 1000 : 5, // 5 login attempts per 15 min in production
  'Too many authentication attempts, please try again after 15 minutes'
);

// Rate limiting for search endpoints
const searchLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  isDevelopment ? 300 : 30, // 30 searches per minute in production
  'Too many search requests, please try again after a minute'
);

// Rate limiting for creation endpoints
const createLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  isDevelopment ? 100 : 20, // 20 creations per minute in production
  'Too many creation requests, please try again after a minute'
);

module.exports = {
  generalLimiter,
  authLimiter,
  searchLimiter,
  createLimiter
};
