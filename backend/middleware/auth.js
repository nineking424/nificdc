const jwt = require('jsonwebtoken');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

// In production, these should come from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
exports.generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'nificdc',
    audience: 'nificdc-api'
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'nificdc',
      audience: 'nificdc-api'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    }
    throw error;
  }
};

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
exports.authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided');
    }

    // Check Bearer format
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AuthenticationError('Invalid authorization header format. Expected: Bearer <token>');
    }

    // Verify token
    const decoded = exports.verifyToken(token);
    
    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || [],
      permissions: decoded.permissions || []
    };

    logger.debug('User authenticated', {
      userId: req.user.id,
      email: req.user.email
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no token is provided
 */
exports.authenticateOptional = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next();
    }

    const decoded = exports.verifyToken(token);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || [],
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    // Log error but continue without authentication
    logger.debug('Optional authentication failed', { error: error.message });
    next();
  }
};

/**
 * Authorization middleware factory
 * Creates middleware that checks for required roles
 * @param {Array<string>} requiredRoles - Roles required to access resource
 * @returns {Function} Express middleware
 */
exports.authorize = (requiredRoles = []) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Admin role bypasses all checks
      if (req.user.roles.includes('admin')) {
        return next();
      }

      // Check if user has any of the required roles
      if (requiredRoles.length > 0) {
        const hasRole = requiredRoles.some(role => req.user.roles.includes(role));
        if (!hasRole) {
          throw new AuthorizationError(`Required roles: ${requiredRoles.join(', ')}`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission-based authorization middleware factory
 * Creates middleware that checks for required permissions
 * @param {Array<string>} requiredPermissions - Permissions required to access resource
 * @returns {Function} Express middleware
 */
exports.requirePermissions = (requiredPermissions = []) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Admin role bypasses all checks
      if (req.user.roles.includes('admin')) {
        return next();
      }

      // Check if user has all required permissions
      if (requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every(permission => 
          req.user.permissions.includes(permission)
        );
        if (!hasAllPermissions) {
          throw new AuthorizationError(`Required permissions: ${requiredPermissions.join(', ')}`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Resource ownership middleware factory
 * Creates middleware that checks if user owns the resource
 * @param {Function} getResourceOwnerId - Function to extract owner ID from request
 * @returns {Function} Express middleware
 */
exports.requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Admin role bypasses ownership check
      if (req.user.roles.includes('admin')) {
        return next();
      }

      // Get resource owner ID
      const ownerId = await getResourceOwnerId(req);
      
      // Check ownership
      if (ownerId !== req.user.id) {
        throw new AuthorizationError('You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * API key authentication middleware
 * Authenticates requests using API key from header
 */
exports.authenticateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      throw new AuthenticationError('API key required');
    }

    // In production, validate API key against database
    // For now, we'll use a simple check
    if (apiKey !== process.env.API_KEY) {
      throw new AuthenticationError('Invalid API key');
    }

    // Set user context for API key authentication
    req.user = {
      id: 'api-key-user',
      email: 'api@nificdc.com',
      roles: ['api-user'],
      permissions: ['read:schemas', 'write:schemas']
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Combined authentication middleware
 * Allows either JWT or API key authentication
 */
exports.authenticateAny = (req, res, next) => {
  const hasAuthHeader = req.headers.authorization;
  const hasApiKey = req.headers['x-api-key'];

  if (hasAuthHeader) {
    return exports.authenticate(req, res, next);
  } else if (hasApiKey) {
    return exports.authenticateApiKey(req, res, next);
  } else {
    next(new AuthenticationError('Authentication required'));
  }
};