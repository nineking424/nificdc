const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const logger = require('../../../src/utils/logger');

/**
 * Base Execution Strategy
 * Abstract base class for all execution strategies
 */
class ExecutionStrategy extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.options = options;
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      recordsProcessed: 0,
      errors: 0,
      lastExecutionTime: null,
      averageExecutionTime: 0
    };
  }

  /**
   * Execute transformation pipeline on data
   * @param {*} data - Input data
   * @param {TransformationPipeline} pipeline - Transformation pipeline
   * @param {Object} context - Execution context
   * @returns {Promise<*>} - Transformed data
   */
  async execute(data, pipeline, context) {
    const startTime = performance.now();
    
    try {
      // Validate inputs
      this.validateInputs(data, pipeline, context);
      
      // Pre-execution setup
      await this.preExecute(data, pipeline, context);
      
      // Execute strategy-specific logic
      const result = await this.doExecute(data, pipeline, context);
      
      // Post-execution cleanup
      await this.postExecute(result, pipeline, context);
      
      // Update metrics
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, result);
      
      // Emit completion event
      this.emit('executionComplete', {
        strategy: this.name,
        executionTime,
        recordsProcessed: this.getRecordCount(result),
        success: true
      });
      
      return result;
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.metrics.errors++;
      
      // Emit error event
      this.emit('executionError', {
        strategy: this.name,
        executionTime,
        error: error.message,
        success: false
      });
      
      throw error;
    }
  }

  /**
   * Validate inputs before execution
   */
  validateInputs(data, pipeline, context) {
    if (!pipeline) {
      throw new Error('Pipeline is required for execution');
    }
    
    if (!context) {
      throw new Error('Execution context is required');
    }
    
    // Strategy-specific validation
    this.validateStrategyInputs(data, pipeline, context);
  }

  /**
   * Strategy-specific input validation (to be overridden)
   */
  validateStrategyInputs(data, pipeline, context) {
    // Override in subclasses
  }

  /**
   * Pre-execution setup (to be overridden)
   */
  async preExecute(data, pipeline, context) {
    // Override in subclasses for setup
  }

  /**
   * Execute strategy-specific logic (must be overridden)
   */
  async doExecute(data, pipeline, context) {
    throw new Error(`${this.constructor.name} must implement doExecute() method`);
  }

  /**
   * Post-execution cleanup (to be overridden)
   */
  async postExecute(result, pipeline, context) {
    // Override in subclasses for cleanup
  }

  /**
   * Update execution metrics
   */
  updateMetrics(executionTime, result) {
    this.metrics.executionCount++;
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.lastExecutionTime = executionTime;
    this.metrics.recordsProcessed += this.getRecordCount(result);
    this.metrics.averageExecutionTime = 
      this.metrics.totalExecutionTime / this.metrics.executionCount;
  }

  /**
   * Get record count from result
   */
  getRecordCount(result) {
    if (Array.isArray(result)) {
      return result.length;
    }
    return result ? 1 : 0;
  }

  /**
   * Get execution metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.executionCount > 0 
        ? (this.metrics.errors / this.metrics.executionCount) * 100
        : 0
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      recordsProcessed: 0,
      errors: 0,
      lastExecutionTime: null,
      averageExecutionTime: 0
    };
  }
}

/**
 * Sequential Execution Strategy
 * Processes records one by one in order
 */
class SequentialExecutor extends ExecutionStrategy {
  constructor(options = {}) {
    super('sequential', options);
    this.stopOnError = options.stopOnError !== false;
  }

  validateStrategyInputs(data, pipeline, context) {
    if (!data) {
      throw new Error('Data is required for sequential execution');
    }
  }

  async doExecute(data, pipeline, context) {
    const records = Array.isArray(data) ? data : [data];
    const results = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        // Update context with current record info
        const recordContext = {
          ...context,
          recordIndex: i,
          totalRecords: records.length,
          progress: ((i + 1) / records.length) * 100
        };

        // Execute pipeline for current record
        const result = await pipeline.execute(records[i], recordContext);
        results.push(result);

        // Emit progress event
        this.emit('progress', {
          current: i + 1,
          total: records.length,
          percentage: recordContext.progress
        });

      } catch (error) {
        const errorInfo = {
          recordIndex: i,
          record: records[i],
          error: error.message,
          stack: error.stack
        };
        
        errors.push(errorInfo);
        
        if (this.stopOnError) {
          throw new Error(
            `Sequential execution failed at record ${i}: ${error.message}`
          );
        }
      }
    }

    // Return results with error information if any
    if (errors.length > 0) {
      context.executionErrors = errors;
      logger.warn(`Sequential execution completed with ${errors.length} errors`);
    }

    return Array.isArray(data) ? results : results[0];
  }
}

/**
 * Batch Execution Strategy
 * Processes records in configurable batches
 */
class BatchExecutor extends ExecutionStrategy {
  constructor(options = {}) {
    super('batch', options);
    this.batchSize = options.batchSize || 100;
    this.maxBatches = options.maxBatches || Infinity;
    this.delayBetweenBatches = options.delayBetweenBatches || 0;
  }

  validateStrategyInputs(data, pipeline, context) {
    if (!Array.isArray(data)) {
      throw new Error('Batch execution requires an array of records');
    }
    
    if (data.length === 0) {
      throw new Error('Batch execution requires at least one record');
    }
  }

  async doExecute(data, pipeline, context) {
    const totalRecords = data.length;
    const totalBatches = Math.ceil(totalRecords / this.batchSize);
    const batchesToProcess = Math.min(totalBatches, this.maxBatches);
    const results = [];
    const errors = [];

    logger.info(`Starting batch execution: ${totalRecords} records in ${batchesToProcess} batches`);

    for (let batchIndex = 0; batchIndex < batchesToProcess; batchIndex++) {
      const startIdx = batchIndex * this.batchSize;
      const endIdx = Math.min(startIdx + this.batchSize, totalRecords);
      const batch = data.slice(startIdx, endIdx);

      try {
        // Create batch context
        const batchContext = {
          ...context,
          batchIndex,
          totalBatches: batchesToProcess,
          batchSize: batch.length,
          startIndex: startIdx,
          endIndex: endIdx - 1,
          progress: ((batchIndex + 1) / batchesToProcess) * 100
        };

        // Process batch
        const batchStartTime = performance.now();
        const batchResults = await this.processBatch(batch, pipeline, batchContext);
        const batchExecutionTime = performance.now() - batchStartTime;

        results.push(...batchResults);

        // Emit batch completion event
        this.emit('batchComplete', {
          batchIndex,
          totalBatches: batchesToProcess,
          recordsProcessed: batch.length,
          executionTime: batchExecutionTime,
          progress: batchContext.progress
        });

        // Delay between batches if configured
        if (this.delayBetweenBatches > 0 && batchIndex < batchesToProcess - 1) {
          await this.delay(this.delayBetweenBatches);
        }

      } catch (error) {
        const errorInfo = {
          batchIndex,
          startIndex: startIdx,
          endIndex: endIdx - 1,
          error: error.message,
          stack: error.stack
        };
        
        errors.push(errorInfo);
        
        if (this.options.stopOnBatchError) {
          throw new Error(
            `Batch execution failed at batch ${batchIndex}: ${error.message}`
          );
        }
      }
    }

    // Add error information to context
    if (errors.length > 0) {
      context.batchErrors = errors;
      logger.warn(`Batch execution completed with ${errors.length} batch errors`);
    }

    return results;
  }

  async processBatch(batch, pipeline, context) {
    const results = [];
    
    for (let i = 0; i < batch.length; i++) {
      try {
        const recordContext = {
          ...context,
          recordIndexInBatch: i,
          globalRecordIndex: context.startIndex + i
        };
        
        const result = await pipeline.execute(batch[i], recordContext);
        results.push(result);
        
      } catch (error) {
        if (this.options.skipFailedRecords) {
          logger.warn(`Skipping failed record in batch ${context.batchIndex}, record ${i}: ${error.message}`);
          results.push({
            error: true,
            message: error.message,
            originalRecord: batch[i]
          });
        } else {
          throw error;
        }
      }
    }
    
    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Stream Execution Strategy
 * Processes records as a continuous stream
 */
class StreamExecutor extends ExecutionStrategy {
  constructor(options = {}) {
    super('stream', options);
    this.highWaterMark = options.highWaterMark || 16;
    this.backpressureThreshold = options.backpressureThreshold || 100;
    this.queue = [];
    this.processing = false;
    this.paused = false;
  }

  validateStrategyInputs(data, pipeline, context) {
    // Stream executor can handle various input types
    if (data === null || data === undefined) {
      throw new Error('Data is required for stream execution');
    }
  }

  async doExecute(data, pipeline, context) {
    const records = Array.isArray(data) ? data : [data];
    
    // Initialize stream processing
    this.queue = [...records];
    this.processing = true;
    this.paused = false;
    
    const results = [];
    const errors = [];
    let processedCount = 0;

    // Process stream
    while (this.queue.length > 0 || this.processing) {
      if (this.paused) {
        await this.delay(100); // Wait for unpause
        continue;
      }

      // Check backpressure
      if (results.length >= this.backpressureThreshold) {
        this.emit('backpressure', {
          queueSize: this.queue.length,
          resultsSize: results.length
        });
        await this.handleBackpressure(results, context);
      }

      // Get next batch to process
      const batch = this.queue.splice(0, this.highWaterMark);
      if (batch.length === 0) {
        break;
      }

      // Process batch concurrently
      const batchPromises = batch.map(async (record, index) => {
        try {
          const recordContext = {
            ...context,
            streamIndex: processedCount + index,
            inFlight: batch.length
          };
          
          const result = await pipeline.execute(record, recordContext);
          return { success: true, result };
          
        } catch (error) {
          return { 
            success: false, 
            error: {
              record,
              message: error.message,
              index: processedCount + index
            }
          };
        }
      });

      // Wait for batch completion
      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      for (const item of batchResults) {
        if (item.success) {
          results.push(item.result);
        } else {
          errors.push(item.error);
          if (this.options.stopOnError) {
            this.processing = false;
            throw new Error(
              `Stream execution failed: ${item.error.message}`
            );
          }
        }
      }

      processedCount += batch.length;

      // Emit progress
      this.emit('streamProgress', {
        processed: processedCount,
        remaining: this.queue.length,
        errors: errors.length
      });
    }

    // Add error information to context
    if (errors.length > 0) {
      context.streamErrors = errors;
      logger.warn(`Stream execution completed with ${errors.length} errors`);
    }

    return Array.isArray(data) ? results : results[0];
  }

  async handleBackpressure(results, context) {
    // Implement backpressure handling
    if (this.options.onBackpressure) {
      await this.options.onBackpressure(results, context);
    } else {
      // Default: wait for consumer to process some results
      await this.delay(100);
    }
  }

  pause() {
    this.paused = true;
    this.emit('paused');
  }

  resume() {
    this.paused = false;
    this.emit('resumed');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parallel Execution Strategy
 * Processes records concurrently with configurable parallelism
 */
class ParallelExecutor extends ExecutionStrategy {
  constructor(options = {}) {
    super('parallel', options);
    this.maxConcurrency = options.maxConcurrency || 10;
    this.chunkSize = options.chunkSize || 50;
    this.timeout = options.timeout || 30000; // 30 seconds default
  }

  validateStrategyInputs(data, pipeline, context) {
    if (!Array.isArray(data)) {
      throw new Error('Parallel execution requires an array of records');
    }
  }

  async doExecute(data, pipeline, context) {
    if (data.length === 0) {
      return [];
    }

    const chunks = this.createChunks(data, this.chunkSize);
    const results = new Array(data.length);
    const errors = [];

    logger.info(`Starting parallel execution: ${data.length} records in ${chunks.length} chunks with max concurrency ${this.maxConcurrency}`);

    // Process chunks with limited concurrency
    const chunkPromises = [];
    let activeChunks = 0;
    let chunkIndex = 0;

    while (chunkIndex < chunks.length || activeChunks > 0) {
      // Start new chunks up to max concurrency
      while (activeChunks < this.maxConcurrency && chunkIndex < chunks.length) {
        const currentChunkIndex = chunkIndex;
        const chunk = chunks[currentChunkIndex];
        
        const chunkPromise = this.processChunk(
          chunk,
          currentChunkIndex,
          chunks.length,
          pipeline,
          context
        ).then(chunkResults => {
          // Place results in correct positions
          const startIdx = currentChunkIndex * this.chunkSize;
          for (let i = 0; i < chunkResults.length; i++) {
            results[startIdx + i] = chunkResults[i];
          }
          activeChunks--;
        }).catch(error => {
          errors.push({
            chunkIndex: currentChunkIndex,
            error: error.message,
            stack: error.stack
          });
          activeChunks--;
          
          if (this.options.stopOnChunkError) {
            throw error;
          }
        });

        chunkPromises.push(chunkPromise);
        activeChunks++;
        chunkIndex++;
      }

      // Wait for at least one chunk to complete
      if (activeChunks > 0) {
        await Promise.race(chunkPromises.filter(p => p));
      }
    }

    // Wait for all remaining chunks
    await Promise.all(chunkPromises);

    // Add error information to context
    if (errors.length > 0) {
      context.parallelErrors = errors;
      logger.warn(`Parallel execution completed with ${errors.length} chunk errors`);
    }

    return results;
  }

  async processChunk(chunk, chunkIndex, totalChunks, pipeline, context) {
    const chunkStartTime = performance.now();
    
    const chunkContext = {
      ...context,
      chunkIndex,
      totalChunks,
      chunkSize: chunk.data.length,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex
    };

    // Process records in chunk concurrently
    const recordPromises = chunk.data.map(async (record, index) => {
      const recordContext = {
        ...chunkContext,
        recordIndexInChunk: index,
        globalRecordIndex: chunk.startIndex + index
      };

      try {
        // Add timeout to individual record processing
        const result = await this.withTimeout(
          pipeline.execute(record, recordContext),
          this.timeout,
          `Record ${recordContext.globalRecordIndex} processing timeout`
        );
        
        return result;
        
      } catch (error) {
        if (this.options.skipFailedRecords) {
          logger.warn(`Failed to process record ${recordContext.globalRecordIndex}: ${error.message}`);
          return {
            error: true,
            message: error.message,
            originalRecord: record
          };
        }
        throw error;
      }
    });

    const results = await Promise.all(recordPromises);
    const chunkExecutionTime = performance.now() - chunkStartTime;

    // Emit chunk completion
    this.emit('chunkComplete', {
      chunkIndex,
      totalChunks,
      recordsProcessed: chunk.data.length,
      executionTime: chunkExecutionTime,
      progress: ((chunkIndex + 1) / totalChunks) * 100
    });

    return results;
  }

  createChunks(data, chunkSize) {
    const chunks = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push({
        data: data.slice(i, i + chunkSize),
        startIndex: i,
        endIndex: Math.min(i + chunkSize - 1, data.length - 1)
      });
    }
    
    return chunks;
  }

  async withTimeout(promise, timeout, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeout);
      })
    ]);
  }
}

/**
 * Factory function to create execution strategies
 */
function createExecutor(type, options = {}) {
  switch (type) {
    case 'sequential':
      return new SequentialExecutor(options);
    case 'batch':
      return new BatchExecutor(options);
    case 'stream':
      return new StreamExecutor(options);
    case 'parallel':
      return new ParallelExecutor(options);
    default:
      throw new Error(`Unknown executor type: ${type}`);
  }
}

module.exports = {
  ExecutionStrategy,
  SequentialExecutor,
  BatchExecutor,
  StreamExecutor,
  ParallelExecutor,
  createExecutor
};