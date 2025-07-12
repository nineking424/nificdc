const logger = require('../utils/logger');
const { JobExecution } = require('../models');
const { Op } = require('sequelize');

/**
 * 에러 로그 분석 및 알림 서비스
 * 로그 패턴 분석, 에러 분류, 알림 발송을 담당
 */
class ErrorAnalysisService {
  constructor() {
    this.errorPatterns = new Map();
    this.alertChannels = new Map();
    this.errorHistory = [];
    
    // 설정
    this.config = {
      maxHistorySize: 10000,
      analysisInterval: 60000, // 1분
      alertCooldown: 300000,   // 5분
      severityLevels: ['low', 'medium', 'high', 'critical']
    };
    
    // 에러 분류 규칙
    this.initializeErrorRules();
    
    // 알림 채널 초기화
    this.initializeAlertChannels();
    
    // 정기 분석 시작
    this.startPeriodicAnalysis();
  }

  /**
   * 에러 분류 규칙 초기화
   */
  initializeErrorRules() {
    // 연결 관련 에러
    this.errorPatterns.set('connection', {
      patterns: [
        /connection.*timeout/i,
        /connection.*refused/i,
        /connection.*reset/i,
        /unable to connect/i,
        /network.*unreachable/i
      ],
      severity: 'high',
      category: 'network',
      suggestedAction: '네트워크 연결 상태를 확인하고 시스템 간 연결을 점검하세요.'
    });
    
    // 인증 관련 에러
    this.errorPatterns.set('authentication', {
      patterns: [
        /authentication.*failed/i,
        /unauthorized/i,
        /access.*denied/i,
        /invalid.*credentials/i,
        /permission.*denied/i
      ],
      severity: 'medium',
      category: 'security',
      suggestedAction: '인증 정보를 확인하고 접근 권한을 점검하세요.'
    });
    
    // 데이터 관련 에러
    this.errorPatterns.set('data', {
      patterns: [
        /data.*validation.*failed/i,
        /invalid.*format/i,
        /parsing.*error/i,
        /schema.*mismatch/i,
        /column.*not.*found/i
      ],
      severity: 'medium',
      category: 'data',
      suggestedAction: '데이터 형식과 스키마 매핑을 확인하세요.'
    });
    
    // 리소스 관련 에러
    this.errorPatterns.set('resource', {
      patterns: [
        /out of memory/i,
        /disk.*full/i,
        /resource.*exhausted/i,
        /too many.*connections/i,
        /quota.*exceeded/i
      ],
      severity: 'critical',
      category: 'resource',
      suggestedAction: '시스템 리소스를 확인하고 용량을 증설하세요.'
    });
    
    // 시스템 관련 에러
    this.errorPatterns.set('system', {
      patterns: [
        /internal.*server.*error/i,
        /system.*error/i,
        /service.*unavailable/i,
        /timeout/i,
        /deadlock/i
      ],
      severity: 'high',
      category: 'system',
      suggestedAction: '시스템 상태를 점검하고 서비스를 재시작하세요.'
    });
  }

  /**
   * 알림 채널 초기화
   */
  initializeAlertChannels() {
    // 이메일 알림
    this.alertChannels.set('email', {
      enabled: true,
      config: {
        recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
        serverityThreshold: 'medium'
      },
      handler: this.sendEmailAlert.bind(this)
    });
    
    // Slack 알림
    this.alertChannels.set('slack', {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
        severityThreshold: 'high'
      },
      handler: this.sendSlackAlert.bind(this)
    });
    
    // 웹훅 알림
    this.alertChannels.set('webhook', {
      enabled: !!process.env.WEBHOOK_ALERT_URL,
      config: {
        url: process.env.WEBHOOK_ALERT_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WEBHOOK_AUTH_TOKEN || ''}`
        }
      },
      handler: this.sendWebhookAlert.bind(this)
    });
  }

  /**
   * 에러 분석
   * @param {string} errorMessage - 에러 메시지
   * @param {Object} context - 컨텍스트 정보
   * @returns {Object} 분석 결과
   */
  analyzeError(errorMessage, context = {}) {
    if (!errorMessage) return null;
    
    const analysis = {
      originalMessage: errorMessage,
      timestamp: new Date(),
      context,
      classification: null,
      severity: 'low',
      category: 'unknown',
      suggestedAction: '로그를 자세히 검토하고 관련 문서를 확인하세요.',
      fingerprint: this.generateFingerprint(errorMessage)
    };
    
    // 패턴 매칭으로 에러 분류
    for (const [ruleId, rule] of this.errorPatterns) {
      for (const pattern of rule.patterns) {
        if (pattern.test(errorMessage)) {
          analysis.classification = ruleId;
          analysis.severity = rule.severity;
          analysis.category = rule.category;
          analysis.suggestedAction = rule.suggestedAction;
          break;
        }
      }
      if (analysis.classification) break;
    }
    
    // 에러 히스토리에 추가
    this.addToHistory(analysis);
    
    // 알림 체크
    this.checkAndSendAlert(analysis);
    
    return analysis;
  }

  /**
   * 일괄 에러 분석
   * @param {Array} errors - 에러 목록
   * @returns {Array} 분석 결과 목록
   */
  analyzeErrors(errors) {
    return errors.map(error => {
      if (typeof error === 'string') {
        return this.analyzeError(error);
      } else {
        return this.analyzeError(error.message, error.context);
      }
    });
  }

  /**
   * 작업 실행 에러 분석
   * @param {string} executionId - 실행 ID
   * @returns {Promise<Object>} 분석 결과
   */
  async analyzeJobExecutionErrors(executionId) {
    try {
      const execution = await JobExecution.findByPk(executionId, {
        attributes: ['id', 'errorMessage', 'errorStack', 'warnings', 'logs']
      });
      
      if (!execution) {
        throw new Error(`실행 ID ${executionId}를 찾을 수 없습니다.`);
      }
      
      const results = {
        executionId,
        errors: [],
        warnings: [],
        summary: {
          totalErrors: 0,
          criticalErrors: 0,
          categories: {}
        }
      };
      
      // 메인 에러 분석
      if (execution.errorMessage) {
        const analysis = this.analyzeError(execution.errorMessage, {
          executionId,
          type: 'execution_error',
          stack: execution.errorStack
        });
        results.errors.push(analysis);
      }
      
      // 경고 분석
      if (execution.warnings && Array.isArray(execution.warnings)) {
        for (const warning of execution.warnings) {
          const analysis = this.analyzeError(warning, {
            executionId,
            type: 'warning'
          });
          results.warnings.push(analysis);
        }
      }
      
      // 로그에서 에러 패턴 추출
      if (execution.logs && Array.isArray(execution.logs)) {
        const errorLogs = execution.logs.filter(log => 
          log.level === 'error' || log.level === 'fatal'
        );
        
        for (const log of errorLogs) {
          const analysis = this.analyzeError(log.message, {
            executionId,
            type: 'log_error',
            timestamp: log.timestamp,
            source: log.source
          });
          results.errors.push(analysis);
        }
      }
      
      // 요약 통계 계산
      results.summary.totalErrors = results.errors.length;
      results.summary.criticalErrors = results.errors.filter(e => e.severity === 'critical').length;
      
      // 카테고리별 집계
      results.errors.forEach(error => {
        const category = error.category;
        results.summary.categories[category] = (results.summary.categories[category] || 0) + 1;
      });
      
      return results;
    } catch (error) {
      logger.error('작업 실행 에러 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 에러 트렌드 분석
   * @param {string} timeWindow - 시간 윈도우 (예: '1h', '24h', '7d')
   * @returns {Object} 트렌드 분석 결과
   */
  getErrorTrends(timeWindow = '24h') {
    const windowMs = this.parseTimeWindow(timeWindow);
    const cutoffTime = new Date(Date.now() - windowMs);
    
    const recentErrors = this.errorHistory.filter(error => 
      error.timestamp >= cutoffTime
    );
    
    const trends = {
      timeWindow,
      totalErrors: recentErrors.length,
      byCategory: {},
      bySeverity: {},
      byClassification: {},
      timeline: this.generateTimeline(recentErrors, windowMs),
      topErrors: this.getTopErrorPatterns(recentErrors),
      recommendations: this.generateRecommendations(recentErrors)
    };
    
    // 카테고리별 집계
    recentErrors.forEach(error => {
      trends.byCategory[error.category] = (trends.byCategory[error.category] || 0) + 1;
      trends.bySeverity[error.severity] = (trends.bySeverity[error.severity] || 0) + 1;
      if (error.classification) {
        trends.byClassification[error.classification] = (trends.byClassification[error.classification] || 0) + 1;
      }
    });
    
    return trends;
  }

  /**
   * 상위 에러 패턴 분석
   * @param {Array} errors - 에러 목록
   * @param {number} limit - 제한 개수
   * @returns {Array} 상위 에러 패턴
   */
  getTopErrorPatterns(errors, limit = 10) {
    const patterns = new Map();
    
    errors.forEach(error => {
      const fingerprint = error.fingerprint;
      if (!patterns.has(fingerprint)) {
        patterns.set(fingerprint, {
          fingerprint,
          count: 0,
          firstOccurrence: error.timestamp,
          lastOccurrence: error.timestamp,
          severity: error.severity,
          category: error.category,
          classification: error.classification,
          sample: error.originalMessage
        });
      }
      
      const pattern = patterns.get(fingerprint);
      pattern.count++;
      pattern.lastOccurrence = error.timestamp;
    });
    
    return Array.from(patterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 알림 체크 및 발송
   * @param {Object} analysis - 에러 분석 결과
   */
  async checkAndSendAlert(analysis) {
    const shouldAlert = this.shouldSendAlert(analysis);
    if (!shouldAlert) return;
    
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'error_analysis',
      severity: analysis.severity,
      category: analysis.category,
      classification: analysis.classification,
      message: analysis.originalMessage,
      suggestedAction: analysis.suggestedAction,
      context: analysis.context,
      timestamp: analysis.timestamp,
      fingerprint: analysis.fingerprint
    };
    
    // 각 알림 채널로 발송
    for (const [channelName, channel] of this.alertChannels) {
      if (!channel.enabled) continue;
      
      // 심각도 임계값 체크
      if (!this.meetsSeverityThreshold(analysis.severity, channel.config.severityThreshold)) {
        continue;
      }
      
      try {
        await channel.handler(alert);
        logger.info(`알림 발송 성공: ${channelName}`, { alertId: alert.id });
      } catch (error) {
        logger.error(`알림 발송 실패: ${channelName}`, error);
      }
    }
  }

  /**
   * 알림 발송 여부 판단
   * @param {Object} analysis - 에러 분석 결과
   * @returns {boolean} 발송 여부
   */
  shouldSendAlert(analysis) {
    // 중복 알림 방지 (쿨다운)
    const recentSimilar = this.errorHistory.filter(error => 
      error.fingerprint === analysis.fingerprint &&
      (Date.now() - error.timestamp.getTime()) < this.config.alertCooldown
    );
    
    if (recentSimilar.length > 1) {
      return false; // 이미 최근에 같은 에러로 알림 발송됨
    }
    
    // 심각도가 medium 이상일 때만 알림
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    return severityOrder.indexOf(analysis.severity) >= 1;
  }

  /**
   * 심각도 임계값 확인
   * @param {string} severity - 에러 심각도
   * @param {string} threshold - 임계값
   * @returns {boolean} 임계값 충족 여부
   */
  meetsSeverityThreshold(severity, threshold) {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const severityIndex = severityOrder.indexOf(severity);
    const thresholdIndex = severityOrder.indexOf(threshold);
    
    return severityIndex >= thresholdIndex;
  }

  /**
   * 이메일 알림 발송
   * @param {Object} alert - 알림 데이터
   */
  async sendEmailAlert(alert) {
    // 실제 구현에서는 nodemailer 등을 사용
    logger.info('이메일 알림 발송 (시뮬레이션):', {
      to: this.alertChannels.get('email').config.recipients,
      subject: `[${alert.severity.toUpperCase()}] 시스템 에러 알림`,
      alert
    });
  }

  /**
   * Slack 알림 발송
   * @param {Object} alert - 알림 데이터
   */
  async sendSlackAlert(alert) {
    const channel = this.alertChannels.get('slack');
    if (!channel.config.webhookUrl) return;
    
    const message = {
      channel: channel.config.channel,
      username: 'Error Analysis Bot',
      icon_emoji: this.getSeverityEmoji(alert.severity),
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        title: `${alert.severity.toUpperCase()} Error Detected`,
        text: alert.message,
        fields: [
          {
            title: 'Category',
            value: alert.category,
            short: true
          },
          {
            title: 'Classification',
            value: alert.classification || 'Unknown',
            short: true
          },
          {
            title: 'Suggested Action',
            value: alert.suggestedAction,
            short: false
          }
        ],
        timestamp: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    };
    
    // 실제 구현에서는 HTTP 요청으로 전송
    logger.info('Slack 알림 발송 (시뮬레이션):', message);
  }

  /**
   * 웹훅 알림 발송
   * @param {Object} alert - 알림 데이터
   */
  async sendWebhookAlert(alert) {
    const channel = this.alertChannels.get('webhook');
    
    const payload = {
      type: 'error_alert',
      data: alert,
      timestamp: alert.timestamp.toISOString()
    };
    
    // 실제 구현에서는 HTTP 요청으로 전송
    logger.info('웹훅 알림 발송 (시뮬레이션):', {
      url: channel.config.url,
      payload
    });
  }

  /**
   * 심각도별 이모지 반환
   * @param {string} severity - 심각도
   * @returns {string} 이모지
   */
  getSeverityEmoji(severity) {
    const emojis = {
      low: ':information_source:',
      medium: ':warning:',
      high: ':exclamation:',
      critical: ':rotating_light:'
    };
    return emojis[severity] || ':question:';
  }

  /**
   * 심각도별 색상 반환
   * @param {string} severity - 심각도
   * @returns {string} 색상 코드
   */
  getSeverityColor(severity) {
    const colors = {
      low: '#36a64f',     // 녹색
      medium: '#ff9500',   // 주황색
      high: '#ff4444',     // 빨간색
      critical: '#8b0000'  // 진한 빨간색
    };
    return colors[severity] || '#cccccc';
  }

  /**
   * 에러 지문 생성
   * @param {string} message - 에러 메시지
   * @returns {string} 지문
   */
  generateFingerprint(message) {
    // 동적인 부분(숫자, ID 등)을 제거하고 패턴 추출
    const normalized = message
      .replace(/\d+/g, 'N')           // 숫자를 N으로 대체
      .replace(/[a-f0-9-]{36}/gi, 'UUID') // UUID를 UUID로 대체
      .replace(/[a-f0-9]{8,}/gi, 'ID')    // 긴 16진수를 ID로 대체
      .replace(/\s+/g, ' ')           // 연속 공백을 하나로
      .toLowerCase()
      .trim();
    
    // 간단한 해시 생성
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * 히스토리에 추가
   * @param {Object} analysis - 분석 결과
   */
  addToHistory(analysis) {
    this.errorHistory.push(analysis);
    
    // 크기 제한
    if (this.errorHistory.length > this.config.maxHistorySize) {
      this.errorHistory.splice(0, 1000); // 오래된 데이터 1000개 제거
    }
  }

  /**
   * 타임라인 생성
   * @param {Array} errors - 에러 목록
   * @param {number} windowMs - 윈도우 크기 (밀리초)
   * @returns {Array} 타임라인 데이터
   */
  generateTimeline(errors, windowMs) {
    const bucketSize = Math.max(windowMs / 24, 60000); // 최소 1분 단위
    const buckets = new Map();
    
    errors.forEach(error => {
      const bucketTime = Math.floor(error.timestamp.getTime() / bucketSize) * bucketSize;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, 0);
      }
      buckets.set(bucketTime, buckets.get(bucketTime) + 1);
    });
    
    return Array.from(buckets.entries())
      .map(([time, count]) => ({
        timestamp: new Date(time).toISOString(),
        count
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * 권장사항 생성
   * @param {Array} errors - 에러 목록
   * @returns {Array} 권장사항 목록
   */
  generateRecommendations(errors) {
    const recommendations = [];
    const categoryCount = {};
    const severityCount = {};
    
    errors.forEach(error => {
      categoryCount[error.category] = (categoryCount[error.category] || 0) + 1;
      severityCount[error.severity] = (severityCount[error.severity] || 0) + 1;
    });
    
    // 카테고리별 권장사항
    const topCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory && topCategory[1] > 5) {
      recommendations.push({
        type: 'category_focus',
        message: `${topCategory[0]} 카테고리 에러가 ${topCategory[1]}회 발생했습니다. 해당 영역을 집중적으로 점검하세요.`,
        priority: 'high'
      });
    }
    
    // 심각도별 권장사항
    if (severityCount.critical > 0) {
      recommendations.push({
        type: 'critical_errors',
        message: `치명적 에러가 ${severityCount.critical}회 발생했습니다. 즉시 대응이 필요합니다.`,
        priority: 'critical'
      });
    }
    
    return recommendations;
  }

  /**
   * 시간 윈도우 파싱
   * @param {string} timeWindow - 시간 윈도우 문자열
   * @returns {number} 밀리초
   */
  parseTimeWindow(timeWindow) {
    const match = timeWindow.match(/^(\d+)([smhd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // 기본 24시간
    
    const [, amount, unit] = match;
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };
    
    return parseInt(amount) * multipliers[unit];
  }

  /**
   * 정기 분석 시작
   */
  startPeriodicAnalysis() {
    setInterval(async () => {
      try {
        await this.performPeriodicAnalysis();
      } catch (error) {
        logger.error('정기 에러 분석 실패:', error);
      }
    }, this.config.analysisInterval);
    
    logger.info('정기 에러 분석이 시작되었습니다.');
  }

  /**
   * 정기 분석 수행
   */
  async performPeriodicAnalysis() {
    // 최근 실패한 작업 실행들 분석
    const recentFailures = await JobExecution.findAll({
      where: {
        status: 'failed',
        startedAt: {
          [Op.gte]: new Date(Date.now() - this.config.analysisInterval)
        }
      },
      limit: 50
    });
    
    for (const execution of recentFailures) {
      if (execution.errorMessage) {
        this.analyzeError(execution.errorMessage, {
          executionId: execution.id,
          jobId: execution.jobId,
          type: 'periodic_analysis'
        });
      }
    }
    
    // 트렌드 분석 및 알림
    const trends = this.getErrorTrends('1h');
    if (trends.totalErrors > 10) {
      const alert = {
        type: 'error_spike',
        message: `지난 1시간 동안 ${trends.totalErrors}개의 에러가 발생했습니다.`,
        severity: 'high',
        data: trends
      };
      
      logger.warn('에러 급증 감지:', alert);
    }
  }

  /**
   * 통계 정보 조회
   * @returns {Object} 통계 정보
   */
  getStatistics() {
    const stats = {
      totalErrorsInHistory: this.errorHistory.length,
      errorPatternRules: this.errorPatterns.size,
      alertChannels: Array.from(this.alertChannels.entries()).map(([name, config]) => ({
        name,
        enabled: config.enabled
      })),
      recentTrends: this.getErrorTrends('1h')
    };
    
    return stats;
  }

  /**
   * 서비스 종료
   */
  shutdown() {
    logger.info('에러 분석 서비스를 종료합니다...');
    logger.info('에러 분석 서비스 종료 완료');
  }
}

module.exports = new ErrorAnalysisService();