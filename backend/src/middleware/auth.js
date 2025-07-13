const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { cache } = require('../utils/redis');
const bruteForceProtection = require('../../services/bruteForceProtection');
const auditLogger = require('../../services/auditLogger');

// JWT 인증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Access token required',
        code: 'TOKEN_REQUIRED'
      }
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', async (err, user) => {
    if (err) {
      // 무효한 토큰 시도를 브루트포스 공격으로 간주
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      await bruteForceProtection.recordFailedAttempt(
        ip, 
        'token_validation', 
        'invalid_token',
        {
          tokenPrefix: token.substring(0, 20),
          userAgent: req.get('User-Agent'),
          error: err.message
        }
      );

      logger.security('Invalid token access attempt', {
        token: token.substring(0, 20) + '...',
        ip: req.ip,
        error: err.message
      });
      return res.status(403).json({
        error: {
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        }
      });
    }

    // 세션 검증 (Redis)
    const session = await cache.getSession(user.userId);
    if (!session) {
      logger.security('Session not found for valid token', {
        userId: user.userId,
        ip: req.ip
      });
      return res.status(401).json({
        error: {
          message: 'Session expired',
          code: 'SESSION_EXPIRED'
        }
      });
    }

    req.user = user;
    next();
  });
};

// 역할 기반 접근 제어 미들웨어
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        }
      });
    }

    // 역할 배열이 아닌 경우 배열로 변환
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      logger.security('Unauthorized access attempt', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        }
      });
    }

    next();
  };
};

// 관리자 전용 미들웨어
const requireAdmin = authorize(['admin']);

// 사용자 또는 관리자 미들웨어
const requireUser = authorize(['user', 'admin']);

module.exports = {
  authenticateToken,
  authorize,
  requireAdmin,
  requireUser
};