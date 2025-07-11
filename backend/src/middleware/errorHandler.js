const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Default error response
  let error = {
    message: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        ...error,
        message: 'Validation Error',
        code: 'VALIDATION_ERROR',
        details: err.details || err.message
      }
    });
  }

  if (err.name === 'UnauthorizedError' || err.code === 'UNAUTHORIZED') {
    return res.status(401).json({
      error: {
        ...error,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED'
      }
    });
  }

  if (err.name === 'ForbiddenError' || err.code === 'FORBIDDEN') {
    return res.status(403).json({
      error: {
        ...error,
        message: 'Forbidden',
        code: 'FORBIDDEN'
      }
    });
  }

  if (err.name === 'NotFoundError' || err.code === 'NOT_FOUND') {
    return res.status(404).json({
      error: {
        ...error,
        message: 'Resource Not Found',
        code: 'NOT_FOUND'
      }
    });
  }

  if (err.name === 'ConflictError' || err.code === 'CONFLICT') {
    return res.status(409).json({
      error: {
        ...error,
        message: 'Conflict',
        code: 'CONFLICT'
      }
    });
  }

  // Sequelize errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: {
        ...error,
        message: 'Database Validation Error',
        code: 'DB_VALIDATION_ERROR',
        details: err.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      }
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: {
        ...error,
        message: 'Duplicate Entry',
        code: 'DUPLICATE_ENTRY',
        details: err.errors.map(e => ({
          field: e.path,
          value: e.value
        }))
      }
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      error: {
        ...error,
        message: 'Foreign Key Constraint Error',
        code: 'FK_CONSTRAINT_ERROR'
      }
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        ...error,
        message: 'Invalid Token',
        code: 'INVALID_TOKEN'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        ...error,
        message: 'Token Expired',
        code: 'TOKEN_EXPIRED'
      }
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      error: {
        ...error,
        message: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
  }

  // Default server error
  const statusCode = err.statusCode || err.status || 500;
  
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    error.message = 'Internal Server Error';
    error.code = 'INTERNAL_ERROR';
  }

  res.status(statusCode).json({ error });
};

module.exports = errorHandler;