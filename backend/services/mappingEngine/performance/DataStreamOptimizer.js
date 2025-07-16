const { Transform, pipeline } = require('stream');
const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');
const logger = require('../../../src/utils/logger');

/**
 * Data Stream Optimizer
 * Optimizes streaming data processing for large datasets
 */
class DataStreamOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      highWaterMark: options.highWaterMark || 16384, // 16KB buffer
      objectMode: options.objectMode !== false,
      backpressureThreshold: options.backpressureThreshold || 1000,
      maxConcurrency: options.maxConcurrency || 10,
      enableMetrics: options.enableMetrics !== false,
      chunkSize: options.chunkSize || 100,
      enableBackpressureControl: options.enableBackpressureControl !== false,
      enableAdaptiveBuffering: options.enableAdaptiveBuffering !== false,
      ...options
    };
    
    this.metrics = {
      totalProcessed: 0,
      totalErrors: 0,
      processingRate: 0,
      averageLatency: 0,
      backpressureEvents: 0,
      bufferUtilization: 0,
      throughputHistory: [],
      latencyHistory: []
    };
    
    this.activeStreams = new Set();
    this.streamPool = new Map();
    
    // Start metrics collection
    if (this.options.enableMetrics) {
      this.startMetricsCollection();
    }
  }
  
  /**
   * Create optimized transform stream
   */
  createOptimizedStream(transformFunction, options = {}) {
    const streamOptions = {
      objectMode: this.options.objectMode,
      highWaterMark: this.options.highWaterMark,
      ...options
    };
    
    const optimizedTransform = new OptimizedTransform(transformFunction, {
      ...streamOptions,
      optimizer: this,
      enableBackpressureControl: this.options.enableBackpressureControl,
      enableAdaptiveBuffering: this.options.enableAdaptiveBuffering
    });
    
    this.activeStreams.add(optimizedTransform);
    
    optimizedTransform.on('close', () => {
      this.activeStreams.delete(optimizedTransform);
    });
    
    return optimizedTransform;
  }
  
  /**
   * Create parallel processing stream
   */
  createParallelStream(transformFunction, options = {}) {
    const parallelOptions = {
      maxConcurrency: options.maxConcurrency || this.options.maxConcurrency,
      chunkSize: options.chunkSize || this.options.chunkSize,
      ...options
    };
    
    return new ParallelProcessingStream(transformFunction, {
      ...parallelOptions,
      optimizer: this
    });
  }
  
  /**
   * Create batch processing stream
   */
  createBatchStream(batchFunction, options = {}) {
    const batchOptions = {
      batchSize: options.batchSize || this.options.chunkSize,
      flushTimeout: options.flushTimeout || 1000,
      ...options
    };
    
    return new BatchProcessingStream(batchFunction, {
      ...batchOptions,
      optimizer: this
    });
  }
  
  /**
   * Create memory-efficient processing pipeline
   */
  createOptimizedPipeline(stages, options = {}) {
    const pipeline = new OptimizedPipeline(stages, {
      ...this.options,
      ...options,
      optimizer: this
    });
    
    return pipeline;
  }
  
  /**
   * Process data with streaming optimization
   */
  async processWithStreaming(data, transformFunction, options = {}) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      const startTime = performance.now();
      
      const sourceStream = this.createDataSource(data);
      const transformStream = this.createOptimizedStream((chunk) => {
        try {
          return transformFunction(chunk);
        } catch (error) {
          errors.push(error);
          return null; // Skip failed transformations
        }
      });
      const collectStream = this.createCollector(results, errors);
      
      pipeline(
        sourceStream,
        transformStream,
        collectStream,
        (error) => {
          const processingTime = performance.now() - startTime;
          
          if (error) {
            logger.error('Stream processing failed:', error);
            reject(error);
          } else {
            this.updateMetrics(results.length, processingTime, errors.length);
            resolve({
              results: results.filter(r => r !== null),
              errors,
              processingTime,
              throughput: results.length / (processingTime / 1000)
            });
          }
        }
      );
    });
  }
  
  /**
   * Create data source stream
   */
  createDataSource(data) {
    const { Readable } = require('stream');
    
    if (Array.isArray(data)) {
      let index = 0;
      
      return new Readable({
        objectMode: true,
        read() {
          if (index < data.length) {
            this.push(data[index++]);
          } else {
            this.push(null);
          }
        }
      });
    }
    
    // Handle other data types
    return new Readable({
      objectMode: true,
      read() {
        this.push(data);
        this.push(null);
      }
    });
  }
  
  /**
   * Create collector stream
   */
  createCollector(results, errors) {
    const { Writable } = require('stream');
    
    return new Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        if (chunk.error) {
          errors.push(chunk.error);
        } else {
          results.push(chunk.data || chunk);
        }
        callback();
      }
    });
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.collectStreamMetrics();
    }, 5000);
  }
  
  /**
   * Collect stream metrics
   */
  collectStreamMetrics() {
    const now = Date.now();
    const activeStreamCount = this.activeStreams.size;
    
    let totalBufferUtilization = 0;
    
    for (const stream of this.activeStreams) {
      if (stream.getBufferUtilization) {
        totalBufferUtilization += stream.getBufferUtilization();
      }
    }
    
    this.metrics.bufferUtilization = activeStreamCount > 0 
      ? totalBufferUtilization / activeStreamCount 
      : 0;
    
    // Calculate processing rate
    const recentThroughput = this.metrics.throughputHistory.slice(-10);
    if (recentThroughput.length > 0) {
      this.metrics.processingRate = recentThroughput.reduce((sum, t) => sum + t, 0) / recentThroughput.length;
    }
    
    // Calculate average latency
    const recentLatency = this.metrics.latencyHistory.slice(-10);
    if (recentLatency.length > 0) {
      this.metrics.averageLatency = recentLatency.reduce((sum, l) => sum + l, 0) / recentLatency.length;
    }
    
    this.emit('metricsUpdate', this.getMetrics());
  }
  
  /**
   * Update processing metrics
   */
  updateMetrics(processed, processingTime, errors = 0) {
    this.metrics.totalProcessed += processed;
    this.metrics.totalErrors += errors;
    
    const throughput = processed / (processingTime / 1000);
    this.metrics.throughputHistory.push(throughput);
    
    const latency = processingTime / processed;
    this.metrics.latencyHistory.push(latency);
    
    // Keep only last 100 entries
    if (this.metrics.throughputHistory.length > 100) {
      this.metrics.throughputHistory = this.metrics.throughputHistory.slice(-100);
    }
    
    if (this.metrics.latencyHistory.length > 100) {
      this.metrics.latencyHistory = this.metrics.latencyHistory.slice(-100);
    }
  }
  
  /**
   * Handle backpressure event
   */
  handleBackpressure(streamId, bufferSize) {
    this.metrics.backpressureEvents++;
    
    logger.debug(`Backpressure detected in stream ${streamId}, buffer size: ${bufferSize}`);
    
    this.emit('backpressure', {
      streamId,
      bufferSize,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get stream metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeStreams: this.activeStreams.size,
      successRate: this.metrics.totalProcessed > 0 
        ? ((this.metrics.totalProcessed - this.metrics.totalErrors) / this.metrics.totalProcessed) * 100 
        : 0
    };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalProcessed: 0,
      totalErrors: 0,
      processingRate: 0,
      averageLatency: 0,
      backpressureEvents: 0,
      bufferUtilization: 0,
      throughputHistory: [],
      latencyHistory: []
    };
  }
  
  /**
   * Shutdown optimizer
   */
  async shutdown() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Close all active streams
    for (const stream of this.activeStreams) {
      if (!stream.destroyed) {
        stream.destroy();
      }
    }
    
    this.activeStreams.clear();
    this.streamPool.clear();
    
    logger.info('Data stream optimizer shutdown complete');
  }
}

/**
 * Optimized Transform Stream
 */
class OptimizedTransform extends Transform {
  constructor(transformFunction, options = {}) {
    super({
      objectMode: options.objectMode,
      highWaterMark: options.highWaterMark
    });
    
    this.transformFunction = transformFunction;
    this.options = options;
    this.optimizer = options.optimizer;
    this.streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics = {
      processed: 0,
      errors: 0,
      avgProcessingTime: 0,
      bufferHighWater: 0
    };
    
    this.processingTimes = [];
  }
  
  async _transform(chunk, encoding, callback) {
    const startTime = performance.now();
    
    try {
      const result = await this.transformFunction(chunk);
      const processingTime = performance.now() - startTime;
      
      this.updateMetrics(processingTime);
      
      // Handle backpressure
      if (this.options.enableBackpressureControl) {
        this.handleBackpressure();
      }
      
      callback(null, result);
    } catch (error) {
      this.metrics.errors++;
      
      if (this.optimizer) {
        this.optimizer.updateMetrics(0, performance.now() - startTime, 1);
      }
      
      callback(error);
    }
  }
  
  updateMetrics(processingTime) {
    this.metrics.processed++;
    this.processingTimes.push(processingTime);
    
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }
    
    this.metrics.avgProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    
    // Track buffer utilization
    const bufferSize = this.readableLength + this.writableLength;
    this.metrics.bufferHighWater = Math.max(this.metrics.bufferHighWater, bufferSize);
  }
  
  handleBackpressure() {
    const bufferSize = this.readableLength + this.writableLength;
    const threshold = this.options.optimizer?.options.backpressureThreshold || 1000;
    
    if (bufferSize > threshold) {
      if (this.optimizer) {
        this.optimizer.handleBackpressure(this.streamId, bufferSize);
      }
    }
  }
  
  getBufferUtilization() {
    const currentBuffer = this.readableLength + this.writableLength;
    const maxBuffer = this.readableHighWaterMark + this.writableHighWaterMark;
    
    return maxBuffer > 0 ? (currentBuffer / maxBuffer) * 100 : 0;
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      bufferUtilization: this.getBufferUtilization()
    };
  }
}

/**
 * Parallel Processing Stream
 */
class ParallelProcessingStream extends Transform {
  constructor(transformFunction, options = {}) {
    super({
      objectMode: true,
      highWaterMark: options.highWaterMark || 16
    });
    
    this.transformFunction = transformFunction;
    this.options = options;
    this.maxConcurrency = options.maxConcurrency || 10;
    this.activePromises = new Set();
    this.processedCount = 0;
  }
  
  async _transform(chunk, encoding, callback) {
    // If we're at max concurrency, wait for one to complete
    if (this.activePromises.size >= this.maxConcurrency) {
      await Promise.race(this.activePromises);
    }
    
    const promise = this.processChunk(chunk)
      .then(result => {
        this.push(result);
        this.processedCount++;
      })
      .catch(error => {
        this.emit('error', error);
      })
      .finally(() => {
        this.activePromises.delete(promise);
      });
    
    this.activePromises.add(promise);
    callback();
  }
  
  async _flush(callback) {
    // Wait for all active promises to complete
    await Promise.all(this.activePromises);
    callback();
  }
  
  async processChunk(chunk) {
    try {
      return await this.transformFunction(chunk);
    } catch (error) {
      logger.error('Parallel processing error:', error);
      throw error;
    }
  }
  
  getMetrics() {
    return {
      processed: this.processedCount,
      activeTasks: this.activePromises.size,
      concurrency: this.maxConcurrency
    };
  }
}

/**
 * Batch Processing Stream
 */
class BatchProcessingStream extends Transform {
  constructor(batchFunction, options = {}) {
    super({
      objectMode: true,
      highWaterMark: options.highWaterMark || 16
    });
    
    this.batchFunction = batchFunction;
    this.options = options;
    this.batchSize = options.batchSize || 100;
    this.flushTimeout = options.flushTimeout || 1000;
    
    this.currentBatch = [];
    this.batchTimer = null;
    this.processedBatches = 0;
  }
  
  _transform(chunk, encoding, callback) {
    this.currentBatch.push(chunk);
    
    if (this.currentBatch.length >= this.batchSize) {
      this.processBatch().then(() => callback()).catch(callback);
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.flushTimeout);
      callback();
    } else {
      callback();
    }
  }
  
  _flush(callback) {
    if (this.currentBatch.length > 0) {
      this.processBatch().then(() => callback()).catch(callback);
    } else {
      callback();
    }
  }
  
  async processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.currentBatch.length === 0) return;
    
    const batch = this.currentBatch;
    this.currentBatch = [];
    
    try {
      const results = await this.batchFunction(batch);
      
      if (Array.isArray(results)) {
        results.forEach(result => this.push(result));
      } else {
        this.push(results);
      }
      
      this.processedBatches++;
    } catch (error) {
      logger.error('Batch processing error:', error);
      this.emit('error', error);
    }
  }
  
  getMetrics() {
    return {
      processedBatches: this.processedBatches,
      currentBatchSize: this.currentBatch.length,
      configuredBatchSize: this.batchSize
    };
  }
}

/**
 * Optimized Pipeline
 */
class OptimizedPipeline extends EventEmitter {
  constructor(stages, options = {}) {
    super();
    
    this.stages = stages;
    this.options = options;
    this.optimizer = options.optimizer;
    
    this.metrics = {
      totalProcessed: 0,
      stageMetrics: new Map(),
      pipelineLatency: 0
    };
  }
  
  async process(data) {
    const startTime = performance.now();
    
    try {
      let result = data;
      
      for (let i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i];
        const stageStartTime = performance.now();
        
        result = await this.processStage(stage, result, i);
        
        const stageTime = performance.now() - stageStartTime;
        this.updateStageMetrics(i, stageTime);
      }
      
      const totalTime = performance.now() - startTime;
      this.metrics.totalProcessed++;
      this.metrics.pipelineLatency = totalTime;
      
      this.emit('pipelineComplete', {
        processingTime: totalTime,
        stagesProcessed: this.stages.length
      });
      
      return result;
    } catch (error) {
      this.emit('pipelineError', error);
      throw error;
    }
  }
  
  async processStage(stage, data, stageIndex) {
    this.emit('stageStart', { stage: stageIndex, data });
    
    try {
      const result = await stage(data);
      this.emit('stageComplete', { stage: stageIndex, result });
      return result;
    } catch (error) {
      this.emit('stageError', { stage: stageIndex, error });
      throw error;
    }
  }
  
  updateStageMetrics(stageIndex, processingTime) {
    if (!this.metrics.stageMetrics.has(stageIndex)) {
      this.metrics.stageMetrics.set(stageIndex, {
        processedCount: 0,
        totalTime: 0,
        averageTime: 0
      });
    }
    
    const metrics = this.metrics.stageMetrics.get(stageIndex);
    metrics.processedCount++;
    metrics.totalTime += processingTime;
    metrics.averageTime = metrics.totalTime / metrics.processedCount;
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      stageMetrics: Object.fromEntries(this.metrics.stageMetrics)
    };
  }
}

module.exports = {
  DataStreamOptimizer,
  OptimizedTransform,
  ParallelProcessingStream,
  BatchProcessingStream,
  OptimizedPipeline
};