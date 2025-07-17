const rateLimit = require('express-rate-limit');
const { RateLimitError } = require('../utils/errors');

/**
 * Create rate limiter with custom configuration
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express rate limit middleware
 */
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next) => {
      next(new RateLimitError('Too many requests, please try again later.'));
    },
    skip: (req) => {
      // Skip rate limiting for authenticated admin users
      return req.user && req.user.roles && req.user.roles.includes('admin');
    }
  };

  return rateLimit({ ...defaults, ...options });
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
exports.apiLimiter = createRateLimiter({
  max: 100,
  message: 'Too many API requests, please try again later.'
});

/**
 * Strict rate limiter for sensitive operations
 * 20 requests per 15 minutes
 */
exports.strictLimiter = createRateLimiter({
  max: 20,
  message: 'Too many requests to this endpoint, please try again later.'
});

/**
 * Auth endpoints rate limiter
 * 5 requests per 15 minutes
 */
exports.authLimiter = createRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later.'
});

/**
 * Schema discovery rate limiter
 * 50 requests per 15 minutes (resource intensive)
 */
exports.schemaDiscoveryLimiter = createRateLimiter({
  max: 50,
  windowMs: 15 * 60 * 1000,
  message: 'Too many schema discovery requests, please try again later.'
});

/**
 * Dynamic rate limiter based on user role
 */
exports.dynamicLimiter = (req, res, next) => {
  let maxRequests = 100;

  if (req.user) {
    if (req.user.roles.includes('admin')) {
      // No rate limiting for admins
      return next();
    } else if (req.user.roles.includes('premium')) {
      maxRequests = 1000;
    } else if (req.user.roles.includes('standard')) {
      maxRequests = 500;
    }
  }

  const limiter = createRateLimiter({
    max: maxRequests,
    windowMs: 15 * 60 * 1000
  });

  return limiter(req, res, next);
};