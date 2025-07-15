// Using crypto.randomUUID instead of uuid package to avoid dependency issues
const crypto = require('crypto');
const logger = require('../../../src/utils/logger');

/**
 * Execution Context Manager
 * Manages execution state, metadata, and configuration
 */
class ExecutionContext {
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.parentId = options.parentId || null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    
    // Execution metadata
    this.metadata = {
      source: options.source || 'unknown',
      target: options.target || 'unknown',
      mappingId: options.mappingId || null,
      executorType: options.executorType || null,
      userId: options.userId || null,
      jobId: options.jobId || null,
      ...options.metadata
    };
    
    // Execution configuration
    this.config = {
      timeout: options.timeout || 300000, // 5 minutes default
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      strictMode: options.strictMode !== false,
      validateInput: options.validateInput !== false,
      validateOutput: options.validateOutput !== false,
      collectMetrics: options.collectMetrics !== false,
      enableProfiling: options.enableProfiling || false,
      ...options.config
    };
    
    // Execution state
    this.state = {
      status: 'initialized',
      startTime: null,
      endTime: null,
      duration: null,
      progress: 0,
      recordsProcessed: 0,
      errors: [],
      warnings: [],
      retryCount: 0
    };
    
    // Performance metrics
    this.metrics = {
      recordsProcessed: 0,
      recordsFailed: 0,
      totalExecutionTime: 0,
      averageRecordTime: 0,
      peakMemoryUsage: 0,
      cpuUsage: 0,
      throughput: 0
    };
    
    // Profiling data
    this.profiling = options.enableProfiling ? {
      stages: {},
      records: [],
      memorySnapshots: []
    } : null;
    
    // Custom data storage
    this.data = options.data || {};
    
    // Event callbacks
    this.callbacks = {
      onProgress: options.onProgress || null,
      onError: options.onError || null,
      onComplete: options.onComplete || null,
      onStateChange: options.onStateChange || null
    };
  }

  /**
   * Start execution
   */
  start() {
    this.state.status = 'running';
    this.state.startTime = new Date();
    this.state.endTime = null;
    this.state.duration = null;
    this.updatedAt = new Date();
    
    if (this.config.enableProfiling) {
      this.startProfiling();
    }
    
    this.emitStateChange('started');
    logger.info(`Execution context ${this.id} started`);
  }

  /**
   * Complete execution
   */
  complete(result = null) {
    this.state.status = 'completed';
    this.state.endTime = new Date();
    this.state.duration = this.state.endTime - this.state.startTime;
    this.state.progress = 100;
    this.updatedAt = new Date();
    
    if (this.config.enableProfiling) {
      this.stopProfiling();
    }
    
    this.calculateFinalMetrics();
    this.emitStateChange('completed', result);
    
    logger.info(`Execution context ${this.id} completed in ${this.state.duration}ms`);
  }

  /**
   * Fail execution
   */
  fail(error) {
    this.state.status = 'failed';
    this.state.endTime = new Date();
    this.state.duration = this.state.endTime - this.state.startTime;
    this.updatedAt = new Date();
    
    this.addError(error);
    
    if (this.config.enableProfiling) {
      this.stopProfiling();
    }
    
    this.emitStateChange('failed', error);
    logger.error(`Execution context ${this.id} failed: ${error.message}`);
  }

  /**
   * Cancel execution
   */
  cancel(reason = 'User cancelled') {
    this.state.status = 'cancelled';
    this.state.endTime = new Date();
    this.state.duration = this.state.endTime - this.state.startTime;
    this.updatedAt = new Date();
    
    if (this.config.enableProfiling) {
      this.stopProfiling();
    }
    
    this.emitStateChange('cancelled', reason);
    logger.info(`Execution context ${this.id} cancelled: ${reason}`);
  }

  /**
   * Update progress
   */
  updateProgress(current, total, message = null) {
    this.state.progress = Math.round((current / total) * 100);
    this.state.recordsProcessed = current;
    this.updatedAt = new Date();
    
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress({
        contextId: this.id,
        current,
        total,
        progress: this.state.progress,
        message
      });
    }
  }

  /**
   * Add error
   */
  addError(error, record = null) {
    const errorInfo = {
      timestamp: new Date(),
      message: error.message || String(error),
      stack: error.stack,
      record,
      code: error.code
    };
    
    this.state.errors.push(errorInfo);
    this.metrics.recordsFailed++;
    
    if (this.callbacks.onError) {
      this.callbacks.onError(errorInfo);
    }
  }

  /**
   * Add warning
   */
  addWarning(message, details = null) {
    this.state.warnings.push({
      timestamp: new Date(),
      message,
      details
    });
  }

  /**
   * Increment retry count
   */
  incrementRetry() {
    this.state.retryCount++;
    return this.state.retryCount <= this.config.retryAttempts;
  }

  /**
   * Get retry delay
   */
  getRetryDelay() {
    // Exponential backoff
    return this.config.retryDelay * Math.pow(2, this.state.retryCount - 1);
  }

  /**
   * Update metrics
   */
  updateMetrics(recordMetrics) {
    if (!this.config.collectMetrics) return;
    
    this.metrics.recordsProcessed++;
    
    if (recordMetrics.executionTime) {
      this.metrics.totalExecutionTime += recordMetrics.executionTime;
      this.metrics.averageRecordTime = 
        this.metrics.totalExecutionTime / this.metrics.recordsProcessed;
    }
    
    if (recordMetrics.memoryUsage && 
        recordMetrics.memoryUsage > this.metrics.peakMemoryUsage) {
      this.metrics.peakMemoryUsage = recordMetrics.memoryUsage;
    }
  }

  /**
   * Start profiling
   */
  startProfiling() {
    if (!this.profiling) return;
    
    this.profiling.startTime = process.hrtime.bigint();
    this.profiling.startMemory = process.memoryUsage();
  }

  /**
   * Stop profiling
   */
  stopProfiling() {
    if (!this.profiling) return;
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - this.profiling.startTime) / 1000000; // Convert to ms
    
    this.profiling.totalDuration = duration;
    this.profiling.endMemory = process.memoryUsage();
    this.profiling.memoryDelta = {
      heapUsed: this.profiling.endMemory.heapUsed - this.profiling.startMemory.heapUsed,
      heapTotal: this.profiling.endMemory.heapTotal - this.profiling.startMemory.heapTotal,
      external: this.profiling.endMemory.external - this.profiling.startMemory.external
    };
  }

  /**
   * Profile stage execution
   */
  profileStage(stageName, fn) {
    if (!this.config.enableProfiling) {
      return fn();
    }
    
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    const result = fn();
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    const endMemory = process.memoryUsage();
    
    if (!this.profiling.stages[stageName]) {
      this.profiling.stages[stageName] = {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
        memoryDelta: 0
      };
    }
    
    const stage = this.profiling.stages[stageName];
    stage.count++;
    stage.totalTime += duration;
    stage.minTime = Math.min(stage.minTime, duration);
    stage.maxTime = Math.max(stage.maxTime, duration);
    stage.avgTime = stage.totalTime / stage.count;
    stage.memoryDelta += (endMemory.heapUsed - startMemory.heapUsed);
    
    return result;
  }

  /**
   * Calculate final metrics
   */
  calculateFinalMetrics() {
    if (this.state.duration !== null && this.state.duration > 0 && this.metrics.recordsProcessed > 0) {
      this.metrics.throughput = 
        (this.metrics.recordsProcessed / this.state.duration) * 1000; // Records per second
    }
    
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      this.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    }
  }

  /**
   * Emit state change
   */
  emitStateChange(newState, data = null) {
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange({
        contextId: this.id,
        previousState: this.state.status,
        newState,
        data,
        timestamp: new Date()
      });
    }
    
    if (newState === 'completed' && this.callbacks.onComplete) {
      this.callbacks.onComplete({
        contextId: this.id,
        result: data,
        metrics: this.getMetrics(),
        duration: this.state.duration
      });
    }
  }

  /**
   * Get execution summary
   */
  getSummary() {
    return {
      id: this.id,
      status: this.state.status,
      progress: this.state.progress,
      startTime: this.state.startTime,
      endTime: this.state.endTime,
      duration: this.state.duration,
      recordsProcessed: this.state.recordsProcessed,
      errors: this.state.errors.length,
      warnings: this.state.warnings.length,
      metadata: this.metadata
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.recordsProcessed > 0
        ? (this.metrics.recordsFailed / this.metrics.recordsProcessed) * 100
        : 0,
      successRate: this.metrics.recordsProcessed > 0
        ? ((this.metrics.recordsProcessed - this.metrics.recordsFailed) / 
           this.metrics.recordsProcessed) * 100
        : 0
    };
  }

  /**
   * Get profiling report
   */
  getProfilingReport() {
    if (!this.profiling) {
      return null;
    }
    
    return {
      totalDuration: this.profiling.totalDuration,
      memoryDelta: this.profiling.memoryDelta,
      stages: this.profiling.stages,
      summary: {
        totalStages: Object.keys(this.profiling.stages).length,
        totalStageExecutions: Object.values(this.profiling.stages)
          .reduce((sum, stage) => sum + stage.count, 0),
        totalStageTime: Object.values(this.profiling.stages)
          .reduce((sum, stage) => sum + stage.totalTime, 0)
      }
    };
  }

  /**
   * Clone context for child execution
   */
  createChildContext(options = {}) {
    return new ExecutionContext({
      parentId: this.id,
      source: options.source || this.metadata.source,
      target: options.target || this.metadata.target,
      mappingId: options.mappingId || this.metadata.mappingId,
      executorType: options.executorType || this.metadata.executorType,
      userId: options.userId || this.metadata.userId,
      metadata: {
        ...this.metadata,
        ...options.metadata,
        mappingId: options.mappingId || this.metadata.mappingId
      },
      config: {
        ...this.config,
        ...options.config
      },
      data: {
        ...this.data,
        ...options.data
      },
      ...options
    });
  }

  /**
   * Merge child context results
   */
  mergeChildContext(childContext) {
    // Merge metrics
    this.metrics.recordsProcessed += childContext.metrics.recordsProcessed;
    this.metrics.recordsFailed += childContext.metrics.recordsFailed;
    this.metrics.totalExecutionTime += childContext.metrics.totalExecutionTime;
    
    // Recalculate average
    if (this.metrics.recordsProcessed > 0) {
      this.metrics.averageRecordTime = 
        this.metrics.totalExecutionTime / this.metrics.recordsProcessed;
    }
    
    // Merge errors and warnings
    this.state.errors.push(...childContext.state.errors);
    this.state.warnings.push(...childContext.state.warnings);
    
    // Update peak memory usage
    if (childContext.metrics.peakMemoryUsage > this.metrics.peakMemoryUsage) {
      this.metrics.peakMemoryUsage = childContext.metrics.peakMemoryUsage;
    }
    
    // Merge profiling data if enabled
    if (this.profiling && childContext.profiling) {
      for (const [stageName, stageData] of Object.entries(childContext.profiling.stages)) {
        if (!this.profiling.stages[stageName]) {
          this.profiling.stages[stageName] = { ...stageData };
        } else {
          const stage = this.profiling.stages[stageName];
          stage.count += stageData.count;
          stage.totalTime += stageData.totalTime;
          stage.minTime = Math.min(stage.minTime, stageData.minTime);
          stage.maxTime = Math.max(stage.maxTime, stageData.maxTime);
          stage.avgTime = stage.totalTime / stage.count;
          stage.memoryDelta += stageData.memoryDelta;
        }
      }
    }
  }

  /**
   * Export context for persistence
   */
  toJSON() {
    return {
      id: this.id,
      parentId: this.parentId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata,
      config: this.config,
      state: this.state,
      metrics: this.metrics,
      profiling: this.profiling,
      data: this.data
    };
  }

  /**
   * Import context from persistence
   */
  static fromJSON(json) {
    const context = new ExecutionContext(json);
    
    // Restore all properties from JSON
    Object.assign(context, json);
    
    // Restore dates
    context.createdAt = new Date(json.createdAt);
    context.updatedAt = new Date(json.updatedAt);
    
    if (json.state.startTime) {
      context.state.startTime = new Date(json.state.startTime);
    }
    if (json.state.endTime) {
      context.state.endTime = new Date(json.state.endTime);
    }
    
    // Restore error and warning timestamps
    if (json.state.errors && json.state.errors.length > 0) {
      context.state.errors = json.state.errors.map(error => ({
        ...error,
        timestamp: new Date(error.timestamp)
      }));
    }
    
    if (json.state.warnings && json.state.warnings.length > 0) {
      context.state.warnings = json.state.warnings.map(warning => ({
        ...warning,
        timestamp: new Date(warning.timestamp)
      }));
    }
    
    return context;
  }
}

module.exports = ExecutionContext;