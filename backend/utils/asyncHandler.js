/**
 * Async handler wrapper for Express routes
 * Catches errors in async route handlers and passes them to Express error handler
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
exports.asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};