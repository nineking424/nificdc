const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * Circuit Breaker States
 */
const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

/**
 * Circuit Breaker Implementation
 * 
 * Prevents cascading failures by temporarily failing fast
 * when failure rate exceeds threshold
 */
class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.timeout = options.timeout || 60000; // 1분
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1분
    this.volumeThreshold = options.volumeThreshold || 10;
    this.resetTimeout = options.resetTimeout || 30000; // 30초
    
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttempt = null;
    
    // 통계 추적
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      totalRejections: 0,
      stateTransitions: 0
    };
    
    // 모니터링 윈도우
    this.requestWindow = [];
    this.windowCleanupInterval = setInterval(() => {
      this.cleanupRequestWindow();
    }, this.monitoringPeriod);
    
    logger.info(`Circuit Breaker '${this.name}' initialized with threshold: ${this.failureThreshold}`);
  }

  /**
   * 요청 실행
   */
  async execute(operation, ...args) {
    this.stats.totalRequests++;
    
    // Circuit이 열려있는지 확인
    if (this.state === STATES.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = STATES.HALF_OPEN;
        this.successCount = 0;
        logger.info(`Circuit Breaker '${this.name}' moved to HALF_OPEN state`);
        this.emit('halfOpen');
        this.stats.stateTransitions++;
      } else {
        this.stats.totalRejections++;
        logger.warn(`Circuit Breaker '${this.name}' rejected request - circuit is OPEN`);
        this.emit('reject');
        throw new Error(`Circuit breaker is OPEN for '${this.name}'`);
      }
    }
    
    try {
      const startTime = Date.now();
      
      // 타임아웃 처리
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${this.timeout}ms`));
        }, this.timeout);
      });
      
      const result = await Promise.race([
        operation(...args),
        timeoutPromise
      ]);
      
      const duration = Date.now() - startTime;
      this.onSuccess(duration);
      
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * 성공 처리
   */
  onSuccess(duration) {
    this.successCount++;
    this.requestCount++;
    this.lastSuccessTime = Date.now();
    this.stats.totalSuccesses++;
    
    this.recordRequest({
      success: true,
      timestamp: Date.now(),
      duration: duration
    });
    
    if (this.state === STATES.HALF_OPEN) {
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    } else if (this.state === STATES.CLOSED) {
      this.failureCount = 0;
    }
    
    logger.debug(`Circuit Breaker '${this.name}' recorded success (${duration}ms)`);
    this.emit('success', { duration });
  }

  /**
   * 실패 처리
   */
  onFailure(error) {
    this.failureCount++;
    this.requestCount++;
    this.lastFailureTime = Date.now();
    this.stats.totalFailures++;
    
    if (error.message.includes('timeout')) {
      this.stats.totalTimeouts++;
    }
    
    this.recordRequest({
      success: false,
      timestamp: Date.now(),
      error: error.message
    });
    
    logger.warn(`Circuit Breaker '${this.name}' recorded failure:`, error.message);
    this.emit('failure', { error });
    
    if (this.state === STATES.HALF_OPEN) {
      this.trip();
    } else if (this.state === STATES.CLOSED) {
      if (this.shouldTrip()) {
        this.trip();
      }
    }
  }

  /**
   * Circuit이 트립되어야 하는지 확인
   */
  shouldTrip() {
    if (this.requestCount < this.volumeThreshold) {
      return false;
    }
    
    const failureRate = this.failureCount / this.requestCount;
    const recentFailureRate = this.calculateRecentFailureRate();
    
    return failureRate >= (this.failureThreshold / 100) || 
           recentFailureRate >= (this.failureThreshold / 100);
  }

  /**
   * 최근 실패율 계산
   */
  calculateRecentFailureRate() {
    const now = Date.now();
    const recentWindow = this.requestWindow.filter(req => 
      now - req.timestamp <= this.monitoringPeriod
    );
    
    if (recentWindow.length === 0) {
      return 0;
    }
    
    const failures = recentWindow.filter(req => !req.success).length;
    return failures / recentWindow.length;
  }

  /**
   * Circuit을 OPEN 상태로 전환
   */
  trip() {
    this.state = STATES.OPEN;
    this.nextAttempt = Date.now() + this.resetTimeout;
    this.stats.stateTransitions++;
    
    logger.warn(`Circuit Breaker '${this.name}' tripped - moving to OPEN state`);
    this.emit('open');
  }

  /**
   * Circuit을 CLOSED 상태로 리셋
   */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.nextAttempt = null;
    this.stats.stateTransitions++;
    
    logger.info(`Circuit Breaker '${this.name}' reset - moving to CLOSED state`);
    this.emit('close');
  }

  /**
   * 리셋 시도 여부 확인
   */
  shouldAttemptReset() {
    return this.nextAttempt && Date.now() >= this.nextAttempt;
  }

  /**
   * 요청 기록
   */
  recordRequest(request) {
    this.requestWindow.push(request);
    
    // 윈도우 크기 제한
    if (this.requestWindow.length > 1000) {
      this.requestWindow = this.requestWindow.slice(-500);
    }
  }

  /**
   * 요청 윈도우 정리
   */
  cleanupRequestWindow() {
    const now = Date.now();
    const cutoff = now - this.monitoringPeriod * 2;
    
    this.requestWindow = this.requestWindow.filter(req => 
      req.timestamp > cutoff
    );
  }

  /**
   * 현재 상태 조회
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      failureRate: this.requestCount > 0 ? (this.failureCount / this.requestCount) * 100 : 0,
      recentFailureRate: this.calculateRecentFailureRate() * 100,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt,
      stats: { ...this.stats }
    };
  }

  /**
   * 통계 정보 조회
   */
  getStats() {
    const currentState = this.getState();
    
    return {
      ...currentState,
      uptime: Date.now() - (this.createdAt || Date.now()),
      requestWindowSize: this.requestWindow.length,
      averageResponseTime: this.calculateAverageResponseTime(),
      p95ResponseTime: this.calculatePercentileResponseTime(0.95),
      p99ResponseTime: this.calculatePercentileResponseTime(0.99)
    };
  }

  /**
   * 평균 응답 시간 계산
   */
  calculateAverageResponseTime() {
    const successfulRequests = this.requestWindow.filter(req => 
      req.success && req.duration
    );
    
    if (successfulRequests.length === 0) {
      return 0;
    }
    
    const totalDuration = successfulRequests.reduce((sum, req) => sum + req.duration, 0);
    return totalDuration / successfulRequests.length;
  }

  /**
   * 백분위 응답 시간 계산
   */
  calculatePercentileResponseTime(percentile) {
    const successfulRequests = this.requestWindow
      .filter(req => req.success && req.duration)
      .map(req => req.duration)
      .sort((a, b) => a - b);
    
    if (successfulRequests.length === 0) {
      return 0;
    }
    
    const index = Math.ceil(successfulRequests.length * percentile) - 1;
    return successfulRequests[index] || 0;
  }

  /**
   * 수동으로 Circuit을 열기
   */
  forceOpen() {
    this.state = STATES.OPEN;
    this.nextAttempt = Date.now() + this.resetTimeout;
    this.stats.stateTransitions++;
    
    logger.warn(`Circuit Breaker '${this.name}' manually opened`);
    this.emit('open');
  }

  /**
   * 수동으로 Circuit을 닫기
   */
  forceClose() {
    this.reset();
    
    logger.info(`Circuit Breaker '${this.name}' manually closed`);
  }

  /**
   * Circuit Breaker 정리
   */
  destroy() {
    if (this.windowCleanupInterval) {
      clearInterval(this.windowCleanupInterval);
    }
    
    this.removeAllListeners();
    this.requestWindow = [];
    
    logger.info(`Circuit Breaker '${this.name}' destroyed`);
  }
}

/**
 * Circuit Breaker 관리자
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Circuit Breaker 생성 또는 반환
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({
        name,
        ...options
      });
      
      this.breakers.set(name, breaker);
    }
    
    return this.breakers.get(name);
  }

  /**
   * 모든 Circuit Breaker 상태 조회
   */
  getAllStates() {
    const states = {};
    
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    
    return states;
  }

  /**
   * 모든 Circuit Breaker 통계 조회
   */
  getAllStats() {
    const stats = {};
    
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  /**
   * Circuit Breaker 제거
   */
  removeCircuitBreaker(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      this.breakers.delete(name);
    }
  }

  /**
   * 모든 Circuit Breaker 정리
   */
  destroy() {
    for (const [name, breaker] of this.breakers) {
      breaker.destroy();
    }
    
    this.breakers.clear();
  }
}

// 싱글톤 인스턴스
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  STATES
};