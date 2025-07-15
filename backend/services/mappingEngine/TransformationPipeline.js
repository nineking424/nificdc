const EventEmitter = require('events');
const logger = require('../../src/utils/logger');
const { performance } = require('perf_hooks');

/**
 * Transformation Pipeline Stage Types
 */
const STAGE_TYPES = {
  PREPROCESSING: 'preprocessing',
  TRANSFORMATION: 'transformation',
  VALIDATION: 'validation',
  POSTPROCESSING: 'postprocessing'
};

/**
 * Pipeline Stage Interface
 * Base class for all pipeline stages
 */
class PipelineStage {
  constructor(name, type, options = {}) {
    this.name = name;
    this.type = type;
    this.options = options;
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      errorCount: 0,
      lastExecutionTime: null
    };
  }

  /**
   * Execute the stage
   * @param {*} data - Input data
   * @param {Object} context - Pipeline context
   * @returns {Promise<*>} - Transformed data
   */
  async execute(data, context) {
    throw new Error(`${this.constructor.name} must implement execute() method`);
  }

  /**
   * Validate stage configuration
   * @returns {boolean} - True if valid
   */
  validate() {
    return true;
  }

  /**
   * Get stage metrics
   * @returns {Object} - Stage metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageExecutionTime: this.metrics.executionCount > 0 
        ? this.metrics.totalExecutionTime / this.metrics.executionCount 
        : 0
    };
  }

  /**
   * Update metrics after execution
   * @param {number} executionTime - Execution time in milliseconds
   * @param {boolean} success - Whether execution was successful
   */
  updateMetrics(executionTime, success) {
    this.metrics.executionCount++;
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.lastExecutionTime = executionTime;
    
    if (!success) {
      this.metrics.errorCount++;
    }
  }
}

/**
 * Pipeline Context
 * Manages execution context and state across pipeline stages
 */
class PipelineContext {
  constructor(options = {}) {
    this.id = options.id || this.generateId();
    this.startTime = Date.now();
    this.metadata = options.metadata || {};
    this.state = new Map();
    this.errors = [];
    this.warnings = [];
    this.progressCallback = options.progressCallback;
    this.abortController = new AbortController();
    this.config = options.config || {};
  }

  /**
   * Generate unique context ID
   * @returns {string} - Unique ID
   */
  generateId() {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set state value
   * @param {string} key - State key
   * @param {*} value - State value
   */
  setState(key, value) {
    this.state.set(key, value);
  }

  /**
   * Get state value
   * @param {string} key - State key
   * @returns {*} - State value
   */
  getState(key) {
    return this.state.get(key);
  }

  /**
   * Add error to context
   * @param {Error} error - Error object
   * @param {string} stage - Stage name where error occurred
   */
  addError(error, stage) {
    this.errors.push({
      error,
      stage,
      timestamp: Date.now()
    });
  }

  /**
   * Add warning to context
   * @param {string} message - Warning message
   * @param {string} stage - Stage name where warning occurred
   */
  addWarning(message, stage) {
    this.warnings.push({
      message,
      stage,
      timestamp: Date.now()
    });
  }

  /**
   * Report progress
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {string} stage - Current stage
   */
  reportProgress(current, total, stage) {
    if (this.progressCallback) {
      this.progressCallback({
        current,
        total,
        stage,
        percentage: (current / total) * 100,
        contextId: this.id
      });
    }
  }

  /**
   * Check if pipeline should abort
   * @returns {boolean} - True if should abort
   */
  shouldAbort() {
    return this.abortController.signal.aborted;
  }

  /**
   * Abort pipeline execution
   */
  abort() {
    this.abortController.abort();
  }

  /**
   * Get execution summary
   * @returns {Object} - Execution summary
   */
  getSummary() {
    return {
      id: this.id,
      executionTime: Date.now() - this.startTime,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings,
      metadata: this.metadata
    };
  }
}

/**
 * Transformation Pipeline Builder
 * Fluent API for building transformation pipelines
 */
class PipelineBuilder {
  constructor() {
    this.stages = [];
    this.config = {};
    this.errorHandlers = new Map();
    this.middleware = [];
  }

  /**
   * Add preprocessing stage
   * @param {PipelineStage} stage - Preprocessing stage
   * @returns {PipelineBuilder} - Builder instance
   */
  preprocessing(stage) {
    if (!(stage instanceof PipelineStage)) {
      throw new Error('Stage must be instance of PipelineStage');
    }
    
    if (stage.type !== STAGE_TYPES.PREPROCESSING) {
      throw new Error('Stage must be of type PREPROCESSING');
    }
    
    this.stages.push(stage);
    return this;
  }

  /**
   * Add transformation stage
   * @param {PipelineStage} stage - Transformation stage
   * @returns {PipelineBuilder} - Builder instance
   */
  transformation(stage) {
    if (!(stage instanceof PipelineStage)) {
      throw new Error('Stage must be instance of PipelineStage');
    }
    
    if (stage.type !== STAGE_TYPES.TRANSFORMATION) {
      throw new Error('Stage must be of type TRANSFORMATION');
    }
    
    this.stages.push(stage);
    return this;
  }

  /**
   * Add validation stage
   * @param {PipelineStage} stage - Validation stage
   * @returns {PipelineBuilder} - Builder instance
   */
  validation(stage) {
    if (!(stage instanceof PipelineStage)) {
      throw new Error('Stage must be instance of PipelineStage');
    }
    
    if (stage.type !== STAGE_TYPES.VALIDATION) {
      throw new Error('Stage must be of type VALIDATION');
    }
    
    this.stages.push(stage);
    return this;
  }

  /**
   * Add postprocessing stage
   * @param {PipelineStage} stage - Postprocessing stage
   * @returns {PipelineBuilder} - Builder instance
   */
  postprocessing(stage) {
    if (!(stage instanceof PipelineStage)) {
      throw new Error('Stage must be instance of PipelineStage');
    }
    
    if (stage.type !== STAGE_TYPES.POSTPROCESSING) {
      throw new Error('Stage must be of type POSTPROCESSING');
    }
    
    this.stages.push(stage);
    return this;
  }

  /**
   * Add error handler for specific stage type
   * @param {string} stageType - Stage type
   * @param {Function} handler - Error handler function
   * @returns {PipelineBuilder} - Builder instance
   */
  errorHandler(stageType, handler) {
    this.errorHandlers.set(stageType, handler);
    return this;
  }

  /**
   * Add middleware
   * @param {Function} middleware - Middleware function
   * @returns {PipelineBuilder} - Builder instance
   */
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Set pipeline configuration
   * @param {Object} config - Configuration object
   * @returns {PipelineBuilder} - Builder instance
   */
  configure(config) {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Build the pipeline
   * @returns {TransformationPipeline} - Built pipeline
   */
  build() {
    return new TransformationPipeline(this.stages, {
      config: this.config,
      errorHandlers: this.errorHandlers,
      middleware: this.middleware
    });
  }
}

/**
 * Transformation Pipeline
 * Main pipeline executor with stage management and error handling
 */
class TransformationPipeline extends EventEmitter {
  constructor(stages = [], options = {}) {
    super();
    this.stages = stages;
    this.config = options.config || {};
    this.errorHandlers = options.errorHandlers || new Map();
    this.middleware = options.middleware || [];
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      successCount: 0,
      errorCount: 0,
      lastExecutionTime: null
    };
    
    this.validatePipeline();
  }

  /**
   * Validate pipeline configuration
   * @throws {Error} - If pipeline is invalid
   */
  validatePipeline() {
    if (this.stages.length === 0) {
      throw new Error('Pipeline must have at least one stage');
    }

    // Validate stage order
    const stageOrder = [
      STAGE_TYPES.PREPROCESSING,
      STAGE_TYPES.TRANSFORMATION,
      STAGE_TYPES.VALIDATION,
      STAGE_TYPES.POSTPROCESSING
    ];

    let lastStageIndex = -1;
    for (const stage of this.stages) {
      if (!stage.validate()) {
        throw new Error(`Stage ${stage.name} failed validation`);
      }

      const currentStageIndex = stageOrder.indexOf(stage.type);
      if (currentStageIndex < lastStageIndex) {
        throw new Error(`Invalid stage order: ${stage.type} cannot come after ${stageOrder[lastStageIndex]}`);
      }
      lastStageIndex = Math.max(lastStageIndex, currentStageIndex);
    }
  }

  /**
   * Execute pipeline on data
   * @param {*} data - Input data
   * @param {Object} contextOptions - Context options
   * @returns {Promise<Object>} - Execution result
   */
  async execute(data, contextOptions = {}) {
    const startTime = performance.now();
    const context = new PipelineContext(contextOptions);
    
    try {
      logger.info(`Starting pipeline execution: ${context.id}`);
      this.emit('pipelineStart', { contextId: context.id, data });
      
      let currentData = data;
      
      // Execute middleware before pipeline
      for (const middleware of this.middleware) {
        currentData = await middleware(currentData, context, 'before');
      }
      
      // Execute pipeline stages
      for (let i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i];
        
        if (context.shouldAbort()) {
          throw new Error('Pipeline execution aborted');
        }
        
        context.reportProgress(i, this.stages.length, stage.name);
        
        try {
          const stageStartTime = performance.now();
          
          logger.debug(`Executing stage: ${stage.name} (${stage.type})`);
          this.emit('stageStart', { 
            contextId: context.id, 
            stage: stage.name, 
            type: stage.type 
          });
          
          currentData = await stage.execute(currentData, context);
          
          const stageExecutionTime = performance.now() - stageStartTime;
          stage.updateMetrics(stageExecutionTime, true);
          
          this.emit('stageComplete', { 
            contextId: context.id, 
            stage: stage.name, 
            type: stage.type,
            executionTime: stageExecutionTime
          });
          
          logger.debug(`Stage ${stage.name} completed in ${stageExecutionTime.toFixed(2)}ms`);
          
        } catch (error) {
          const stageExecutionTime = performance.now() - startTime;
          stage.updateMetrics(stageExecutionTime, false);
          
          context.addError(error, stage.name);
          
          this.emit('stageError', { 
            contextId: context.id, 
            stage: stage.name, 
            type: stage.type,
            error: error.message 
          });
          
          // Try to handle error
          const errorHandler = this.errorHandlers.get(stage.type);
          if (errorHandler) {
            const handlerResult = await errorHandler(error, currentData, context);
            if (handlerResult.continue) {
              currentData = handlerResult.data;
              continue;
            }
          }
          
          throw error;
        }
      }
      
      // Execute middleware after pipeline
      for (const middleware of this.middleware) {
        currentData = await middleware(currentData, context, 'after');
      }
      
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, true);
      
      const result = {
        data: currentData,
        context: context.getSummary(),
        executionTime,
        success: true
      };
      
      logger.info(`Pipeline execution completed: ${context.id} in ${executionTime.toFixed(2)}ms`);
      this.emit('pipelineComplete', result);
      
      return result;
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, false);
      
      const result = {
        data: null,
        context: context.getSummary(),
        executionTime,
        success: false,
        error: error.message
      };
      
      logger.error(`Pipeline execution failed: ${context.id}`, error);
      this.emit('pipelineError', result);
      
      throw error;
    }
  }

  /**
   * Execute pipeline in batch mode
   * @param {Array} dataArray - Array of data items
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} - Array of results
   */
  async executeBatch(dataArray, options = {}) {
    const {
      batchSize = 100,
      parallelism = 1,
      continueOnError = false,
      progressCallback
    } = options;
    
    const results = [];
    const errors = [];
    
    logger.info(`Starting batch execution: ${dataArray.length} items, batch size: ${batchSize}, parallelism: ${parallelism}`);
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const batchPromises = [];
      
      for (let j = 0; j < batch.length; j += Math.ceil(batch.length / parallelism)) {
        const subBatch = batch.slice(j, j + Math.ceil(batch.length / parallelism));
        
        const batchPromise = this.processBatch(subBatch, {
          batchIndex: Math.floor(i / batchSize),
          totalBatches: Math.ceil(dataArray.length / batchSize),
          continueOnError,
          progressCallback
        });
        
        batchPromises.push(batchPromise);
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const batchResult of batchResults) {
        results.push(...batchResult.results);
        errors.push(...batchResult.errors);
      }
    }
    
    return {
      results,
      errors,
      totalProcessed: dataArray.length,
      successCount: results.filter(r => r.success).length,
      errorCount: errors.length
    };
  }

  /**
   * Process a batch of data
   * @param {Array} batch - Batch of data items
   * @param {Object} options - Batch options
   * @returns {Promise<Object>} - Batch result
   */
  async processBatch(batch, options = {}) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < batch.length; i++) {
      try {
        const result = await this.execute(batch[i], {
          metadata: {
            batchIndex: options.batchIndex,
            itemIndex: i,
            totalBatches: options.totalBatches
          },
          progressCallback: options.progressCallback
        });
        
        results.push(result);
        
      } catch (error) {
        errors.push({
          itemIndex: i,
          data: batch[i],
          error: error.message,
          timestamp: Date.now()
        });
        
        if (!options.continueOnError) {
          break;
        }
      }
    }
    
    return { results, errors };
  }

  /**
   * Get pipeline metrics
   * @returns {Object} - Pipeline metrics
   */
  getMetrics() {
    return {
      pipeline: {
        ...this.metrics,
        averageExecutionTime: this.metrics.executionCount > 0 
          ? this.metrics.totalExecutionTime / this.metrics.executionCount 
          : 0,
        successRate: this.metrics.executionCount > 0 
          ? (this.metrics.successCount / this.metrics.executionCount) * 100 
          : 0
      },
      stages: this.stages.map(stage => ({
        name: stage.name,
        type: stage.type,
        ...stage.getMetrics()
      }))
    };
  }

  /**
   * Update pipeline metrics
   * @param {number} executionTime - Execution time
   * @param {boolean} success - Success flag
   */
  updateMetrics(executionTime, success) {
    this.metrics.executionCount++;
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.lastExecutionTime = executionTime;
    
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
    }
  }

  /**
   * Add stage to pipeline
   * @param {PipelineStage} stage - Stage to add
   */
  addStage(stage) {
    this.stages.push(stage);
    this.validatePipeline();
  }

  /**
   * Remove stage from pipeline
   * @param {string} stageName - Name of stage to remove
   */
  removeStage(stageName) {
    this.stages = this.stages.filter(stage => stage.name !== stageName);
  }

  /**
   * Get stage by name
   * @param {string} stageName - Stage name
   * @returns {PipelineStage} - Stage instance
   */
  getStage(stageName) {
    return this.stages.find(stage => stage.name === stageName);
  }

  /**
   * Clear all stages
   */
  clearStages() {
    this.stages = [];
  }
}

module.exports = {
  TransformationPipeline,
  PipelineBuilder,
  PipelineStage,
  PipelineContext,
  STAGE_TYPES
};