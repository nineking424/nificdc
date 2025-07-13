const cron = require('node-cron');
const logger = require('../src/utils/logger');
const vulnerabilityScanner = require('./vulnerabilityScanner');
const auditLogger = require('./auditLogger');

/**
 * 예약된 보안 스캔 서비스
 * 정기적인 자동 보안 스캔 실행 및 관리
 */
class ScheduledScanner {
  constructor() {
    this.scheduledJobs = new Map();
    this.config = {
      enabled: process.env.SCHEDULED_SCANS_ENABLED === 'true',
      timezone: process.env.TIMEZONE || 'Asia/Seoul',
      maxConcurrentScans: 2,
      retryAttempts: 3,
      retryDelay: 60000 // 1분
    };
    
    this.activeScans = new Set();
    
    if (this.config.enabled) {
      this.initializeScheduledScans();
    }
  }

  /**
   * 예약된 스캔 초기화
   */
  initializeScheduledScans() {
    // 일일 의존성 스캔 (매일 새벽 2시)
    this.scheduleJob('daily-dependency-scan', '0 2 * * *', async () => {
      await this.executeDependencyScan();
    });

    // 일일 시크릿 스캔 (매일 새벽 3시)
    this.scheduleJob('daily-secret-scan', '0 3 * * *', async () => {
      await this.executeSecretScan();
    });

    // 주간 전체 스캔 (매주 월요일 새벽 4시)
    this.scheduleJob('weekly-full-scan', '0 4 * * 1', async () => {
      await this.executeFullScan();
    });

    // 월간 상세 스캔 (매월 1일 새벽 5시)
    this.scheduleJob('monthly-comprehensive-scan', '0 5 1 * *', async () => {
      await this.executeComprehensiveScan();
    });

    logger.info('예약된 보안 스캔 초기화 완료:', {
      jobCount: this.scheduledJobs.size,
      timezone: this.config.timezone,
      enabled: this.config.enabled
    });
  }

  /**
   * 스캔 작업 예약
   */
  scheduleJob(jobId, cronExpression, callback) {
    try {
      const task = cron.schedule(cronExpression, callback, {
        scheduled: false,
        timezone: this.config.timezone
      });

      this.scheduledJobs.set(jobId, {
        id: jobId,
        cronExpression,
        task,
        callback,
        enabled: true,
        lastRun: null,
        nextRun: this.getNextRunTime(cronExpression),
        runCount: 0,
        successCount: 0,
        errorCount: 0
      });

      task.start();
      
      logger.info('스캔 작업 예약:', { jobId, cronExpression });
    } catch (error) {
      logger.error('스캔 작업 예약 실패:', { jobId, error: error.message });
    }
  }

  /**
   * 의존성 스캔 실행
   */
  async executeDependencyScan() {
    const scanId = `scheduled-dependency-${Date.now()}`;
    
    if (!this.canStartScan()) {
      logger.warn('동시 실행 제한으로 의존성 스캔 건너뜀');
      return;
    }

    this.activeScans.add(scanId);
    
    try {
      logger.info('예약된 의존성 스캔 시작:', { scanId });
      
      const result = await vulnerabilityScanner.runScan('dependency', {
        scheduledScan: true,
        scanId
      });

      await this.handleScanResult('dependency', result, scanId);
      
      await this.updateJobStats('daily-dependency-scan', true);
      
      logger.info('예약된 의존성 스캔 완료:', {
        scanId,
        vulnerabilities: result.vulnerabilities.length,
        riskScore: result.riskScore
      });
      
    } catch (error) {
      await this.handleScanError('dependency', error, scanId);
      await this.updateJobStats('daily-dependency-scan', false);
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * 시크릿 스캔 실행
   */
  async executeSecretScan() {
    const scanId = `scheduled-secrets-${Date.now()}`;
    
    if (!this.canStartScan()) {
      logger.warn('동시 실행 제한으로 시크릿 스캔 건너뜀');
      return;
    }

    this.activeScans.add(scanId);
    
    try {
      logger.info('예약된 시크릿 스캔 시작:', { scanId });
      
      const result = await vulnerabilityScanner.runScan('secrets', {
        scheduledScan: true,
        scanId,
        excludePatterns: ['node_modules', '.git', 'dist', 'build', '*.test.js', '*.spec.js']
      });

      await this.handleScanResult('secrets', result, scanId);
      
      await this.updateJobStats('daily-secret-scan', true);
      
      logger.info('예약된 시크릿 스캔 완료:', {
        scanId,
        vulnerabilities: result.vulnerabilities.length,
        riskScore: result.riskScore
      });
      
    } catch (error) {
      await this.handleScanError('secrets', error, scanId);
      await this.updateJobStats('daily-secret-scan', false);
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * 전체 스캔 실행
   */
  async executeFullScan() {
    const scanId = `scheduled-full-${Date.now()}`;
    
    if (!this.canStartScan()) {
      logger.warn('동시 실행 제한으로 전체 스캔 건너뜀');
      return;
    }

    this.activeScans.add(scanId);
    
    try {
      logger.info('예약된 전체 스캔 시작:', { scanId });
      
      const result = await vulnerabilityScanner.runFullScan({
        scanTypes: ['dependency', 'secrets', 'code'],
        scheduledScan: true,
        scanId
      });

      await this.handleFullScanResult(result, scanId);
      
      await this.updateJobStats('weekly-full-scan', true);
      
      logger.info('예약된 전체 스캔 완료:', {
        scanId,
        vulnerabilities: result.summary.totalVulnerabilities,
        riskScore: result.summary.overallRiskScore
      });
      
    } catch (error) {
      await this.handleScanError('full', error, scanId);
      await this.updateJobStats('weekly-full-scan', false);
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * 종합 스캔 실행
   */
  async executeComprehensiveScan() {
    const scanId = `scheduled-comprehensive-${Date.now()}`;
    
    if (!this.canStartScan()) {
      logger.warn('동시 실행 제한으로 종합 스캔 건너뜀');
      return;
    }

    this.activeScans.add(scanId);
    
    try {
      logger.info('예약된 종합 스캔 시작:', { scanId });
      
      const result = await vulnerabilityScanner.runFullScan({
        scanTypes: ['dependency', 'secrets', 'code', 'docker', 'webapp'],
        scheduledScan: true,
        scanId,
        comprehensive: true
      });

      await this.handleFullScanResult(result, scanId, true);
      
      await this.updateJobStats('monthly-comprehensive-scan', true);
      
      logger.info('예약된 종합 스캔 완료:', {
        scanId,
        vulnerabilities: result.summary.totalVulnerabilities,
        riskScore: result.summary.overallRiskScore
      });
      
    } catch (error) {
      await this.handleScanError('comprehensive', error, scanId);
      await this.updateJobStats('monthly-comprehensive-scan', false);
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * 스캔 시작 가능 여부 확인
   */
  canStartScan() {
    return this.activeScans.size < this.config.maxConcurrentScans;
  }

  /**
   * 스캔 결과 처리
   */
  async handleScanResult(scanType, result, scanId) {
    try {
      // 감사 로그 기록
      await auditLogger.log({
        type: 'SCHEDULED_SCAN_COMPLETED',
        action: 'SCAN',
        resource: 'security',
        resourceId: scanType,
        result: 'SUCCESS',
        severity: result.riskScore > 70 ? 'HIGH' : result.riskScore > 40 ? 'MEDIUM' : 'LOW',
        metadata: {
          scanId,
          scanType,
          scheduledScan: true,
          duration: result.duration,
          vulnerabilityCount: result.vulnerabilities.length,
          riskScore: result.riskScore
        }
      });

      // 높은 위험도 취약점 발견 시 즉시 알림
      const criticalVulns = result.vulnerabilities.filter(v => v.severity === 'CRITICAL');
      const highVulns = result.vulnerabilities.filter(v => v.severity === 'HIGH');

      if (criticalVulns.length > 0 || highVulns.length > 0) {
        await this.sendCriticalAlert(scanType, result, scanId);
      }

    } catch (error) {
      logger.error('스캔 결과 처리 실패:', { scanId, error: error.message });
    }
  }

  /**
   * 전체 스캔 결과 처리
   */
  async handleFullScanResult(result, scanId, comprehensive = false) {
    try {
      // 감사 로그 기록
      await auditLogger.log({
        type: comprehensive ? 'SCHEDULED_COMPREHENSIVE_SCAN_COMPLETED' : 'SCHEDULED_FULL_SCAN_COMPLETED',
        action: 'SCAN',
        resource: 'security',
        result: 'SUCCESS',
        severity: result.summary.riskLevel,
        metadata: {
          scanId,
          scheduledScan: true,
          comprehensive,
          duration: result.duration,
          vulnerabilityCount: result.summary.totalVulnerabilities,
          riskScore: result.summary.overallRiskScore,
          scanTypes: result.summary.scanTypes,
          errors: result.errors.length
        }
      });

      // 높은 위험도 스캔 결과 시 즉시 알림
      if (result.summary.riskLevel === 'CRITICAL' || result.summary.riskLevel === 'HIGH') {
        await this.sendCriticalAlert('full', result, scanId, comprehensive);
      }

      // 월간 종합 리포트 생성 (종합 스캔인 경우)
      if (comprehensive) {
        await this.generateMonthlyReport(result, scanId);
      }

    } catch (error) {
      logger.error('전체 스캔 결과 처리 실패:', { scanId, error: error.message });
    }
  }

  /**
   * 스캔 에러 처리
   */
  async handleScanError(scanType, error, scanId) {
    try {
      logger.error('예약된 스캔 실패:', { scanId, scanType, error: error.message });

      // 감사 로그 기록
      await auditLogger.log({
        type: 'SCHEDULED_SCAN_FAILED',
        action: 'SCAN',
        resource: 'security',
        resourceId: scanType,
        result: 'ERROR',
        severity: 'HIGH',
        error: error.message,
        metadata: {
          scanId,
          scanType,
          scheduledScan: true
        }
      });

      // 연속 실패 시 알림
      await this.checkConsecutiveFailures(scanType);

    } catch (logError) {
      logger.error('스캔 에러 처리 실패:', { scanId, logError: logError.message });
    }
  }

  /**
   * 치명적 취약점 알림 발송
   */
  async sendCriticalAlert(scanType, result, scanId, comprehensive = false) {
    try {
      const alertData = {
        type: 'CRITICAL_VULNERABILITY_DETECTED',
        scanId,
        scanType,
        comprehensive,
        timestamp: new Date(),
        summary: comprehensive ? result.summary : {
          vulnerabilityCount: result.vulnerabilities.length,
          riskScore: result.riskScore,
          criticalCount: result.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
          highCount: result.vulnerabilities.filter(v => v.severity === 'HIGH').length
        }
      };

      // Alert Manager를 통한 알림 발송 (이미 구현된 시스템 활용)
      const alertManager = require('./alertManager');
      
      await alertManager.processEvent({
        type: 'CRITICAL_VULNERABILITY_DETECTED',
        severity: 'HIGH',
        timestamp: new Date(),
        metadata: alertData
      });

      logger.warn('치명적 취약점 감지 알림 발송:', { scanId, scanType });

    } catch (error) {
      logger.error('치명적 취약점 알림 발송 실패:', { scanId, error: error.message });
    }
  }

  /**
   * 연속 실패 확인
   */
  async checkConsecutiveFailures(scanType) {
    // 실제로는 실패 이력을 데이터베이스에서 조회
    // 여기서는 간단한 로깅만 수행
    logger.warn('스캔 연속 실패 감지:', { scanType });
  }

  /**
   * 월간 리포트 생성
   */
  async generateMonthlyReport(result, scanId) {
    try {
      const reportData = {
        reportId: `monthly-${Date.now()}`,
        scanId,
        generatedAt: new Date(),
        period: this.getCurrentMonth(),
        summary: result.summary,
        recommendations: result.recommendations || [],
        trends: await this.generateTrendAnalysis()
      };

      // 리포트 저장 (실제로는 데이터베이스나 파일 시스템에 저장)
      logger.info('월간 보안 리포트 생성:', {
        reportId: reportData.reportId,
        vulnerabilities: result.summary.totalVulnerabilities,
        riskScore: result.summary.overallRiskScore
      });

    } catch (error) {
      logger.error('월간 리포트 생성 실패:', error);
    }
  }

  /**
   * 트렌드 분석 생성
   */
  async generateTrendAnalysis() {
    // 실제로는 과거 스캔 결과를 분석하여 트렌드 생성
    return {
      riskScoreTrend: 'improving', // improving, stable, degrading
      vulnerabilityTrend: 'stable',
      newVulnerabilityTypes: [],
      resolvedVulnerabilities: 0
    };
  }

  /**
   * 작업 통계 업데이트
   */
  async updateJobStats(jobId, success) {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.lastRun = new Date();
      job.runCount++;
      if (success) {
        job.successCount++;
      } else {
        job.errorCount++;
      }
      job.nextRun = this.getNextRunTime(job.cronExpression);
    }
  }

  /**
   * 다음 실행 시간 계산
   */
  getNextRunTime(cronExpression) {
    try {
      // cron 표현식에서 다음 실행 시간 계산
      // 실제로는 cron-parser 라이브러리 등을 사용
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 임시로 24시간 후
    } catch (error) {
      return null;
    }
  }

  /**
   * 현재 월 정보 반환
   */
  getCurrentMonth() {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      monthName: now.toLocaleString('ko-KR', { month: 'long' })
    };
  }

  /**
   * 예약된 작업 목록 조회
   */
  getScheduledJobs() {
    return Array.from(this.scheduledJobs.values()).map(job => ({
      id: job.id,
      cronExpression: job.cronExpression,
      enabled: job.enabled,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      runCount: job.runCount,
      successCount: job.successCount,
      errorCount: job.errorCount,
      successRate: job.runCount > 0 ? Math.round((job.successCount / job.runCount) * 100) : 0
    }));
  }

  /**
   * 작업 활성화/비활성화
   */
  toggleJob(jobId, enabled) {
    const job = this.scheduledJobs.get(jobId);
    if (!job) return false;

    if (enabled && !job.enabled) {
      job.task.start();
      job.enabled = true;
      logger.info('예약된 작업 활성화:', { jobId });
    } else if (!enabled && job.enabled) {
      job.task.stop();
      job.enabled = false;
      logger.info('예약된 작업 비활성화:', { jobId });
    }

    return true;
  }

  /**
   * 활성 스캔 목록 조회
   */
  getActiveScans() {
    return Array.from(this.activeScans);
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      scheduledJobs: this.getScheduledJobs(),
      activeScans: this.getActiveScans(),
      config: {
        timezone: this.config.timezone,
        maxConcurrentScans: this.config.maxConcurrentScans,
        retryAttempts: this.config.retryAttempts
      }
    };
  }

  /**
   * 수동 스캔 트리거
   */
  async triggerManualScan(scanType, options = {}) {
    if (!this.canStartScan()) {
      throw new Error('Maximum concurrent scans reached');
    }

    const scanId = `manual-${scanType}-${Date.now()}`;
    
    switch (scanType) {
      case 'dependency':
        return await this.executeDependencyScan();
      case 'secrets':
        return await this.executeSecretScan();
      case 'full':
        return await this.executeFullScan();
      case 'comprehensive':
        return await this.executeComprehensiveScan();
      default:
        throw new Error(`Unknown scan type: ${scanType}`);
    }
  }

  /**
   * 서비스 종료
   */
  shutdown() {
    logger.info('예약된 스캔 서비스 종료 중...');
    
    for (const [jobId, job] of this.scheduledJobs) {
      if (job.task) {
        job.task.stop();
        logger.info('예약된 작업 중지:', { jobId });
      }
    }
    
    this.scheduledJobs.clear();
    this.activeScans.clear();
    
    logger.info('예약된 스캔 서비스 종료 완료');
  }
}

module.exports = new ScheduledScanner();