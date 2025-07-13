const express = require('express');
const router = express.Router();
const { authorize, requireAdmin } = require('../../middleware/rbac');
const bruteForceProtection = require('../../services/bruteForceProtection');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../src/utils/logger');

/**
 * 브루트포스 방어 관리 API
 * 차단 상태 조회, 해제, 화이트리스트 관리 등
 */

// 현재 차단 상태 조회
router.get('/status/:ip?/:identifier?', authorize('security', 'read'), async (req, res) => {
  try {
    const { ip, identifier } = req.params;
    const clientIP = ip || req.query.ip;
    const userIdentifier = identifier || req.query.identifier;

    if (!clientIP && !userIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'IP address or user identifier is required'
      });
    }

    const blockStatus = await bruteForceProtection.getBlockStatus(
      clientIP || 'unknown',
      userIdentifier || 'unknown'
    );

    await auditLogger.log({
      type: 'BRUTE_FORCE_STATUS_CHECK',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        checkedIP: clientIP,
        checkedIdentifier: userIdentifier,
        blockStatus: blockStatus.blocked
      }
    });

    res.json({
      success: true,
      data: {
        ip: clientIP,
        identifier: userIdentifier,
        blockStatus,
        checkedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('브루트포스 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check brute force status'
    });
  }
});

// 차단 해제 (관리자만)
router.post('/unblock', requireAdmin(), async (req, res) => {
  try {
    const { type, key, reason } = req.body;

    if (!type || !key) {
      return res.status(400).json({
        success: false,
        error: 'Block type and key are required'
      });
    }

    const validTypes = ['login', 'ip', 'account', 'permanent'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid block type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    await bruteForceProtection.unblock(type, key, reason || 'Manual unblock by admin');

    await auditLogger.log({
      type: 'BRUTE_FORCE_UNBLOCK',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UNBLOCK',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        blockType: type,
        blockedKey: key,
        reason: reason || 'Manual unblock by admin'
      }
    });

    logger.info('관리자 차단 해제:', {
      type,
      key,
      reason,
      adminId: req.user.id,
      adminName: req.user.name
    });

    res.json({
      success: true,
      message: `${type} block for ${key} has been removed`,
      data: {
        type,
        key,
        unblockedBy: req.user.name,
        unblockedAt: new Date(),
        reason: reason || 'Manual unblock by admin'
      }
    });

  } catch (error) {
    logger.error('브루트포스 차단 해제 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unblock'
    });
  }
});

// 화이트리스트 추가 (관리자만)
router.post('/whitelist', requireAdmin(), async (req, res) => {
  try {
    const { ip, reason, duration } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }

    // IP 형식 검증
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address format'
      });
    }

    const durationMs = duration ? parseInt(duration) * 1000 : null;
    
    await bruteForceProtection.addToWhitelist(
      ip,
      reason || `Added by ${req.user.name}`,
      durationMs
    );

    await auditLogger.log({
      type: 'WHITELIST_IP_ADDED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'security',
      resourceId: ip,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        whitelistedIP: ip,
        reason: reason || `Added by ${req.user.name}`,
        duration: durationMs,
        permanent: !durationMs
      }
    });

    logger.info('IP 화이트리스트 추가:', {
      ip,
      reason,
      duration: durationMs,
      adminId: req.user.id,
      adminName: req.user.name
    });

    res.json({
      success: true,
      message: `IP ${ip} has been added to whitelist`,
      data: {
        ip,
        reason: reason || `Added by ${req.user.name}`,
        duration: durationMs,
        permanent: !durationMs,
        addedBy: req.user.name,
        addedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('화이트리스트 추가 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add IP to whitelist'
    });
  }
});

// 로그인 시도 검증 (API 테스트용)
router.post('/check-attempt', authorize('security', 'read'), async (req, res) => {
  try {
    const { ip, identifier, userAgent } = req.body;

    if (!ip || !identifier) {
      return res.status(400).json({
        success: false,
        error: 'IP and identifier are required'
      });
    }

    const result = await bruteForceProtection.checkLoginAttempt(
      ip,
      identifier,
      userAgent || req.get('User-Agent') || '',
      { testMode: true }
    );

    await auditLogger.log({
      type: 'BRUTE_FORCE_CHECK_ATTEMPT',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CHECK',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        checkedIP: ip,
        checkedIdentifier: identifier,
        allowed: result.allowed,
        reason: result.reason
      }
    });

    res.json({
      success: true,
      data: {
        ...result,
        checkedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('로그인 시도 검증 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check login attempt'
    });
  }
});

// 통계 조회 (관리자만)
router.get('/statistics', requireAdmin(), async (req, res) => {
  try {
    const { timeWindow = '24h' } = req.query;
    
    const statistics = await bruteForceProtection.getStatistics(timeWindow);

    await auditLogger.log({
      type: 'BRUTE_FORCE_STATISTICS_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { timeWindow }
    });

    res.json({
      success: true,
      data: {
        timeWindow,
        statistics,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('브루트포스 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brute force statistics'
    });
  }
});

// 설정 조회 (관리자만)
router.get('/config', requireAdmin(), async (req, res) => {
  try {
    // 설정 정보 반환 (민감한 정보 제외)
    const config = {
      login: {
        maxAttempts: bruteForceProtection.config.login.maxAttempts,
        windowMs: bruteForceProtection.config.login.windowMs,
        blockDurationMs: bruteForceProtection.config.login.blockDurationMs
      },
      ip: {
        maxAttempts: bruteForceProtection.config.ip.maxAttempts,
        windowMs: bruteForceProtection.config.ip.windowMs,
        blockDurationMs: bruteForceProtection.config.ip.blockDurationMs
      },
      account: {
        maxAttempts: bruteForceProtection.config.account.maxAttempts,
        windowMs: bruteForceProtection.config.account.windowMs,
        blockDurationMs: bruteForceProtection.config.account.blockDurationMs
      },
      pattern: {
        enabled: bruteForceProtection.config.pattern.enabled,
        patternMultiplier: bruteForceProtection.config.pattern.patternMultiplier
      },
      geo: {
        enabled: bruteForceProtection.config.geo.enabled,
        vpnDetection: bruteForceProtection.config.geo.vpnDetection
      }
    };

    await auditLogger.log({
      type: 'BRUTE_FORCE_CONFIG_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('브루트포스 설정 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brute force configuration'
    });
  }
});

// 실시간 모니터링 데이터 (관리자만)
router.get('/monitoring', requireAdmin(), async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // 실제로는 Redis에서 최근 활동 조회
    const recentActivity = {
      recentAttempts: [],
      activeBlocks: [],
      suspiciousIPs: [],
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: recentActivity
    });

  } catch (error) {
    logger.error('브루트포스 모니터링 데이터 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring data'
    });
  }
});

module.exports = router;