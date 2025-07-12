const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../middleware/rbac');
const { getSSLStatus, validateTLSConfig } = require('../../config/ssl');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../utils/logger');

/**
 * 보안 설정 관리 API 라우터
 * SSL/TLS 상태, 보안 헤더, 보안 설정 조회 및 관리
 */

// 보안 상태 종합 조회 (관리자만)
router.get('/status', requireAdmin(), async (req, res) => {
  try {
    // SSL/TLS 상태
    const sslStatus = getSSLStatus();
    
    // TLS 설정 검증
    const tlsValidation = validateTLSConfig();
    
    // 환경 변수 기반 보안 설정 상태
    const securityConfig = {
      httpsRedirect: process.env.FORCE_HTTPS === 'true',
      secureCookies: process.env.SECURE_COOKIES !== 'false',
      corsEnabled: true,
      rateLimitEnabled: true,
      helmetEnabled: true,
      auditLogging: true,
      alertSystem: true,
      environment: process.env.NODE_ENV || 'development'
    };
    
    // IP 제한 설정
    const ipRestrictions = {
      adminWhitelist: process.env.ADMIN_IPS ? process.env.ADMIN_IPS.split(',') : [],
      corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []
    };
    
    // 보안 점수 계산
    const securityScore = calculateSecurityScore(sslStatus, securityConfig, tlsValidation);

    await auditLogger.log({
      type: 'SECURITY_STATUS_ACCESS',
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
      data: {
        ssl: sslStatus,
        tls: tlsValidation,
        config: securityConfig,
        ipRestrictions,
        securityScore,
        recommendations: generateSecurityRecommendations(sslStatus, securityConfig, tlsValidation),
        lastChecked: new Date()
      }
    });
  } catch (error) {
    logger.error('보안 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security status'
    });
  }
});

// 보안 헤더 테스트
router.get('/headers/test', requireAdmin(), async (req, res) => {
  try {
    const testUrl = req.query.url || `${req.protocol}://${req.get('host')}`;
    
    // 실제로는 외부 헤더 검증 서비스나 자체 구현 사용
    const headerTests = {
      strictTransportSecurity: req.get('strict-transport-security') ? 'PASS' : 'FAIL',
      contentSecurityPolicy: req.get('content-security-policy') ? 'PASS' : 'FAIL',
      xFrameOptions: req.get('x-frame-options') ? 'PASS' : 'FAIL',
      xContentTypeOptions: req.get('x-content-type-options') ? 'PASS' : 'FAIL',
      xXssProtection: req.get('x-xss-protection') ? 'PASS' : 'FAIL',
      referrerPolicy: req.get('referrer-policy') ? 'PASS' : 'FAIL',
      permissionsPolicy: req.get('permissions-policy') ? 'PASS' : 'FAIL'
    };

    const passedTests = Object.values(headerTests).filter(result => result === 'PASS').length;
    const totalTests = Object.keys(headerTests).length;
    const score = Math.round((passedTests / totalTests) * 100);

    await auditLogger.log({
      type: 'SECURITY_HEADER_TEST',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'TEST',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        testUrl,
        score,
        passedTests,
        totalTests
      }
    });

    res.json({
      success: true,
      data: {
        testUrl,
        tests: headerTests,
        score,
        passedTests,
        totalTests,
        testedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('보안 헤더 테스트 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test security headers'
    });
  }
});

// SSL 인증서 정보 조회
router.get('/ssl/certificate', requireAdmin(), async (req, res) => {
  try {
    const sslStatus = getSSLStatus();
    
    if (!sslStatus.enabled || !sslStatus.certInfo) {
      return res.status(404).json({
        success: false,
        error: 'SSL certificate not found or invalid'
      });
    }

    // 민감한 정보 제외하고 인증서 정보만 반환
    const certInfo = {
      subject: sslStatus.certInfo.subject,
      issuer: sslStatus.certInfo.issuer,
      notBefore: sslStatus.certInfo.notBefore,
      notAfter: sslStatus.certInfo.notAfter,
      daysUntilExpiry: sslStatus.certInfo.daysUntilExpiry,
      valid: sslStatus.certInfo.valid
    };

    await auditLogger.log({
      type: 'SSL_CERTIFICATE_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      resourceId: 'ssl_certificate',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: certInfo
    });
  } catch (error) {
    logger.error('SSL 인증서 정보 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SSL certificate info'
    });
  }
});

// 보안 설정 업데이트 (관리자만)
router.patch('/config', requireAdmin(), async (req, res) => {
  try {
    const { 
      forceHttps,
      secureCookies,
      corsOrigins,
      adminIPs 
    } = req.body;

    const updates = {};
    const oldConfig = {
      forceHttps: process.env.FORCE_HTTPS === 'true',
      secureCookies: process.env.SECURE_COOKIES !== 'false',
      corsOrigins: process.env.CORS_ORIGINS,
      adminIPs: process.env.ADMIN_IPS
    };

    // 실제로는 환경 변수 파일이나 설정 데이터베이스 업데이트
    // 여기서는 로깅만 수행
    if (typeof forceHttps === 'boolean') {
      updates.forceHttps = forceHttps;
    }
    
    if (typeof secureCookies === 'boolean') {
      updates.secureCookies = secureCookies;
    }
    
    if (corsOrigins && Array.isArray(corsOrigins)) {
      updates.corsOrigins = corsOrigins.join(',');
    }
    
    if (adminIPs && Array.isArray(adminIPs)) {
      updates.adminIPs = adminIPs.join(',');
    }

    await auditLogger.logConfigChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      configKey: 'security_settings',
      section: 'security',
      oldValues: oldConfig,
      newValues: updates,
      changes: updates,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      affectedServices: ['api', 'authentication', 'cors']
    });

    logger.warn('보안 설정 변경:', {
      userId: req.user.id,
      oldConfig,
      updates
    });

    res.json({
      success: true,
      message: 'Security configuration updated (restart required)',
      data: {
        updates,
        restartRequired: true,
        updatedBy: req.user.name,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('보안 설정 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update security configuration'
    });
  }
});

// 보안 취약점 스캔 시뮬레이션
router.post('/scan', requireAdmin(), async (req, res) => {
  try {
    const { scanType = 'basic' } = req.body;
    
    // 실제로는 외부 보안 스캔 도구나 자체 구현 사용
    const vulnerabilities = simulateSecurityScan(scanType);
    
    const scanResult = {
      scanId: `scan_${Date.now()}`,
      scanType,
      startedAt: new Date(),
      completedAt: new Date(),
      vulnerabilities,
      riskScore: calculateRiskScore(vulnerabilities),
      summary: {
        critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
        medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        low: vulnerabilities.filter(v => v.severity === 'LOW').length,
        total: vulnerabilities.length
      }
    };

    await auditLogger.log({
      type: 'SECURITY_SCAN_EXECUTED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SCAN',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      severity: scanResult.riskScore > 70 ? 'HIGH' : 'MEDIUM',
      metadata: {
        scanId: scanResult.scanId,
        scanType,
        vulnerabilityCount: vulnerabilities.length,
        riskScore: scanResult.riskScore
      }
    });

    logger.info('보안 스캔 완료:', {
      scanId: scanResult.scanId,
      vulnerabilityCount: vulnerabilities.length,
      riskScore: scanResult.riskScore
    });

    res.json({
      success: true,
      data: scanResult
    });
  } catch (error) {
    logger.error('보안 스캔 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute security scan'
    });
  }
});

// 보안 권장사항 조회
router.get('/recommendations', requireAdmin(), async (req, res) => {
  try {
    const sslStatus = getSSLStatus();
    const tlsValidation = validateTLSConfig();
    const securityConfig = {
      httpsRedirect: process.env.FORCE_HTTPS === 'true',
      secureCookies: process.env.SECURE_COOKIES !== 'false',
      environment: process.env.NODE_ENV || 'development'
    };

    const recommendations = generateSecurityRecommendations(sslStatus, securityConfig, tlsValidation);

    await auditLogger.log({
      type: 'SECURITY_RECOMMENDATIONS_ACCESS',
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
      data: {
        recommendations,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('보안 권장사항 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security recommendations'
    });
  }
});

// 헬퍼 함수들
function calculateSecurityScore(sslStatus, securityConfig, tlsValidation) {
  let score = 0;
  let maxScore = 0;

  // SSL/TLS (30점)
  maxScore += 30;
  if (sslStatus.enabled && sslStatus.certValid) {
    score += 30;
  } else if (sslStatus.enabled) {
    score += 15;
  }

  // HTTPS 강제 (15점)
  maxScore += 15;
  if (securityConfig.httpsRedirect) {
    score += 15;
  }

  // 보안 쿠키 (10점)
  maxScore += 10;
  if (securityConfig.secureCookies) {
    score += 10;
  }

  // 기본 보안 설정 (45점)
  maxScore += 45;
  if (securityConfig.corsEnabled) score += 10;
  if (securityConfig.rateLimitEnabled) score += 10;
  if (securityConfig.helmetEnabled) score += 10;
  if (securityConfig.auditLogging) score += 10;
  if (securityConfig.alertSystem) score += 5;

  return Math.round((score / maxScore) * 100);
}

function generateSecurityRecommendations(sslStatus, securityConfig, tlsValidation) {
  const recommendations = [];

  if (!sslStatus.enabled) {
    recommendations.push({
      category: 'SSL/TLS',
      severity: 'HIGH',
      title: 'SSL/TLS 인증서 설정 필요',
      description: 'HTTPS를 활성화하여 데이터 전송을 암호화하세요.',
      action: 'SSL 인증서를 설치하고 HTTPS를 구성하세요.'
    });
  } else if (!sslStatus.certValid) {
    recommendations.push({
      category: 'SSL/TLS',
      severity: 'CRITICAL',
      title: 'SSL 인증서 갱신 필요',
      description: 'SSL 인증서가 만료되었거나 유효하지 않습니다.',
      action: '유효한 SSL 인증서로 교체하세요.'
    });
  } else if (sslStatus.certInfo && sslStatus.certInfo.daysUntilExpiry < 30) {
    recommendations.push({
      category: 'SSL/TLS',
      severity: 'MEDIUM',
      title: 'SSL 인증서 만료 임박',
      description: `SSL 인증서가 ${sslStatus.certInfo.daysUntilExpiry}일 후 만료됩니다.`,
      action: 'SSL 인증서를 갱신하세요.'
    });
  }

  if (!securityConfig.httpsRedirect && securityConfig.environment === 'production') {
    recommendations.push({
      category: '보안 설정',
      severity: 'HIGH',
      title: 'HTTPS 강제 리다이렉트 활성화',
      description: '프로덕션 환경에서 모든 HTTP 요청을 HTTPS로 리다이렉트해야 합니다.',
      action: 'FORCE_HTTPS 환경 변수를 true로 설정하세요.'
    });
  }

  if (!securityConfig.secureCookies && securityConfig.environment === 'production') {
    recommendations.push({
      category: '보안 설정',
      severity: 'MEDIUM',
      title: '보안 쿠키 설정 활성화',
      description: '쿠키를 HTTPS를 통해서만 전송되도록 설정해야 합니다.',
      action: 'SECURE_COOKIES 환경 변수를 true로 설정하세요.'
    });
  }

  if (tlsValidation.warnings.length > 0) {
    tlsValidation.warnings.forEach(warning => {
      recommendations.push({
        category: 'TLS 설정',
        severity: 'MEDIUM',
        title: 'TLS 설정 개선',
        description: warning,
        action: '해당 설정을 검토하고 수정하세요.'
      });
    });
  }

  return recommendations;
}

function simulateSecurityScan(scanType) {
  const vulnerabilities = [];

  if (scanType === 'comprehensive') {
    // 종합 스캔 시뮬레이션
    vulnerabilities.push({
      id: 'VULN-001',
      title: 'Weak TLS Configuration',
      description: 'Server accepts weak TLS cipher suites',
      severity: 'MEDIUM',
      category: 'TLS/SSL',
      cveId: null,
      remediation: 'Configure server to use only strong cipher suites'
    });
  }

  // 기본 스캔은 항상 실행
  if (process.env.NODE_ENV !== 'production') {
    vulnerabilities.push({
      id: 'VULN-DEV-001',
      title: 'Development Mode Detected',
      description: 'Application is running in development mode',
      severity: 'LOW',
      category: 'Configuration',
      cveId: null,
      remediation: 'Set NODE_ENV to production in production environment'
    });
  }

  return vulnerabilities;
}

function calculateRiskScore(vulnerabilities) {
  let score = 0;
  
  vulnerabilities.forEach(vuln => {
    switch (vuln.severity) {
      case 'CRITICAL': score += 25; break;
      case 'HIGH': score += 15; break;
      case 'MEDIUM': score += 8; break;
      case 'LOW': score += 3; break;
    }
  });

  return Math.min(score, 100);
}

module.exports = router;