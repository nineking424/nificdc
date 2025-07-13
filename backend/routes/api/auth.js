const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../src/utils/logger');
// const bruteForceProtection = require('../../services/bruteForceProtection');
// const enhancedRateLimit = require('../../middleware/enhancedRateLimit');

/**
 * 인증 관련 API 라우터
 * 로그인, 로그아웃, 토큰 갱신 등의 인증 기능
 */

// Enhanced login rate limiter with brute force protection
// const loginLimiter = enhancedRateLimit.createLoginLimiter();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 로그인
router.post('/login', loginLimiter, async (req, res) => {
  try {
    // 디버깅: 요청 본문 로깅
    console.log('[DEBUG] Login request body:', req.body);
    console.log('[DEBUG] Content-Type:', req.get('Content-Type'));
    
    const { email, password, rememberMe = false } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || '';
    
    // 브루트포스 보호 사전 검사
    /* 
    const bruteForceCheck = await bruteForceProtection.checkLoginAttempt(
      ip, 
      email || 'unknown',
      userAgent,
      { timestamp: Date.now() }
    );

    if (!bruteForceCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Login temporarily blocked',
        message: bruteForceCheck.blockInfo?.reason || 'Too many failed attempts',
        retryAfter: bruteForceCheck.retryAfter,
        type: 'brute_force_protection'
      });
    }
    */
    
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
      // 사용자 없음 - 브루트포스 공격 기록
      /*
      await bruteForceProtection.recordFailedAttempt(
        ip,
        email,
        'user_not_found',
        { userAgent, timestamp: Date.now() }
      );
      */

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
      // 잘못된 비밀번호 - 브루트포스 공격 기록
      /*
      await bruteForceProtection.recordFailedAttempt(
        ip,
        email,
        'invalid_password',
        { userAgent, userId: user.id, timestamp: Date.now() }
      );
      */

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

    // 성공적인 로그인 - 브루트포스 카운터 리셋
    // await bruteForceProtection.recordSuccessfulAttempt(ip, email);

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
  try {
    const { User } = require('../../src/models');
    const user = await User.findByEmail(email);
    
    if (!user) return null;
    
    // Convert Sequelize model to plain object for compatibility
    return {
      id: user.id,
      name: user.username, // Use username as name
      email: user.email,
      password: user.passwordHash,
      role: user.role,
      status: user.isActive ? 'active' : 'inactive'
    };
  } catch (error) {
    logger.error('Error finding user by email:', error);
    return null;
  }
}

async function findUserById(id) {
  try {
    const { User } = require('../../src/models');
    const user = await User.findByPk(id);
    
    if (!user) return null;
    
    // Convert Sequelize model to plain object for compatibility
    return {
      id: user.id,
      name: user.username,
      email: user.email,
      role: user.role,
      status: user.isActive ? 'active' : 'inactive',
      lastLogin: user.lastLoginAt,
      profile: { department: 'IT', position: user.role }
    };
  } catch (error) {
    logger.error('Error finding user by ID:', error);
    return null;
  }
}

async function updateLastLogin(userId, ip) {
  try {
    const { User } = require('../../src/models');
    await User.update(
      { lastLoginAt: new Date() },
      { where: { id: userId } }
    );
    logger.debug('마지막 로그인 업데이트:', { userId, ip });
  } catch (error) {
    logger.error('Error updating last login:', error);
  }
}

async function updateUserPassword(userId, hashedPassword) {
  try {
    const { User } = require('../../src/models');
    await User.update(
      { passwordHash: hashedPassword },
      { where: { id: userId } }
    );
    logger.debug('비밀번호 업데이트:', { userId });
  } catch (error) {
    logger.error('Error updating password:', error);
  }
}

function getRolePermissions(role) {
  const { rolePermissions } = require('../../middleware/rbac');
  return rolePermissions[role] || [];
}

function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

module.exports = router;