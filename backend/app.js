const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// Import routes
const schemaRoutes = require('./routes/api/schemaRoutes');

// Import services
const SchemaDiscoveryService = require('./services/schemaDiscovery');
const ConnectionManager = require('./services/connectionManager');

// Create Express app
const app = express();

// Initialize services
const schemaDiscoveryService = new SchemaDiscoveryService({
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 100
  }
});

const connectionManager = new ConnectionManager({
  maxConnections: 10,
  connectionTimeout: 30000
});

// Initialize routes with services
schemaRoutes.initialize({
  schemaDiscoveryService,
  connectionManager
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(compression()); // Compress responses
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/schemas', schemaRoutes);

// Serve API documentation in development
if (process.env.NODE_ENV === 'development') {
  app.get('/api/docs', (req, res) => {
    res.json({
      message: 'API documentation',
      endpoints: {
        schemas: {
          discover: 'GET /api/schemas/discover/:systemId',
          refresh: 'GET /api/schemas/refresh/:schemaId',
          sample: 'GET /api/schemas/sample/:schemaId',
          statistics: 'GET /api/schemas/statistics/:schemaId',
          compare: 'POST /api/schemas/compare',
          cacheStatus: 'GET /api/schemas/cache/status',
          clearCache: 'DELETE /api/schemas/cache/:systemId?'
        }
      }
    });
  });
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  
  // Shutdown services
  await schemaDiscoveryService.shutdown();
  await connectionManager.shutdown();
  
  process.exit(0);
});

module.exports = app;