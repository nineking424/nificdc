const logger = require('../src/utils/logger');
const { AuditLog } = require('../src/models');
const { Op } = require('sequelize');

/**
 * 감사 로그 서비스
 * 보안 관련 모든 활동을 추적하고 중요 이벤트에 대한 실시간 알림을 제공
 */
class AuditLogger {
  constructor() {
    this.alertChannels = new Map();
    this.logBuffer = [];
    this.config = {
      bufferSize: 100,
      flushInterval: 30000, // 30초
      retentionDays: 365,
      alertThresholds: {
        failedLogins: 5,
        suspiciousActivities: 3,
        timeWindow: 300000 // 5분
      }
    };
    
    // 중요 이벤트 타입 정의
    this.criticalEventTypes = [
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'MULTIPLE_LOGIN_FAILURES', 
      'PRIVILEGE_ESCALATION',
      'DATA_EXPORT',
      'SYSTEM_CONFIG_CHANGE',
      'SECURITY_BREACH',
      'SUSPICIOUS_ACTIVITY',
      'ADMIN_ACTION',
      'BULK_DATA_ACCESS',
      'AFTER_HOURS_ACCESS'
    ];
    
    this.initializeAlertChannels();
    this.startBufferFlush();
    
    // Alert Manager 연동 지연 로딩 (순환 의존성 방지)
    this.alertManager = null;
    this.initializeAlertManager();
  }

  /**
   * Alert Manager 초기화 (지연 로딩)
   */
  async initializeAlertManager() {
    // 순환 의존성을 방지하기 위해 지연 로딩
    setTimeout(() => {
      try {
        this.alertManager = require('./alertManager');
        logger.info('Alert Manager 연동 완료');
      } catch (error) {
        logger.warn('Alert Manager 연동 실패:', error.message);
      }
    }, 1000);
  }

  /**
   * 알림 채널 초기화
   */
  initializeAlertChannels() {
    // 실시간 모니터링 서비스 연동
    this.alertChannels.set('monitoring', {
      enabled: true,
      handler: this.sendMonitoringAlert.bind(this)
    });
    
    // 이메일 알림
    this.alertChannels.set('email', {
      enabled: !!process.env.ALERT_EMAIL_ENABLED,
      recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
      handler: this.sendEmailAlert.bind(this)
    });
    
    // Slack 알림
    this.alertChannels.set('slack', {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_SECURITY_CHANNEL || '#security-alerts',
      handler: this.sendSlackAlert.bind(this)
    });
    
    // 웹훅 알림
    this.alertChannels.set('webhook', {
      enabled: !!process.env.SECURITY_WEBHOOK_URL,
      url: process.env.SECURITY_WEBHOOK_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SECURITY_WEBHOOK_TOKEN || ''}`
      },
      handler: this.sendWebhookAlert.bind(this)
    });
  }

  /**
   * 감사 로그 기록
   * @param {Object} event - 로그 이벤트 객체
   */
  async log(event) {
    try {
      const auditEntry = {
        id: this.generateLogId(),
        timestamp: new Date(),
        eventType: event.type,
        userId: event.userId || null,
        userName: event.userName || 'Anonymous',
        userRole: event.userRole || 'Unknown',
        action: event.action || 'Unknown',
        resource: event.resource || 'Unknown',
        resourceId: event.resourceId || null,
        changes: event.changes ? JSON.stringify(event.changes) : null,
        oldValues: event.oldValues ? JSON.stringify(event.oldValues) : null,
        newValues: event.newValues ? JSON.stringify(event.newValues) : null,
        ipAddress: event.ip || 'Unknown',
        userAgent: event.userAgent || 'Unknown',
        sessionId: event.sessionId || null,
        result: event.result || 'SUCCESS',
        errorMessage: event.error || null,
        severity: this.calculateSeverity(event.type, event.result),
        tags: event.tags ? JSON.stringify(event.tags) : null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null
      };

      // 버퍼에 추가
      this.logBuffer.push(auditEntry);
      
      // 중요 이벤트는 즉시 처리
      if (this.isCriticalEvent(event.type)) {
        await this.flushBuffer();
        await this.handleCriticalEvent(auditEntry);
      }
      
      // 버퍼가 가득 차면 플러시
      if (this.logBuffer.length >= this.config.bufferSize) {
        await this.flushBuffer();
      }
      
      return auditEntry.id;
    } catch (error) {
      logger.error('감사 로그 기록 실패:', error);
      throw error;
    }
  }

  /**
   * 로그인 관련 이벤트 기록
   * @param {Object} loginEvent - 로그인 이벤트
   */
  async logLogin(loginEvent) {
    const event = {
      type: loginEvent.success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE',
      userId: loginEvent.userId,
      userName: loginEvent.userName,
      ip: loginEvent.ip,
      userAgent: loginEvent.userAgent,
      sessionId: loginEvent.sessionId,
      result: loginEvent.success ? 'SUCCESS' : 'FAILURE',
      error: loginEvent.error,
      metadata: {
        loginMethod: loginEvent.method || 'password',
        mfaUsed: loginEvent.mfaUsed || false,
        deviceInfo: loginEvent.deviceInfo
      }
    };

    await this.log(event);

    // 연속 로그인 실패 감지
    if (!loginEvent.success) {
      await this.checkFailedLoginAttempts(loginEvent.userName || loginEvent.ip);
    }
  }

  /**
   * 데이터 변경 이벤트 기록
   * @param {Object} changeEvent - 변경 이벤트
   */
  async logDataChange(changeEvent) {
    const event = {
      type: 'DATA_CHANGE',
      userId: changeEvent.userId,
      userName: changeEvent.userName,
      userRole: changeEvent.userRole,
      action: changeEvent.action, // CREATE, UPDATE, DELETE
      resource: changeEvent.resource,
      resourceId: changeEvent.resourceId,
      changes: changeEvent.changes,
      oldValues: changeEvent.oldValues,
      newValues: changeEvent.newValues,
      ip: changeEvent.ip,
      userAgent: changeEvent.userAgent,
      sessionId: changeEvent.sessionId
    };

    await this.log(event);
  }

  /**
   * 시스템 설정 변경 이벤트 기록
   * @param {Object} configEvent - 설정 변경 이벤트
   */
  async logConfigChange(configEvent) {
    const event = {
      type: 'SYSTEM_CONFIG_CHANGE',
      userId: configEvent.userId,
      userName: configEvent.userName,
      userRole: configEvent.userRole,
      action: 'UPDATE',
      resource: 'system_config',
      resourceId: configEvent.configKey,
      changes: configEvent.changes,
      oldValues: configEvent.oldValues,
      newValues: configEvent.newValues,
      ip: configEvent.ip,
      userAgent: configEvent.userAgent,
      metadata: {
        configSection: configEvent.section,
        affectedServices: configEvent.affectedServices
      }
    };

    await this.log(event);
  }

  /**
   * 중요 이벤트 여부 확인
   * @param {string} eventType - 이벤트 타입
   * @returns {boolean} 중요 이벤트 여부
   */
  isCriticalEvent(eventType) {
    return this.criticalEventTypes.includes(eventType);
  }

  /**
   * 심각도 계산
   * @param {string} eventType - 이벤트 타입
   * @param {string} result - 결과
   * @returns {string} 심각도
   */
  calculateSeverity(eventType, result) {
    if (result === 'ERROR' || result === 'FAILURE') {
      if (['SECURITY_BREACH', 'PRIVILEGE_ESCALATION'].includes(eventType)) {
        return 'CRITICAL';
      }
      if (['UNAUTHORIZED_ACCESS_ATTEMPT', 'MULTIPLE_LOGIN_FAILURES'].includes(eventType)) {
        return 'HIGH';
      }
      return 'MEDIUM';
    }

    if (['SYSTEM_CONFIG_CHANGE', 'ADMIN_ACTION', 'BULK_DATA_ACCESS'].includes(eventType)) {
      return 'HIGH';
    }

    if (['DATA_EXPORT', 'DATA_CHANGE'].includes(eventType)) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * 연속 로그인 실패 감지
   * @param {string} identifier - 사용자명 또는 IP
   */
  async checkFailedLoginAttempts(identifier) {
    try {
      const since = new Date(Date.now() - this.config.alertThresholds.timeWindow);
      
      const failedAttempts = await AuditLog.count({
        where: {
          eventType: 'LOGIN_FAILURE',
          [Op.or]: [
            { userName: identifier },
            { ipAddress: identifier }
          ],
          timestamp: {
            [Op.gte]: since
          }
        }
      });

      if (failedAttempts >= this.config.alertThresholds.failedLogins) {
        await this.log({
          type: 'MULTIPLE_LOGIN_FAILURES',
          userName: identifier,
          ip: identifier,
          metadata: {
            failedAttempts,
            timeWindow: this.config.alertThresholds.timeWindow
          },
          result: 'ALERT'
        });
      }
    } catch (error) {
      logger.error('로그인 실패 감지 중 오류:', error);
    }
  }

  /**
   * 중요 이벤트 처리
   * @param {Object} auditEntry - 감사 로그 엔트리
   */
  async handleCriticalEvent(auditEntry) {
    try {
      // 실시간 알림 발송
      for (const [channelName, channel] of this.alertChannels) {
        if (channel.enabled) {
          try {
            await channel.handler(auditEntry);
            logger.info(`보안 알림 발송 성공: ${channelName}`, { eventId: auditEntry.id });
          } catch (error) {
            logger.error(`보안 알림 발송 실패: ${channelName}`, error);
          }
        }
      }

      // 특별한 처리가 필요한 이벤트
      await this.handleSpecialEvents(auditEntry);
    } catch (error) {
      logger.error('중요 이벤트 처리 중 오류:', error);
    }
  }

  /**
   * 특별 이벤트 처리
   * @param {Object} auditEntry - 감사 로그 엔트리
   */
  async handleSpecialEvents(auditEntry) {
    switch (auditEntry.eventType) {
      case 'SECURITY_BREACH':
        // 보안 침해 시 자동 대응
        await this.handleSecurityBreach(auditEntry);
        break;
        
      case 'MULTIPLE_LOGIN_FAILURES':
        // IP 차단 고려
        await this.considerIPBlocking(auditEntry);
        break;
        
      case 'PRIVILEGE_ESCALATION':
        // 권한 상승 시 즉시 검토
        await this.handlePrivilegeEscalation(auditEntry);
        break;
    }
  }

  /**
   * 모니터링 시스템 알림
   * @param {Object} auditEntry - 감사 로그 엔트리
   */
  async sendMonitoringAlert(auditEntry) {
    try {
      const monitoringService = require('./monitoringService');
      
      const alert = {
        type: 'security_alert',
        severity: auditEntry.severity.toLowerCase(),
        title: `보안 이벤트: ${auditEntry.eventType}`,
        message: this.formatAlertMessage(auditEntry),
        timestamp: auditEntry.timestamp,
        data: {
          eventType: auditEntry.eventType,
          userId: auditEntry.userId,
          userName: auditEntry.userName,
          resource: auditEntry.resource,
          ipAddress: auditEntry.ipAddress,
          result: auditEntry.result
        }
      };
      
      monitoringService.broadcastToSubscribers('alerts', alert);
    } catch (error) {
      logger.error('모니터링 알림 발송 실패:', error);
    }
  }

  /**
   * 이메일 알림 발송
   * @param {Object} auditEntry - 감사 로그 엔트리
   */
  async sendEmailAlert(auditEntry) {
    // 실제 구현에서는 nodemailer 등을 사용
    logger.info('이메일 보안 알림 발송 (시뮬레이션):', {
      to: this.alertChannels.get('email').recipients,
      subject: `[보안 알림] ${auditEntry.eventType}`,
      body: this.formatAlertMessage(auditEntry)
    });
  }

  /**
   * Slack 알림 발송
   * @param {Object} auditEntry - 감사 로그 엔트리
   */
  async sendSlackAlert(auditEntry) {
    const channel = this.alertChannels.get('slack');
    
    const message = {
      channel: channel.channel,
      username: 'Security Alert Bot',
      icon_emoji: this.getSeverityEmoji(auditEntry.severity),
      attachments: [{
        color: this.getSeverityColor(auditEntry.severity),
        title: `🚨 보안 이벤트: ${auditEntry.eventType}`,
        text: this.formatAlertMessage(auditEntry),
        fields: [
          {
            title: '사용자',
            value: `${auditEntry.userName} (${auditEntry.userId})`,
            short: true
          },
          {
            title: 'IP 주소',
            value: auditEntry.ipAddress,
            short: true
          },
          {
            title: '리소스',
            value: auditEntry.resource,
            short: true
          },
          {
            title: '결과',
            value: auditEntry.result,
            short: true
          }
        ],
        timestamp: Math.floor(auditEntry.timestamp.getTime() / 1000)
      }]
    };
    
    logger.info('Slack 보안 알림 발송 (시뮬레이션):', message);
  }

  /**
   * 웹훅 알림 발송
   * @param {Object} auditEntry - 감사 로그 엔트리
   */
  async sendWebhookAlert(auditEntry) {
    const channel = this.alertChannels.get('webhook');
    
    const payload = {
      type: 'security_alert',
      eventType: auditEntry.eventType,
      severity: auditEntry.severity,
      timestamp: auditEntry.timestamp.toISOString(),
      data: auditEntry
    };
    
    logger.info('웹훅 보안 알림 발송 (시뮬레이션):', {
      url: channel.url,
      payload
    });
  }

  /**
   * 버퍼 플러시
   */
  async flushBuffer() {
    if (this.logBuffer.length === 0) return;

    try {
      const logs = [...this.logBuffer];
      this.logBuffer = [];

      await AuditLog.bulkCreate(logs);
      logger.debug(`감사 로그 ${logs.length}개 저장 완료`);
      
      // Alert Manager로 이벤트 전송 (비동기)
      if (this.alertManager) {
        logs.forEach(log => {
          setImmediate(() => {
            this.alertManager.processEvent(log).catch(error => {
              logger.error('Alert Manager 이벤트 처리 실패:', error);
            });
          });
        });
      }
    } catch (error) {
      logger.error('감사 로그 저장 실패:', error);
      // 실패한 로그는 다시 버퍼에 추가
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  /**
   * 정기 버퍼 플러시 시작
   */
  startBufferFlush() {
    setInterval(async () => {
      await this.flushBuffer();
    }, this.config.flushInterval);
    
    logger.info('감사 로그 버퍼 플러시가 시작되었습니다.');
  }

  /**
   * 감사 로그 조회
   * @param {Object} filters - 필터 조건
   * @returns {Array} 감사 로그 목록
   */
  async getLogs(filters = {}) {
    try {
      const where = {};
      
      if (filters.eventType) {
        where.eventType = filters.eventType;
      }
      
      if (filters.userId) {
        where.userId = filters.userId;
      }
      
      if (filters.resource) {
        where.resource = filters.resource;
      }
      
      if (filters.severity) {
        where.severity = filters.severity;
      }
      
      if (filters.startDate && filters.endDate) {
        where.timestamp = {
          [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
        };
      }
      
      const logs = await AuditLog.findAll({
        where,
        order: [['timestamp', 'DESC']],
        limit: filters.limit || 100,
        offset: filters.offset || 0
      });
      
      return logs;
    } catch (error) {
      logger.error('감사 로그 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 보안 통계 조회
   * @param {string} timeWindow - 시간 윈도우
   * @returns {Object} 보안 통계
   */
  async getSecurityStats(timeWindow = '24h') {
    try {
      const windowMs = this.parseTimeWindow(timeWindow);
      const since = new Date(Date.now() - windowMs);
      
      const stats = await AuditLog.findAll({
        where: {
          timestamp: {
            [Op.gte]: since
          }
        },
        attributes: [
          'eventType',
          'severity',
          'result',
          [require('sequelize').fn('COUNT', '*'), 'count']
        ],
        group: ['eventType', 'severity', 'result']
      });
      
      return this.formatSecurityStats(stats);
    } catch (error) {
      logger.error('보안 통계 조회 실패:', error);
      throw error;
    }
  }

  // 유틸리티 메서드들
  generateLogId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  formatAlertMessage(auditEntry) {
    return `사용자 ${auditEntry.userName}이(가) ${auditEntry.resource}에 대해 ${auditEntry.action} 작업을 수행했습니다. (결과: ${auditEntry.result})`;
  }

  getSeverityEmoji(severity) {
    const emojis = {
      LOW: ':information_source:',
      MEDIUM: ':warning:',
      HIGH: ':exclamation:',
      CRITICAL: ':rotating_light:'
    };
    return emojis[severity] || ':question:';
  }

  getSeverityColor(severity) {
    const colors = {
      LOW: '#36a64f',
      MEDIUM: '#ff9500',
      HIGH: '#ff4444',
      CRITICAL: '#8b0000'
    };
    return colors[severity] || '#cccccc';
  }

  parseTimeWindow(timeWindow) {
    const match = timeWindow.match(/^(\d+)([smhd])$/);
    if (!match) return 24 * 60 * 60 * 1000;
    
    const [, amount, unit] = match;
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };
    
    return parseInt(amount) * multipliers[unit];
  }

  formatSecurityStats(stats) {
    const formatted = {
      totalEvents: 0,
      byEventType: {},
      bySeverity: {},
      byResult: {}
    };
    
    stats.forEach(stat => {
      const count = parseInt(stat.get('count'));
      formatted.totalEvents += count;
      
      formatted.byEventType[stat.eventType] = (formatted.byEventType[stat.eventType] || 0) + count;
      formatted.bySeverity[stat.severity] = (formatted.bySeverity[stat.severity] || 0) + count;
      formatted.byResult[stat.result] = (formatted.byResult[stat.result] || 0) + count;
    });
    
    return formatted;
  }

  // 특별 이벤트 핸들러들
  async handleSecurityBreach(auditEntry) {
    logger.error('보안 침해 감지:', auditEntry);
    // 추가 보안 대응 로직
  }

  async considerIPBlocking(auditEntry) {
    logger.warn('IP 차단 고려:', auditEntry.ipAddress);
    // IP 차단 로직
  }

  async handlePrivilegeEscalation(auditEntry) {
    logger.error('권한 상승 감지:', auditEntry);
    // 권한 검토 로직
  }

  /**
   * 서비스 종료
   */
  async shutdown() {
    logger.info('감사 로그 서비스를 종료합니다...');
    await this.flushBuffer();
    logger.info('감사 로그 서비스 종료 완료');
  }
}

module.exports = new AuditLogger();