const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http = require('http');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const { connectDatabase } = require('./database/connection');
const { connectRedis } = require('./utils/redis');
// const monitoringService = require('../services/monitoringService');
// const scheduledScanner = require('../services/scheduledScanner');
// const enhancedRateLimit = require('../middleware/enhancedRateLimit');

// 보안 미들웨어 통합 사용
// const {
//   configureBaseSecurity,
//   configureApiSecurity,
//   configureAdminSecurity,
//   getLoginRateLimit
// } = require('../middleware/security');

// SSL/TLS 설정
// const { createHTTPSServer, getSSLStatus } = require('../config/ssl');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Trust proxy (for accurate IP addresses behind load balancers)
app.set('trust proxy', 1);

// CORS 설정
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://frontend:8080',
    'http://127.0.0.1:8080'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Accept-Language']
}));

// 기본 미들웨어
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 보안 미들웨어 설정
// configureBaseSecurity(app);
// configureApiSecurity(app);

// 관리자 IP 화이트리스트 (환경 변수에서 설정)
const adminIPs = process.env.ADMIN_IPS ? process.env.ADMIN_IPS.split(',') : [];
// configureAdminSecurity(app, adminIPs);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Enhanced Rate Limiting 적용
// app.use('/api/v1/', enhancedRateLimit.createApiLimiter());
// app.use('/api/v1/auth/login', enhancedRateLimit.createLoginLimiter());
// app.use('/api/v1/admin/', enhancedRateLimit.createAdminLimiter());
// app.use('/api/v1/upload/', enhancedRateLimit.createUploadLimiter());

// API Routes with RBAC integration
app.use('/api/v1/auth', require('../routes/api/auth'));
// Temporarily disabled until path issues are resolved
// app.use('/api/v1/users', require('../routes/api/users'));
// app.use('/api/v1/systems', require('../routes/api/systems'));
// app.use('/api/v1/audit', require('../routes/api/audit'));
// app.use('/api/v1/alerts', require('../routes/api/alerts'));
// app.use('/api/v1/security', require('../routes/api/security'));
// app.use('/api/v1/security-scan', require('../routes/api/security-scan'));
// app.use('/api/v1/brute-force', require('../routes/api/brute-force'));
// app.use('/api/v1/data', require('./routes/data'));
// app.use('/api/v1/mappings', require('./routes/mappings'));
// app.use('/api/v1/jobs', require('./routes/jobs'));
// app.use('/api/v1/monitoring', require('./routes/monitoring'));

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

// HTTP 서버 생성
const httpServer = http.createServer(app);

// Database and Redis connection
const startServer = async () => {
  try {
    await connectDatabase();
    
    // Try Redis connection but don't fail if it's unavailable
    try {
      await connectRedis();
    } catch (redisError) {
      logger.warn('Redis connection failed, continuing without Redis:', redisError.message);
    }
    
    // HTTP 서버 시작
    httpServer.listen(PORT, () => {
      logger.info(`HTTP Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      }
    });
    
    // 개발 모드: 기본 HTTP 서버만 실행
    logger.info(`WebSocket monitoring service disabled for development`);
    
    if (process.env.NODE_ENV === 'production') {
      logger.warn('프로덕션 환경에서 HTTPS가 비활성화되어 있습니다!');
    }
    
    // 보안 스캐너 상태 로그
    // const scannerStatus = scheduledScanner.getStatus();
    logger.info('예약된 보안 스캔 상태:', {
      enabled: false, // scannerStatus.enabled,
      scheduledJobs: 0, // scannerStatus.scheduledJobs.length,
      activeScans: 0 // scannerStatus.activeScans.length
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // 서버 종료
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
  }
  
  /*
  if (httpsServer) {
    httpsServer.close(() => {
      logger.info('HTTPS server closed');
    });
  }
  */
  
  // monitoringService.shutdown();
  // scheduledScanner.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // 서버 종료
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
  }
  
  /*
  if (httpsServer) {
    httpsServer.close(() => {
      logger.info('HTTPS server closed');
    });
  }
  */
  
  // monitoringService.shutdown();
  // scheduledScanner.shutdown();
  process.exit(0);
});

startServer();

module.exports = app;