const EventEmitter = require('events');
const { TransformationPipeline, PipelineBuilder } = require('./TransformationPipeline');
const {
  DataValidationStage,
  DataSanitizationStage,
  FieldMappingStage,
  DataAggregationStage,
  DataQualityCheckStage,
  DataEnrichmentStage
} = require('./stages');
const {
  SequentialExecutor,
  BatchExecutor,
  StreamExecutor,
  ParallelExecutor,
  ExecutionContext
} = require('./executors');
const logger = require('../../src/utils/logger');
const { performance } = require('perf_hooks');

/**
 * Mapping Validation Error
 */
class MappingValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'MappingValidationError';
    this.details = details;
  }
}

/**
 * Enhanced Mapping Engine
 * High-level interface for complex data transformations
 */
class EnhancedMappingEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableCache: options.enableCache || false,
      cacheSize: options.cacheSize || 1000,
      enableMetrics: options.enableMetrics !== false,
      defaultTimeout: options.defaultTimeout || 30000,
      maxConcurrency: options.maxConcurrency || 10,
      ...options
    };

    // Initialize components
    this.transformers = new Map();
    this.validators = new Map();
    this.executors = new Map();
    this.pipelines = new Map();
    this.cache = new Map();
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Load built-in transformations
    this.loadBuiltInTransformations();
    this.loadBuiltInValidators();
    this.loadBuiltInExecutors();
    
    // Setup cache cleanup
    if (this.options.enableCache) {
      this.setupCacheCleanup();
    }
  }

  /**
   * Load built-in transformation functions
   */
  loadBuiltInTransformations() {
    const transformLibrary = require('../../utils/transformLibrary');
    
    for (const [name, transform] of Object.entries(transformLibrary)) {
      this.transformers.set(name, transform);
    }
    
    logger.info(`Loaded ${this.transformers.size} built-in transformations`);
  }

  /**
   * Load built-in validators
   */
  loadBuiltInValidators() {
    // Basic validators
    this.validators.set('required', (value) => value !== null && value !== undefined && value !== '');
    this.validators.set('email', (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    this.validators.set('phone', (value) => /^\+?[\d\s-()]+$/.test(value));
    this.validators.set('number', (value) => !isNaN(Number(value)));
    this.validators.set('date', (value) => !isNaN(Date.parse(value)));
    
    logger.info(`Loaded ${this.validators.size} built-in validators`);
  }

  /**
   * Load built-in execution strategies
   */
  loadBuiltInExecutors() {
    // Sequential executor - processes records one by one
    this.executors.set('sequential', new SequentialExecutor({
      stopOnError: this.options.stopOnError
    }));
    
    // Batch executor - processes records in batches
    this.executors.set('batch', new BatchExecutor({
      batchSize: this.options.batchSize || 100,
      maxBatches: this.options.maxBatches,
      delayBetweenBatches: this.options.batchDelay || 0,
      stopOnBatchError: this.options.stopOnError,
      skipFailedRecords: this.options.skipFailedRecords
    }));
    
    // Stream executor - processes records as a stream
    this.executors.set('stream', new StreamExecutor({
      highWaterMark: this.options.streamHighWaterMark || 16,
      backpressureThreshold: this.options.backpressureThreshold || 100,
      stopOnError: this.options.stopOnError
    }));
    
    // Parallel executor - processes records concurrently
    this.executors.set('parallel', new ParallelExecutor({
      maxConcurrency: this.options.maxConcurrency || 10,
      chunkSize: this.options.chunkSize || 50,
      timeout: this.options.recordTimeout || 30000,
      stopOnChunkError: this.options.stopOnError,
      skipFailedRecords: this.options.skipFailedRecords
    }));
    
    // Set up event handlers for executors
    this.executors.forEach((executor, name) => {
      executor.on('progress', (progress) => {
        this.emit('executorProgress', { executor: name, ...progress });
      });
      
      executor.on('executionComplete', (stats) => {
        this.emit('executorComplete', { executor: name, ...stats });
      });
      
      executor.on('executionError', (error) => {
        this.emit('executorError', { executor: name, ...error });
      });
    });
    
    logger.info(`Loaded ${this.executors.size} built-in executors`);
  }

  /**
   * Execute mapping transformation
   * @param {Object} mapping - Mapping configuration
   * @param {*} sourceData - Source data
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Transformation result
   */
  async executeMapping(mapping, sourceData, options = {}) {
    const startTime = performance.now();
    const executionId = this.generateExecutionId();
    
    try {
      logger.info(`Starting mapping execution: ${executionId}`);
      
      // Validate inputs
      this.validateInputs(mapping, sourceData);
      
      // Create execution context
      const context = this.createExecutionContext(mapping, options, executionId);
      
      // Check cache
      if (this.options.enableCache && options.useCache !== false) {
        const cacheKey = this.generateCacheKey(mapping, sourceData);
        const cachedResult = this.cache.get(cacheKey);
        
        if (cachedResult) {
          this.metrics.cacheHits++;
          logger.debug(`Cache hit for execution: ${executionId}`);
          return cachedResult;
        }
        
        this.metrics.cacheMisses++;
      }
      
      // Get or create pipeline
      const pipeline = await this.getOrCreatePipeline(mapping, context);
      
      // Select execution strategy
      const executorType = options.executorType || this.selectExecutor(mapping, options);
      const executor = this.executors.get(executorType);
      
      if (!executor) {
        throw new MappingExecutionError(`Unknown executor type: ${executorType}`);
      }
      
      // Start execution context
      context.start();
      
      // Execute pipeline with selected strategy
      const result = await executor.execute(sourceData, pipeline, context);
      
      // Complete execution context
      context.complete(result);
      
      // Cache result
      if (this.options.enableCache && options.useCache !== false) {
        const cacheKey = this.generateCacheKey(mapping, sourceData);
        this.cache.set(cacheKey, result);
        this.cleanupCache();
      }
      
      // Update metrics
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, true);
      
      // Emit success event
      this.emit('mappingComplete', {
        executionId,
        mapping: mapping.id,
        executionTime,
        success: true,
        recordsProcessed: Array.isArray(sourceData) ? sourceData.length : 1
      });
      
      logger.info(`Mapping execution completed: ${executionId} in ${executionTime.toFixed(2)}ms`);
      
      return result;
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, false);
      
      // Fail the execution context if it was created
      if (context) {
        context.fail(error);
      }
      
      // Emit error event
      this.emit('mappingError', {
        executionId,
        mapping: mapping ? mapping.id : 'unknown',
        executionTime,
        error: error.message,
        success: false
      });
      
      logger.error(`Mapping execution failed: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Execute mapping in batch mode
   * @param {Object} mapping - Mapping configuration
   * @param {Array} dataArray - Array of source data
   * @param {Object} options - Batch execution options
   * @returns {Promise<Object>} - Batch execution result
   */
  async executeBatchMapping(mapping, dataArray, options = {}) {
    const {
      batchSize = 100,
      parallelism = 4,
      continueOnError = false,
      progressCallback
    } = options;
    
    logger.info(`Starting batch mapping execution: ${dataArray.length} items`);
    
    // Validate inputs
    this.validateInputs(mapping, dataArray);
    
    // Create execution context
    const context = this.createExecutionContext(mapping, { 
      ...options,
      executorType: 'batch' 
    });
    
    // Get or create pipeline
    const pipeline = await this.getOrCreatePipeline(mapping, context);
    
    // Get batch executor
    const batchExecutor = this.executors.get('batch');
    
    // Configure batch executor with options
    if (batchSize) {
      batchExecutor.batchSize = batchSize;
    }
    
    // Start execution context
    context.start();
    
    // Execute in batches
    const result = await batchExecutor.execute(dataArray, pipeline, context);
    
    // Complete execution context
    context.complete(result);
    
    const summary = context.getSummary();
    logger.info(`Batch mapping execution completed: ${summary.recordsProcessed} items processed`);
    
    return {
      totalProcessed: summary.recordsProcessed,
      successful: summary.recordsProcessed - summary.errors,
      failed: summary.errors,
      results: result,
      executionTime: summary.duration,
      errors: context.state.errors
    };
  }

  /**
   * Validate mapping and source data
   * @param {Object} mapping - Mapping configuration
   * @param {*} sourceData - Source data
   */
  validateInputs(mapping, sourceData) {
    if (!mapping) {
      throw new MappingValidationError('Mapping configuration is required');
    }
    
    if (!mapping.rules || !Array.isArray(mapping.rules)) {
      throw new MappingValidationError('Mapping rules are required and must be an array');
    }
    
    if (sourceData === null || sourceData === undefined) {
      throw new MappingValidationError('Source data is required');
    }
    
    // Validate source schema compatibility
    if (mapping.sourceSchema) {
      const validation = this.validateSourceData(mapping, sourceData);
      if (!validation.valid) {
        throw new MappingValidationError(
          `Source data validation failed: ${validation.errors.join(', ')}`,
          validation
        );
      }
    }
  }

  /**
   * Validate source data against mapping schema
   * @param {Object} mapping - Mapping configuration
   * @param {*} sourceData - Source data
   * @returns {Object} - Validation result
   */
  validateSourceData(mapping, sourceData) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Implement schema validation logic
    // This is a simplified version - in practice, you'd use a schema validation library
    
    return validation;
  }

  /**
   * Create execution context
   * @param {Object} mapping - Mapping configuration
   * @param {Object} options - Execution options
   * @param {string} executionId - Execution ID
   * @returns {Object} - Execution context
   */
  createExecutionContext(mapping, options, executionId) {
    return new ExecutionContext({
      id: executionId,
      source: mapping.sourceSchema?.name || 'unknown',
      target: mapping.targetSchema?.name || 'unknown',
      mappingId: mapping.id,
      executorType: options.executorType || this.selectExecutor(mapping, options),
      userId: options.userId,
      metadata: {
        mappingVersion: mapping.version,
        executionMode: options.executionMode || 'standard',
        ...options.metadata
      },
      config: {
        timeout: options.timeout || this.options.defaultTimeout,
        strictMode: options.strictMode || false,
        validateOutput: options.validateOutput !== false,
        enableProfiling: options.enableProfiling || false,
        ...options.config
      },
      onProgress: options.onProgress,
      onError: options.onError,
      onComplete: options.onComplete,
      onStateChange: options.onStateChange
    });
  }

  /**
   * Get or create pipeline for mapping
   * @param {Object} mapping - Mapping configuration
   * @param {Object} context - Execution context
   * @returns {Promise<TransformationPipeline>} - Pipeline instance
   */
  async getOrCreatePipeline(mapping, context) {
    const pipelineKey = this.generatePipelineKey(mapping);
    
    if (this.pipelines.has(pipelineKey)) {
      return this.pipelines.get(pipelineKey);
    }
    
    const pipeline = await this.buildPipeline(mapping, context);
    this.pipelines.set(pipelineKey, pipeline);
    
    return pipeline;
  }

  /**
   * Build transformation pipeline
   * @param {Object} mapping - Mapping configuration
   * @param {Object} context - Execution context
   * @returns {Promise<TransformationPipeline>} - Built pipeline
   */
  async buildPipeline(mapping, context) {
    const builder = new PipelineBuilder();
    
    // Configure pipeline based on mapping requirements
    builder.configure({
      timeout: context.config.timeout,
      strictMode: context.config.strictMode
    });
    
    // Add preprocessing stages
    if (mapping.preprocessing) {
      for (const stage of mapping.preprocessing) {
        builder.preprocessing(this.createPreprocessingStage(stage));
      }
    } else {
      // Default preprocessing
      builder.preprocessing(new DataValidationStage('inputValidation', {
        schema: mapping.sourceSchema,
        rules: mapping.validationRules || []
      }));
      
      builder.preprocessing(new DataSanitizationStage('dataSanitization', {
        sanitizers: mapping.sanitizers || [],
        normalizers: mapping.normalizers || []
      }));
    }
    
    // Add transformation stages
    builder.transformation(new FieldMappingStage('fieldMapping', {
      mappingRules: mapping.rules,
      defaultValues: mapping.defaultValues || {},
      strictMapping: context.config.strictMode
    }));
    
    // Add aggregation if needed
    if (mapping.aggregation) {
      builder.transformation(new DataAggregationStage('aggregation', {
        groupBy: mapping.aggregation.groupBy,
        aggregations: mapping.aggregation.rules
      }));
    }
    
    // Add validation stages
    if (mapping.qualityRules) {
      builder.validation(new DataQualityCheckStage('qualityCheck', {
        qualityRules: mapping.qualityRules,
        threshold: mapping.qualityThreshold || 0.8
      }));
    }
    
    // Add postprocessing stages
    if (mapping.postprocessing) {
      for (const stage of mapping.postprocessing) {
        builder.postprocessing(this.createPostprocessingStage(stage));
      }
    } else {
      // Default postprocessing
      builder.postprocessing(new DataEnrichmentStage('enrichment', {
        enrichmentRules: mapping.enrichmentRules || []
      }));
    }
    
    // Add error handlers
    builder.errorHandler('preprocessing', async (error, data, context) => {
      logger.warn(`Preprocessing error: ${error.message}`);
      return { continue: false };
    });
    
    builder.errorHandler('transformation', async (error, data, context) => {
      logger.warn(`Transformation error: ${error.message}`);
      return { continue: context.config.strictMode ? false : true, data };
    });
    
    builder.errorHandler('validation', async (error, data, context) => {
      logger.warn(`Validation error: ${error.message}`);
      return { continue: false };
    });
    
    builder.errorHandler('postprocessing', async (error, data, context) => {
      logger.warn(`Postprocessing error: ${error.message}`);
      return { continue: true, data };
    });
    
    // Add middleware for metrics and logging
    builder.use(async (data, context, phase) => {
      if (phase === 'before') {
        logger.debug(`Pipeline started for context: ${context.id}`);
      } else if (phase === 'after') {
        logger.debug(`Pipeline completed for context: ${context.id}`);
      }
      return data;
    });
    
    const pipeline = builder.build();
    
    // Setup pipeline event handlers
    pipeline.on('stageStart', (event) => {
      logger.debug(`Stage started: ${event.stage} (${event.type})`);
    });
    
    pipeline.on('stageComplete', (event) => {
      logger.debug(`Stage completed: ${event.stage} in ${event.executionTime}ms`);
    });
    
    pipeline.on('stageError', (event) => {
      logger.error(`Stage error: ${event.stage} - ${event.error}`);
    });
    
    return pipeline;
  }

  /**
   * Create preprocessing stage
   * @param {Object} stageConfig - Stage configuration
   * @returns {PipelineStage} - Stage instance
   */
  createPreprocessingStage(stageConfig) {
    switch (stageConfig.type) {
      case 'validation':
        return new DataValidationStage(stageConfig.name, stageConfig.options);
      case 'sanitization':
        return new DataSanitizationStage(stageConfig.name, stageConfig.options);
      default:
        throw new Error(`Unknown preprocessing stage type: ${stageConfig.type}`);
    }
  }

  /**
   * Create postprocessing stage
   * @param {Object} stageConfig - Stage configuration
   * @returns {PipelineStage} - Stage instance
   */
  createPostprocessingStage(stageConfig) {
    switch (stageConfig.type) {
      case 'enrichment':
        return new DataEnrichmentStage(stageConfig.name, stageConfig.options);
      default:
        throw new Error(`Unknown postprocessing stage type: ${stageConfig.type}`);
    }
  }

  /**
   * Select execution strategy
   * @param {string} mappingType - Mapping type
   * @returns {Object} - Executor instance
   */
  selectExecutor(mappingType) {
    switch (mappingType) {
      case 'batch':
        return this.executors.get('batch');
      case 'stream':
        return this.executors.get('stream');
      case 'parallel':
        return this.executors.get('parallel');
      default:
        return this.executors.get('sequential');
    }
  }


  /**
   * Generate execution ID
   * @returns {string} - Unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cache key
   * @param {Object} mapping - Mapping configuration
   * @param {*} sourceData - Source data
   * @returns {string} - Cache key
   */
  generateCacheKey(mapping, sourceData) {
    const mappingHash = this.hashObject(mapping);
    const dataHash = this.hashObject(sourceData);
    return `${mappingHash}_${dataHash}`;
  }

  /**
   * Generate pipeline key
   * @param {Object} mapping - Mapping configuration
   * @returns {string} - Pipeline key
   */
  generatePipelineKey(mapping) {
    return `${mapping.id}_${mapping.version || 'latest'}`;
  }

  /**
   * Hash object for caching
   * @param {*} obj - Object to hash
   * @returns {string} - Hash string
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Setup cache cleanup
   */
  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup cache
   */
  cleanupCache() {
    if (this.cache.size > this.options.cacheSize) {
      const entries = Array.from(this.cache.entries());
      const toDelete = entries.slice(0, entries.length - this.options.cacheSize);
      
      for (const [key] of toDelete) {
        this.cache.delete(key);
      }
      
      logger.debug(`Cache cleaned up: removed ${toDelete.length} entries`);
    }
  }

  /**
   * Update metrics
   * @param {number} executionTime - Execution time
   * @param {boolean} success - Success flag
   */
  updateMetrics(executionTime, success) {
    if (!this.options.enableMetrics) return;
    
    this.metrics.executionCount++;
    this.metrics.totalExecutionTime += executionTime;
    
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
    }
  }

  /**
   * Get engine metrics
   * @returns {Object} - Engine metrics
   */
  getMetrics() {
    return {
      engine: {
        ...this.metrics,
        averageExecutionTime: this.metrics.executionCount > 0 
          ? this.metrics.totalExecutionTime / this.metrics.executionCount 
          : 0,
        successRate: this.metrics.executionCount > 0 
          ? (this.metrics.successCount / this.metrics.executionCount) * 100 
          : 0,
        cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
          ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
          : 0
      },
      pipelines: Array.from(this.pipelines.values()).map(pipeline => 
        pipeline.getMetrics()
      )
    };
  }

  /**
   * Clear all caches and pipelines
   */
  clearCaches() {
    this.cache.clear();
    this.pipelines.clear();
    logger.info('All caches and pipelines cleared');
  }

  /**
   * Register custom transformer
   * @param {string} name - Transformer name
   * @param {Function} transformer - Transformer function
   */
  registerTransformer(name, transformer) {
    this.transformers.set(name, transformer);
    logger.info(`Registered custom transformer: ${name}`);
  }

  /**
   * Register custom validator
   * @param {string} name - Validator name
   * @param {Function} validator - Validator function
   */
  registerValidator(name, validator) {
    this.validators.set(name, validator);
    logger.info(`Registered custom validator: ${name}`);
  }

  /**
   * Register custom executor
   * @param {string} name - Executor name
   * @param {Object} executor - Executor instance
   */
  registerExecutor(name, executor) {
    this.executors.set(name, executor);
    logger.info(`Registered custom executor: ${name}`);
  }
}

module.exports = {
  EnhancedMappingEngine,
  MappingValidationError
};