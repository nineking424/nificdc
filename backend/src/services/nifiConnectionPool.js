const NiFiClient = require('./nifiClient');
const logger = require('../utils/logger');
const { circuitBreakerManager } = require('./circuitBreaker');

class NiFiConnectionPool {
  constructor(options = {}) {
    this.pools = new Map(); // systemId -> pool
    this.defaultConfig = {
      minConnections: options.minConnections || 1,
      maxConnections: options.maxConnections || 5,
      acquireTimeoutMs: options.acquireTimeoutMs || 30000,
      idleTimeoutMs: options.idleTimeoutMs || 300000, // 5분
      maxRetries: options.maxRetries || 3,
      retryDelayMs: options.retryDelayMs || 1000,
      healthCheckIntervalMs: options.healthCheckIntervalMs || 60000 // 1분
    };
    
    // 주기적 헬스체크
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.defaultConfig.healthCheckIntervalMs);

    // 유휴 연결 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.defaultConfig.idleTimeoutMs);
  }

  /**
   * 시스템별 연결 풀 생성 또는 반환
   */
  getPool(systemId, config) {
    if (!this.pools.has(systemId)) {
      // Circuit Breaker 설정
      const circuitBreaker = circuitBreakerManager.getCircuitBreaker(
        `nifi-${systemId}`,
        {
          failureThreshold: config.circuitBreakerFailureThreshold || 50, // 50% 실패율
          timeout: config.circuitBreakerTimeout || 30000,
          resetTimeout: config.circuitBreakerResetTimeout || 60000,
          volumeThreshold: config.circuitBreakerVolumeThreshold || 10
        }
      );
      
      this.pools.set(systemId, {
        systemId,
        config: { ...this.defaultConfig, ...config },
        connections: [],
        activeConnections: new Set(),
        waitingQueue: [],
        circuitBreaker,
        stats: {
          created: 0,
          acquired: 0,
          released: 0,
          failed: 0,
          timeouts: 0
        }
      });
      
      logger.info(`Created NiFi connection pool for system: ${systemId}`);
    }
    
    return this.pools.get(systemId);
  }

  /**
   * 연결 획득
   */
  async acquire(systemId, systemConfig) {
    const pool = this.getPool(systemId, systemConfig);
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // 대기열에서 제거
        const index = pool.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index >= 0) {
          pool.waitingQueue.splice(index, 1);
        }
        
        pool.stats.timeouts++;
        reject(new Error(`Connection acquire timeout for system ${systemId}`));
      }, pool.config.acquireTimeoutMs);

      const tryAcquire = async () => {
        try {
          // 사용 가능한 연결 찾기
          let connection = pool.connections.find(conn => 
            !pool.activeConnections.has(conn) && conn.isHealthy
          );

          // 연결이 없고 최대 연결 수에 도달하지 않은 경우 새로 생성
          if (!connection && pool.connections.length < pool.config.maxConnections) {
            connection = await this.createConnection(systemId, systemConfig);
            pool.connections.push(connection);
            pool.stats.created++;
          }

          if (connection) {
            clearTimeout(timeoutId);
            pool.activeConnections.add(connection);
            connection.lastUsed = Date.now();
            pool.stats.acquired++;
            
            logger.debug(`Acquired NiFi connection for system: ${systemId}`);
            resolve(connection);
          } else {
            // 대기열에 추가
            pool.waitingQueue.push({ resolve, reject, startTime });
          }
        } catch (error) {
          clearTimeout(timeoutId);
          pool.stats.failed++;
          logger.error(`Failed to acquire NiFi connection for system ${systemId}:`, error);
          reject(error);
        }
      };

      tryAcquire();
    });
  }

  /**
   * 연결 반환
   */
  release(systemId, connection) {
    const pool = this.pools.get(systemId);
    if (!pool) {
      logger.warn(`Pool not found for system: ${systemId}`);
      return;
    }

    pool.activeConnections.delete(connection);
    connection.lastUsed = Date.now();
    pool.stats.released++;
    
    logger.debug(`Released NiFi connection for system: ${systemId}`);

    // 대기 중인 요청이 있으면 처리
    if (pool.waitingQueue.length > 0) {
      const { resolve } = pool.waitingQueue.shift();
      pool.activeConnections.add(connection);
      pool.stats.acquired++;
      resolve(connection);
    }
  }

  /**
   * 새 연결 생성
   */
  async createConnection(systemId, config) {
    try {
      const client = new NiFiClient(config);
      await client.authenticate();
      
      const connection = {
        id: `${systemId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        systemId,
        client,
        created: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        consecutiveFailures: 0
      };

      logger.info(`Created new NiFi connection: ${connection.id}`);
      return connection;
    } catch (error) {
      logger.error(`Failed to create NiFi connection for system ${systemId}:`, error);
      throw error;
    }
  }

  /**
   * 재시도 로직이 포함된 작업 실행 (Circuit Breaker 적용)
   */
  async executeWithRetry(systemId, systemConfig, operation, operationName = 'operation') {
    const pool = this.getPool(systemId, systemConfig);
    
    try {
      const result = await pool.circuitBreaker.execute(async () => {
        let lastError;
        const maxRetries = systemConfig.maxRetries || this.defaultConfig.maxRetries;
        const retryDelay = systemConfig.retryDelayMs || this.defaultConfig.retryDelayMs;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          let connection;
          
          try {
            connection = await this.acquire(systemId, systemConfig);
            const result = await operation(connection.client);
            
            // 성공 시 연결 상태 업데이트
            connection.isHealthy = true;
            connection.consecutiveFailures = 0;
            
            this.release(systemId, connection);
            return result;
          } catch (error) {
            lastError = error;
            
            if (connection) {
              connection.consecutiveFailures++;
              
              // 연속 실패가 많으면 연결을 비정상으로 표시
              if (connection.consecutiveFailures >= 3) {
                connection.isHealthy = false;
                logger.warn(`Marked connection as unhealthy: ${connection.id}`);
              }
              
              this.release(systemId, connection);
            }

            logger.warn(`${operationName} attempt ${attempt}/${maxRetries} failed for system ${systemId}:`, error.message);

            // 마지막 시도가 아니면 대기 후 재시도
            if (attempt < maxRetries) {
              await this.delay(retryDelay * attempt); // 지수 백오프
            }
          }
        }

        throw new Error(`${operationName} failed after ${maxRetries} attempts for system ${systemId}: ${lastError.message}`);
      });

      return result;
    } catch (error) {
      pool.stats.failed++;
      throw error;
    }
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 헬스체크 수행
   */
  async performHealthChecks() {
    for (const [systemId, pool] of this.pools) {
      try {
        // 비활성 연결들에 대해 헬스체크 수행
        const inactiveConnections = pool.connections.filter(conn => 
          !pool.activeConnections.has(conn)
        );

        for (const connection of inactiveConnections) {
          try {
            const isHealthy = await connection.client.isConnected();
            connection.isHealthy = isHealthy;
            
            if (isHealthy) {
              connection.consecutiveFailures = 0;
            } else {
              connection.consecutiveFailures++;
            }
          } catch (error) {
            connection.isHealthy = false;
            connection.consecutiveFailures++;
            logger.warn(`Health check failed for connection ${connection.id}:`, error.message);
          }
        }
      } catch (error) {
        logger.error(`Health check failed for system ${systemId}:`, error);
      }
    }
  }

  /**
   * 유휴 연결 정리
   */
  cleanupIdleConnections() {
    const now = Date.now();
    
    for (const [systemId, pool] of this.pools) {
      const idleConnections = pool.connections.filter(conn => 
        !pool.activeConnections.has(conn) && 
        (now - conn.lastUsed) > pool.config.idleTimeoutMs
      );

      for (const connection of idleConnections) {
        // 최소 연결 수 유지
        if (pool.connections.length > pool.config.minConnections) {
          pool.connections = pool.connections.filter(c => c !== connection);
          connection.client.disconnect();
          logger.debug(`Cleaned up idle connection: ${connection.id}`);
        }
      }

      // 비정상 연결 정리
      const unhealthyConnections = pool.connections.filter(conn => 
        !pool.activeConnections.has(conn) && 
        !conn.isHealthy && 
        conn.consecutiveFailures >= 5
      );

      for (const connection of unhealthyConnections) {
        pool.connections = pool.connections.filter(c => c !== connection);
        connection.client.disconnect();
        logger.info(`Removed unhealthy connection: ${connection.id}`);
      }
    }
  }

  /**
   * 풀 통계 조회
   */
  getPoolStats(systemId) {
    const pool = this.pools.get(systemId);
    if (!pool) {
      return null;
    }

    const activeCount = pool.activeConnections.size;
    const idleCount = pool.connections.length - activeCount;
    const healthyCount = pool.connections.filter(c => c.isHealthy).length;
    const waitingCount = pool.waitingQueue.length;

    return {
      systemId,
      totalConnections: pool.connections.length,
      activeConnections: activeCount,
      idleConnections: idleCount,
      healthyConnections: healthyCount,
      waitingRequests: waitingCount,
      stats: { ...pool.stats }
    };
  }

  /**
   * 모든 풀 통계 조회
   */
  getAllPoolStats() {
    const stats = {};
    for (const systemId of this.pools.keys()) {
      stats[systemId] = this.getPoolStats(systemId);
    }
    return stats;
  }

  /**
   * Circuit Breaker 통계 조회
   */
  getCircuitBreakerStats(systemId) {
    const pool = this.pools.get(systemId);
    if (!pool || !pool.circuitBreaker) {
      return null;
    }

    return pool.circuitBreaker.getStats();
  }

  /**
   * 모든 시스템의 Circuit Breaker 통계 조회
   */
  getAllCircuitBreakerStats() {
    const stats = {};
    for (const [systemId, pool] of this.pools) {
      if (pool.circuitBreaker) {
        stats[systemId] = pool.circuitBreaker.getStats();
      }
    }
    return stats;
  }

  /**
   * 특정 시스템의 풀 제거
   */
  removePool(systemId) {
    const pool = this.pools.get(systemId);
    if (pool) {
      // 모든 연결 정리
      for (const connection of pool.connections) {
        connection.client.disconnect();
      }
      
      // 대기 중인 요청들 거부
      for (const { reject } of pool.waitingQueue) {
        reject(new Error(`Pool removed for system ${systemId}`));
      }
      
      this.pools.delete(systemId);
      logger.info(`Removed NiFi connection pool for system: ${systemId}`);
    }
  }

  /**
   * 모든 풀 정리
   */
  destroy() {
    // 인터벌 정리
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // 모든 풀 제거
    for (const systemId of this.pools.keys()) {
      this.removePool(systemId);
    }
    
    logger.info('NiFi connection pool destroyed');
  }
}

// 싱글톤 인스턴스
const connectionPool = new NiFiConnectionPool();

module.exports = {
  NiFiConnectionPool,
  connectionPool
};