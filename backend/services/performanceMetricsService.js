const logger = require('../src/utils/logger');
const { Job, JobExecution, System } = require('../src/models');
const { Op } = require('sequelize');

/**
 * 성능 메트릭 수집 및 집계 서비스
 * 시계열 데이터 수집, 집계, 다운샘플링을 담당
 */
class PerformanceMetricsService {
  constructor() {
    this.metricsBuffer = [];
    this.aggregatedMetrics = new Map();
    this.alertThresholds = new Map();
    
    // 설정
    this.config = {
      bufferSize: 1000,
      flushInterval: 30000, // 30초
      retentionPeriods: {
        raw: 24 * 60 * 60 * 1000,      // 24시간
        hourly: 7 * 24 * 60 * 60 * 1000, // 7일
        daily: 30 * 24 * 60 * 60 * 1000, // 30일
        monthly: 365 * 24 * 60 * 60 * 1000 // 1년
      }
    };
    
    // 집계 간격
    this.aggregationIntervals = {
      '1m': 60 * 1000,         // 1분
      '5m': 5 * 60 * 1000,     // 5분
      '15m': 15 * 60 * 1000,   // 15분
      '1h': 60 * 60 * 1000,    // 1시간
      '6h': 6 * 60 * 60 * 1000, // 6시간
      '1d': 24 * 60 * 60 * 1000 // 1일
    };
    
    // 메트릭 타입 정의
    this.metricTypes = {
      COUNTER: 'counter',     // 계속 증가하는 값
      GAUGE: 'gauge',         // 임의의 값
      HISTOGRAM: 'histogram', // 분포 측정
      SUMMARY: 'summary'      // 요약 통계
    };
    
    // 기본 임계값 설정
    this.initializeDefaultThresholds();
    
    // 정기적 플러시 시작
    this.startBufferFlush();
    
    // 집계 작업 시작
    this.startAggregation();
  }

  /**
   * 기본 임계값 초기화
   */
  initializeDefaultThresholds() {
    this.alertThresholds.set('cpu.usage', { warning: 70, critical: 90 });
    this.alertThresholds.set('memory.usage', { warning: 80, critical: 95 });
    this.alertThresholds.set('job.error_rate', { warning: 5, critical: 10 });
    this.alertThresholds.set('job.avg_latency', { warning: 30000, critical: 60000 });
    this.alertThresholds.set('system.response_time', { warning: 5000, critical: 10000 });
  }

  /**
   * 메트릭 기록
   * @param {string} name - 메트릭 이름
   * @param {number} value - 메트릭 값
   * @param {string} type - 메트릭 타입
   * @param {Object} tags - 태그 (선택적)
   */
  recordMetric(name, value, type = this.metricTypes.GAUGE, tags = {}) {
    const metric = {
      name,
      value,
      type,
      tags,
      timestamp: new Date()
    };

    this.metricsBuffer.push(metric);
    
    // 실시간 알림 체크
    this.checkAlerts(metric);
    
    // 버퍼가 가득 차면 즉시 플러시
    if (this.metricsBuffer.length >= this.config.bufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * 일괄 메트릭 기록
   * @param {Array} metrics - 메트릭 배열
   */
  recordMetrics(metrics) {
    for (const metric of metrics) {
      this.recordMetric(
        metric.name, 
        metric.value, 
        metric.type || this.metricTypes.GAUGE, 
        metric.tags || {}
      );
    }
  }

  /**
   * 작업 성능 메트릭 수집
   * @param {string} jobId - 작업 ID
   * @param {string} executionId - 실행 ID
   * @param {Object} metrics - 성능 메트릭
   */
  recordJobMetrics(jobId, executionId, metrics) {
    const tags = { job_id: jobId, execution_id: executionId };
    
    // 기본 성능 메트릭
    if (metrics.duration !== undefined) {
      this.recordMetric('job.duration', metrics.duration, this.metricTypes.HISTOGRAM, tags);
    }
    
    if (metrics.recordsProcessed !== undefined) {
      this.recordMetric('job.records_processed', metrics.recordsProcessed, this.metricTypes.COUNTER, tags);
    }
    
    if (metrics.recordsPerSecond !== undefined) {
      this.recordMetric('job.throughput', metrics.recordsPerSecond, this.metricTypes.GAUGE, tags);
    }
    
    if (metrics.memoryUsage !== undefined) {
      this.recordMetric('job.memory_usage', metrics.memoryUsage, this.metricTypes.GAUGE, tags);
    }
    
    if (metrics.cpuUsage !== undefined) {
      this.recordMetric('job.cpu_usage', metrics.cpuUsage, this.metricTypes.GAUGE, tags);
    }
    
    // 에러 관련 메트릭
    if (metrics.errorCount !== undefined) {
      this.recordMetric('job.error_count', metrics.errorCount, this.metricTypes.COUNTER, tags);
    }
    
    if (metrics.errorRate !== undefined) {
      this.recordMetric('job.error_rate', metrics.errorRate, this.metricTypes.GAUGE, tags);
    }
  }

  /**
   * 시스템 성능 메트릭 수집
   * @param {Object} systemMetrics - 시스템 메트릭
   */
  recordSystemMetrics(systemMetrics) {
    const timestamp = new Date();
    
    // CPU 메트릭
    if (systemMetrics.cpu) {
      this.recordMetric('cpu.usage', systemMetrics.cpu.usage, this.metricTypes.GAUGE, { timestamp });
      this.recordMetric('cpu.cores', systemMetrics.cpu.cores, this.metricTypes.GAUGE, { timestamp });
      
      if (systemMetrics.cpu.loadAverage) {
        systemMetrics.cpu.loadAverage.forEach((load, index) => {
          this.recordMetric(`cpu.load_${index + 1}`, load, this.metricTypes.GAUGE, { timestamp });
        });
      }
    }
    
    // 메모리 메트릭
    if (systemMetrics.memory) {
      this.recordMetric('memory.usage', systemMetrics.memory.usage, this.metricTypes.GAUGE, { timestamp });
      this.recordMetric('memory.total', systemMetrics.memory.total, this.metricTypes.GAUGE, { timestamp });
      this.recordMetric('memory.used', systemMetrics.memory.used, this.metricTypes.GAUGE, { timestamp });
      this.recordMetric('memory.free', systemMetrics.memory.free, this.metricTypes.GAUGE, { timestamp });
    }
    
    // 네트워크 메트릭
    if (systemMetrics.network) {
      this.recordMetric('network.interfaces', systemMetrics.network.interfaces, this.metricTypes.GAUGE, { timestamp });
      this.recordMetric('network.active', systemMetrics.network.active, this.metricTypes.GAUGE, { timestamp });
    }
    
    // 프로세스 메트릭
    if (systemMetrics.process) {
      this.recordMetric('process.uptime', systemMetrics.process.uptime, this.metricTypes.GAUGE, { timestamp });
      this.recordMetric('process.memory.heap_used', systemMetrics.process.memory.heapUsed, this.metricTypes.GAUGE, { timestamp });
      this.recordMetric('process.memory.heap_total', systemMetrics.process.memory.heapTotal, this.metricTypes.GAUGE, { timestamp });
    }
  }

  /**
   * 메트릭 쿼리
   * @param {Object} query - 쿼리 조건
   * @returns {Promise<Array>} 메트릭 데이터
   */
  async queryMetrics(query) {
    const {
      metric,
      startTime,
      endTime,
      interval = '5m',
      aggregation = 'avg',
      tags = {},
      limit = 1000
    } = query;

    try {
      // 집계 간격에 따른 데이터 조회
      const aggregatedData = await this.getAggregatedData(
        metric,
        startTime,
        endTime,
        interval,
        aggregation,
        tags
      );

      return aggregatedData.slice(0, limit);
    } catch (error) {
      logger.error('메트릭 쿼리 실패:', error);
      throw error;
    }
  }

  /**
   * 집계된 데이터 조회
   * @param {string} metric - 메트릭 이름
   * @param {Date} startTime - 시작 시간
   * @param {Date} endTime - 종료 시간
   * @param {string} interval - 집계 간격
   * @param {string} aggregation - 집계 함수
   * @param {Object} tags - 태그 필터
   * @returns {Promise<Array>} 집계된 데이터
   */
  async getAggregatedData(metric, startTime, endTime, interval, aggregation, tags) {
    const key = `${metric}:${interval}`;
    const data = this.aggregatedMetrics.get(key) || [];
    
    // 시간 범위 필터링
    let filteredData = data.filter(point => {
      const pointTime = new Date(point.timestamp);
      return (!startTime || pointTime >= startTime) && 
             (!endTime || pointTime <= endTime);
    });
    
    // 태그 필터링
    if (Object.keys(tags).length > 0) {
      filteredData = filteredData.filter(point => {
        return Object.entries(tags).every(([key, value]) => 
          point.tags && point.tags[key] === value
        );
      });
    }
    
    return filteredData;
  }

  /**
   * 실시간 통계 계산
   * @param {string} metric - 메트릭 이름
   * @param {string} timeWindow - 시간 윈도우 (예: '1h', '24h')
   * @returns {Promise<Object>} 통계 데이터
   */
  async getRealtimeStats(metric, timeWindow = '1h') {
    const now = new Date();
    const windowMs = this.parseTimeWindow(timeWindow);
    const startTime = new Date(now.getTime() - windowMs);
    
    const data = await this.queryMetrics({
      metric,
      startTime,
      endTime: now,
      interval: '1m'
    });
    
    if (data.length === 0) {
      return {
        count: 0,
        min: null,
        max: null,
        avg: null,
        median: null,
        percentile95: null
      };
    }
    
    const values = data.map(point => point.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    
    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: sum / count,
      median: values[Math.floor(count / 2)],
      percentile95: values[Math.floor(count * 0.95)],
      sum
    };
  }

  /**
   * 이상 탐지
   * @param {string} metric - 메트릭 이름
   * @param {number} threshold - 임계값 (표준편차 배수)
   * @returns {Promise<Array>} 이상값 목록
   */
  async detectAnomalies(metric, threshold = 2) {
    const stats = await this.getRealtimeStats(metric, '24h');
    const recentData = await this.queryMetrics({
      metric,
      startTime: new Date(Date.now() - 60 * 60 * 1000), // 최근 1시간
      interval: '1m'
    });
    
    if (!stats.avg || recentData.length === 0) {
      return [];
    }
    
    // 표준편차 계산
    const variance = recentData.reduce((acc, point) => {
      return acc + Math.pow(point.value - stats.avg, 2);
    }, 0) / recentData.length;
    
    const stdDev = Math.sqrt(variance);
    const upperBound = stats.avg + (threshold * stdDev);
    const lowerBound = stats.avg - (threshold * stdDev);
    
    // 이상값 탐지
    return recentData.filter(point => 
      point.value > upperBound || point.value < lowerBound
    ).map(point => ({
      ...point,
      anomalyType: point.value > upperBound ? 'high' : 'low',
      deviation: Math.abs(point.value - stats.avg) / stdDev
    }));
  }

  /**
   * 알림 체크
   * @param {Object} metric - 메트릭 데이터
   */
  checkAlerts(metric) {
    const threshold = this.alertThresholds.get(metric.name);
    if (!threshold) return;
    
    let alertLevel = null;
    if (metric.value >= threshold.critical) {
      alertLevel = 'critical';
    } else if (metric.value >= threshold.warning) {
      alertLevel = 'warning';
    }
    
    if (alertLevel) {
      this.triggerAlert({
        metric: metric.name,
        value: metric.value,
        level: alertLevel,
        threshold: threshold[alertLevel],
        timestamp: metric.timestamp,
        tags: metric.tags
      });
    }
  }

  /**
   * 알림 발생
   * @param {Object} alert - 알림 데이터
   */
  triggerAlert(alert) {
    logger.warn('성능 메트릭 알림:', alert);
    
    // 모니터링 서비스에 알림 전송
    try {
      const monitoringService = require('./monitoringService');
      monitoringService.broadcastToSubscribers('alerts', {
        type: 'performance_alert',
        data: alert,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('알림 브로드캐스트 실패:', error);
    }
  }

  /**
   * 버퍼 플러시
   */
  flushBuffer() {
    if (this.metricsBuffer.length === 0) return;
    
    logger.debug(`메트릭 버퍼 플러시: ${this.metricsBuffer.length}개 항목`);
    
    // 실제 구현에서는 데이터베이스나 시계열 DB에 저장
    // 여기서는 메모리에 보관 (데모용)
    this.metricsBuffer.forEach(metric => {
      this.storeMetric(metric);
    });
    
    this.metricsBuffer = [];
  }

  /**
   * 메트릭 저장 (메모리 기반)
   * @param {Object} metric - 메트릭 데이터
   */
  storeMetric(metric) {
    // 원시 데이터 저장 키
    const rawKey = `${metric.name}:raw`;
    
    if (!this.aggregatedMetrics.has(rawKey)) {
      this.aggregatedMetrics.set(rawKey, []);
    }
    
    const rawData = this.aggregatedMetrics.get(rawKey);
    rawData.push(metric);
    
    // 데이터 크기 제한
    if (rawData.length > 10000) {
      rawData.splice(0, 1000); // 오래된 데이터 1000개 제거
    }
  }

  /**
   * 집계 작업 시작
   */
  startAggregation() {
    // 1분마다 집계 작업 실행
    setInterval(() => {
      this.performAggregation();
    }, 60 * 1000);
    
    logger.info('메트릭 집계 작업이 시작되었습니다.');
  }

  /**
   * 집계 수행
   */
  performAggregation() {
    const now = new Date();
    
    // 각 집계 간격에 대해 처리
    for (const [intervalName, intervalMs] of Object.entries(this.aggregationIntervals)) {
      this.aggregateByInterval(intervalName, intervalMs, now);
    }
  }

  /**
   * 간격별 집계
   * @param {string} intervalName - 간격 이름
   * @param {number} intervalMs - 간격 (밀리초)
   * @param {Date} currentTime - 현재 시간
   */
  aggregateByInterval(intervalName, intervalMs, currentTime) {
    // 집계 대상 시간 윈도우
    const windowStart = new Date(Math.floor(currentTime.getTime() / intervalMs) * intervalMs);
    const windowEnd = new Date(windowStart.getTime() + intervalMs);
    
    // 모든 원시 메트릭에 대해 집계 수행
    this.aggregatedMetrics.forEach((data, key) => {
      if (!key.endsWith(':raw')) return;
      
      const metricName = key.replace(':raw', '');
      const aggregatedKey = `${metricName}:${intervalName}`;
      
      // 윈도우 내 데이터 필터링
      const windowData = data.filter(metric => {
        const metricTime = new Date(metric.timestamp);
        return metricTime >= windowStart && metricTime < windowEnd;
      });
      
      if (windowData.length === 0) return;
      
      // 집계 계산
      const aggregated = this.calculateAggregates(windowData, windowStart);
      
      // 집계 데이터 저장
      if (!this.aggregatedMetrics.has(aggregatedKey)) {
        this.aggregatedMetrics.set(aggregatedKey, []);
      }
      
      const aggregatedData = this.aggregatedMetrics.get(aggregatedKey);
      
      // 기존 데이터 중복 제거
      const existingIndex = aggregatedData.findIndex(item => 
        new Date(item.timestamp).getTime() === windowStart.getTime()
      );
      
      if (existingIndex >= 0) {
        aggregatedData[existingIndex] = aggregated;
      } else {
        aggregatedData.push(aggregated);
      }
      
      // 데이터 크기 제한
      if (aggregatedData.length > 1000) {
        aggregatedData.splice(0, 100);
      }
    });
  }

  /**
   * 집계 계산
   * @param {Array} data - 데이터 배열
   * @param {Date} timestamp - 타임스탬프
   * @returns {Object} 집계 결과
   */
  calculateAggregates(data, timestamp) {
    const values = data.map(item => item.value);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const sortedValues = [...values].sort((a, b) => a - b);
    
    return {
      timestamp: timestamp.toISOString(),
      count,
      sum,
      avg: sum / count,
      min: Math.min(...values),
      max: Math.max(...values),
      median: sortedValues[Math.floor(count / 2)],
      percentile95: sortedValues[Math.floor(count * 0.95)] || sortedValues[count - 1],
      tags: this.mergeTags(data)
    };
  }

  /**
   * 태그 병합
   * @param {Array} data - 데이터 배열
   * @returns {Object} 병합된 태그
   */
  mergeTags(data) {
    const commonTags = {};
    
    if (data.length === 0) return commonTags;
    
    const firstTags = data[0].tags || {};
    
    // 모든 데이터에 공통으로 있는 태그만 유지
    Object.keys(firstTags).forEach(key => {
      const value = firstTags[key];
      if (data.every(item => item.tags && item.tags[key] === value)) {
        commonTags[key] = value;
      }
    });
    
    return commonTags;
  }

  /**
   * 시간 윈도우 파싱
   * @param {string} timeWindow - 시간 윈도우 문자열
   * @returns {number} 밀리초
   */
  parseTimeWindow(timeWindow) {
    const match = timeWindow.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid time window: ${timeWindow}`);
    
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
   * 버퍼 플러시 시작
   */
  startBufferFlush() {
    setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);
    
    logger.info('메트릭 버퍼 플러시가 시작되었습니다.');
  }

  /**
   * 메트릭 요약 정보
   * @returns {Object} 요약 정보
   */
  getMetricsSummary() {
    const summary = {
      bufferSize: this.metricsBuffer.length,
      storedMetrics: 0,
      aggregatedMetrics: 0,
      rawMetrics: 0
    };
    
    this.aggregatedMetrics.forEach((data, key) => {
      summary.storedMetrics += data.length;
      if (key.endsWith(':raw')) {
        summary.rawMetrics += data.length;
      } else {
        summary.aggregatedMetrics += data.length;
      }
    });
    
    return summary;
  }

  /**
   * 임계값 설정
   * @param {string} metric - 메트릭 이름
   * @param {Object} thresholds - 임계값 설정
   */
  setThreshold(metric, thresholds) {
    this.alertThresholds.set(metric, thresholds);
    logger.info(`메트릭 임계값 설정: ${metric}`, thresholds);
  }

  /**
   * 서비스 종료
   */
  shutdown() {
    logger.info('성능 메트릭 서비스를 종료합니다...');
    
    // 마지막 플러시
    this.flushBuffer();
    
    logger.info('성능 메트릭 서비스 종료 완료');
  }
}

module.exports = new PerformanceMetricsService();