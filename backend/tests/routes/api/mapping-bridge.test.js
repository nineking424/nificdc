const request = require('supertest');
const express = require('express');
const mappingBridgeRouter = require('../../../routes/api/mapping-bridge');

// Mock dependencies
jest.mock('../../../services/enhanced-mapping', () => ({
  EnhancedMappingService: jest.fn()
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

describe('Mapping Bridge API Routes', () => {
  let app;
  let mockEnhancedService;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/mapping-bridge', mappingBridgeRouter);

    // Setup mock enhanced service
    mockEnhancedService = {
      initialize: jest.fn().mockResolvedValue(),
      executeMapping: jest.fn(),
      executeBatchMapping: jest.fn(),
      processWithStreaming: jest.fn(),
      validateMapping: jest.fn(),
      getMetrics: jest.fn(),
      getHealthStatus: jest.fn(),
      resetMetrics: jest.fn()
    };

    // Mock the EnhancedMappingService constructor
    const { EnhancedMappingService } = require('../../../services/enhanced-mapping');
    EnhancedMappingService.mockImplementation(() => mockEnhancedService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /:id/execute-enhanced', () => {
    it('should execute enhanced mapping successfully', async () => {
      const sourceData = { field1: 'test', field2: 123 };
      const expectedResult = {
        executionId: 'exec_123',
        result: { field1: 'test', field2: 123 },
        mappingId: 'mapping1',
        success: true,
        timestamp: new Date()
      };

      mockEnhancedService.executeMapping.mockResolvedValue(expectedResult);
      mockEnhancedService.getMetrics.mockReturnValue({
        initialized: true,
        service: { activeExecutions: 0 }
      });

      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/execute-enhanced')
        .send({
          sourceData,
          options: {
            enablePerformanceOptimization: true,
            enableCache: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(expectedResult.result);
      expect(response.body.execution).toMatchObject({
        executionId: expectedResult.executionId,
        mappingId: expectedResult.mappingId,
        enhanced: true
      });

      expect(mockEnhancedService.executeMapping).toHaveBeenCalledWith(
        'mapping1',
        sourceData,
        expect.objectContaining({
          userId: 'user1',
          enablePerformanceOptimization: true,
          enableCache: true
        })
      );
    });

    it('should return 400 when source data is missing', async () => {
      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/execute-enhanced')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Source data is required');
      expect(response.body.code).toBe('MISSING_SOURCE_DATA');
    });

    it('should handle execution errors gracefully', async () => {
      mockEnhancedService.executeMapping.mockRejectedValue(new Error('Execution failed'));

      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/execute-enhanced')
        .send({ sourceData: { test: 'data' } })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Enhanced mapping execution failed');
      expect(response.body.code).toBe('ENHANCED_EXECUTION_ERROR');
    });
  });

  describe('POST /:id/execute-batch-enhanced', () => {
    it('should execute batch enhanced mapping successfully', async () => {
      const dataArray = [
        { field1: 'test1', field2: 1 },
        { field1: 'test2', field2: 2 }
      ];
      const expectedResult = {
        executionId: 'exec_batch_123',
        result: {
          totalProcessed: 2,
          successful: 2,
          failed: 0,
          results: dataArray
        },
        mappingId: 'mapping1',
        success: true,
        timestamp: new Date()
      };

      mockEnhancedService.executeBatchMapping.mockResolvedValue(expectedResult);
      mockEnhancedService.getMetrics.mockReturnValue({
        initialized: true,
        service: { activeExecutions: 0 }
      });

      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/execute-batch-enhanced')
        .send({
          dataArray,
          batchSize: 50,
          parallelism: 2,
          continueOnError: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(expectedResult.result);
      expect(response.body.execution).toMatchObject({
        executionId: expectedResult.executionId,
        mappingId: expectedResult.mappingId,
        totalRecords: 2,
        enhanced: true,
        batchConfiguration: {
          batchSize: 50,
          parallelism: 2,
          continueOnError: false
        }
      });

      expect(mockEnhancedService.executeBatchMapping).toHaveBeenCalledWith(
        'mapping1',
        dataArray,
        expect.objectContaining({
          batchSize: 50,
          parallelism: 2,
          continueOnError: false,
          userId: 'user1'
        })
      );
    });

    it('should return 400 when dataArray is not an array', async () => {
      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/execute-batch-enhanced')
        .send({ dataArray: 'not an array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Data array is required and must be an array');
      expect(response.body.code).toBe('INVALID_BATCH_DATA');
    });
  });

  describe('POST /:id/stream-enhanced', () => {
    it('should process streaming data successfully', async () => {
      const streamData = [{ field1: 'test1' }, { field1: 'test2' }];
      const expectedResult = {
        result: {
          results: streamData,
          errors: [],
          processingTime: 50,
          throughput: 40
        },
        mappingId: 'mapping1',
        success: true,
        timestamp: new Date()
      };

      mockEnhancedService.processWithStreaming.mockResolvedValue(expectedResult);
      mockEnhancedService.getMetrics.mockReturnValue({
        initialized: true,
        service: { activeExecutions: 0 }
      });

      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/stream-enhanced')
        .send({
          data: streamData,
          options: {
            maxConcurrency: 5,
            highWaterMark: 32768
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toEqual(expectedResult.result);
      expect(response.body.execution).toMatchObject({
        mappingId: expectedResult.mappingId,
        enhanced: true,
        streamConfiguration: {
          highWaterMark: 32768,
          maxConcurrency: 5,
          enableBackpressureControl: true
        }
      });

      expect(mockEnhancedService.processWithStreaming).toHaveBeenCalledWith(
        'mapping1',
        streamData,
        expect.objectContaining({
          maxConcurrency: 5,
          highWaterMark: 32768,
          enableBackpressureControl: true
        })
      );
    });

    it('should return 400 when data is missing', async () => {
      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/stream-enhanced')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Data is required for streaming');
      expect(response.body.code).toBe('MISSING_STREAM_DATA');
    });
  });

  describe('POST /:id/validate-enhanced', () => {
    it('should validate mapping successfully', async () => {
      const expectedResult = {
        mappingId: 'mapping1',
        validation: {
          valid: true,
          errors: [],
          warnings: []
        },
        analysis: {
          complexity: 0.5,
          systemResources: { availableMemory: 0.7 },
          recommendations: { executorType: 'batch' }
        },
        timestamp: new Date()
      };

      mockEnhancedService.validateMapping.mockResolvedValue(expectedResult);

      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/validate-enhanced')
        .send({
          sampleData: [{ field1: 'test' }],
          validationLevel: 'comprehensive'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validation).toEqual(expectedResult.validation);
      expect(response.body.analysis).toEqual(expectedResult.analysis);
      expect(response.body.enhanced).toBe(true);

      expect(mockEnhancedService.validateMapping).toHaveBeenCalledWith(
        'mapping1',
        expect.objectContaining({
          level: 'comprehensive',
          sampleData: [{ field1: 'test' }],
          checkPerformance: true,
          checkCompatibility: true
        })
      );
    });
  });

  describe('GET /capabilities', () => {
    it('should return enhanced mapping capabilities', async () => {
      mockEnhancedService.getHealthStatus.mockReturnValue({
        status: 'healthy',
        checks: { initialized: { status: 'pass' } }
      });
      mockEnhancedService.getMetrics.mockReturnValue({
        initialized: true,
        service: { activeExecutions: 0 }
      });

      const response = await request(app)
        .get('/api/mapping-bridge/capabilities')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.capabilities).toMatchObject({
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
      });
    });
  });

  describe('POST /:id/compare-performance', () => {
    it('should compare performance successfully', async () => {
      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/compare-performance')
        .send({
          sampleData: [{ field1: 'test' }],
          testIterations: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.comparison).toMatchObject({
        testConfiguration: {
          mappingId: 'mapping1',
          sampleDataSize: 1,
          iterations: 5
        },
        enhancedMapping: expect.objectContaining({
          features: expect.arrayContaining(['caching', 'optimization', 'error_recovery'])
        }),
        standardMapping: expect.objectContaining({
          features: expect.arrayContaining(['basic_execution'])
        }),
        recommendations: expect.arrayContaining([
          expect.stringContaining('Enhanced mapping provides better performance')
        ])
      });
    });

    it('should return 400 when sample data is missing', async () => {
      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/compare-performance')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sample data is required for performance comparison');
      expect(response.body.code).toBe('MISSING_SAMPLE_DATA');
    });
  });

  describe('POST /reset-metrics', () => {
    it('should reset metrics successfully', async () => {
      mockEnhancedService.resetMetrics.mockImplementation(() => {});

      const response = await request(app)
        .post('/api/mapping-bridge/reset-metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Enhanced mapping service metrics reset successfully');
      expect(mockEnhancedService.resetMetrics).toHaveBeenCalled();
    });

    it('should handle reset errors gracefully', async () => {
      mockEnhancedService.resetMetrics.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      const response = await request(app)
        .post('/api/mapping-bridge/reset-metrics')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to reset enhanced mapping metrics');
      expect(response.body.code).toBe('METRICS_RESET_ERROR');
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', async () => {
      mockEnhancedService.initialize.mockRejectedValue(new Error('Init failed'));

      const response = await request(app)
        .post('/api/mapping-bridge/mapping1/execute-enhanced')
        .send({ sourceData: { test: 'data' } })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Enhanced mapping execution failed');
    });
  });
});