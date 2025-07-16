const { EnhancedMappingEngine } = require('../mappingEngine/EnhancedMappingEngine');
const { ValidationFramework } = require('../mappingEngine/validation');
const { Mapping, System, DataSchema } = require('../../models');
const logger = require('../../src/utils/logger');
const EventEmitter = require('events');

/**
 * Enhanced Mapping Service
 * Provides high-level service methods for enhanced mapping operations
 */
class EnhancedMappingService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      autoInitialize: options.autoInitialize !== false,
      engineOptions: {
        enableCache: true,
        cacheSize: 10000,
        enableMetrics: true,
        defaultTimeout: 60000,
        maxConcurrency: 20,
        enableMemoryManagement: true,
        enableDataCompression: true,
        enableConnectionPooling: true,
        enableBatchOptimization: true,
        enablePerformanceOptimization: true,
        memoryThreshold: 0.8,
        compressionThreshold: 2048,
        ...options.engineOptions
      },
      ...options
    };
    
    this.engine = null;
    this.validationFramework = null;
    this.connectionPools = new Map();
    this.activeExecutions = new Map();
    this.executionHistory = [];
    this.isInitialized = false;
    
    if (this.options.autoInitialize) {
      this.initialize().catch(error => {
        logger.error('Failed to auto-initialize Enhanced Mapping Service:', error);
      });
    }
  }
  
  /**
   * Initialize the service
   */
  async initialize() {
    if (this.isInitialized) {
      return this;
    }
    
    try {
      // Initialize enhanced mapping engine
      this.engine = new EnhancedMappingEngine(this.options.engineOptions);
      
      // Initialize validation framework
      this.validationFramework = new ValidationFramework({
        enableCaching: true,
        strictMode: false
      });
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('Enhanced Mapping Service initialized successfully');
      return this;
    } catch (error) {
      logger.error('Failed to initialize Enhanced Mapping Service:', error);
      throw error;
    }
  }
  
  /**
   * Setup event handlers for engine events
   */
  setupEventHandlers() {
    if (!this.engine) return;
    
    // Engine events
    this.engine.on('mappingComplete', (event) => {
      this.handleExecutionComplete(event);
      this.emit('executionComplete', event);
    });
    
    this.engine.on('mappingError', (event) => {
      this.handleExecutionError(event);
      this.emit('executionError', event);
    });
    
    this.engine.on('errorRecovered', (event) => {
      logger.info('Error recovered in mapping execution:', event);
      this.emit('errorRecovered', event);
    });
    
    this.engine.on('memoryPressure', (event) => {
      logger.warn('Memory pressure detected:', event);
      this.emit('memoryPressure', event);
    });
    
    this.engine.on('performanceWarning', (event) => {
      logger.warn('Performance warning:', event);
      this.emit('performanceWarning', event);
    });
  }
  
  /**
   * Execute enhanced mapping
   */
  async executeMapping(mappingId, sourceData, options = {}) {
    await this.ensureInitialized();
    
    const executionId = this.generateExecutionId();
    
    try {
      // Get mapping configuration
      const mapping = await this.getMappingConfiguration(mappingId);
      
      // Validate mapping is active
      if (!mapping.isActive) {
        throw new Error(`Mapping ${mappingId} is not active`);
      }
      
      // Prepare enhanced mapping configuration
      const enhancedMapping = this.prepareEnhancedMapping(mapping);
      
      // Prepare execution options
      const executionOptions = {
        executionId,
        userId: options.userId,
        enablePerformanceOptimization: options.enablePerformanceOptimization !== false,
        enableCache: options.enableCache !== false,
        enableRollback: options.enableRollback !== false,
        timeout: options.timeout || this.options.engineOptions.defaultTimeout,
        executorType: options.executorType,
        metadata: {
          mappingId,
          requestId: options.requestId,
          ...options.metadata
        },
        onProgress: (progress) => {
          this.emit('executionProgress', { executionId, ...progress });
        },
        onComplete: (result) => {
          this.handleExecutionComplete({ executionId, mappingId, result });
        },
        onError: (error) => {
          this.handleExecutionError({ executionId, mappingId, error });
        }
      };
      
      // Track active execution
      this.activeExecutions.set(executionId, {
        mappingId,
        startTime: Date.now(),
        options: executionOptions,
        status: 'running'
      });
      
      // Execute mapping
      const result = await this.engine.executeMapping(enhancedMapping, sourceData, executionOptions);
      
      // Update execution tracking
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'completed';
        execution.endTime = Date.now();
        execution.result = result;
      }
      
      return {
        executionId,
        result,
        mappingId,
        success: true,
        timestamp: new Date()
      };
      
    } catch (error) {
      // Update execution tracking
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'failed';
        execution.endTime = Date.now();
        execution.error = error.message;
      }
      
      logger.error('Enhanced mapping execution failed:', {
        executionId,
        mappingId,
        error: error.message
      });
      
      throw error;
    } finally {
      // Move to history and cleanup
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        this.executionHistory.push(execution);
        this.activeExecutions.delete(executionId);
        
        // Keep only last 1000 executions
        if (this.executionHistory.length > 1000) {
          this.executionHistory = this.executionHistory.slice(-1000);
        }
      }
    }
  }
  
  /**
   * Execute batch mapping
   */
  async executeBatchMapping(mappingId, dataArray, options = {}) {
    await this.ensureInitialized();
    
    const executionId = this.generateExecutionId();
    
    try {
      // Get mapping configuration
      const mapping = await this.getMappingConfiguration(mappingId);
      
      if (!mapping.isActive) {
        throw new Error(`Mapping ${mappingId} is not active`);
      }
      
      // Prepare enhanced mapping configuration
      const enhancedMapping = this.prepareEnhancedMapping(mapping);
      
      // Execute batch mapping
      const result = await this.engine.executeBatchMapping(enhancedMapping, dataArray, {
        batchSize: options.batchSize || 100,
        parallelism: options.parallelism || 4,
        continueOnError: options.continueOnError || false,
        userId: options.userId,
        progressCallback: (progress) => {
          this.emit('batchProgress', { executionId, mappingId, ...progress });
        },
        ...options
      });
      
      return {
        executionId,
        result,
        mappingId,
        success: true,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Batch mapping execution failed:', {
        executionId,
        mappingId,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Process data with streaming
   */
  async processWithStreaming(mappingId, data, options = {}) {
    await this.ensureInitialized();
    
    try {
      // Get mapping configuration for transform function
      const mapping = await this.getMappingConfiguration(mappingId);
      
      // Create transform function from mapping rules
      const transformFunction = this.createTransformFunction(mapping);
      
      // Execute streaming processing
      const result = await this.engine.processWithStreaming(data, transformFunction, {
        highWaterMark: options.highWaterMark || 16384,
        maxConcurrency: options.maxConcurrency || 10,
        enableBackpressureControl: options.enableBackpressureControl !== false,
        enableAdaptiveBuffering: options.enableAdaptiveBuffering !== false,
        ...options
      });
      
      return {
        mappingId,
        result,
        success: true,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Stream processing failed:', {
        mappingId,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Validate mapping configuration
   */
  async validateMapping(mappingId, options = {}) {
    await this.ensureInitialized();
    
    try {
      // Get mapping configuration
      const mapping = await this.getMappingConfiguration(mappingId);
      
      // Prepare enhanced mapping configuration
      const enhancedMapping = this.prepareEnhancedMapping(mapping);
      
      // Perform validation
      const validationResult = await this.validationFramework.validateMapping(enhancedMapping, {
        level: options.level || 'standard',
        sampleData: options.sampleData,
        checkPerformance: options.checkPerformance !== false,
        checkCompatibility: options.checkCompatibility !== false
      });
      
      // Additional analysis
      const complexityAnalysis = this.engine.calculateMappingComplexity(enhancedMapping);
      const resourceAnalysis = this.engine.getSystemResources();
      const optimizationRecommendation = this.engine.performanceOptimizer.optimizeExecutionStrategy(
        options.estimatedDataSize || 1000,
        complexityAnalysis,
        resourceAnalysis
      );
      
      return {
        mappingId,
        validation: validationResult,
        analysis: {
          complexity: complexityAnalysis,
          systemResources: resourceAnalysis,
          recommendations: optimizationRecommendation
        },
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Mapping validation failed:', {
        mappingId,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Create connection pool
   */
  async createConnectionPool(name, factory, options = {}) {
    await this.ensureInitialized();
    
    try {
      const pool = this.engine.createConnectionPool(name, factory, options);
      this.connectionPools.set(name, {
        pool,
        factory,
        options,
        createdAt: new Date()
      });
      
      logger.info(`Connection pool created: ${name}`);
      return pool;
    } catch (error) {
      logger.error(`Failed to create connection pool ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Get connection pool
   */
  getConnectionPool(name) {
    const poolInfo = this.connectionPools.get(name);
    return poolInfo ? poolInfo.pool : null;
  }
  
  /**
   * Execute with database connection
   */
  async executeWithConnection(poolName, queryFunction) {
    await this.ensureInitialized();
    return await this.engine.executeWithConnection(poolName, queryFunction);
  }
  
  /**
   * Get service metrics
   */
  getMetrics() {
    if (!this.isInitialized || !this.engine) {
      return {
        initialized: false,
        error: 'Service not initialized'
      };
    }
    
    const engineMetrics = this.engine.getMetrics();
    const errorMetrics = this.engine.getErrorMetrics();
    const rollbackStats = this.engine.getRollbackStats();
    
    return {
      initialized: true,
      service: {
        activeExecutions: this.activeExecutions.size,
        totalExecutions: this.executionHistory.length,
        connectionPools: this.connectionPools.size,
        uptime: Date.now() - (this.initTime || Date.now())
      },
      engine: engineMetrics,
      errorHandling: errorMetrics,
      rollback: rollbackStats,
      executions: {
        active: Array.from(this.activeExecutions.values()),
        recent: this.executionHistory.slice(-10)
      }
    };
  }
  
  /**
   * Get service health status
   */
  getHealthStatus() {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {}
    };
    
    // Check if service is initialized
    health.checks.initialized = {
      status: this.isInitialized ? 'pass' : 'fail',
      message: this.isInitialized ? 'Service initialized' : 'Service not initialized'
    };
    
    // Check engine status
    health.checks.engine = {
      status: this.engine ? 'pass' : 'fail',
      message: this.engine ? 'Engine available' : 'Engine not available'
    };
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
    health.checks.memory = {
      status: memoryPressure < 0.8 ? 'pass' : memoryPressure < 0.9 ? 'warn' : 'fail',
      usage: memoryPressure,
      message: `Memory usage: ${(memoryPressure * 100).toFixed(1)}%`
    };
    
    // Check active executions
    health.checks.executions = {
      status: this.activeExecutions.size < 100 ? 'pass' : 'warn',
      count: this.activeExecutions.size,
      message: `${this.activeExecutions.size} active executions`
    };
    
    // Overall status
    const failedChecks = Object.values(health.checks).filter(check => check.status === 'fail');
    const warnChecks = Object.values(health.checks).filter(check => check.status === 'warn');
    
    if (failedChecks.length > 0) {
      health.status = 'unhealthy';
    } else if (warnChecks.length > 0) {
      health.status = 'degraded';
    }
    
    return health;
  }
  
  /**
   * Reset service metrics
   */
  resetMetrics() {
    if (this.engine) {
      this.engine.resetPerformanceMetrics();
    }
    
    this.executionHistory = [];
    logger.info('Enhanced Mapping Service metrics reset');
  }
  
  /**
   * Shutdown service
   */
  async shutdown() {
    logger.info('Shutting down Enhanced Mapping Service...');
    
    try {
      // Wait for active executions to complete (with timeout)
      if (this.activeExecutions.size > 0) {
        logger.info(`Waiting for ${this.activeExecutions.size} active executions to complete...`);
        
        const timeout = 30000; // 30 seconds timeout
        const start = Date.now();
        
        while (this.activeExecutions.size > 0 && (Date.now() - start) < timeout) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.activeExecutions.size > 0) {
          logger.warn(`Forcing shutdown with ${this.activeExecutions.size} active executions`);
        }
      }
      
      // Shutdown engine
      if (this.engine) {
        await this.engine.shutdown();
      }
      
      // Clear connection pools
      this.connectionPools.clear();
      
      // Clear execution tracking
      this.activeExecutions.clear();
      this.executionHistory = [];
      
      this.isInitialized = false;
      this.emit('shutdown');
      
      logger.info('Enhanced Mapping Service shutdown complete');
    } catch (error) {
      logger.error('Error during Enhanced Mapping Service shutdown:', error);
      throw error;
    }
  }
  
  /**
   * Helper Methods
   */
  
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async getMappingConfiguration(mappingId) {
    const mapping = await Mapping.findByPk(mappingId, {
      include: [
        { model: System, as: 'sourceSystem' },
        { model: System, as: 'targetSystem' },
        { model: DataSchema, as: 'sourceSchema' },
        { model: DataSchema, as: 'targetSchema' }
      ]
    });
    
    if (!mapping) {
      throw new Error(`Mapping not found: ${mappingId}`);
    }
    
    return mapping;
  }
  
  prepareEnhancedMapping(mapping) {
    return {
      id: mapping.id,
      name: mapping.name,
      version: mapping.version || '1.0.0',
      sourceSchema: mapping.sourceSchema?.schemaDefinition || {},
      targetSchema: mapping.targetSchema?.schemaDefinition || {},
      rules: mapping.mappingRules || [],
      transformations: mapping.transformationConfig || {},
      validationRules: mapping.validationRules || [],
      qualityRules: mapping.qualityRules || [],
      preprocessing: mapping.preprocessingConfig || [],
      postprocessing: mapping.postprocessingConfig || [],
      aggregation: mapping.aggregationConfig || null,
      enrichmentRules: mapping.enrichmentRules || []
    };
  }
  
  createTransformFunction(mapping) {
    return (data) => {
      let transformed = {};
      
      // Apply field mappings
      if (mapping.mappingRules && mapping.mappingRules.fieldMappings) {
        for (const rule of mapping.mappingRules.fieldMappings) {
          if (data[rule.source] !== undefined) {
            transformed[rule.target] = data[rule.source];
            
            // Apply transformation if specified
            if (rule.transformation) {
              transformed[rule.target] = this.applyTransformation(
                transformed[rule.target], 
                rule.transformation
              );
            }
          }
        }
      }
      
      // Apply default values
      if (mapping.mappingRules && mapping.mappingRules.defaultValues) {
        for (const [field, value] of Object.entries(mapping.mappingRules.defaultValues)) {
          if (transformed[field] === undefined) {
            transformed[field] = value;
          }
        }
      }
      
      return transformed;
    };
  }
  
  applyTransformation(value, transformation) {
    try {
      switch (transformation.type) {
        case 'uppercase':
          return String(value).toUpperCase();
        case 'lowercase':
          return String(value).toLowerCase();
        case 'trim':
          return String(value).trim();
        case 'number':
          return Number(value);
        case 'date':
          return new Date(value);
        default:
          return value;
      }
    } catch (error) {
      logger.warn('Transformation failed:', { transformation, value, error: error.message });
      return value;
    }
  }
  
  handleExecutionComplete(event) {
    logger.info('Mapping execution completed:', event);
  }
  
  handleExecutionError(event) {
    logger.error('Mapping execution error:', event);
  }
}

module.exports = EnhancedMappingService;