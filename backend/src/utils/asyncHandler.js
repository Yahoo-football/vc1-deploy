/**
 * Async Handler Utility
 * Centralized error handling for async route handlers
 */

/**
 * Async handler wrapper for error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
// Support async handler for this module.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
