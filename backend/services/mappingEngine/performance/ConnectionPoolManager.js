const EventEmitter = require('events');
const logger = require('../../../src/utils/logger');

/**
 * Connection Pool Manager
 * Manages database connections and external service connections for optimal performance
 */
class ConnectionPoolManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      minConnections: options.minConnections || 2,
      maxConnections: options.maxConnections || 20,
      acquireTimeoutMillis: options.acquireTimeoutMillis || 10000,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      createRetryIntervalMillis: options.createRetryIntervalMillis || 2000,
      createTimeoutMillis: options.createTimeoutMillis || 30000,
      reapIntervalMillis: options.reapIntervalMillis || 1000,
      enableHealthCheck: options.enableHealthCheck !== false,
      healthCheckIntervalMs: options.healthCheckIntervalMs || 60000,
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    this.pools = new Map();
    this.healthCheckInterval = null;
    
    // Start health check monitoring
    if (this.options.enableHealthCheck) {
      this.startHealthCheck();
    }
  }
  
  /**
   * Create a new connection pool
   */
  createPool(name, factory, poolOptions = {}) {
    if (this.pools.has(name)) {
      logger.warn(`Pool ${name} already exists, returning existing pool`);
      return this.pools.get(name);
    }
    
    const options = { ...this.options, ...poolOptions };
    const pool = new ConnectionPool(name, factory, options);
    
    // Set up pool event handlers
    pool.on('connect', (event) => {
      logger.debug(`Connection established in pool ${name}:`, event);
      this.emit('poolConnect', { pool: name, ...event });
    });
    
    pool.on('disconnect', (event) => {
      logger.debug(`Connection disconnected in pool ${name}:`, event);
      this.emit('poolDisconnect', { pool: name, ...event });
    });
    
    pool.on('error', (event) => {
      logger.error(`Pool error in ${name}:`, event);
      this.emit('poolError', { pool: name, ...event });
    });
    
    pool.on('acquire', (event) => {
      logger.debug(`Connection acquired from pool ${name}:`, event);
      this.emit('poolAcquire', { pool: name, ...event });
    });
    
    pool.on('release', (event) => {
      logger.debug(`Connection released to pool ${name}:`, event);
      this.emit('poolRelease', { pool: name, ...event });
    });
    
    this.pools.set(name, pool);
    logger.info(`Created connection pool: ${name}`);
    
    return pool;
  }
  
  /**
   * Get an existing pool
   */
  getPool(name) {
    return this.pools.get(name);
  }
  
  /**
   * Acquire connection from pool
   */
  async acquireConnection(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    return await pool.acquire();
  }
  
  /**
   * Release connection back to pool
   */
  async releaseConnection(poolName, connection) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    return await pool.release(connection);
  }
  
  /**
   * Execute query using connection from pool
   */
  async executeWithConnection(poolName, queryFunction) {
    const connection = await this.acquireConnection(poolName);
    
    try {
      const result = await queryFunction(connection);
      await this.releaseConnection(poolName, connection);
      return result;
    } catch (error) {
      // Return connection to pool even on error
      try {
        await this.releaseConnection(poolName, connection);
      } catch (releaseError) {
        logger.error('Failed to release connection after error:', releaseError);
      }
      throw error;
    }
  }
  
  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      for (const [name, pool] of this.pools) {
        try {
          await pool.performHealthCheck();
        } catch (error) {
          logger.error(`Health check failed for pool ${name}:`, error);
        }
      }
    }, this.options.healthCheckIntervalMs);
  }
  
  /**
   * Get all pool statistics
   */
  getPoolStatistics() {
    const stats = {};
    
    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStatistics();
    }
    
    return stats;
  }
  
  /**
   * Get overall connection manager metrics
   */
  getMetrics() {
    const poolStats = this.getPoolStatistics();
    const totalStats = {
      totalPools: this.pools.size,
      totalConnections: 0,
      totalActiveConnections: 0,
      totalIdleConnections: 0,
      totalWaitingClients: 0,
      totalAcquiredConnections: 0,
      totalReleasedConnections: 0,
      totalErrors: 0
    };
    
    for (const stats of Object.values(poolStats)) {
      totalStats.totalConnections += stats.size;
      totalStats.totalActiveConnections += stats.activeConnections;
      totalStats.totalIdleConnections += stats.idleConnections;
      totalStats.totalWaitingClients += stats.waitingClients;
      totalStats.totalAcquiredConnections += stats.acquiredConnections;
      totalStats.totalReleasedConnections += stats.releasedConnections;
      totalStats.totalErrors += stats.errors;
    }
    
    return {
      summary: totalStats,
      pools: poolStats
    };
  }
  
  /**
   * Drain a specific pool
   */
  async drainPool(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    await pool.drain();
    logger.info(`Drained pool: ${poolName}`);
  }
  
  /**
   * Destroy a specific pool
   */
  async destroyPool(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    
    await pool.destroy();
    this.pools.delete(poolName);
    logger.info(`Destroyed pool: ${poolName}`);
  }
  
  /**
   * Shutdown all pools
   */
  async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    const shutdownPromises = [];
    
    for (const [name, pool] of this.pools) {
      shutdownPromises.push(
        pool.destroy().catch(error => {
          logger.error(`Failed to destroy pool ${name}:`, error);
        })
      );
    }
    
    await Promise.all(shutdownPromises);
    this.pools.clear();
    
    logger.info('Connection pool manager shutdown complete');
  }
}

/**
 * Individual Connection Pool
 */
class ConnectionPool extends EventEmitter {
  constructor(name, factory, options) {
    super();
    
    this.name = name;
    this.factory = factory;
    this.options = options;
    
    // Pool state
    this.connections = [];
    this.activeConnections = new Set();
    this.waitingQueue = [];
    this.destroyed = false;
    this.draining = false;
    
    // Statistics
    this.stats = {
      createdConnections: 0,
      destroyedConnections: 0,
      acquiredConnections: 0,
      releasedConnections: 0,
      timeouts: 0,
      errors: 0,
      rejections: 0
    };
    
    // Start reaper for idle connections
    this.startReaper();
    
    // Initialize minimum connections
    this.ensureMinimumConnections();
  }
  
  /**
   * Acquire a connection from the pool
   */
  async acquire() {
    if (this.destroyed) {
      throw new Error(`Pool ${this.name} has been destroyed`);
    }
    
    if (this.draining) {
      throw new Error(`Pool ${this.name} is draining`);
    }
    
    return new Promise((resolve, reject) => {
      const request = {
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: setTimeout(() => {
          this.removeFromWaitingQueue(request);
          this.stats.timeouts++;
          reject(new Error(`Connection acquire timeout after ${this.options.acquireTimeoutMillis}ms`));
        }, this.options.acquireTimeoutMillis)
      };
      
      this.waitingQueue.push(request);
      this.processWaitingQueue();
    });
  }
  
  /**
   * Release a connection back to the pool
   */
  async release(connection) {
    if (this.destroyed) {
      return this.destroyConnection(connection);
    }
    
    // Remove from active connections
    this.activeConnections.delete(connection);
    
    // Check if connection is still valid
    if (await this.validateConnection(connection)) {
      // Add back to available connections
      connection.lastUsed = Date.now();
      this.connections.push(connection);
      this.stats.releasedConnections++;
      
      this.emit('release', {
        connectionId: connection.id,
        timestamp: Date.now()
      });
      
      // Process waiting queue
      setImmediate(() => this.processWaitingQueue());
    } else {
      // Connection is invalid, destroy it
      await this.destroyConnection(connection);
    }
  }
  
  /**
   * Process waiting queue
   */
  async processWaitingQueue() {
    while (this.waitingQueue.length > 0 && !this.draining) {
      const connection = await this.getAvailableConnection();
      
      if (!connection) {
        break; // No connections available
      }
      
      const request = this.waitingQueue.shift();
      clearTimeout(request.timeout);
      
      this.activeConnections.add(connection);
      this.stats.acquiredConnections++;
      
      this.emit('acquire', {
        connectionId: connection.id,
        waitTime: Date.now() - request.timestamp
      });
      
      request.resolve(connection);
    }
  }
  
  /**
   * Get an available connection
   */
  async getAvailableConnection() {
    // Try to get an existing idle connection
    if (this.connections.length > 0) {
      return this.connections.pop();
    }
    
    // Check if we can create a new connection
    if (this.getTotalConnections() < this.options.maxConnections) {
      try {
        return await this.createConnection();
      } catch (error) {
        this.stats.errors++;
        this.emit('error', { 
          type: 'connection_creation_failed',
          error: error.message 
        });
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * Create a new connection
   */
  async createConnection() {
    const startTime = Date.now();
    
    try {
      const connection = await Promise.race([
        this.factory.create(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Connection creation timeout after ${this.options.createTimeoutMillis}ms`));
          }, this.options.createTimeoutMillis);
        })
      ]);
      
      // Add metadata to connection
      connection.id = `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      connection.createdAt = Date.now();
      connection.lastUsed = Date.now();
      connection.pool = this.name;
      
      this.stats.createdConnections++;
      
      this.emit('connect', {
        connectionId: connection.id,
        creationTime: Date.now() - startTime
      });
      
      return connection;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Destroy a connection
   */
  async destroyConnection(connection) {
    try {
      if (this.factory.destroy) {
        await this.factory.destroy(connection);
      } else if (connection.close) {
        await connection.close();
      } else if (connection.end) {
        await connection.end();
      }
      
      this.stats.destroyedConnections++;
      
      this.emit('disconnect', {
        connectionId: connection.id,
        lifespan: Date.now() - connection.createdAt
      });
    } catch (error) {
      logger.error(`Failed to destroy connection ${connection.id}:`, error);
    }
  }
  
  /**
   * Validate connection
   */
  async validateConnection(connection) {
    try {
      if (this.factory.validate) {
        return await this.factory.validate(connection);
      }
      
      // Default validation - check if connection is not closed
      return connection && !connection.destroyed && !connection.closed;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Perform health check on pool
   */
  async performHealthCheck() {
    const healthCheckPromises = [];
    
    // Check idle connections
    for (const connection of this.connections) {
      healthCheckPromises.push(
        this.validateConnection(connection).then(isValid => {
          if (!isValid) {
            // Remove invalid connection
            const index = this.connections.indexOf(connection);
            if (index > -1) {
              this.connections.splice(index, 1);
            }
            return this.destroyConnection(connection);
          }
        })
      );
    }
    
    await Promise.all(healthCheckPromises);
    
    // Ensure minimum connections
    await this.ensureMinimumConnections();
  }
  
  /**
   * Ensure minimum connections are available
   */
  async ensureMinimumConnections() {
    const currentTotal = this.getTotalConnections();
    const needed = this.options.minConnections - currentTotal;
    
    if (needed > 0) {
      const createPromises = [];
      
      for (let i = 0; i < needed; i++) {
        createPromises.push(
          this.createConnection()
            .then(connection => {
              this.connections.push(connection);
            })
            .catch(error => {
              logger.error(`Failed to create minimum connection for pool ${this.name}:`, error);
            })
        );
      }
      
      await Promise.all(createPromises);
    }
  }
  
  /**
   * Start connection reaper for idle connections
   */
  startReaper() {
    this.reaperInterval = setInterval(() => {
      this.reapIdleConnections();
    }, this.options.reapIntervalMillis);
  }
  
  /**
   * Reap idle connections
   */
  async reapIdleConnections() {
    if (this.destroyed || this.draining) return;
    
    const now = Date.now();
    const idleThreshold = now - this.options.idleTimeoutMillis;
    const connectionsToReap = [];
    
    // Find connections that have been idle too long
    this.connections = this.connections.filter(connection => {
      if (connection.lastUsed < idleThreshold && this.getTotalConnections() > this.options.minConnections) {
        connectionsToReap.push(connection);
        return false;
      }
      return true;
    });
    
    // Destroy reaped connections
    for (const connection of connectionsToReap) {
      await this.destroyConnection(connection);
    }
  }
  
  /**
   * Remove request from waiting queue
   */
  removeFromWaitingQueue(request) {
    const index = this.waitingQueue.indexOf(request);
    if (index > -1) {
      this.waitingQueue.splice(index, 1);
    }
  }
  
  /**
   * Get total number of connections
   */
  getTotalConnections() {
    return this.connections.length + this.activeConnections.size;
  }
  
  /**
   * Get pool statistics
   */
  getStatistics() {
    return {
      name: this.name,
      size: this.getTotalConnections(),
      activeConnections: this.activeConnections.size,
      idleConnections: this.connections.length,
      waitingClients: this.waitingQueue.length,
      ...this.stats,
      destroyed: this.destroyed,
      draining: this.draining
    };
  }
  
  /**
   * Drain the pool (stop accepting new requests)
   */
  async drain() {
    this.draining = true;
    
    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const request = this.waitingQueue.shift();
      clearTimeout(request.timeout);
      this.stats.rejections++;
      request.reject(new Error(`Pool ${this.name} is draining`));
    }
    
    // Wait for all active connections to be released
    while (this.activeConnections.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  /**
   * Destroy the pool
   */
  async destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Stop reaper
    if (this.reaperInterval) {
      clearInterval(this.reaperInterval);
    }
    
    // Drain first
    await this.drain();
    
    // Destroy all idle connections
    const destroyPromises = this.connections.map(connection => 
      this.destroyConnection(connection)
    );
    
    await Promise.all(destroyPromises);
    this.connections.length = 0;
  }
}

module.exports = {
  ConnectionPoolManager,
  ConnectionPool
};