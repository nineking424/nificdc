const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const logger = require('../../../src/utils/logger');

/**
 * Performance Optimizer
 * Manages various performance optimization strategies for the mapping engine
 */
class PerformanceOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableMemoryManagement: options.enableMemoryManagement !== false,
      enableDataCompression: options.enableDataCompression !== false,
      enableConnectionPooling: options.enableConnectionPooling !== false,
      enableBatchOptimization: options.enableBatchOptimization !== false,
      enableCaching: options.enableCaching !== false,
      memoryThreshold: options.memoryThreshold || 0.8, // 80% memory threshold
      maxCacheSize: options.maxCacheSize || 10000,
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
      batchSizeOptimization: options.batchSizeOptimization !== false,
      adaptiveBatchSizing: options.adaptiveBatchSizing !== false,
      ...options
    };
    
    // Initialize optimization components
    this.memoryManager = new MemoryManager(this.options);
    this.compressionManager = new CompressionManager(this.options);
    this.connectionPool = new ConnectionPoolManager(this.options);
    this.batchOptimizer = new BatchOptimizer(this.options);
    this.cacheManager = new CacheManager(this.options);
    
    // Performance metrics
    this.metrics = {
      memoryUsage: [],
      processingTimes: [],
      compressionRatios: [],
      cacheHitRates: [],
      batchSizes: [],
      throughput: [],
      cpuUsage: [],
      startTime: Date.now()
    };
    
    // Start monitoring
    this.startPerformanceMonitoring();
    
    // Setup event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Setup event handlers for optimization components
   */
  setupEventHandlers() {
    this.memoryManager.on('memoryPressure', (event) => {
      logger.warn('Memory pressure detected:', event);
      this.emit('memoryPressure', event);
      this.handleMemoryPressure(event);
    });
    
    this.batchOptimizer.on('batchSizeAdjusted', (event) => {
      logger.debug('Batch size adjusted:', event);
      this.emit('batchSizeAdjusted', event);
    });
    
    this.cacheManager.on('cacheEviction', (event) => {
      logger.debug('Cache eviction occurred:', event);
    });
    
    this.compressionManager.on('compressionComplete', (event) => {
      this.metrics.compressionRatios.push(event.ratio);
    });
  }
  
  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000);
  }
  
  /**
   * Collect performance metrics
   */
  collectMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss
    });
    
    this.metrics.cpuUsage.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Keep only last 1000 entries
    if (this.metrics.memoryUsage.length > 1000) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-1000);
    }
    
    if (this.metrics.cpuUsage.length > 1000) {
      this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-1000);
    }
    
    // Check for memory pressure
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
    if (memoryPressure > this.options.memoryThreshold) {
      this.memoryManager.handleMemoryPressure({ pressure: memoryPressure });
    }
  }
  
  /**
   * Optimize data processing
   */
  async optimizeDataProcessing(data, options = {}) {
    const startTime = performance.now();
    let optimizedData = data;
    
    try {
      // Memory optimization
      if (this.options.enableMemoryManagement) {
        optimizedData = await this.memoryManager.optimizeData(optimizedData);
      }
      
      // Compression optimization
      if (this.options.enableDataCompression) {
        optimizedData = await this.compressionManager.compress(optimizedData);
      }
      
      // Batch optimization
      if (this.options.enableBatchOptimization && Array.isArray(optimizedData)) {
        const optimalBatchSize = this.batchOptimizer.getOptimalBatchSize(optimizedData);
        optimizedData = this.batchOptimizer.createOptimizedBatches(optimizedData, optimalBatchSize);
      }
      
      // Cache optimization
      if (this.options.enableCaching) {
        await this.cacheManager.cacheData(optimizedData, options.cacheKey);
      }
      
      const processingTime = performance.now() - startTime;
      this.metrics.processingTimes.push({
        timestamp: Date.now(),
        duration: processingTime,
        dataSize: this.getDataSize(data)
      });
      
      this.emit('dataOptimized', {
        originalSize: this.getDataSize(data),
        optimizedSize: this.getDataSize(optimizedData),
        processingTime,
        optimizations: this.getAppliedOptimizations()
      });
      
      return optimizedData;
      
    } catch (error) {
      logger.error('Data optimization failed:', error);
      throw error;
    }
  }
  
  /**
   * Optimize execution strategy
   */
  optimizeExecutionStrategy(dataSize, complexity, resources) {
    const recommendation = {
      executorType: 'sequential',
      batchSize: 100,
      parallelism: 1,
      memoryStrategy: 'standard',
      reason: []
    };
    
    // Analyze data size
    if (dataSize > 10000) {
      recommendation.executorType = 'batch';
      recommendation.batchSize = this.batchOptimizer.calculateOptimalBatchSize(dataSize);
      recommendation.reason.push('Large dataset detected, using batch processing');
    }
    
    if (dataSize > 100000) {
      recommendation.executorType = 'stream';
      recommendation.memoryStrategy = 'streaming';
      recommendation.reason.push('Very large dataset, using streaming');
    }
    
    // Analyze complexity
    if (complexity > 0.7) {
      recommendation.parallelism = Math.min(4, Math.ceil(dataSize / 1000));
      recommendation.executorType = 'parallel';
      recommendation.reason.push('High complexity, using parallel processing');
    }
    
    // Analyze available resources
    if (resources.availableMemory < 0.3) {
      recommendation.memoryStrategy = 'conservative';
      recommendation.batchSize = Math.floor(recommendation.batchSize * 0.5);
      recommendation.reason.push('Low memory, reducing batch size');
    }
    
    if (resources.cpuUsage > 0.8) {
      recommendation.parallelism = Math.max(1, Math.floor(recommendation.parallelism * 0.5));
      recommendation.reason.push('High CPU usage, reducing parallelism');
    }
    
    return recommendation;
  }
  
  /**
   * Handle memory pressure
   */
  async handleMemoryPressure(event) {
    logger.info('Handling memory pressure:', event);
    
    // Clear caches
    await this.cacheManager.clearOldEntries();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Emit warning
    this.emit('performanceWarning', {
      type: 'memory_pressure',
      level: event.pressure,
      actions: ['cache_cleared', 'gc_forced']
    });
  }
  
  /**
   * Get data size in bytes
   */
  getDataSize(data) {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
    
    if (Buffer.isBuffer(data)) {
      return data.length;
    }
    
    // Estimate size for objects/arrays
    const str = JSON.stringify(data);
    return Buffer.byteLength(str, 'utf8');
  }
  
  /**
   * Get applied optimizations
   */
  getAppliedOptimizations() {
    return {
      memoryManagement: this.options.enableMemoryManagement,
      dataCompression: this.options.enableDataCompression,
      connectionPooling: this.options.enableConnectionPooling,
      batchOptimization: this.options.enableBatchOptimization,
      caching: this.options.enableCaching
    };
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    return {
      uptime,
      memoryUsage: this.getLatestMetric(this.metrics.memoryUsage),
      cpuUsage: this.getLatestMetric(this.metrics.cpuUsage),
      averageProcessingTime: this.calculateAverage(this.metrics.processingTimes, 'duration'),
      averageCompressionRatio: this.calculateAverage(this.metrics.compressionRatios),
      cacheHitRate: this.cacheManager.getHitRate(),
      throughput: this.calculateThroughput(),
      optimizationsSummary: this.getOptimizationsSummary()
    };
  }
  
  /**
   * Get latest metric value
   */
  getLatestMetric(metrics) {
    return metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }
  
  /**
   * Calculate average of metrics
   */
  calculateAverage(metrics, property = null) {
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, metric) => {
      const value = property ? metric[property] : metric;
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    
    return sum / metrics.length;
  }
  
  /**
   * Calculate throughput
   */
  calculateThroughput() {
    const recentProcessingTimes = this.metrics.processingTimes.slice(-100);
    if (recentProcessingTimes.length === 0) return 0;
    
    const totalTime = recentProcessingTimes.reduce((acc, metric) => acc + metric.duration, 0);
    const totalData = recentProcessingTimes.reduce((acc, metric) => acc + metric.dataSize, 0);
    
    return totalTime > 0 ? (totalData / totalTime) * 1000 : 0; // bytes per second
  }
  
  /**
   * Get optimizations summary
   */
  getOptimizationsSummary() {
    return {
      memoryOptimizations: this.memoryManager.getOptimizationCount(),
      compressionOptimizations: this.compressionManager.getCompressionCount(),
      cacheOptimizations: this.cacheManager.getCacheCount(),
      batchOptimizations: this.batchOptimizer.getOptimizationCount()
    };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      memoryUsage: [],
      processingTimes: [],
      compressionRatios: [],
      cacheHitRates: [],
      batchSizes: [],
      throughput: [],
      cpuUsage: [],
      startTime: Date.now()
    };
    
    // Reset component metrics
    this.memoryManager.resetMetrics();
    this.compressionManager.resetMetrics();
    this.cacheManager.resetMetrics();
    this.batchOptimizer.resetMetrics();
  }
  
  /**
   * Shutdown optimizer
   */
  async shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.memoryManager.shutdown();
    await this.compressionManager.shutdown();
    await this.connectionPool.shutdown();
    await this.cacheManager.shutdown();
    
    logger.info('Performance optimizer shutdown complete');
  }
}

/**
 * Memory Manager
 * Handles memory optimization and monitoring
 */
class MemoryManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.optimizationCount = 0;
  }
  
  async optimizeData(data) {
    // Implement memory-efficient data processing
    if (Array.isArray(data) && data.length > 1000) {
      // Process in chunks to reduce memory footprint
      this.optimizationCount++;
      return this.processInChunks(data);
    }
    
    return data;
  }
  
  async processInChunks(data, chunkSize = 1000) {
    const results = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      results.push(...chunk);
      
      // Allow garbage collection between chunks
      if (i % (chunkSize * 10) === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    return results;
  }
  
  handleMemoryPressure(event) {
    this.emit('memoryPressure', event);
  }
  
  getOptimizationCount() {
    return this.optimizationCount;
  }
  
  resetMetrics() {
    this.optimizationCount = 0;
  }
  
  async shutdown() {
    // Cleanup resources
  }
}

/**
 * Compression Manager
 * Handles data compression and decompression
 */
class CompressionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.compressionCount = 0;
  }
  
  async compress(data) {
    const dataSize = this.getDataSize(data);
    
    if (dataSize < this.options.compressionThreshold) {
      return data; // Skip compression for small data
    }
    
    try {
      const compressed = await this.compressData(data);
      const compressionRatio = dataSize / this.getDataSize(compressed);
      
      this.compressionCount++;
      this.emit('compressionComplete', {
        originalSize: dataSize,
        compressedSize: this.getDataSize(compressed),
        ratio: compressionRatio
      });
      
      return compressed;
    } catch (error) {
      logger.error('Compression failed:', error);
      return data;
    }
  }
  
  async compressData(data) {
    // Simple compression simulation
    // In practice, you'd use zlib or other compression libraries
    if (typeof data === 'string') {
      return Buffer.from(data).toString('base64');
    }
    
    return JSON.stringify(data);
  }
  
  getDataSize(data) {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
    
    if (Buffer.isBuffer(data)) {
      return data.length;
    }
    
    const str = JSON.stringify(data);
    return Buffer.byteLength(str, 'utf8');
  }
  
  getCompressionCount() {
    return this.compressionCount;
  }
  
  resetMetrics() {
    this.compressionCount = 0;
  }
  
  async shutdown() {
    // Cleanup resources
  }
}

/**
 * Connection Pool Manager
 * Manages database and external service connections
 */
class ConnectionPoolManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxConnections: options.maxConnections || 20,
      idleTimeout: options.idleTimeout || 30000,
      acquireTimeout: options.acquireTimeout || 10000,
      ...options
    };
    
    this.pools = new Map();
  }
  
  createPool(name, factory) {
    if (this.pools.has(name)) {
      return this.pools.get(name);
    }
    
    const pool = new ConnectionPool(factory, this.options);
    this.pools.set(name, pool);
    
    return pool;
  }
  
  getPool(name) {
    return this.pools.get(name);
  }
  
  async shutdown() {
    for (const pool of this.pools.values()) {
      await pool.shutdown();
    }
    this.pools.clear();
  }
}

/**
 * Connection Pool Implementation
 */
class ConnectionPool {
  constructor(factory, options) {
    this.factory = factory;
    this.options = options;
    this.pool = [];
    this.active = new Set();
    this.waiting = [];
  }
  
  async acquire() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection acquire timeout'));
      }, this.options.acquireTimeout);
      
      this.waiting.push({ resolve, reject, timeout });
      this.processWaiting();
    });
  }
  
  async processWaiting() {
    if (this.waiting.length === 0) return;
    
    let connection;
    
    if (this.pool.length > 0) {
      connection = this.pool.pop();
    } else if (this.active.size < this.options.maxConnections) {
      connection = await this.factory.create();
    } else {
      return; // No connections available
    }
    
    const waiter = this.waiting.shift();
    clearTimeout(waiter.timeout);
    
    this.active.add(connection);
    waiter.resolve(connection);
  }
  
  release(connection) {
    this.active.delete(connection);
    this.pool.push(connection);
    this.processWaiting();
  }
  
  async shutdown() {
    // Close all connections
    for (const connection of this.pool) {
      if (connection.close) {
        await connection.close();
      }
    }
    
    for (const connection of this.active) {
      if (connection.close) {
        await connection.close();
      }
    }
    
    this.pool.length = 0;
    this.active.clear();
  }
}

/**
 * Batch Optimizer
 * Optimizes batch processing strategies
 */
class BatchOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.optimizationCount = 0;
    this.performanceHistory = [];
  }
  
  getOptimalBatchSize(data) {
    const dataSize = Array.isArray(data) ? data.length : 1;
    
    // Use performance history to determine optimal batch size
    if (this.performanceHistory.length > 0) {
      return this.calculateOptimalFromHistory();
    }
    
    // Default calculation based on data size
    return this.calculateOptimalBatchSize(dataSize);
  }
  
  calculateOptimalBatchSize(dataSize) {
    if (dataSize < 100) return dataSize;
    if (dataSize < 1000) return 100;
    if (dataSize < 10000) return 500;
    if (dataSize < 100000) return 1000;
    return 2000;
  }
  
  calculateOptimalFromHistory() {
    // Find the batch size with the best performance
    const bestPerformance = this.performanceHistory.reduce((best, current) => {
      const currentThroughput = current.itemsProcessed / current.processingTime;
      const bestThroughput = best.itemsProcessed / best.processingTime;
      
      return currentThroughput > bestThroughput ? current : best;
    });
    
    return bestPerformance.batchSize;
  }
  
  createOptimizedBatches(data, batchSize) {
    const batches = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    
    this.optimizationCount++;
    return batches;
  }
  
  recordPerformance(batchSize, processingTime, itemsProcessed) {
    this.performanceHistory.push({
      batchSize,
      processingTime,
      itemsProcessed,
      timestamp: Date.now()
    });
    
    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
  }
  
  getOptimizationCount() {
    return this.optimizationCount;
  }
  
  resetMetrics() {
    this.optimizationCount = 0;
    this.performanceHistory = [];
  }
}

/**
 * Cache Manager
 * Manages intelligent caching strategies
 */
class CacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.cache = new Map();
    this.accessTimes = new Map();
    this.hitCount = 0;
    this.missCount = 0;
    this.cacheCount = 0;
  }
  
  async cacheData(data, key) {
    if (!key) return;
    
    this.cache.set(key, data);
    this.accessTimes.set(key, Date.now());
    this.cacheCount++;
    
    // Cleanup if needed
    if (this.cache.size > this.options.maxCacheSize) {
      await this.clearOldEntries();
    }
  }
  
  getCachedData(key) {
    if (this.cache.has(key)) {
      this.accessTimes.set(key, Date.now());
      this.hitCount++;
      return this.cache.get(key);
    }
    
    this.missCount++;
    return null;
  }
  
  async clearOldEntries() {
    const now = Date.now();
    const entries = Array.from(this.accessTimes.entries());
    
    // Sort by access time and remove oldest 25%
    entries.sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
    
    for (const [key] of toRemove) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
    }
    
    this.emit('cacheEviction', {
      removedCount: toRemove.length,
      remainingSize: this.cache.size
    });
  }
  
  getHitRate() {
    const total = this.hitCount + this.missCount;
    return total > 0 ? (this.hitCount / total) * 100 : 0;
  }
  
  getCacheCount() {
    return this.cacheCount;
  }
  
  resetMetrics() {
    this.hitCount = 0;
    this.missCount = 0;
    this.cacheCount = 0;
  }
  
  async shutdown() {
    this.cache.clear();
    this.accessTimes.clear();
  }
}

module.exports = {
  PerformanceOptimizer,
  MemoryManager,
  CompressionManager,
  ConnectionPoolManager,
  BatchOptimizer,
  CacheManager
};