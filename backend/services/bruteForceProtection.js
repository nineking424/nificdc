const redis = require('../utils/redis');
const logger = require('../utils/logger');
const auditLogger = require('./auditLogger');

/**
 * 고급 브루트포스 방어 서비스
 * 다층 보안과 적응형 임계값을 가진 지능형 방어 시스템
 */
class BruteForceProtection {
  constructor() {
    this.config = {
      // 로그인 시도 제한
      login: {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000, // 15분
        blockDurationMs: 60 * 60 * 1000, // 1시간
        progressiveDelay: true,
        maxDelay: 30000 // 30초
      },
      
      // IP 기반 제한
      ip: {
        maxAttempts: 20,
        windowMs: 60 * 60 * 1000, // 1시간
        blockDurationMs: 4 * 60 * 60 * 1000, // 4시간
        escalation: {
          level2: { attempts: 50, blockDuration: 24 * 60 * 60 * 1000 }, // 24시간
          level3: { attempts: 100, blockDuration: 7 * 24 * 60 * 60 * 1000 } // 7일
        }
      },
      
      // 계정 기반 제한
      account: {
        maxAttempts: 10,
        windowMs: 30 * 60 * 1000, // 30분
        blockDurationMs: 2 * 60 * 60 * 1000, // 2시간
        permanentLockThreshold: 50 // 50회 시도 후 영구 잠금
      },
      
      // 패턴 기반 제한
      pattern: {
        enabled: true,
        suspiciousPatterns: [
          /admin|administrator|root|superuser/i,
          /password|123456|qwerty|letmein/i,
          /test|demo|guest|public/i
        ],
        patternMultiplier: 2 // 패턴 매칭 시 카운트 배수
      },
      
      // 지역 기반 제한
      geo: {
        enabled: process.env.GEO_BLOCKING_ENABLED === 'true',
        allowedCountries: process.env.ALLOWED_COUNTRIES?.split(',') || [],
        blockedCountries: process.env.BLOCKED_COUNTRIES?.split(',') || [],
        vpnDetection: true
      }
    };
    
    this.redis = redis.getClient();
    this.patterns = {
      login: 'bf:login',
      ip: 'bf:ip',
      account: 'bf:account',
      block: 'bf:block',
      whitelist: 'bf:whitelist',
      pattern: 'bf:pattern'
    };
  }

  /**
   * 로그인 시도 검증
   */
  async checkLoginAttempt(ip, identifier, userAgent = '', additionalContext = {}) {
    try {
      // 화이트리스트 확인
      if (await this.isWhitelisted(ip)) {
        return { allowed: true, reason: 'whitelisted' };
      }

      // 현재 차단 상태 확인
      const blockStatus = await this.getBlockStatus(ip, identifier);
      if (blockStatus.blocked) {
        return {
          allowed: false,
          reason: 'blocked',
          blockInfo: blockStatus,
          retryAfter: blockStatus.retryAfter
        };
      }

      // 의심스러운 패턴 검사
      const suspiciousScore = await this.calculateSuspiciousScore(identifier, userAgent, additionalContext);
      
      // 지역 기반 필터링
      if (this.config.geo.enabled) {
        const geoCheck = await this.checkGeolocation(ip);
        if (!geoCheck.allowed) {
          await this.recordFailedAttempt(ip, identifier, 'geo_blocked');
          return {
            allowed: false,
            reason: 'geo_blocked',
            details: geoCheck.reason
          };
        }
      }

      return {
        allowed: true,
        suspiciousScore,
        warnings: suspiciousScore > 50 ? ['suspicious_pattern_detected'] : []
      };

    } catch (error) {
      logger.error('브루트포스 검증 실패:', error);
      // 에러 시 보수적으로 허용하지만 로깅
      return { allowed: true, error: true };
    }
  }

  /**
   * 실패한 로그인 시도 기록
   */
  async recordFailedAttempt(ip, identifier, reason = 'invalid_credentials', metadata = {}) {
    try {
      const timestamp = Date.now();
      const attemptData = {
        ip,
        identifier,
        reason,
        timestamp,
        metadata
      };

      // 다층 카운터 업데이트
      await Promise.all([
        this.incrementCounter('login', `${ip}:${identifier}`, attemptData),
        this.incrementCounter('ip', ip, attemptData),
        this.incrementCounter('account', identifier, attemptData)
      ]);

      // 차단 임계값 확인 및 적용
      await this.checkAndApplyBlocks(ip, identifier, attemptData);

      // 감사 로그 기록
      await auditLogger.log({
        type: 'BRUTE_FORCE_ATTEMPT',
        action: 'LOGIN_FAILED',
        resource: 'auth',
        ip,
        result: 'FAILED',
        severity: 'MEDIUM',
        metadata: {
          identifier,
          reason,
          ...metadata
        }
      });

    } catch (error) {
      logger.error('실패 시도 기록 오류:', error);
    }
  }

  /**
   * 성공한 로그인 시도 기록 (카운터 리셋)
   */
  async recordSuccessfulAttempt(ip, identifier) {
    try {
      // 성공 시 해당 사용자의 카운터 리셋
      await Promise.all([
        this.resetCounter('login', `${ip}:${identifier}`),
        this.resetCounter('account', identifier)
      ]);

      logger.info('성공적인 로그인으로 카운터 리셋:', { ip, identifier });

    } catch (error) {
      logger.error('성공 시도 기록 오류:', error);
    }
  }

  /**
   * 카운터 증가
   */
  async incrementCounter(type, key, attemptData) {
    const redisKey = `${this.patterns[type]}:${key}`;
    const config = this.config[type];
    
    // 현재 카운트 조회
    const current = await this.redis.get(redisKey);
    const count = current ? parseInt(current) : 0;
    const newCount = count + 1;

    // 의심스러운 패턴 가중치 적용
    const multiplier = await this.getPatternMultiplier(attemptData);
    const weightedCount = Math.min(newCount * multiplier, config.maxAttempts * 2);

    // 카운터 업데이트
    await this.redis.setex(redisKey, Math.ceil(config.windowMs / 1000), weightedCount);

    // 시도 이력 저장 (최근 10개)
    const historyKey = `${redisKey}:history`;
    await this.redis.lpush(historyKey, JSON.stringify(attemptData));
    await this.redis.ltrim(historyKey, 0, 9);
    await this.redis.expire(historyKey, Math.ceil(config.windowMs / 1000));

    return { count: weightedCount, multiplier };
  }

  /**
   * 카운터 리셋
   */
  async resetCounter(type, key) {
    const redisKey = `${this.patterns[type]}:${key}`;
    await this.redis.del(redisKey);
    await this.redis.del(`${redisKey}:history`);
  }

  /**
   * 차단 임계값 확인 및 적용
   */
  async checkAndApplyBlocks(ip, identifier, attemptData) {
    const checks = [
      { type: 'login', key: `${ip}:${identifier}` },
      { type: 'ip', key: ip },
      { type: 'account', key: identifier }
    ];

    for (const check of checks) {
      const count = await this.getCount(check.type, check.key);
      const config = this.config[check.type];

      if (count >= config.maxAttempts) {
        await this.applyBlock(check.type, check.key, config.blockDurationMs, attemptData);
      }

      // IP 에스컬레이션 확인
      if (check.type === 'ip' && config.escalation) {
        if (count >= config.escalation.level3.attempts) {
          await this.applyBlock('ip', ip, config.escalation.level3.blockDuration, attemptData, 'LEVEL_3');
        } else if (count >= config.escalation.level2.attempts) {
          await this.applyBlock('ip', ip, config.escalation.level2.blockDuration, attemptData, 'LEVEL_2');
        }
      }

      // 계정 영구 잠금 확인
      if (check.type === 'account' && count >= config.permanentLockThreshold) {
        await this.applyPermanentBlock(identifier, attemptData);
      }
    }
  }

  /**
   * 차단 적용
   */
  async applyBlock(type, key, duration, attemptData, level = 'STANDARD') {
    const blockKey = `${this.patterns.block}:${type}:${key}`;
    const blockData = {
      type,
      key,
      level,
      startTime: Date.now(),
      duration,
      endTime: Date.now() + duration,
      reason: 'max_attempts_exceeded',
      attemptData
    };

    await this.redis.setex(blockKey, Math.ceil(duration / 1000), JSON.stringify(blockData));

    // 알림 발송
    await this.sendBlockAlert(blockData);

    logger.warn(`${type} 차단 적용:`, {
      key,
      level,
      duration: duration / 1000 / 60 + ' minutes'
    });
  }

  /**
   * 영구 차단 적용
   */
  async applyPermanentBlock(identifier, attemptData) {
    const blockKey = `${this.patterns.block}:permanent:${identifier}`;
    const blockData = {
      type: 'permanent',
      key: identifier,
      startTime: Date.now(),
      reason: 'permanent_lock_threshold_exceeded',
      attemptData
    };

    await this.redis.set(blockKey, JSON.stringify(blockData));

    // 즉시 알림 발송
    await this.sendCriticalAlert(blockData);

    logger.error('계정 영구 잠금:', { identifier });
  }

  /**
   * 차단 상태 확인
   */
  async getBlockStatus(ip, identifier) {
    const blockChecks = [
      `${this.patterns.block}:permanent:${identifier}`,
      `${this.patterns.block}:account:${identifier}`,
      `${this.patterns.block}:ip:${ip}`,
      `${this.patterns.block}:login:${ip}:${identifier}`
    ];

    for (const blockKey of blockChecks) {
      const blockData = await this.redis.get(blockKey);
      if (blockData) {
        const block = JSON.parse(blockData);
        
        if (block.type === 'permanent') {
          return {
            blocked: true,
            type: 'permanent',
            reason: 'Account permanently locked',
            startTime: block.startTime
          };
        }

        const remaining = block.endTime - Date.now();
        if (remaining > 0) {
          return {
            blocked: true,
            type: block.type,
            level: block.level,
            reason: `Temporarily blocked due to ${block.reason}`,
            retryAfter: Math.ceil(remaining / 1000),
            endTime: block.endTime
          };
        } else {
          // 만료된 차단 제거
          await this.redis.del(blockKey);
        }
      }
    }

    return { blocked: false };
  }

  /**
   * 카운트 조회
   */
  async getCount(type, key) {
    const redisKey = `${this.patterns[type]}:${key}`;
    const count = await this.redis.get(redisKey);
    return count ? parseInt(count) : 0;
  }

  /**
   * 의심스러운 점수 계산
   */
  async calculateSuspiciousScore(identifier, userAgent, context) {
    let score = 0;

    // 패턴 매칭
    if (this.config.pattern.enabled) {
      for (const pattern of this.config.pattern.suspiciousPatterns) {
        if (pattern.test(identifier)) {
          score += 30;
          break;
        }
      }
    }

    // User-Agent 분석
    if (!userAgent || userAgent.length < 10) {
      score += 20;
    }

    // 자동화 도구 탐지
    const automationPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|go-http/i,
      /postman|insomnia|httpie/i
    ];

    for (const pattern of automationPatterns) {
      if (pattern.test(userAgent)) {
        score += 25;
        break;
      }
    }

    // 시간대 분석 (업무 시간 외 접근)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 10;
    }

    // 빈도 분석
    const recentAttempts = await this.getRecentAttemptCount(identifier);
    if (recentAttempts > 3) {
      score += Math.min(recentAttempts * 5, 30);
    }

    return Math.min(score, 100);
  }

  /**
   * 패턴 가중치 계산
   */
  async getPatternMultiplier(attemptData) {
    if (!this.config.pattern.enabled) return 1;

    const { identifier = '', metadata = {} } = attemptData;
    let multiplier = 1;

    // 의심스러운 패턴 확인
    for (const pattern of this.config.pattern.suspiciousPatterns) {
      if (pattern.test(identifier)) {
        multiplier = this.config.pattern.patternMultiplier;
        break;
      }
    }

    // 추가 메타데이터 기반 가중치
    if (metadata.automated) multiplier *= 1.5;
    if (metadata.vpn) multiplier *= 1.3;

    return multiplier;
  }

  /**
   * 지역 확인
   */
  async checkGeolocation(ip) {
    if (!this.config.geo.enabled) {
      return { allowed: true };
    }

    try {
      // 실제로는 GeoIP 라이브러리나 외부 API 사용
      // 여기서는 시뮬레이션
      const geoData = await this.getGeoData(ip);
      
      if (this.config.geo.blockedCountries.includes(geoData.country)) {
        return {
          allowed: false,
          reason: 'country_blocked',
          country: geoData.country
        };
      }

      if (this.config.geo.allowedCountries.length > 0 && 
          !this.config.geo.allowedCountries.includes(geoData.country)) {
        return {
          allowed: false,
          reason: 'country_not_allowed',
          country: geoData.country
        };
      }

      if (this.config.geo.vpnDetection && geoData.isVpn) {
        return {
          allowed: false,
          reason: 'vpn_detected',
          vpnProvider: geoData.vpnProvider
        };
      }

      return { allowed: true, geoData };

    } catch (error) {
      logger.error('지역 확인 실패:', error);
      return { allowed: true, error: true };
    }
  }

  /**
   * 지역 데이터 조회 (시뮬레이션)
   */
  async getGeoData(ip) {
    // 실제로는 MaxMind, IPinfo, 등의 서비스 사용
    return {
      ip,
      country: 'KR',
      city: 'Seoul',
      isVpn: false,
      vpnProvider: null
    };
  }

  /**
   * 화이트리스트 확인
   */
  async isWhitelisted(ip) {
    const whitelistKey = `${this.patterns.whitelist}:${ip}`;
    return await this.redis.exists(whitelistKey);
  }

  /**
   * 화이트리스트 추가
   */
  async addToWhitelist(ip, reason = '', duration = null) {
    const whitelistKey = `${this.patterns.whitelist}:${ip}`;
    const data = {
      ip,
      reason,
      addedAt: Date.now(),
      duration
    };

    if (duration) {
      await this.redis.setex(whitelistKey, Math.ceil(duration / 1000), JSON.stringify(data));
    } else {
      await this.redis.set(whitelistKey, JSON.stringify(data));
    }

    logger.info('IP 화이트리스트 추가:', { ip, reason, duration });
  }

  /**
   * 최근 시도 횟수 조회
   */
  async getRecentAttemptCount(identifier) {
    const patternKey = `${this.patterns.pattern}:${identifier}`;
    const count = await this.redis.get(patternKey);
    return count ? parseInt(count) : 0;
  }

  /**
   * 차단 알림 발송
   */
  async sendBlockAlert(blockData) {
    try {
      const alertManager = require('./alertManager');
      
      await alertManager.processEvent({
        type: 'BRUTE_FORCE_BLOCK',
        severity: blockData.level === 'LEVEL_3' ? 'CRITICAL' : 'HIGH',
        timestamp: new Date(),
        metadata: {
          blockType: blockData.type,
          key: blockData.key,
          level: blockData.level,
          duration: blockData.duration,
          reason: blockData.reason
        }
      });

    } catch (error) {
      logger.error('차단 알림 발송 실패:', error);
    }
  }

  /**
   * 중요 알림 발송
   */
  async sendCriticalAlert(blockData) {
    try {
      const alertManager = require('./alertManager');
      
      await alertManager.processEvent({
        type: 'PERMANENT_ACCOUNT_LOCK',
        severity: 'CRITICAL',
        timestamp: new Date(),
        metadata: {
          account: blockData.key,
          reason: blockData.reason,
          lockTime: blockData.startTime
        }
      });

    } catch (error) {
      logger.error('중요 알림 발송 실패:', error);
    }
  }

  /**
   * 통계 조회
   */
  async getStatistics(timeWindow = '24h') {
    // 구현 필요: 차단 통계, 시도 통계 등
    return {
      totalAttempts: 0,
      blockedAttempts: 0,
      activeBlocks: 0,
      topAttackers: []
    };
  }

  /**
   * 차단 해제
   */
  async unblock(type, key, reason = '') {
    const blockKey = `${this.patterns.block}:${type}:${key}`;
    await this.redis.del(blockKey);
    
    logger.info('차단 해제:', { type, key, reason });
  }
}

module.exports = new BruteForceProtection();