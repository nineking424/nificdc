const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../utils/logger');

/**
 * 인증 관련 API 라우터
 * 로그인, 로그아웃, 토큰 갱신 등의 인증 기능
 */

// 로그인 시도 제한 (5분간 5회 시도 제한)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 5, // 최대 5회 시도
  message: {
    success: false,
    error: 'Too many login attempts, please try again later',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // IP와 사용자명을 조합하여 키 생성
    return `${req.ip}-${req.body.email || req.body.username || 'unknown'}`;
  }
});

// 로그인
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    
    if (!email || !password) {
      await auditLogger.logLogin({
        success: false,
        userId: null,
        userName: email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: 'Missing credentials',
        method: 'password'
      });

      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // 실제로는 데이터베이스에서 사용자 조회
    const user = await findUserByEmail(email);
    
    if (!user) {
      await auditLogger.logLogin({
        success: false,
        userId: null,
        userName: email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: 'User not found',
        method: 'password'
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 사용자 상태 확인
    if (user.status !== 'active') {
      await auditLogger.logLogin({
        success: false,
        userId: user.id,
        userName: user.name,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: 'Account not active',
        method: 'password'
      });

      return res.status(401).json({
        success: false,
        error: 'Account is not active'
      });
    }

    // 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      await auditLogger.logLogin({
        success: false,
        userId: user.id,
        userName: user.name,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: 'Invalid password',
        method: 'password'
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // JWT 토큰 생성
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_ACCESS_SECRET || 'access-secret',
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: rememberMe ? '30d' : '7d' }
    );

    // 세션 ID 생성
    const sessionId = generateSessionId();

    // 성공적인 로그인 감사 로그
    await auditLogger.logLogin({
      success: true,
      userId: user.id,
      userName: user.name,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId,
      method: 'password',
      deviceInfo: {
        browser: req.get('User-Agent'),
        platform: req.get('sec-ch-ua-platform')
      }
    });

    // 마지막 로그인 시간 업데이트
    await updateLastLogin(user.id, req.ip);

    logger.info('사용자 로그인 성공:', { 
      userId: user.id, 
      userName: user.name,
      ip: req.ip 
    });

    // 응답 설정
    const response = {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: getRolePermissions(user.role)
        },
        accessToken,
        expiresIn: 15 * 60, // 15분
        sessionId
      }
    };

    // Refresh Token을 HTTP-Only 쿠키로 설정
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    });

    res.json(response);
  } catch (error) {
    logger.error('로그인 처리 중 오류:', error);
    
    await auditLogger.log({
      type: 'LOGIN_ERROR',
      userId: null,
      userName: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'ERROR',
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 로그아웃
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Refresh Token 쿠키 삭제
    res.clearCookie('refreshToken');

    await auditLogger.log({
      type: 'LOGOUT',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'LOGOUT',
      resource: 'auth',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id,
      result: 'SUCCESS'
    });

    logger.info('사용자 로그아웃:', { 
      userId: req.user.id, 
      userName: req.user.name 
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('로그아웃 처리 중 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 토큰 갱신
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not provided'
      });
    }

    // Refresh Token 검증
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || 'refresh-secret'
    );

    // 사용자 조회
    const user = await findUserById(decoded.id);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // 새 Access Token 생성
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_ACCESS_SECRET || 'access-secret',
      { expiresIn: '15m' }
    );

    await auditLogger.log({
      type: 'TOKEN_REFRESH',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'REFRESH',
      resource: 'auth',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: 15 * 60
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }

    logger.error('토큰 갱신 중 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 비밀번호 변경
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current and new passwords are required'
      });
    }

    // 현재 사용자 조회
    const user = await findUserById(req.user.id);
    
    // 현재 비밀번호 검증
    const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValidCurrentPassword) {
      await auditLogger.log({
        type: 'PASSWORD_CHANGE',
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'UPDATE',
        resource: 'auth',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        result: 'FAILURE',
        error: 'Invalid current password'
      });

      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // 새 비밀번호 해싱
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트
    await updateUserPassword(req.user.id, hashedNewPassword);

    await auditLogger.log({
      type: 'PASSWORD_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'auth',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    logger.info('비밀번호 변경 성공:', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('비밀번호 변경 중 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 현재 사용자 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: getRolePermissions(user.role),
      lastLogin: user.lastLogin,
      profile: user.profile
    };

    res.json({
      success: true,
      data: userInfo
    });
  } catch (error) {
    logger.error('사용자 정보 조회 중 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// JWT 토큰 검증 미들웨어
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'access-secret', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = user;
    next();
  });
}

// 헬퍼 함수들 (실제로는 별도 서비스로 분리)
async function findUserByEmail(email) {
  // 임시 사용자 데이터
  const users = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 12),
      role: 'admin',
      status: 'active'
    },
    {
      id: '2',
      name: 'Operator User',
      email: 'operator@example.com',
      password: await bcrypt.hash('operator123', 12),
      role: 'operator',
      status: 'active'
    }
  ];

  return users.find(user => user.email === email);
}

async function findUserById(id) {
  // 임시 구현
  const users = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      lastLogin: new Date(),
      profile: { department: 'IT', position: 'Administrator' }
    }
  ];

  return users.find(user => user.id === id);
}

async function updateLastLogin(userId, ip) {
  // 실제로는 데이터베이스 업데이트
  logger.debug('마지막 로그인 업데이트:', { userId, ip });
}

async function updateUserPassword(userId, hashedPassword) {
  // 실제로는 데이터베이스 업데이트
  logger.debug('비밀번호 업데이트:', { userId });
}

function getRolePermissions(role) {
  const { rolePermissions } = require('../../middleware/rbac');
  return rolePermissions[role] || [];
}

function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

module.exports = router;