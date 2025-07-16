const request = require('supertest');
const express = require('express');
const enhancedMappingsRouter = require('../../../routes/api/enhanced-mappings');
const { EnhancedMappingEngine } = require('../../../services/mappingEngine/EnhancedMappingEngine');

// Mock dependencies
jest.mock('../../../services/mappingEngine/EnhancedMappingEngine');
jest.mock('../../../services/mappingEngine/validation', () => ({
  ValidationFramework: jest.fn()
}));
jest.mock('../../../src/models', () => ({
  Mapping: {
    findByPk: jest.fn()
  },
  System: {},
  DataSchema: {}
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { id: 'user1', name: 'Test User', role: 'admin' };
  next();
});

const mockAuthorize = jest.fn(() => (req, res, next) => next());

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken,
  authorize: mockAuthorize
}));

describe('Enhanced Mappings API Routes', () => {
  let app;
  let mockEngine;
  let mockMapping;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/enhanced-mappings', enhancedMappingsRouter);

    // Setup mock engine
    mockEngine = {
      executeMapping: jest.fn(),
      executeBatchMapping: jest.fn(),
      processWithStreaming: jest.fn(),
      calculateMappingComplexity: jest.fn(),
      getSystemResources: jest.fn(),
      getMetrics: jest.fn(),
      getErrorMetrics: jest.fn(),
      getRollbackStats: jest.fn(),
      resetPerformanceMetrics: jest.fn(),
      createConnectionPool: jest.fn(),
      performanceOptimizer: {
        optimizeExecutionStrategy: jest.fn()
      },
      connectionPoolManager: {
        getMetrics: jest.fn()
      }
    };

    // Mock the engine constructor
    EnhancedMappingEngine.mockImplementation(() => mockEngine);

    // Setup mock mapping
    mockMapping = {
      id: 'mapping1',
      name: 'Test Mapping',
      version: '1.0.0',
      isActive: true,
      mappingRules: [
        { source: 'field1', target: 'field1' },
        { source: 'field2', target: 'field2' }
      ],
      transformationConfig: {},
      validationRules: [],
      sourceSchema: {
        schemaDefinition: {
          fields: [
            { name: 'field1', type: 'string' },
            { name: 'field2', type: 'number' }
          ]
        }
      },
      targetSchema: {
        schemaDefinition: {
          fields: [
            { name: 'field1', type: 'string' },
            { name: 'field2', type: 'number' }
          ]
        }
      },
      executionStats: {},
      update: jest.fn()
    };

    // Mock Mapping.findByPk
    require('../../../models').Mapping.findByPk.mockResolvedValue(mockMapping);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /:id/execute', () => {
    it('should execute enhanced mapping successfully', async () => {
      const sourceData = { field1: 'test', field2: 123 };
      const expectedResult = { field1: 'test', field2: 123 };

      mockEngine.executeMapping.mockResolvedValue(expectedResult);
      mockEngine.getMetrics.mockReturnValue({
        engine: {
          executionCount: 1,
          successRate: 100,
          averageExecutionTime: 100
        },
        performance: {
          memoryUsage: { heapUsed: 1000 },
          throughput: 10,
          cacheHitRate: 50
        }
      });

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute')
        .send({
          sourceData,
          options: {
            enablePerformanceOptimization: true,
            enableCache: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(expectedResult);
      expect(response.body.execution).toMatchObject({
        mappingId: 'mapping1',
        mappingName: 'Test Mapping',
        recordsProcessed: 1
      });
      expect(response.body.metrics).toBeDefined();

      expect(mockEngine.executeMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mapping1',
          name: 'Test Mapping',
          rules: mockMapping.mappingRules
        }),
        sourceData,
        expect.objectContaining({
          enablePerformanceOptimization: true,
          enableCache: true
        })
      );
    });

    it('should return 400 when source data is missing', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Source data is required');
      expect(response.body.code).toBe('MISSING_SOURCE_DATA');
    });

    it('should return 404 when mapping is not found', async () => {
      require('../../../models').Mapping.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/enhanced-mappings/nonexistent/execute')
        .send({ sourceData: { test: 'data' } })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Mapping not found');
      expect(response.body.code).toBe('MAPPING_NOT_FOUND');
    });

    it('should return 400 when mapping is inactive', async () => {
      mockMapping.isActive = false;

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute')
        .send({ sourceData: { test: 'data' } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Mapping is not active');
      expect(response.body.code).toBe('MAPPING_INACTIVE');
    });

    it('should handle execution errors gracefully', async () => {
      mockEngine.executeMapping.mockRejectedValue(new Error('Execution failed'));

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute')
        .send({ sourceData: { test: 'data' } })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Enhanced mapping execution failed');
      expect(response.body.details).toBe('Execution failed');
      expect(response.body.code).toBe('EXECUTION_ERROR');
    });

    it('should execute with custom options', async () => {
      const sourceData = { field1: 'test' };
      const customOptions = {
        executorType: 'parallel',
        enablePerformanceOptimization: false,
        timeout: 60000
      };

      mockEngine.executeMapping.mockResolvedValue(sourceData);
      mockEngine.getMetrics.mockReturnValue({ engine: {}, performance: null });

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute')
        .send({
          sourceData,
          ...customOptions
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockEngine.executeMapping).toHaveBeenCalledWith(
        expect.anything(),
        sourceData,
        expect.objectContaining({
          executorType: 'parallel',
          enablePerformanceOptimization: false,
          timeout: 60000
        })
      );
    });
  });

  describe('POST /:id/execute-batch', () => {
    it('should execute batch mapping successfully', async () => {
      const dataArray = [
        { field1: 'test1', field2: 1 },
        { field1: 'test2', field2: 2 }
      ];
      const batchResult = {
        totalProcessed: 2,
        successful: 2,
        failed: 0,
        results: dataArray,
        executionTime: 100,
        errors: []
      };

      mockEngine.executeBatchMapping.mockResolvedValue(batchResult);
      mockEngine.getMetrics.mockReturnValue({ engine: {} });

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute-batch')
        .send({
          dataArray,
          batchSize: 50,
          parallelism: 2
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(batchResult);
      expect(response.body.execution).toMatchObject({
        mappingId: 'mapping1',
        totalRecords: 2,
        processedRecords: 2,
        batchSize: 50,
        parallelism: 2
      });

      expect(mockEngine.executeBatchMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mapping1',
          name: 'Test Mapping'
        }),
        dataArray,
        expect.objectContaining({
          batchSize: 50,
          parallelism: 2
        })
      );
    });

    it('should return 400 when dataArray is not an array', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute-batch')
        .send({ dataArray: 'not an array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Data array is required and must be an array');
      expect(response.body.code).toBe('INVALID_BATCH_DATA');
    });

    it('should handle batch execution errors', async () => {
      mockEngine.executeBatchMapping.mockRejectedValue(new Error('Batch failed'));

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/execute-batch')
        .send({ dataArray: [{ test: 'data' }] })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Batch mapping execution failed');
      expect(response.body.code).toBe('BATCH_EXECUTION_ERROR');
    });
  });

  describe('POST /:id/stream', () => {
    it('should process streaming data successfully', async () => {
      const streamData = [{ field1: 'test1' }, { field1: 'test2' }];
      const streamResult = {
        results: streamData,
        errors: [],
        processingTime: 50,
        throughput: 40
      };

      mockEngine.processWithStreaming.mockResolvedValue(streamResult);
      mockEngine.getMetrics.mockReturnValue({
        streams: { totalProcessed: 2, averageLatency: 25 }
      });

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/stream')
        .send({
          data: streamData,
          options: { maxConcurrency: 5 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(streamResult);
      expect(response.body.execution).toMatchObject({
        mappingId: 'mapping1',
        recordsProcessed: 2,
        errorCount: 0,
        throughput: 40
      });

      expect(mockEngine.processWithStreaming).toHaveBeenCalledWith(
        streamData,
        expect.any(Function),
        expect.objectContaining({ maxConcurrency: 5 })
      );
    });

    it('should return 400 when data is missing', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/stream')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Data is required for streaming');
      expect(response.body.code).toBe('MISSING_STREAM_DATA');
    });
  });

  describe('POST /:id/validate', () => {
    it('should validate mapping successfully', async () => {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };

      mockEngine.calculateMappingComplexity.mockReturnValue(0.5);
      mockEngine.getSystemResources.mockReturnValue({
        availableMemory: 0.7,
        cpuUsage: 0.3
      });
      mockEngine.performanceOptimizer.optimizeExecutionStrategy.mockReturnValue({
        executorType: 'batch',
        batchSize: 100,
        reason: ['Optimal for medium complexity']
      });

      // Mock ValidationFramework
      const mockValidationFramework = {
        validateMapping: jest.fn().mockResolvedValue(validationResult)
      };
      
      // We need to mock the ValidationFramework constructor
      const { ValidationFramework } = require('../../../services/mappingEngine/validation');
      ValidationFramework.mockImplementation(() => mockValidationFramework);

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/validate')
        .send({
          sampleData: [{ field1: 'test' }],
          validationLevel: 'comprehensive'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validation).toEqual(validationResult);
      expect(response.body.analysis).toMatchObject({
        complexity: 0.5,
        systemResources: {
          availableMemory: 0.7,
          cpuUsage: 0.3
        },
        recommendations: {
          executorType: 'batch',
          batchSize: 100
        }
      });
    });

    it('should handle validation errors', async () => {
      require('../../../models').Mapping.findByPk.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/enhanced-mappings/mapping1/validate')
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Enhanced mapping validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /metrics', () => {
    it('should return engine metrics successfully', async () => {
      const mockMetrics = {
        engine: {
          executionCount: 10,
          successRate: 90,
          averageExecutionTime: 150
        },
        performance: {
          memoryUsage: { heapUsed: 2000 },
          throughput: 100
        },
        streams: {
          totalProcessed: 50,
          averageLatency: 20
        },
        connectionPools: {
          summary: { totalPools: 2, totalConnections: 10 }
        },
        pipelines: []
      };

      mockEngine.getMetrics.mockReturnValue(mockMetrics);
      mockEngine.getErrorMetrics.mockReturnValue({
        totalErrors: 1,
        errorRate: 0.1
      });
      mockEngine.getRollbackStats.mockReturnValue({
        totalRollbacks: 0
      });

      const response = await request(app)
        .get('/api/enhanced-mappings/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metrics.engine).toEqual(mockMetrics.engine);
      expect(response.body.metrics.performance).toEqual(mockMetrics.performance);
      expect(response.body.metrics.errorHandling).toEqual({
        totalErrors: 1,
        errorRate: 0.1
      });
    });

    it('should return 503 when engine is not initialized', async () => {
      // Reset the module to simulate uninitialized engine
      jest.resetModules();
      const freshRouter = require('../../../routes/api/enhanced-mappings');
      
      const freshApp = express();
      freshApp.use(express.json());
      freshApp.use('/api/enhanced-mappings', freshRouter);

      const response = await request(freshApp)
        .get('/api/enhanced-mappings/metrics')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Enhanced mapping engine not initialized');
    });
  });

  describe('POST /metrics/reset', () => {
    it('should reset metrics successfully', async () => {
      mockEngine.resetPerformanceMetrics.mockImplementation(() => {});

      const response = await request(app)
        .post('/api/enhanced-mappings/metrics/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Enhanced engine metrics reset successfully');
      expect(mockEngine.resetPerformanceMetrics).toHaveBeenCalled();
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      mockEngine.getMetrics.mockReturnValue({
        engine: {
          averageExecutionTime: 100,
          successRate: 95,
          cacheHitRate: 80
        },
        connectionPools: {
          summary: { totalPools: 1, totalConnections: 5 }
        }
      });

      const response = await request(app)
        .get('/api/enhanced-mappings/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.health.status).toBe('healthy');
      expect(response.body.health.engine.initialized).toBe(true);
      expect(response.body.health.performance).toMatchObject({
        averageExecutionTime: 100,
        successRate: 95,
        cacheHitRate: 80
      });
    });

    it('should detect memory pressure and return warning status', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 950000000, // 950MB
        heapTotal: 1000000000 // 1GB
      });

      mockEngine.getMetrics.mockReturnValue({
        engine: { averageExecutionTime: 100 },
        connectionPools: { summary: {} }
      });

      const response = await request(app)
        .get('/api/enhanced-mappings/health')
        .expect(200);

      expect(response.body.health.status).toBe('warning');
      expect(response.body.health.warnings).toContain('High memory usage detected');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('POST /connections/pools', () => {
    it('should create connection pool successfully', async () => {
      const poolConfig = {
        name: 'testPool',
        factory: {
          create: () => Promise.resolve({ id: 'conn1' }),
          destroy: () => Promise.resolve()
        },
        options: {
          min: 2,
          max: 10
        }
      };

      mockEngine.createConnectionPool.mockReturnValue({ name: 'testPool' });

      const response = await request(app)
        .post('/api/enhanced-mappings/connections/pools')
        .send(poolConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pool.name).toBe('testPool');
      expect(response.body.pool.created).toBe(true);

      expect(mockEngine.createConnectionPool).toHaveBeenCalledWith(
        'testPool',
        poolConfig.factory,
        poolConfig.options
      );
    });

    it('should return 400 when pool config is incomplete', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/connections/pools')
        .send({ name: 'testPool' }) // Missing factory
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Pool name and factory are required');
      expect(response.body.code).toBe('MISSING_POOL_CONFIG');
    });
  });

  describe('GET /connections/pools/stats', () => {
    it('should return connection pool statistics', async () => {
      const poolStats = {
        summary: {
          totalPools: 2,
          totalConnections: 15,
          totalActiveConnections: 8
        },
        pools: {
          pool1: { size: 10, active: 5 },
          pool2: { size: 5, active: 3 }
        }
      };

      mockEngine.connectionPoolManager.getMetrics.mockReturnValue(poolStats);

      const response = await request(app)
        .get('/api/enhanced-mappings/connections/pools/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.connectionPools).toEqual(poolStats);
    });
  });
});