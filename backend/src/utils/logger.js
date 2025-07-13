const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

// Custom format for console output
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length) {
      try {
        // Safe JSON stringify to handle circular references
        metaStr = JSON.stringify(meta, (key, value) => {
          // Skip circular references and complex objects
          if (value && typeof value === 'object' && value.constructor && 
              (value.constructor.name === 'Sequelize' || 
               value.constructor.name.includes('Dialect') ||
               value.constructor.name.includes('Model'))) {
            return '[Complex Object]';
          }
          return value;
        }, 2);
      } catch (error) {
        metaStr = '[Circular Reference]';
      }
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'nificdc-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test'
    }),
    
    // File transport for all logs
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    
    // Separate file for error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    }),
    
    // Audit log for security-related events
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      level: 'info',
      format: combine(
        timestamp(),
        json()
      )
    })
  ]
});

// Audit logging function
logger.audit = (event, userId, details = {}) => {
  logger.info('AUDIT', {
    event,
    userId,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip || 'unknown'
  });
};

// Security logging function
logger.security = (event, details = {}) => {
  logger.warn('SECURITY', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;