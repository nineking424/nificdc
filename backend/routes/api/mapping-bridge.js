const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../../src/middleware/auth');
const { EnhancedMappingService } = require('../../services/enhanced-mapping');
const logger = require('../../src/utils/logger');

/**
 * Mapping Bridge API Routes
 * Bridges existing mapping functionality with enhanced mapping capabilities
 */

// Initialize enhanced mapping service
let enhancedService = null;

async function getEnhancedService() {
  if (!enhancedService) {
    enhancedService = new EnhancedMappingService({
      autoInitialize: true,
      engineOptions: {
        enableCache: true,
        enableMetrics: true,
        enablePerformanceOptimization: true
      }
    });
    await enhancedService.initialize();
  }
  return enhancedService;
}

// Apply authentication middleware
router.use(authenticateToken);

/**
 * Execute mapping with enhanced capabilities
 * POST /api/mapping-bridge/:id/execute-enhanced
 */
router.post('/:id/execute-enhanced', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceData, options = {} } = req.body;

    if (!sourceData) {
      return res.status(400).json({
        success: false,
        error: 'Source data is required',
        code: 'MISSING_SOURCE_DATA'
      });
    }

    const service = await getEnhancedService();
    
    // Execute with enhanced service
    const result = await service.executeMapping(id, sourceData, {
      userId: req.user.id,
      requestId: req.headers['x-request-id'],
      enablePerformanceOptimization: options.enablePerformanceOptimization !== false,
      enableCache: options.enableCache !== false,
      enableRollback: options.enableRollback !== false,
      ...options
    });

    res.json({
      success: true,
      result: result.result,
      execution: {
        executionId: result.executionId,
        mappingId: result.mappingId,
        timestamp: result.timestamp,
        enhanced: true
      },
      metrics: service.getMetrics()
    });

  } catch (error) {
    logger.error('Enhanced mapping execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Enhanced mapping execution failed',
      details: error.message,
      code: 'ENHANCED_EXECUTION_ERROR'
    });
  }
});

/**
 * Batch execute mapping with enhanced capabilities
 * POST /api/mapping-bridge/:id/execute-batch-enhanced
 */
router.post('/:id/execute-batch-enhanced', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      dataArray, 
      batchSize = 100,
      parallelism = 4,
      continueOnError = false,
      options = {}
    } = req.body;

    if (!dataArray || !Array.isArray(dataArray)) {
      return res.status(400).json({
        success: false,
        error: 'Data array is required and must be an array',
        code: 'INVALID_BATCH_DATA'
      });
    }

    const service = await getEnhancedService();
    
    // Execute batch with enhanced service
    const result = await service.executeBatchMapping(id, dataArray, {
      batchSize,
      parallelism,
      continueOnError,
      userId: req.user.id,
      ...options
    });

    res.json({
      success: true,
      result: result.result,
      execution: {
        executionId: result.executionId,
        mappingId: result.mappingId,
        totalRecords: dataArray.length,
        timestamp: result.timestamp,
        enhanced: true,
        batchConfiguration: {
          batchSize,
          parallelism,
          continueOnError
        }
      },
      metrics: service.getMetrics()
    });

  } catch (error) {
    logger.error('Enhanced batch mapping execution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Enhanced batch mapping execution failed',
      details: error.message,
      code: 'ENHANCED_BATCH_EXECUTION_ERROR'
    });
  }
});

/**
 * Stream processing with enhanced capabilities
 * POST /api/mapping-bridge/:id/stream-enhanced
 */
router.post('/:id/stream-enhanced', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { data, options = {} } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required for streaming',
        code: 'MISSING_STREAM_DATA'
      });
    }

    const service = await getEnhancedService();
    
    // Execute streaming with enhanced service
    const result = await service.processWithStreaming(id, data, {
      highWaterMark: options.highWaterMark || 16384,
      maxConcurrency: options.maxConcurrency || 10,
      enableBackpressureControl: options.enableBackpressureControl !== false,
      enableAdaptiveBuffering: options.enableAdaptiveBuffering !== false,
      ...options
    });

    res.json({
      success: true,
      result: result.result,
      execution: {
        mappingId: result.mappingId,
        timestamp: result.timestamp,
        enhanced: true,
        streamConfiguration: {
          highWaterMark: options.highWaterMark || 16384,
          maxConcurrency: options.maxConcurrency || 10,
          enableBackpressureControl: options.enableBackpressureControl !== false
        }
      },
      metrics: service.getMetrics()
    });

  } catch (error) {
    logger.error('Enhanced stream processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Enhanced stream processing failed',
      details: error.message,
      code: 'ENHANCED_STREAM_ERROR'
    });
  }
});

/**
 * Validate mapping with enhanced capabilities
 * POST /api/mapping-bridge/:id/validate-enhanced
 */
router.post('/:id/validate-enhanced', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleData, validationLevel = 'standard', options = {} } = req.body;

    const service = await getEnhancedService();
    
    // Validate with enhanced service
    const result = await service.validateMapping(id, {
      level: validationLevel,
      sampleData,
      checkPerformance: options.checkPerformance !== false,
      checkCompatibility: options.checkCompatibility !== false,
      estimatedDataSize: options.estimatedDataSize || 1000,
      ...options
    });

    res.json({
      success: true,
      validation: result.validation,
      analysis: result.analysis,
      mappingId: result.mappingId,
      enhanced: true,
      timestamp: result.timestamp
    });

  } catch (error) {
    logger.error('Enhanced mapping validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Enhanced mapping validation failed',
      details: error.message,
      code: 'ENHANCED_VALIDATION_ERROR'
    });
  }
});

/**
 * Get enhanced mapping capabilities and status
 * GET /api/mapping-bridge/capabilities
 */
router.get('/capabilities', authorize(['admin', 'manager', 'viewer']), async (req, res) => {
  try {
    const service = await getEnhancedService();
    const status = service.getHealthStatus();
    const metrics = service.getMetrics();

    res.json({
      success: true,
      capabilities: {
        enhancedExecution: true,
        batchProcessing: true,
        streamProcessing: true,
        performanceOptimization: true,
        caching: true,
        errorRecovery: true,
        rollback: true,
        validation: true,
        metrics: true,
        connectionPooling: true
      },
      status,
      metrics: {
        service: metrics.service,
        initialized: metrics.initialized
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Failed to get enhanced mapping capabilities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enhanced mapping capabilities',
      details: error.message,
      code: 'CAPABILITIES_ERROR'
    });
  }
});

/**
 * Compare standard vs enhanced mapping performance
 * POST /api/mapping-bridge/:id/compare-performance
 */
router.post('/:id/compare-performance', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleData, testIterations = 1 } = req.body;

    if (!sampleData) {
      return res.status(400).json({
        success: false,
        error: 'Sample data is required for performance comparison',
        code: 'MISSING_SAMPLE_DATA'
      });
    }

    const service = await getEnhancedService();

    // Performance comparison logic would go here
    // This is a simplified version for demonstration
    const comparison = {
      testConfiguration: {
        mappingId: id,
        sampleDataSize: Array.isArray(sampleData) ? sampleData.length : 1,
        iterations: testIterations
      },
      enhancedMapping: {
        averageExecutionTime: 0,
        memoryUsage: 0,
        throughput: 0,
        features: ['caching', 'optimization', 'error_recovery']
      },
      standardMapping: {
        averageExecutionTime: 0,
        memoryUsage: 0,
        throughput: 0,
        features: ['basic_execution']
      },
      improvement: {
        speedImprovement: '0%',
        memoryEfficiency: '0%',
        throughputIncrease: '0%'
      },
      recommendations: [
        'Enhanced mapping provides better performance for complex transformations',
        'Use batch processing for large datasets',
        'Enable caching for repeated operations'
      ]
    };

    res.json({
      success: true,
      comparison,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Performance comparison failed:', error);
    res.status(500).json({
      success: false,
      error: 'Performance comparison failed',
      details: error.message,
      code: 'COMPARISON_ERROR'
    });
  }
});

/**
 * Reset enhanced mapping service metrics
 * POST /api/mapping-bridge/reset-metrics
 */
router.post('/reset-metrics', authorize(['admin']), async (req, res) => {
  try {
    const service = await getEnhancedService();
    service.resetMetrics();

    res.json({
      success: true,
      message: 'Enhanced mapping service metrics reset successfully',
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Failed to reset enhanced mapping metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset enhanced mapping metrics',
      details: error.message,
      code: 'METRICS_RESET_ERROR'
    });
  }
});

module.exports = router;