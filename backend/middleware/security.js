const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const cors = require('cors');
const logger = require('../utils/logger');
const auditLogger = require('../services/auditLogger');

/**
 * 보안 미들웨어 설정
 * SSL/TLS, 보안 헤더, CORS, Rate Limiting 등 종합 보안 설정
 */

/**
 * 기본 보안 헤더 설정
 */
function getSecurityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.jsdelivr.net'
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'", // Vue.js 개발 모드용
          'https://cdn.jsdelivr.net',
          'https://unpkg.com'
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
          'https://cdn.jsdelivr.net'
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https:',
          'blob:'
        ],
        connectSrc: [
          "'self'",
          'ws://localhost:*',
          'wss://*',
          'https://api.example.com'
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:']
      },
      reportOnly: process.env.NODE_ENV === 'development'
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1년
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin']
    },

    // Permissions Policy
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: []
      }
    },

    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Vue.js 호환성을 위해 비활성화

    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    },

    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups'
    }
  });
}

/**
 * CORS 설정
 */
function getCorsOptions() {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:8080',
        'http://localhost:3000',
        'https://localhost:8080',
        'https://localhost:3000'
      ];

  return cors({
    origin: function (origin, callback) {
      // API 도구나 서버 간 통신을 위해 origin이 없는 경우 허용
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn('CORS 차단:', { origin, allowedOrigins });
        callback(new Error('CORS policy violation'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-API-Key'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'Link'
    ],
    maxAge: 86400 // 24시간
  });
}

/**
 * API Rate Limiting
 */
function getApiRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: function(req) {
      // 인증된 사용자는 더 높은 한도
      if (req.user) {
        if (req.user.role === 'admin') return 1000;
        if (req.user.role === 'operator') return 500;
        return 200;
      }
      return 100; // 미인증 사용자
    },
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    
    // IP + User ID를 조합한 키 생성
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const userId = req.user?.id;
      return userId ? `${ip}-${userId}` : ip;
    },

    // 차단된 요청 로깅
    onLimitReached: async (req, res, options) => {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      const path = req.path;
      
      await auditLogger.log({
        type: 'RATE_LIMIT_EXCEEDED',
        userId: req.user?.id || null,
        userName: req.user?.name || 'Anonymous',
        userRole: req.user?.role || 'unknown',
        action: 'RATE_LIMIT',
        resource: 'api',
        resourceId: path,
        ip,
        userAgent,
        result: 'BLOCKED',
        severity: 'MEDIUM',
        metadata: {
          limit: options.max,
          windowMs: options.windowMs,
          path,
          method: req.method
        }
      });

      logger.warn('API Rate Limit 초과:', {
        ip,
        userId: req.user?.id,
        path,
        method: req.method,
        userAgent
      });
    }
  });
}

/**
 * 로그인 특화 Rate Limiting
 */
function getLoginRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 5, // 최대 5회 시도
    skipSuccessfulRequests: true, // 성공한 요청은 카운트에서 제외
    message: {
      error: 'Too many login attempts',
      message: 'Too many failed login attempts. Please try again in 15 minutes.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    
    keyGenerator: (req) => {
      // IP + 사용자명 조합
      const ip = req.ip || req.connection.remoteAddress;
      const identifier = req.body?.email || req.body?.username || 'unknown';
      return `login-${ip}-${identifier}`;
    },

    onLimitReached: async (req, res, options) => {
      const ip = req.ip || req.connection.remoteAddress;
      const identifier = req.body?.email || req.body?.username;
      
      await auditLogger.log({
        type: 'LOGIN_RATE_LIMIT_EXCEEDED',
        userName: identifier,
        action: 'LOGIN_ATTEMPT',
        resource: 'auth',
        ip,
        userAgent: req.get('User-Agent'),
        result: 'BLOCKED',
        severity: 'HIGH',
        metadata: {
          attempts: options.max,
          windowMs: options.windowMs,
          identifier
        }
      });

      logger.warn('로그인 Rate Limit 초과:', {
        ip,
        identifier,
        userAgent: req.get('User-Agent')
      });
    }
  });
}

/**
 * 속도 제한 (Slow Down)
 */
function getSlowDown() {
  return slowDown({
    windowMs: 15 * 60 * 1000, // 15분
    delayAfter: 50, // 50번째 요청부터 지연 시작
    delayMs: 500, // 500ms씩 지연 증가
    maxDelayMs: 10000, // 최대 10초 지연
    
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const userId = req.user?.id;
      return userId ? `${ip}-${userId}` : ip;
    },

    onLimitReached: async (req, res, options) => {
      const ip = req.ip || req.connection.remoteAddress;
      
      await auditLogger.log({
        type: 'SLOW_DOWN_ACTIVATED',
        userId: req.user?.id || null,
        userName: req.user?.name || 'Anonymous',
        action: 'SLOW_DOWN',
        resource: 'api',
        ip,
        userAgent: req.get('User-Agent'),
        result: 'DELAYED',
        severity: 'LOW',
        metadata: {
          delayAfter: options.delayAfter,
          delayMs: options.delayMs,
          path: req.path
        }
      });
    }
  });
}

/**
 * 보안 이벤트 로깅 미들웨어
 */
function securityEventLogger() {
  return (req, res, next) => {
    // 의심스러운 요청 패턴 감지
    const suspiciousPatterns = [
      /\.\.\//g,           // Path traversal
      /<script/gi,         // XSS attempts
      /union.*select/gi,   // SQL injection
      /javascript:/gi,     // JavaScript protocol
      /data:.*base64/gi,   // Data URI schemes
      /eval\(/gi,          // Code injection
      /exec\(/gi,          // Command injection
    ];

    const userAgent = req.get('User-Agent') || '';
    const url = req.url;
    const body = JSON.stringify(req.body || {});
    const query = JSON.stringify(req.query || {});

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body) || pattern.test(query)) {
        auditLogger.log({
          type: 'SUSPICIOUS_REQUEST',
          userId: req.user?.id || null,
          userName: req.user?.name || 'Anonymous',
          action: 'SUSPICIOUS_ACCESS',
          resource: 'api',
          resourceId: req.path,
          ip: req.ip,
          userAgent,
          result: 'DETECTED',
          severity: 'HIGH',
          metadata: {
            pattern: pattern.toString(),
            url,
            method: req.method,
            detectedIn: pattern.test(url) ? 'url' : 
                       pattern.test(body) ? 'body' : 'query'
          }
        });

        logger.warn('의심스러운 요청 패턴 감지:', {
          ip: req.ip,
          pattern: pattern.toString(),
          url,
          method: req.method,
          userAgent
        });
        break;
      }
    }

    // 비정상적인 User-Agent 감지
    const suspiciousUserAgents = [
      /sqlmap/gi,
      /nikto/gi,
      /nessus/gi,
      /burp/gi,
      /acunetix/gi,
      /nmap/gi,
      /masscan/gi
    ];

    for (const pattern of suspiciousUserAgents) {
      if (pattern.test(userAgent)) {
        auditLogger.log({
          type: 'SUSPICIOUS_USER_AGENT',
          action: 'SCAN_ATTEMPT',
          resource: 'api',
          ip: req.ip,
          userAgent,
          result: 'DETECTED',
          severity: 'HIGH',
          metadata: {
            pattern: pattern.toString(),
            url,
            method: req.method
          }
        });

        logger.warn('의심스러운 User-Agent 감지:', {
          ip: req.ip,
          userAgent,
          url,
          method: req.method
        });
        break;
      }
    }

    next();
  };
}

/**
 * SSL/TLS 강제 리다이렉트 미들웨어
 */
function enforceHTTPS() {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
      logger.info('HTTP to HTTPS 리다이렉트:', {
        originalUrl: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    }
    next();
  };
}

/**
 * IP 화이트리스트 체크 (관리 API용)
 */
function ipWhitelist(allowedIPs = []) {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // 화이트리스트가 비어있으면 모든 IP 허용
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      auditLogger.log({
        type: 'IP_WHITELIST_VIOLATION',
        action: 'ACCESS_DENIED',
        resource: 'admin_api',
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        result: 'BLOCKED',
        severity: 'HIGH',
        metadata: {
          allowedIPs,
          requestedPath: req.path
        }
      });

      logger.warn('IP 화이트리스트 위반:', {
        clientIP,
        allowedIPs,
        path: req.path,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this resource'
      });
    }

    next();
  };
}

/**
 * 요청 크기 제한
 */
function requestSizeLimit() {
  return (req, res, next) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      auditLogger.log({
        type: 'REQUEST_SIZE_EXCEEDED',
        userId: req.user?.id || null,
        action: 'LARGE_REQUEST',
        resource: 'api',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        result: 'BLOCKED',
        severity: 'MEDIUM',
        metadata: {
          contentLength,
          maxSize,
          path: req.path
        }
      });

      logger.warn('요청 크기 제한 초과:', {
        contentLength,
        maxSize,
        ip: req.ip,
        path: req.path
      });

      return res.status(413).json({
        error: 'Payload too large',
        message: `Request size exceeds limit of ${maxSize} bytes`
      });
    }

    next();
  };
}

/**
 * 보안 미들웨어 통합 설정
 */
function configureBaseSecurity(app) {
  // HTTPS 강제 (프로덕션 환경)
  app.use(enforceHTTPS());
  
  // 기본 보안 헤더
  app.use(getSecurityHeaders());
  
  // CORS 설정
  app.use(getCorsOptions());
  
  // 요청 크기 제한
  app.use(requestSizeLimit());
  
  // 보안 이벤트 로깅
  app.use(securityEventLogger());
  
  // 속도 제한 (전역)
  app.use(getSlowDown());
  
  logger.info('기본 보안 미들웨어 설정 완료');
}

/**
 * API 보안 미들웨어 설정
 */
function configureApiSecurity(app) {
  // API Rate Limiting
  app.use('/api/', getApiRateLimit());
  
  logger.info('API 보안 미들웨어 설정 완료');
}

/**
 * 관리자 API 보안 미들웨어 설정
 */
function configureAdminSecurity(app, adminIPs = []) {
  // 관리자 IP 화이트리스트
  if (adminIPs.length > 0) {
    app.use('/api/v1/admin/', ipWhitelist(adminIPs));
    logger.info('관리자 IP 화이트리스트 설정 완료:', { adminIPs });
  }
}

module.exports = {
  getSecurityHeaders,
  getCorsOptions,
  getApiRateLimit,
  getLoginRateLimit,
  getSlowDown,
  securityEventLogger,
  enforceHTTPS,
  ipWhitelist,
  requestSizeLimit,
  configureBaseSecurity,
  configureApiSecurity,
  configureAdminSecurity
};