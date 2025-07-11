const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * NiFi 연결 모니터링 및 헬스체크 서비스
 */
class NiFiMonitoring extends EventEmitter {
  constructor(connectionPool, options = {}) {
    super();
    
    this.connectionPool = connectionPool;
    this.options = {
      healthCheckInterval: options.healthCheckInterval || 60000, // 1분
      metricsCollectionInterval: options.metricsCollectionInterval || 30000, // 30초
      alertThresholds: {
        responseTime: options.responseTimeThreshold || 5000, // 5초
        errorRate: options.errorRateThreshold || 0.1, // 10%
        connectionFailureRate: options.connectionFailureRateThreshold || 0.2, // 20%
        memoryUsage: options.memoryUsageThreshold || 0.85, // 85%
        diskUsage: options.diskUsageThreshold || 0.9 // 90%
      },
      retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24시간
      maxMetricsHistory: options.maxMetricsHistory || 1000
    };
    
    this.metrics = new Map(); // systemId -> metrics history
    this.alerts = [];
    this.lastHealthCheck = new Map(); // systemId -> last health check result
    this.running = false;
    
    // 인터벌 핸들러
    this.healthCheckInterval = null;
    this.metricsCollectionInterval = null;
    this.cleanupInterval = null;
  }

  /**
   * 모니터링 시작
   */
  start() {
    if (this.running) {
      logger.warn('NiFi monitoring is already running');
      return;
    }
    
    this.running = true;
    
    // 헬스체크 인터벌 시작
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);
    
    // 메트릭 수집 인터벌 시작
    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.options.metricsCollectionInterval);
    
    // 정리 인터벌 시작 (1시간마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
    
    logger.info('NiFi monitoring started');
    this.emit('started');
  }

  /**
   * 모니터링 중지
   */
  stop() {
    if (!this.running) {
      logger.warn('NiFi monitoring is not running');
      return;
    }
    
    this.running = false;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    logger.info('NiFi monitoring stopped');
    this.emit('stopped');
  }

  /**
   * 모든 시스템 헬스체크 수행
   */
  async performHealthChecks() {
    try {
      const pools = this.connectionPool.getAllPoolStats();
      
      for (const [systemId, poolStats] of Object.entries(pools)) {
        await this.performSystemHealthCheck(systemId, poolStats);
      }
      
      this.emit('healthCheckCompleted');
    } catch (error) {
      logger.error('Failed to perform health checks:', error);
      this.emit('error', error);
    }
  }

  /**
   * 특정 시스템 헬스체크 수행
   */
  async performSystemHealthCheck(systemId, poolStats) {
    const startTime = Date.now();
    
    try {
      // 연결 풀에서 연결 획득하여 헬스체크 수행
      const result = await this.connectionPool.executeWithRetry(
        systemId,
        {},
        async (client) => {
          const healthResult = await client.healthCheck();
          return healthResult;
        },
        'health-check'
      );
      
      const responseTime = Date.now() - startTime;
      
      const healthCheckResult = {
        systemId,
        timestamp: new Date(),
        status: 'healthy',
        responseTime,
        details: result,
        poolStats
      };
      
      this.lastHealthCheck.set(systemId, healthCheckResult);
      
      // 응답 시간 알림 확인
      if (responseTime > this.options.alertThresholds.responseTime) {
        this.createAlert('slow_response', systemId, {
          responseTime,
          threshold: this.options.alertThresholds.responseTime
        });
      }
      
      // 메모리 사용량 알림 확인
      if (result.memory && result.memory.usage > this.options.alertThresholds.memoryUsage) {
        this.createAlert('high_memory_usage', systemId, {
          usage: result.memory.usage,
          threshold: this.options.alertThresholds.memoryUsage
        });
      }
      
      logger.debug(`Health check completed for system ${systemId}: ${responseTime}ms`);
      this.emit('healthCheckResult', healthCheckResult);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const healthCheckResult = {
        systemId,
        timestamp: new Date(),
        status: 'unhealthy',
        responseTime,
        error: error.message,
        poolStats
      };
      
      this.lastHealthCheck.set(systemId, healthCheckResult);
      
      this.createAlert('health_check_failure', systemId, {
        error: error.message,
        responseTime
      });
      
      logger.warn(`Health check failed for system ${systemId}:`, error.message);
      this.emit('healthCheckResult', healthCheckResult);
    }
  }

  /**
   * 메트릭 수집
   */
  async collectMetrics() {
    try {
      const timestamp = Date.now();
      const pools = this.connectionPool.getAllPoolStats();
      const circuitBreakerStats = this.connectionPool.getAllCircuitBreakerStats();
      
      for (const [systemId, poolStats] of Object.entries(pools)) {
        const metrics = {
          timestamp,
          systemId,
          connections: {
            total: poolStats.totalConnections,
            active: poolStats.activeConnections,
            idle: poolStats.idleConnections,
            healthy: poolStats.healthyConnections,
            waiting: poolStats.waitingRequests
          },
          pool: {
            created: poolStats.stats.created,
            acquired: poolStats.stats.acquired,
            released: poolStats.stats.released,
            failed: poolStats.stats.failed,
            timeouts: poolStats.stats.timeouts
          },
          circuitBreaker: circuitBreakerStats[systemId] || null
        };
        
        // 메트릭 히스토리에 추가
        if (!this.metrics.has(systemId)) {
          this.metrics.set(systemId, []);
        }
        
        const history = this.metrics.get(systemId);
        history.push(metrics);
        
        // 최대 히스토리 크기 제한
        if (history.length > this.options.maxMetricsHistory) {
          history.splice(0, history.length - this.options.maxMetricsHistory);
        }
        
        // 알림 조건 확인
        this.checkMetricsAlerts(systemId, metrics);
      }
      
      this.emit('metricsCollected', { timestamp });
      
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * 메트릭 기반 알림 조건 확인
   */
  checkMetricsAlerts(systemId, metrics) {
    // 연결 실패율 확인
    const failureRate = metrics.pool.failed / (metrics.pool.acquired || 1);
    if (failureRate > this.options.alertThresholds.connectionFailureRate) {
      this.createAlert('high_connection_failure_rate', systemId, {
        failureRate,
        threshold: this.options.alertThresholds.connectionFailureRate
      });
    }
    
    // Circuit Breaker 상태 확인
    if (metrics.circuitBreaker && metrics.circuitBreaker.state === 'OPEN') {
      this.createAlert('circuit_breaker_open', systemId, {
        failureRate: metrics.circuitBreaker.failureRate,
        recentFailureRate: metrics.circuitBreaker.recentFailureRate
      });
    }
    
    // 연결 풀 고갈 확인
    if (metrics.connections.waiting > 0 && metrics.connections.idle === 0) {
      this.createAlert('connection_pool_exhausted', systemId, {
        waiting: metrics.connections.waiting,
        total: metrics.connections.total
      });
    }
  }

  /**
   * 알림 생성
   */
  createAlert(type, systemId, details) {
    const alert = {
      id: `${type}-${systemId}-${Date.now()}`,
      type,
      systemId,
      timestamp: new Date(),
      severity: this.getAlertSeverity(type),
      message: this.getAlertMessage(type, systemId, details),
      details,
      resolved: false
    };
    
    this.alerts.push(alert);
    
    // 최대 알림 수 제한
    if (this.alerts.length > 1000) {
      this.alerts.splice(0, this.alerts.length - 1000);
    }
    
    logger.warn(`Alert created: ${alert.message}`);
    this.emit('alert', alert);
  }

  /**
   * 알림 심각도 결정
   */
  getAlertSeverity(type) {
    const severityMap = {
      'health_check_failure': 'critical',
      'circuit_breaker_open': 'critical',
      'connection_pool_exhausted': 'high',
      'high_connection_failure_rate': 'high',
      'high_memory_usage': 'medium',
      'slow_response': 'medium'
    };
    
    return severityMap[type] || 'low';
  }

  /**
   * 알림 메시지 생성
   */
  getAlertMessage(type, systemId, details) {
    const messages = {
      'health_check_failure': `Health check failed for system ${systemId}: ${details.error}`,
      'circuit_breaker_open': `Circuit breaker opened for system ${systemId} (failure rate: ${details.failureRate.toFixed(2)}%)`,
      'connection_pool_exhausted': `Connection pool exhausted for system ${systemId} (${details.waiting} requests waiting)`,
      'high_connection_failure_rate': `High connection failure rate for system ${systemId}: ${(details.failureRate * 100).toFixed(2)}%`,
      'high_memory_usage': `High memory usage for system ${systemId}: ${(details.usage * 100).toFixed(2)}%`,
      'slow_response': `Slow response from system ${systemId}: ${details.responseTime}ms`
    };
    
    return messages[type] || `Alert for system ${systemId}`;
  }

  /**
   * 시스템 상태 조회
   */
  getSystemStatus(systemId) {
    const healthCheck = this.lastHealthCheck.get(systemId);
    const metrics = this.metrics.get(systemId);
    const poolStats = this.connectionPool.getPoolStats(systemId);
    const circuitBreakerStats = this.connectionPool.getCircuitBreakerStats(systemId);
    
    const recentMetrics = metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
    
    return {
      systemId,
      status: healthCheck?.status || 'unknown',
      lastHealthCheck: healthCheck,
      recentMetrics,
      poolStats,
      circuitBreakerStats,
      alerts: this.alerts.filter(alert => alert.systemId === systemId && !alert.resolved)
    };
  }

  /**
   * 모든 시스템 상태 조회
   */
  getAllSystemStatus() {
    const status = {};
    
    for (const systemId of this.connectionPool.pools.keys()) {
      status[systemId] = this.getSystemStatus(systemId);
    }
    
    return status;
  }

  /**
   * 메트릭 히스토리 조회
   */
  getMetricsHistory(systemId, timeRange = null) {
    const history = this.metrics.get(systemId) || [];
    
    if (!timeRange) {
      return history;
    }
    
    const startTime = Date.now() - timeRange;
    return history.filter(metric => metric.timestamp >= startTime);
  }

  /**
   * 알림 목록 조회
   */
  getAlerts(filters = {}) {
    let filteredAlerts = this.alerts;
    
    if (filters.systemId) {
      filteredAlerts = filteredAlerts.filter(alert => alert.systemId === filters.systemId);
    }
    
    if (filters.severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === filters.severity);
    }
    
    if (filters.resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.resolved === filters.resolved);
    }
    
    if (filters.type) {
      filteredAlerts = filteredAlerts.filter(alert => alert.type === filters.type);
    }
    
    return filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 알림 해결 처리
   */
  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      logger.info(`Alert resolved: ${alert.message}`);
      this.emit('alertResolved', alert);
    }
  }

  /**
   * 모든 알림 해결 처리
   */
  resolveAllAlerts(systemId = null) {
    const alertsToResolve = systemId 
      ? this.alerts.filter(a => a.systemId === systemId && !a.resolved)
      : this.alerts.filter(a => !a.resolved);
    
    alertsToResolve.forEach(alert => {
      alert.resolved = true;
      alert.resolvedAt = new Date();
    });
    
    logger.info(`Resolved ${alertsToResolve.length} alerts`);
    this.emit('alertsBulkResolved', alertsToResolve);
  }

  /**
   * 대시보드 통계 조회
   */
  getDashboardStats() {
    const systemCount = this.connectionPool.pools.size;
    const healthySystems = Array.from(this.lastHealthCheck.values())
      .filter(check => check.status === 'healthy').length;
    const unhealthySystems = Array.from(this.lastHealthCheck.values())
      .filter(check => check.status === 'unhealthy').length;
    
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    
    const totalConnections = Array.from(this.connectionPool.pools.values())
      .reduce((sum, pool) => sum + pool.connections.length, 0);
    
    return {
      systems: {
        total: systemCount,
        healthy: healthySystems,
        unhealthy: unhealthySystems,
        unknown: systemCount - healthySystems - unhealthySystems
      },
      connections: {
        total: totalConnections
      },
      alerts: {
        total: activeAlerts.length,
        critical: criticalAlerts.length,
        high: activeAlerts.filter(alert => alert.severity === 'high').length,
        medium: activeAlerts.filter(alert => alert.severity === 'medium').length,
        low: activeAlerts.filter(alert => alert.severity === 'low').length
      }
    };
  }

  /**
   * 오래된 데이터 정리
   */
  cleanupOldData() {
    const cutoff = Date.now() - this.options.retentionPeriod;
    
    // 메트릭 히스토리 정리
    for (const [systemId, history] of this.metrics.entries()) {
      const filtered = history.filter(metric => metric.timestamp >= cutoff);
      this.metrics.set(systemId, filtered);
    }
    
    // 오래된 알림 정리
    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() >= cutoff);
    
    logger.debug('Cleaned up old monitoring data');
  }

  /**
   * 모니터링 서비스 정리
   */
  destroy() {
    this.stop();
    this.metrics.clear();
    this.alerts = [];
    this.lastHealthCheck.clear();
    this.removeAllListeners();
    
    logger.info('NiFi monitoring service destroyed');
  }
}

module.exports = NiFiMonitoring;