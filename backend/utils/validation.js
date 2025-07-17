const { validationResult } = require('express-validator');
const { ValidationError } = require('./errors');

/**
 * Middleware to check validation results from express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));
    
    throw new ValidationError(formattedErrors);
  }
  
  next();
};

/**
 * Common validation schemas
 */
exports.validationSchemas = {
  // Pagination validation
  pagination: {
    page: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1 }
      },
      toInt: true,
      errorMessage: 'Page must be a positive integer'
    },
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1, max: 1000 }
      },
      toInt: true,
      errorMessage: 'Limit must be between 1 and 1000'
    }
  },
  
  // Sort validation
  sort: {
    sortBy: {
      in: ['query'],
      optional: true,
      isString: true,
      trim: true,
      errorMessage: 'Sort field must be a string'
    },
    sortOrder: {
      in: ['query'],
      optional: true,
      isIn: {
        options: [['asc', 'desc']]
      },
      errorMessage: 'Sort order must be either asc or desc'
    }
  },
  
  // ID validation
  mongoId: {
    in: ['params'],
    isMongoId: true,
    errorMessage: 'Invalid ID format'
  },
  
  // UUID validation
  uuid: {
    in: ['params'],
    isUUID: true,
    errorMessage: 'Invalid UUID format'
  }
};