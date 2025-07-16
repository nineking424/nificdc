const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../../middleware/auth');
const { EnhancedMappingEngine } = require('../../services/mappingEngine/EnhancedMappingEngine');
const { ValidationFramework } = require('../../services/mappingEngine/validation');
const { Mapping, System, DataSchema } = require('../../models');
const logger = require('../../src/utils/logger');
const { Op } = require('sequelize');

// Global enhanced mapping engine instance
let enhancedEngine = null;

/**
 * Initialize Enhanced Mapping Engine
 */
async function initializeEngine() {
  if (!enhancedEngine) {
    enhancedEngine = new EnhancedMappingEngine({
      enableCache: true,
      cacheSize: 5000,
      enableMetrics: true,
      defaultTimeout: 30000,
      maxConcurrency: 10,
      enableMemoryManagement: true,
      enableDataCompression: true,
      enableConnectionPooling: true,
      enableBatchOptimization: true,
      enablePerformanceOptimization: true,
      memoryThreshold: 0.8,
      compressionThreshold: 1024
    });

    logger.info('Enhanced Mapping Engine initialized');
  }
  return enhancedEngine;
}

// Initialize engine on module load
initializeEngine().catch(error => {
  logger.error('Failed to initialize Enhanced Mapping Engine:', error);
});

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Execute Enhanced Mapping
 * POST /api/enhanced-mappings/:id/execute
 */
router.post('/:id/execute', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      sourceData, 
      options = {},
      executorType,
      enablePerformanceOptimization = true,
      enableCache = true,
      enableRollback = true,
      timeout = 30000,
      metadata = {}
    } = req.body;

    // Validate input
    if (!sourceData) {
      return res.status(400).json({
        success: false,
        error: 'Source data is required',
        code: 'MISSING_SOURCE_DATA'
      });
    }

    // Get mapping configuration
    const mapping = await Mapping.findByPk(id, {
      include: [
        {
          model: System,
          as: 'sourceSystem',
          attributes: ['id', 'name', 'type', 'connectionConfig']
        },
        {
          model: System,
          as: 'targetSystem',
          attributes: ['id', 'name', 'type', 'connectionConfig']
        },
        {
          model: DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'version', 'schemaDefinition']
        },
        {
          model: DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'version', 'schemaDefinition']
        }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found',
        code: 'MAPPING_NOT_FOUND'
      });
    }

    if (!mapping.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Mapping is not active',
        code: 'MAPPING_INACTIVE'
      });
    }

    // Initialize enhanced engine
    const engine = await initializeEngine();

    // Prepare mapping configuration for enhanced engine
    const enhancedMapping = {
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

    // Prepare execution options
    const executionOptions = {
      executorType,
      enablePerformanceOptimization,
      enableCache,
      enableRollback,
      timeout,
      userId: req.user.id,
      metadata: {
        requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        ...metadata
      },
      onProgress: (progress) => {
        // Could emit real-time progress via WebSocket
        logger.debug('Mapping execution progress:', progress);
      },
      onComplete: (result) => {
        logger.info('Mapping execution completed:', {
          mappingId: id,
          recordsProcessed: result.recordsProcessed || 1,
          executionTime: result.executionTime
        });
      },
      onError: (error) => {
        logger.error('Mapping execution error:', {
          mappingId: id,
          error: error.message
        });
      }
    };

    // Execute mapping with enhanced engine
    const startTime = Date.now();
    const result = await engine.executeMapping(enhancedMapping, sourceData, executionOptions);
    const executionTime = Date.now() - startTime;

    // Update mapping execution statistics
    await updateMappingStats(mapping, {
      success: true,
      executionTime,
      recordsProcessed: Array.isArray(sourceData) ? sourceData.length : 1
    });

    // Get engine metrics
    const engineMetrics = engine.getMetrics();

    res.json({
      success: true,
      result,
      execution: {
        mappingId: id,
        mappingName: mapping.name,
        executionTime,
        recordsProcessed: Array.isArray(sourceData) ? sourceData.length : 1,
        timestamp: new Date(),
        options: {
          executorType: executionOptions.executorType,
          enablePerformanceOptimization,
          enableCache
        }
      },
      metrics: {
        engine: engineMetrics.engine,
        performance: engineMetrics.performance ? {
          memoryUsage: engineMetrics.performance.memoryUsage,
          throughput: engineMetrics.performance.throughput,
          cacheHitRate: engineMetrics.performance.cacheHitRate
        } : null
      }
    });

  } catch (error) {
    logger.error('Enhanced mapping execution failed:', error);

    // Update mapping error statistics
    if (req.params.id) {
      try {
        const mapping = await Mapping.findByPk(req.params.id);
        if (mapping) {
          await updateMappingStats(mapping, {
            success: false,
            error: error.message
          });
        }
      } catch (updateError) {
        logger.error('Failed to update mapping error stats:', updateError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Enhanced mapping execution failed',
      details: error.message,
      code: error.code || 'EXECUTION_ERROR',
      timestamp: new Date()
    });
  }
});

/**
 * Execute Batch Enhanced Mapping
 * POST /api/enhanced-mappings/:id/execute-batch
 */
router.post('/:id/execute-batch', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      dataArray, 
      batchSize = 100,
      parallelism = 4,
      continueOnError = false,
      enableProgressCallback = false,
      options = {}
    } = req.body;

    if (!dataArray || !Array.isArray(dataArray)) {
      return res.status(400).json({
        success: false,
        error: 'Data array is required and must be an array',
        code: 'INVALID_BATCH_DATA'
      });
    }

    // Get mapping configuration
    const mapping = await Mapping.findByPk(id, {
      include: [
        { model: DataSchema, as: 'sourceSchema' },
        { model: DataSchema, as: 'targetSchema' }
      ]
    });

    if (!mapping || !mapping.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Active mapping not found',
        code: 'MAPPING_NOT_FOUND'
      });
    }

    // Initialize enhanced engine
    const engine = await initializeEngine();

    // Prepare mapping configuration
    const enhancedMapping = {
      id: mapping.id,
      name: mapping.name,
      sourceSchema: mapping.sourceSchema?.schemaDefinition || {},
      targetSchema: mapping.targetSchema?.schemaDefinition || {},
      rules: mapping.mappingRules || [],
      transformations: mapping.transformationConfig || {},
      validationRules: mapping.validationRules || []
    };

    // Progress tracking
    let progressCallback = null;
    if (enableProgressCallback) {
      progressCallback = (progress) => {
        // In a real application, you'd emit this via WebSocket
        logger.debug('Batch progress:', progress);
      };
    }

    // Execute batch mapping
    const startTime = Date.now();
    const result = await engine.executeBatchMapping(enhancedMapping, dataArray, {
      batchSize,
      parallelism,
      continueOnError,
      progressCallback,
      userId: req.user.id,
      ...options
    });

    const executionTime = Date.now() - startTime;

    // Update mapping statistics
    await updateMappingStats(mapping, {
      success: true,
      executionTime,
      recordsProcessed: dataArray.length,
      batchExecution: true
    });

    res.json({
      success: true,
      result,
      execution: {
        mappingId: id,
        mappingName: mapping.name,
        totalRecords: dataArray.length,
        processedRecords: result.totalProcessed,
        successfulRecords: result.successful,
        failedRecords: result.failed,
        executionTime,
        batchSize,
        parallelism,
        timestamp: new Date()
      },
      metrics: engine.getMetrics()
    });

  } catch (error) {
    logger.error('Batch mapping execution failed:', error);

    res.status(500).json({
      success: false,
      error: 'Batch mapping execution failed',
      details: error.message,
      code: 'BATCH_EXECUTION_ERROR',
      timestamp: new Date()
    });
  }
});

/**
 * Stream Data Processing
 * POST /api/enhanced-mappings/:id/stream
 */
router.post('/:id/stream', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      data,
      transformFunction,
      options = {}
    } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required for streaming',
        code: 'MISSING_STREAM_DATA'
      });
    }

    // Get mapping configuration
    const mapping = await Mapping.findByPk(id);
    if (!mapping || !mapping.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Active mapping not found',
        code: 'MAPPING_NOT_FOUND'
      });
    }

    // Initialize enhanced engine
    const engine = await initializeEngine();

    // Create transform function based on mapping rules
    const mappingTransform = (item) => {
      // Apply mapping rules to transform data
      const transformed = {};
      
      if (mapping.mappingRules && mapping.mappingRules.fieldMappings) {
        for (const rule of mapping.mappingRules.fieldMappings) {
          if (item[rule.source] !== undefined) {
            transformed[rule.target] = item[rule.source];
          }
        }
      }
      
      return transformed;
    };

    // Execute streaming processing
    const result = await engine.processWithStreaming(data, mappingTransform, {
      highWaterMark: options.highWaterMark || 16384,
      maxConcurrency: options.maxConcurrency || 10,
      enableBackpressureControl: options.enableBackpressureControl !== false,
      ...options
    });

    res.json({
      success: true,
      result,
      execution: {
        mappingId: id,
        mappingName: mapping.name,
        recordsProcessed: result.results.length,
        errorCount: result.errors.length,
        processingTime: result.processingTime,
        throughput: result.throughput,
        timestamp: new Date()
      },
      metrics: engine.getMetrics().streams
    });

  } catch (error) {
    logger.error('Stream processing failed:', error);

    res.status(500).json({
      success: false,
      error: 'Stream processing failed',
      details: error.message,
      code: 'STREAM_ERROR',
      timestamp: new Date()
    });
  }
});

/**
 * Validate Enhanced Mapping
 * POST /api/enhanced-mappings/:id/validate
 */
router.post('/:id/validate', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleData, validationLevel = 'standard' } = req.body;

    // Get mapping configuration
    const mapping = await Mapping.findByPk(id, {
      include: [
        { model: DataSchema, as: 'sourceSchema' },
        { model: DataSchema, as: 'targetSchema' }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found',
        code: 'MAPPING_NOT_FOUND'
      });
    }

    // Initialize validation framework
    const validationFramework = new ValidationFramework();

    // Create enhanced mapping configuration
    const enhancedMapping = {
      id: mapping.id,
      name: mapping.name,
      sourceSchema: mapping.sourceSchema?.schemaDefinition || {},
      targetSchema: mapping.targetSchema?.schemaDefinition || {},
      rules: mapping.mappingRules || [],
      validationRules: mapping.validationRules || [],
      transformations: mapping.transformationConfig || {}
    };

    // Perform validation
    const validationResult = await validationFramework.validateMapping(enhancedMapping, {
      level: validationLevel,
      sampleData,
      checkPerformance: true,
      checkCompatibility: true
    });

    // Additional enhanced validation
    const engine = await initializeEngine();
    const complexityAnalysis = engine.calculateMappingComplexity(enhancedMapping);
    const resourceAnalysis = engine.getSystemResources();
    const optimizationRecommendation = engine.performanceOptimizer.optimizeExecutionStrategy(
      Array.isArray(sampleData) ? sampleData.length : 1,
      complexityAnalysis,
      resourceAnalysis
    );

    res.json({
      success: true,
      validation: validationResult,
      analysis: {
        complexity: complexityAnalysis,
        systemResources: resourceAnalysis,
        recommendations: optimizationRecommendation,
        mappingId: id,
        mappingName: mapping.name,
        validatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Enhanced mapping validation failed:', error);

    res.status(500).json({
      success: false,
      error: 'Enhanced mapping validation failed',
      details: error.message,
      code: 'VALIDATION_ERROR',
      timestamp: new Date()
    });
  }
});

/**
 * Get Enhanced Engine Metrics
 * GET /api/enhanced-mappings/metrics
 */
router.get('/metrics', authorize(['admin', 'manager']), async (req, res) => {
  try {
    if (!enhancedEngine) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced mapping engine not initialized',
        code: 'ENGINE_NOT_INITIALIZED'
      });
    }

    const metrics = enhancedEngine.getMetrics();
    const errorMetrics = enhancedEngine.getErrorMetrics();
    const rollbackStats = enhancedEngine.getRollbackStats();

    res.json({
      success: true,
      metrics: {
        engine: metrics.engine,
        performance: metrics.performance,
        streams: metrics.streams,
        connectionPools: metrics.connectionPools,
        pipelines: metrics.pipelines,
        errorHandling: errorMetrics,
        rollback: rollbackStats,
        timestamp: new Date()
      }
    });

  } catch (error) {
    logger.error('Failed to get enhanced engine metrics:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get engine metrics',
      details: error.message,
      code: 'METRICS_ERROR'
    });
  }
});

/**
 * Reset Enhanced Engine Metrics
 * POST /api/enhanced-mappings/metrics/reset
 */
router.post('/metrics/reset', authorize(['admin']), async (req, res) => {
  try {
    if (!enhancedEngine) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced mapping engine not initialized',
        code: 'ENGINE_NOT_INITIALIZED'
      });
    }

    enhancedEngine.resetPerformanceMetrics();

    res.json({
      success: true,
      message: 'Enhanced engine metrics reset successfully',
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Failed to reset enhanced engine metrics:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to reset engine metrics',
      details: error.message,
      code: 'METRICS_RESET_ERROR'
    });
  }
});

/**
 * Get Engine Status and Health
 * GET /api/enhanced-mappings/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      engine: {
        initialized: !!enhancedEngine,
        uptime: enhancedEngine ? Date.now() - enhancedEngine.metrics?.startTime : 0
      },
      performance: null,
      connections: null,
      memory: process.memoryUsage()
    };

    if (enhancedEngine) {
      const metrics = enhancedEngine.getMetrics();
      
      health.performance = {
        averageExecutionTime: metrics.engine?.averageExecutionTime || 0,
        successRate: metrics.engine?.successRate || 0,
        cacheHitRate: metrics.engine?.cacheHitRate || 0
      };

      health.connections = metrics.connectionPools?.summary || null;
    }

    // Check if memory usage is concerning
    const memoryUsage = process.memoryUsage();
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (memoryPressure > 0.9) {
      health.status = 'warning';
      health.warnings = ['High memory usage detected'];
    }

    res.json({
      success: true,
      health
    });

  } catch (error) {
    logger.error('Health check failed:', error);

    res.status(500).json({
      success: false,
      health: {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      }
    });
  }
});

/**
 * Manage Connection Pools
 * POST /api/enhanced-mappings/connections/pools
 */
router.post('/connections/pools', authorize(['admin']), async (req, res) => {
  try {
    const { name, factory, options = {} } = req.body;

    if (!name || !factory) {
      return res.status(400).json({
        success: false,
        error: 'Pool name and factory are required',
        code: 'MISSING_POOL_CONFIG'
      });
    }

    if (!enhancedEngine) {
      await initializeEngine();
    }

    const pool = enhancedEngine.createConnectionPool(name, factory, options);

    res.json({
      success: true,
      pool: {
        name,
        options,
        created: true,
        timestamp: new Date()
      }
    });

  } catch (error) {
    logger.error('Failed to create connection pool:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to create connection pool',
      details: error.message,
      code: 'POOL_CREATION_ERROR'
    });
  }
});

/**
 * Get Connection Pool Statistics
 * GET /api/enhanced-mappings/connections/pools/stats
 */
router.get('/connections/pools/stats', authorize(['admin', 'manager']), async (req, res) => {
  try {
    if (!enhancedEngine) {
      return res.status(503).json({
        success: false,
        error: 'Enhanced mapping engine not initialized',
        code: 'ENGINE_NOT_INITIALIZED'
      });
    }

    const poolStats = enhancedEngine.connectionPoolManager.getMetrics();

    res.json({
      success: true,
      connectionPools: poolStats,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Failed to get connection pool stats:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get connection pool statistics',
      details: error.message,
      code: 'POOL_STATS_ERROR'
    });
  }
});

/**
 * Update mapping execution statistics
 */
async function updateMappingStats(mapping, execution) {
  try {
    const currentStats = mapping.executionStats || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      lastExecutedAt: null,
      totalRecordsProcessed: 0
    };

    currentStats.totalExecutions++;
    currentStats.lastExecutedAt = new Date();

    if (execution.success) {
      currentStats.successfulExecutions++;
      currentStats.totalExecutionTime += execution.executionTime;
      currentStats.averageExecutionTime = currentStats.totalExecutionTime / currentStats.successfulExecutions;
      currentStats.totalRecordsProcessed += execution.recordsProcessed || 0;
    } else {
      currentStats.failedExecutions++;
      currentStats.lastError = execution.error;
      currentStats.lastErrorAt = new Date();
    }

    await mapping.update({ executionStats: currentStats });
  } catch (error) {
    logger.error('Failed to update mapping statistics:', error);
  }
}

module.exports = router;