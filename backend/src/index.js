const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const http = require('http');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const { connectDatabase } = require('./database/connection');
const { connectRedis } = require('./utils/redis');
const monitoringService = require('./services/monitoringService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes with RBAC integration
app.use('/api/v1/auth', require('../routes/api/auth'));
app.use('/api/v1/users', require('../routes/api/users'));
app.use('/api/v1/systems', require('../routes/api/systems'));
app.use('/api/v1/data', require('./routes/data'));
app.use('/api/v1/mappings', require('./routes/mappings'));
app.use('/api/v1/jobs', require('./routes/jobs'));
app.use('/api/v1/monitoring', require('./routes/monitoring'));

// Swagger documentation
if (process.env.NODE_ENV !== 'production') {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');
  
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'NiFiCDC API',
        version: '1.0.0',
        description: 'NiFi-based Change Data Capture API',
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server',
        },
      ],
    },
    apis: ['./src/routes/*.js'],
  };
  
  const specs = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Database and Redis connection
const startServer = async () => {
  try {
    await connectDatabase();
    await connectRedis();
    
    // Initialize monitoring service
    monitoringService.initialize(server);
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Monitoring WebSocket server initialized on /monitoring`);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  monitoringService.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  monitoringService.shutdown();
  process.exit(0);
});

startServer();

module.exports = app;