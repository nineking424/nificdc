const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
  logger.warn('Route not found:', {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = notFoundHandler;