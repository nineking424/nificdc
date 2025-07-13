const logger = require('../src/utils/logger');
const auditLogger = require('./auditLogger');

/**
 * 알림 관리 서비스
 * 중요 이벤트 감지 및 다양한 채널을 통한 실시간 알림 관리
 */
class AlertManager {
  constructor() {
    this.alertRules = new Map();
    this.alertHistory = [];
    this.config = {
      maxHistorySize: 1000,
      rateLimitWindow: 300000, // 5분
      maxAlertsPerWindow: 10,
      alertCooldown: 60000 // 1분
    };
    
    this.rateLimitTracker = new Map();
    this.alertCooldowns = new Map();
    
    this.initializeDefaultRules();
  }

  /**
   * 기본 알림 규칙 초기화
   */
  initializeDefaultRules() {
    // 로그인 실패 연속 시도
    this.addRule('multiple_login_failures', {
      name: '다중 로그인 실패',
      description: '연속된 로그인 실패 시도 감지',
      severity: 'HIGH',
      conditions: {
        eventType: 'LOGIN_FAILURE',
        threshold: 5,
        timeWindow: 300000, // 5분
        groupBy: ['ipAddress', 'userName']
      },
      actions: ['email', 'slack', 'monitoring'],
      enabled: true
    });

    // 무권한 접근 시도
    this.addRule('unauthorized_access', {
      name: '무권한 접근 시도',
      description: '권한 없는 리소스 접근 시도',
      severity: 'HIGH',
      conditions: {
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        threshold: 3,
        timeWindow: 300000,
        groupBy: ['userId', 'resource']
      },
      actions: ['email', 'slack', 'monitoring', 'webhook'],
      enabled: true
    });

    // 권한 상승 시도
    this.addRule('privilege_escalation', {
      name: '권한 상승 시도',
      description: '사용자 권한 상승 시도 감지',
      severity: 'CRITICAL',
      conditions: {
        eventType: 'PRIVILEGE_ESCALATION',
        threshold: 1,
        timeWindow: 0,
        groupBy: ['userId']
      },
      actions: ['email', 'slack', 'monitoring', 'webhook'],
      enabled: true
    });

    // 시스템 설정 변경
    this.addRule('system_config_change', {
      name: '시스템 설정 변경',
      description: '중요 시스템 설정 변경 감지',
      severity: 'MEDIUM',
      conditions: {
        eventType: 'SYSTEM_CONFIG_CHANGE',
        threshold: 1,
        timeWindow: 0,
        groupBy: ['userId']
      },
      actions: ['monitoring', 'slack'],
      enabled: true
    });

    // 관리자 계정 활동
    this.addRule('admin_activity', {
      name: '관리자 계정 활동',
      description: '관리자 권한으로 수행된 중요 작업',
      severity: 'MEDIUM',
      conditions: {
        userRole: 'admin',
        action: ['CREATE', 'UPDATE', 'DELETE'],
        resource: ['users', 'systems'],
        threshold: 1,
        timeWindow: 0,
        groupBy: ['userId', 'resource']
      },
      actions: ['monitoring', 'webhook'],
      enabled: true
    });

    // 대량 데이터 접근
    this.addRule('bulk_data_access', {
      name: '대량 데이터 접근',
      description: '비정상적인 대량 데이터 접근',
      severity: 'MEDIUM',
      conditions: {
        eventType: 'BULK_DATA_ACCESS',
        threshold: 1,
        timeWindow: 0,
        groupBy: ['userId']
      },
      actions: ['monitoring', 'email'],
      enabled: true
    });

    // 업무 외 시간 접근
    this.addRule('after_hours_access', {
      name: '업무 외 시간 접근',
      description: '업무 시간 외 시스템 접근',
      severity: 'LOW',
      conditions: {
        eventType: 'AFTER_HOURS_ACCESS',
        threshold: 1,
        timeWindow: 0,
        groupBy: ['userId']
      },
      actions: ['monitoring'],
      enabled: true
    });

    logger.info('기본 알림 규칙 초기화 완료:', { ruleCount: this.alertRules.size });
  }

  /**
   * 알림 규칙 추가
   * @param {string} ruleId - 규칙 ID
   * @param {Object} rule - 규칙 설정
   */
  addRule(ruleId, rule) {
    rule.id = ruleId;
    rule.createdAt = new Date();
    rule.eventCounts = new Map();
    
    this.alertRules.set(ruleId, rule);
    logger.info('알림 규칙 추가:', { ruleId, ruleName: rule.name });
  }

  /**
   * 알림 규칙 업데이트
   * @param {string} ruleId - 규칙 ID
   * @param {Object} updates - 업데이트할 설정
   */
  updateRule(ruleId, updates) {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    Object.assign(rule, updates);
    rule.updatedAt = new Date();
    
    logger.info('알림 규칙 업데이트:', { ruleId, updates });
  }

  /**
   * 알림 규칙 삭제
   * @param {string} ruleId - 규칙 ID
   */
  removeRule(ruleId) {
    const deleted = this.alertRules.delete(ruleId);
    if (deleted) {
      logger.info('알림 규칙 삭제:', { ruleId });
    }
    return deleted;
  }

  /**
   * 이벤트 처리 및 알림 규칙 확인
   * @param {Object} event - 감사 로그 이벤트
   */
  async processEvent(event) {
    try {
      for (const [ruleId, rule] of this.alertRules) {
        if (!rule.enabled) continue;

        if (this.matchesRule(event, rule)) {
          await this.handleRuleMatch(event, rule);
        }
      }
    } catch (error) {
      logger.error('이벤트 처리 중 오류:', error);
    }
  }

  /**
   * 이벤트가 규칙에 매치되는지 확인
   * @param {Object} event - 이벤트
   * @param {Object} rule - 알림 규칙
   * @returns {boolean} 매치 여부
   */
  matchesRule(event, rule) {
    const { conditions } = rule;

    // 이벤트 타입 확인
    if (conditions.eventType && event.eventType !== conditions.eventType) {
      return false;
    }

    // 사용자 역할 확인
    if (conditions.userRole && event.userRole !== conditions.userRole) {
      return false;
    }

    // 액션 확인
    if (conditions.action && Array.isArray(conditions.action)) {
      if (!conditions.action.includes(event.action)) {
        return false;
      }
    }

    // 리소스 확인
    if (conditions.resource && Array.isArray(conditions.resource)) {
      if (!conditions.resource.includes(event.resource)) {
        return false;
      }
    }

    // 심각도 확인
    if (conditions.severity && event.severity !== conditions.severity) {
      return false;
    }

    // 업무 시간 확인 (특별 조건)
    if (rule.id === 'after_hours_access') {
      const hour = new Date(event.timestamp).getHours();
      const isBusinessHours = hour >= 9 && hour <= 18;
      const isWeekday = new Date(event.timestamp).getDay() >= 1 && new Date(event.timestamp).getDay() <= 5;
      
      if (isBusinessHours && isWeekday) {
        return false;
      }
    }

    return true;
  }

  /**
   * 규칙 매치 시 처리
   * @param {Object} event - 이벤트
   * @param {Object} rule - 알림 규칙
   */
  async handleRuleMatch(event, rule) {
    try {
      // 그룹 키 생성
      const groupKey = this.generateGroupKey(event, rule.conditions.groupBy);
      
      // 카운트 증가
      this.incrementEventCount(rule, groupKey);
      
      // 임계값 확인
      const count = this.getEventCount(rule, groupKey, rule.conditions.timeWindow);
      
      if (count >= rule.conditions.threshold) {
        // 율 제한 확인
        if (this.isRateLimited(rule.id)) {
          logger.debug('알림 율 제한 적용:', { ruleId: rule.id });
          return;
        }

        // 쿨다운 확인
        if (this.isInCooldown(rule.id, groupKey)) {
          logger.debug('알림 쿨다운 적용:', { ruleId: rule.id, groupKey });
          return;
        }

        // 알림 생성 및 발송
        await this.createAndSendAlert(event, rule, count, groupKey);
        
        // 쿨다운 설정
        this.setCooldown(rule.id, groupKey);
      }
    } catch (error) {
      logger.error('규칙 매치 처리 중 오류:', error);
    }
  }

  /**
   * 그룹 키 생성
   * @param {Object} event - 이벤트
   * @param {Array} groupBy - 그룹화 필드
   * @returns {string} 그룹 키
   */
  generateGroupKey(event, groupBy) {
    if (!groupBy || groupBy.length === 0) {
      return 'default';
    }

    return groupBy
      .map(field => `${field}:${event[field] || 'unknown'}`)
      .join('|');
  }

  /**
   * 이벤트 카운트 증가
   * @param {Object} rule - 규칙
   * @param {string} groupKey - 그룹 키
   */
  incrementEventCount(rule, groupKey) {
    if (!rule.eventCounts.has(groupKey)) {
      rule.eventCounts.set(groupKey, []);
    }

    const timestamps = rule.eventCounts.get(groupKey);
    timestamps.push(Date.now());
    
    // 오래된 타임스탬프 정리
    const cutoff = Date.now() - rule.conditions.timeWindow;
    rule.eventCounts.set(
      groupKey,
      timestamps.filter(ts => ts > cutoff)
    );
  }

  /**
   * 시간 윈도우 내 이벤트 카운트 조회
   * @param {Object} rule - 규칙
   * @param {string} groupKey - 그룹 키
   * @param {number} timeWindow - 시간 윈도우
   * @returns {number} 이벤트 수
   */
  getEventCount(rule, groupKey, timeWindow) {
    const timestamps = rule.eventCounts.get(groupKey) || [];
    
    if (timeWindow === 0) {
      return timestamps.length;
    }

    const cutoff = Date.now() - timeWindow;
    return timestamps.filter(ts => ts > cutoff).length;
  }

  /**
   * 율 제한 확인
   * @param {string} ruleId - 규칙 ID
   * @returns {boolean} 제한 여부
   */
  isRateLimited(ruleId) {
    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindow;
    
    if (!this.rateLimitTracker.has(ruleId)) {
      this.rateLimitTracker.set(ruleId, []);
    }

    const timestamps = this.rateLimitTracker.get(ruleId);
    const recentAlerts = timestamps.filter(ts => ts > windowStart);
    
    this.rateLimitTracker.set(ruleId, recentAlerts);
    
    return recentAlerts.length >= this.config.maxAlertsPerWindow;
  }

  /**
   * 쿨다운 확인
   * @param {string} ruleId - 규칙 ID
   * @param {string} groupKey - 그룹 키
   * @returns {boolean} 쿨다운 여부
   */
  isInCooldown(ruleId, groupKey) {
    const cooldownKey = `${ruleId}:${groupKey}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    
    if (!lastAlert) return false;
    
    return (Date.now() - lastAlert) < this.config.alertCooldown;
  }

  /**
   * 쿨다운 설정
   * @param {string} ruleId - 규칙 ID
   * @param {string} groupKey - 그룹 키
   */
  setCooldown(ruleId, groupKey) {
    const cooldownKey = `${ruleId}:${groupKey}`;
    this.alertCooldowns.set(cooldownKey, Date.now());
  }

  /**
   * 알림 생성 및 발송
   * @param {Object} event - 원본 이벤트
   * @param {Object} rule - 알림 규칙
   * @param {number} count - 이벤트 발생 횟수
   * @param {string} groupKey - 그룹 키
   */
  async createAndSendAlert(event, rule, count, groupKey) {
    try {
      const alert = {
        id: this.generateAlertId(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        title: this.generateAlertTitle(rule, event, count),
        message: this.generateAlertMessage(rule, event, count, groupKey),
        originalEvent: event,
        triggeredAt: new Date(),
        count,
        groupKey,
        metadata: {
          ruleDescription: rule.description,
          threshold: rule.conditions.threshold,
          timeWindow: rule.conditions.timeWindow
        }
      };

      // 알림 히스토리에 추가
      this.addToHistory(alert);

      // 감사 로그 기록
      await auditLogger.log({
        type: 'SECURITY_ALERT_GENERATED',
        userId: event.userId,
        userName: event.userName,
        userRole: event.userRole,
        action: 'ALERT',
        resource: 'security',
        ip: event.ipAddress,
        result: 'ALERT',
        severity: rule.severity,
        metadata: {
          alertId: alert.id,
          ruleId: rule.id,
          ruleName: rule.name,
          originalEventType: event.eventType,
          count,
          groupKey
        }
      });

      // 설정된 액션들 실행
      for (const action of rule.actions) {
        await this.executeAction(action, alert);
      }

      // 율 제한 추적 업데이트
      if (!this.rateLimitTracker.has(rule.id)) {
        this.rateLimitTracker.set(rule.id, []);
      }
      this.rateLimitTracker.get(rule.id).push(Date.now());

      logger.warn('보안 알림 생성:', {
        alertId: alert.id,
        ruleId: rule.id,
        severity: rule.severity,
        count,
        groupKey
      });

    } catch (error) {
      logger.error('알림 생성 및 발송 실패:', error);
    }
  }

  /**
   * 알림 제목 생성
   */
  generateAlertTitle(rule, event, count) {
    if (count > 1) {
      return `🚨 ${rule.name} (${count}회 발생)`;
    }
    return `🚨 ${rule.name}`;
  }

  /**
   * 알림 메시지 생성
   */
  generateAlertMessage(rule, event, count, groupKey) {
    const userName = event.userName || event.userId || 'Unknown User';
    const resource = event.resource || 'Unknown Resource';
    const ip = event.ipAddress || 'Unknown IP';
    
    let message = `보안 이벤트가 감지되었습니다.\n\n`;
    message += `**규칙:** ${rule.name}\n`;
    message += `**설명:** ${rule.description}\n`;
    message += `**사용자:** ${userName}\n`;
    message += `**IP 주소:** ${ip}\n`;
    message += `**리소스:** ${resource}\n`;
    message += `**발생 횟수:** ${count}회\n`;
    message += `**시간:** ${new Date(event.timestamp).toLocaleString('ko-KR')}\n`;
    
    if (groupKey !== 'default') {
      message += `**그룹:** ${groupKey}\n`;
    }
    
    return message;
  }

  /**
   * 액션 실행
   * @param {string} action - 액션 타입
   * @param {Object} alert - 알림 객체
   */
  async executeAction(action, alert) {
    try {
      switch (action) {
        case 'monitoring':
          await this.sendToMonitoring(alert);
          break;
        case 'email':
          await this.sendEmailAlert(alert);
          break;
        case 'slack':
          await this.sendSlackAlert(alert);
          break;
        case 'webhook':
          await this.sendWebhookAlert(alert);
          break;
        default:
          logger.warn('알 수 없는 액션:', { action });
      }
    } catch (error) {
      logger.error(`액션 실행 실패 (${action}):`, error);
    }
  }

  /**
   * 모니터링 시스템으로 알림 전송
   */
  async sendToMonitoring(alert) {
    try {
      const monitoringService = require('./monitoringService');
      
      const monitoringAlert = {
        type: 'security_alert',
        severity: alert.severity.toLowerCase(),
        title: alert.title,
        message: alert.message,
        timestamp: alert.triggeredAt,
        data: {
          alertId: alert.id,
          ruleId: alert.ruleId,
          originalEvent: alert.originalEvent,
          count: alert.count
        }
      };
      
      monitoringService.broadcastToSubscribers('alerts', monitoringAlert);
      logger.debug('모니터링 알림 전송 완료:', { alertId: alert.id });
    } catch (error) {
      logger.error('모니터링 알림 전송 실패:', error);
    }
  }

  /**
   * 이메일 알림 전송 (시뮬레이션)
   */
  async sendEmailAlert(alert) {
    // 실제 구현에서는 nodemailer 등을 사용
    logger.info('이메일 알림 전송 (시뮬레이션):', {
      alertId: alert.id,
      title: alert.title,
      severity: alert.severity
    });
  }

  /**
   * Slack 알림 전송 (시뮬레이션)
   */
  async sendSlackAlert(alert) {
    // 실제 구현에서는 Slack API 사용
    logger.info('Slack 알림 전송 (시뮬레이션):', {
      alertId: alert.id,
      title: alert.title,
      severity: alert.severity
    });
  }

  /**
   * 웹훅 알림 전송 (시뮬레이션)
   */
  async sendWebhookAlert(alert) {
    // 실제 구현에서는 HTTP 요청
    logger.info('웹훅 알림 전송 (시뮬레이션):', {
      alertId: alert.id,
      title: alert.title,
      severity: alert.severity
    });
  }

  /**
   * 알림 히스토리에 추가
   */
  addToHistory(alert) {
    this.alertHistory.unshift(alert);
    
    // 최대 크기 유지
    if (this.alertHistory.length > this.config.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.config.maxHistorySize);
    }
  }

  /**
   * 알림 ID 생성
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 알림 히스토리 조회
   * @param {Object} filters - 필터 조건
   * @returns {Array} 알림 목록
   */
  getAlertHistory(filters = {}) {
    let alerts = [...this.alertHistory];

    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    if (filters.ruleId) {
      alerts = alerts.filter(alert => alert.ruleId === filters.ruleId);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      alerts = alerts.filter(alert => new Date(alert.triggeredAt) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      alerts = alerts.filter(alert => new Date(alert.triggeredAt) <= endDate);
    }

    return alerts.slice(0, filters.limit || 100);
  }

  /**
   * 알림 규칙 목록 조회
   * @returns {Array} 규칙 목록
   */
  getRules() {
    return Array.from(this.alertRules.values());
  }

  /**
   * 알림 통계 조회
   * @returns {Object} 통계 정보
   */
  getStatistics() {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const last7d = now - (7 * 24 * 60 * 60 * 1000);

    const recent24h = this.alertHistory.filter(
      alert => new Date(alert.triggeredAt).getTime() > last24h
    );

    const recent7d = this.alertHistory.filter(
      alert => new Date(alert.triggeredAt).getTime() > last7d
    );

    const severityCounts = {};
    const ruleCounts = {};

    recent24h.forEach(alert => {
      severityCounts[alert.severity] = (severityCounts[alert.severity] || 0) + 1;
      ruleCounts[alert.ruleId] = (ruleCounts[alert.ruleId] || 0) + 1;
    });

    return {
      totalRules: this.alertRules.size,
      enabledRules: Array.from(this.alertRules.values()).filter(r => r.enabled).length,
      totalAlerts: this.alertHistory.length,
      alerts24h: recent24h.length,
      alerts7d: recent7d.length,
      severityBreakdown: severityCounts,
      topTriggeredRules: Object.entries(ruleCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([ruleId, count]) => ({
          ruleId,
          ruleName: this.alertRules.get(ruleId)?.name || ruleId,
          count
        }))
    };
  }
}

module.exports = new AlertManager();