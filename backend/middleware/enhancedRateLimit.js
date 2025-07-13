const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../utils/redis');
const logger = require('../utils/logger');
const auditLogger = require('../services/auditLogger');
const bruteForceProtection = require('../services/bruteForceProtection');

/**
 * 고급 Rate Limiting 미들웨어
 * Redis 기반 분산 처리와 적응형 임계값을 지원
 */
class EnhancedRateLimit {
  constructor() {
    this.redisClient = redis.getClient();
    this.store = new RedisStore({
      sendCommand: (...args) => this.redisClient.call(...args),
    });
  }

  /**
   * 적응형 API Rate Limiter
   * 사용자 유형, 시간대, 시스템 부하에 따라 동적 조정
   */
  createApiLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15분
      standardHeaders: true,
      legacyHeaders: false,
      store: this.store,
      keyGenerator: this.generateKey.bind(this),
      max: this.calculateAdaptiveLimit.bind(this),
      message: this.getRateLimitMessage.bind(this),
      onLimitReached: this.handleLimitReached.bind(this),
      skip: this.shouldSkipRateLimit.bind(this)
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * 로그인 전용 Rate Limiter
   * 브루트포스 공격 방어와 통합
   */
  createLoginLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15분
      max: 5,
      skipSuccessfulRequests: true,
      store: this.store,
      keyGenerator: (req) => {
        const ip = this.getClientIP(req);
        const identifier = req.body?.email || req.body?.username || 'unknown';
        return `login:${ip}:${identifier}`;
      },
      message: {
        error: 'Too many login attempts',
        message: 'Account temporarily locked due to multiple failed login attempts.',
        retryAfter: null,
        type: 'rate_limit_exceeded'
      },
      onLimitReached: async (req, res, options) => {
        const ip = this.getClientIP(req);
        const identifier = req.body?.email || req.body?.username;
        
        // 브루트포스 보호 서비스와 연동
        await bruteForceProtection.recordFailedAttempt(
          ip, 
          identifier, 
          'rate_limit_exceeded',
          {
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method
          }
        );

        // 감사 로그
        await auditLogger.log({
          type: 'LOGIN_RATE_LIMIT_EXCEEDED',
          action: 'LOGIN_ATTEMPT',
          resource: 'auth',
          ip,
          userAgent: req.get('User-Agent'),
          result: 'BLOCKED',
          severity: 'HIGH',
          metadata: {
            identifier,
            attempts: options.max,
            windowMs: options.windowMs
          }
        });
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * 관리자 API 전용 Rate Limiter
   * 더 엄격한 제한과 모니터링
   */
  createAdminLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 5 * 60 * 1000, // 5분
      max: 50,
      store: this.store,
      keyGenerator: (req) => {
        const ip = this.getClientIP(req);
        const userId = req.user?.id || 'anonymous';
        return `admin:${ip}:${userId}`;
      },
      message: {
        error: 'Admin API rate limit exceeded',
        message: 'Too many administrative requests. Please wait before trying again.',
        type: 'admin_rate_limit'
      },
      onLimitReached: async (req, res, options) => {
        const ip = this.getClientIP(req);
        
        // 관리자 API 과다 사용 알림
        await this.sendAdminAlertNotification(req, options);
        
        await auditLogger.log({
          type: 'ADMIN_RATE_LIMIT_EXCEEDED',
          userId: req.user?.id,
          userName: req.user?.name,
          userRole: req.user?.role,
          action: 'ADMIN_API_ACCESS',
          resource: 'admin',
          ip,
          userAgent: req.get('User-Agent'),
          result: 'BLOCKED',
          severity: 'HIGH',
          metadata: {
            path: req.path,
            method: req.method,
            limit: options.max
          }
        });
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * 파일 업로드 Rate Limiter
   * 대용량 파일 업로드 남용 방지
   */
  createUploadLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 60 * 60 * 1000, // 1시간
      max: 10, // 시간당 최대 10개 파일
      store: this.store,
      keyGenerator: (req) => {
        const ip = this.getClientIP(req);
        const userId = req.user?.id || 'anonymous';
        return `upload:${ip}:${userId}`;
      },
      message: {
        error: 'Upload rate limit exceeded',
        message: 'Too many file uploads. Please wait before uploading more files.',
        type: 'upload_rate_limit'
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * 적응형 제한 계산
   * 사용자 유형, 시스템 부하, 시간대를 고려
   */
  async calculateAdaptiveLimit(req) {
    const baseLimit = 100;
    let limit = baseLimit;

    // 인증된 사용자 보너스
    if (req.user) {
      switch (req.user.role) {
        case 'admin':
          limit = baseLimit * 10;
          break;
        case 'operator':
          limit = baseLimit * 5;
          break;
        case 'user':
          limit = baseLimit * 2;
          break;
        default:
          limit = baseLimit;
      }
    }

    // 시간대 조정 (업무 시간)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 18) {
      limit = Math.floor(limit * 1.5); // 업무 시간 증가
    } else if (hour >= 22 || hour <= 6) {
      limit = Math.floor(limit * 0.5); // 심야 시간 감소
    }

    // 시스템 부하 조정
    const systemLoad = await this.getSystemLoad();
    if (systemLoad > 80) {
      limit = Math.floor(limit * 0.5);
    } else if (systemLoad < 30) {
      limit = Math.floor(limit * 1.2);
    }

    // VIP 사용자 또는 신뢰할 수 있는 IP
    if (await this.isVIPUser(req.user) || await this.isTrustedIP(this.getClientIP(req))) {
      limit = Math.floor(limit * 2);
    }

    return Math.max(limit, 10); // 최소 10개 요청 보장
  }

  /**
   * Rate Limit 메시지 생성
   */
  getRateLimitMessage(req, options) {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    
    return {
      error: 'Rate limit exceeded',
      message: `Too many requests from this client. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter,
      type: 'rate_limit_exceeded',
      limit: options.max,
      windowMs: options.windowMs,
      suggestions: [
        'Wait for the rate limit window to reset',
        'Use authentication for higher limits',
        'Implement request batching',
        'Contact support for enterprise limits'
      ]
    };
  }

  /**
   * Rate Limit 도달 처리
   */
  async handleLimitReached(req, res, options) {
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent');
    const path = req.path;

    // 의심스러운 활동 패턴 분석
    const suspiciousScore = await this.analyzeSuspiciousActivity(req);
    
    if (suspiciousScore > 70) {
      // 높은 의심 점수시 추가 조치
      await this.handleSuspiciousActivity(req, suspiciousScore);
    }

    // 감사 로그
    await auditLogger.log({
      type: 'API_RATE_LIMIT_EXCEEDED',
      userId: req.user?.id || null,
      userName: req.user?.name || 'Anonymous',
      userRole: req.user?.role || 'unknown',
      action: 'API_REQUEST',
      resource: 'api',
      resourceId: path,
      ip,
      userAgent,
      result: 'BLOCKED',
      severity: suspiciousScore > 70 ? 'HIGH' : 'MEDIUM',
      metadata: {
        limit: options.max,
        windowMs: options.windowMs,
        path,
        method: req.method,
        suspiciousScore
      }
    });

    logger.warn('API Rate Limit 초과:', {
      ip,
      userId: req.user?.id,
      path,
      method: req.method,
      userAgent,
      suspiciousScore
    });
  }

  /**
   * Rate Limit 건너뛰기 조건
   */
  async shouldSkipRateLimit(req) {
    const ip = this.getClientIP(req);
    
    // 화이트리스트 IP 확인
    if (await bruteForceProtection.isWhitelisted(ip)) {
      return true;
    }

    // 헬스체크 엔드포인트
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }

    // 시스템 관리자 계정
    if (req.user && req.user.role === 'system' && this.isInternalIP(ip)) {
      return true;
    }

    return false;
  }

  /**
   * 의심스러운 활동 분석
   */
  async analyzeSuspiciousActivity(req) {
    let score = 0;
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || '';

    // User-Agent 분석
    if (!userAgent || userAgent.length < 10) {
      score += 20;
    }

    // 자동화 도구 패턴
    const botPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python-requests/i,
      /postman|insomnia|httpie/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        score += 25;
        break;
      }
    }

    // 요청 빈도 분석
    const recentRequests = await this.getRecentRequestCount(ip);
    if (recentRequests > 1000) {
      score += 30;
    } else if (recentRequests > 500) {
      score += 15;
    }

    // 지역 기반 위험 평가
    const geoRisk = await this.getGeographicRisk(ip);
    score += geoRisk;

    // 시간대 분석
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * 의심스러운 활동 처리
   */
  async handleSuspiciousActivity(req, suspiciousScore) {
    const ip = this.getClientIP(req);
    
    // 알림 발송
    try {
      const alertManager = require('../services/alertManager');
      
      await alertManager.processEvent({
        type: 'SUSPICIOUS_ACTIVITY_DETECTED',
        severity: 'HIGH',
        timestamp: new Date(),
        metadata: {
          ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          suspiciousScore,
          userId: req.user?.id
        }
      });
    } catch (error) {
      logger.error('의심스러운 활동 알림 발송 실패:', error);
    }
  }

  /**
   * 키 생성
   */
  generateKey(req) {
    const ip = this.getClientIP(req);
    const userId = req.user?.id;
    const userRole = req.user?.role || 'anonymous';
    
    return userId ? `api:${userRole}:${ip}:${userId}` : `api:${userRole}:${ip}`;
  }

  /**
   * 클라이언트 IP 추출
   */
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           'unknown';
  }

  /**
   * 시스템 부하 조회
   */
  async getSystemLoad() {
    try {
      // 실제로는 시스템 메트릭을 조회
      // CPU, 메모리, 디스크 I/O 등을 종합하여 계산
      const os = require('os');
      const loadAverage = os.loadavg()[0];
      const cpuCount = os.cpus().length;
      return Math.min((loadAverage / cpuCount) * 100, 100);
    } catch (error) {
      return 50; // 기본값
    }
  }

  /**
   * VIP 사용자 확인
   */
  async isVIPUser(user) {
    if (!user) return false;
    return user.role === 'admin' || user.vip === true;
  }

  /**
   * 신뢰할 수 있는 IP 확인
   */
  async isTrustedIP(ip) {
    const trustedIPs = [
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ];

    return trustedIPs.some(trustedIP => {
      if (trustedIP.includes('/')) {
        // CIDR 범위 확인 (간단한 구현)
        return ip.startsWith(trustedIP.split('/')[0].slice(0, -1));
      }
      return ip === trustedIP;
    });
  }

  /**
   * 내부 IP 확인
   */
  isInternalIP(ip) {
    const internalRanges = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return internalRanges.some(range => range.test(ip));
  }

  /**
   * 최근 요청 수 조회
   */
  async getRecentRequestCount(ip) {
    try {
      const key = `requests:${ip}:${Math.floor(Date.now() / 60000)}`;
      const count = await this.redisClient.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 지역 기반 위험 평가
   */
  async getGeographicRisk(ip) {
    try {
      // 실제로는 GeoIP 데이터베이스 사용
      // 여기서는 간단한 시뮬레이션
      const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
      const mediumRiskCountries = ['BR', 'IN', 'ID'];
      
      // 시뮬레이션된 국가 코드
      const country = 'KR'; // 실제로는 IP에서 추출
      
      if (highRiskCountries.includes(country)) {
        return 30;
      } else if (mediumRiskCountries.includes(country)) {
        return 15;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 관리자 알림 발송
   */
  async sendAdminAlertNotification(req, options) {
    try {
      const alertManager = require('../services/alertManager');
      
      await alertManager.processEvent({
        type: 'ADMIN_API_ABUSE',
        severity: 'HIGH',
        timestamp: new Date(),
        metadata: {
          userId: req.user?.id,
          userName: req.user?.name,
          ip: this.getClientIP(req),
          path: req.path,
          method: req.method,
          limit: options.max
        }
      });
    } catch (error) {
      logger.error('관리자 알림 발송 실패:', error);
    }
  }
}

module.exports = new EnhancedRateLimit();