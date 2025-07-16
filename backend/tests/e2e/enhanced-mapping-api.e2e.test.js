const request = require('supertest');
const express = require('express');
const { EnhancedMappingEngine } = require('../../services/mappingEngine/EnhancedMappingEngine');
const { EnhancedMappingService } = require('../../services/enhanced-mapping');
const EnhancedMappingIntegration = require('../../middleware/enhanced-mapping-integration');

// Mock database and external dependencies
jest.mock('../../models', () => ({
  Mapping: {
    findByPk: jest.fn(),
    findAll: jest.fn()
  },
  System: {},
  DataSchema: {}
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock auth middleware
const mockAuth = {
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'test-user', name: 'Test User', role: 'admin' };
    next();
  }),
  authorize: jest.fn(() => (req, res, next) => next())
};

jest.mock('../../middleware/auth', () => mockAuth);

describe('Enhanced Mapping API End-to-End Tests', () => {
  let app;
  let integration;
  let server;

  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json({ limit: '50mb' }));
    
    // Initialize enhanced mapping integration
    integration = new EnhancedMappingIntegration(app, {
      enablePrometheus: false, // Disable for testing
      enableHealthChecks: true,
      enableMetricsCollection: true,
      basePath: '/api'
    });
    
    await integration.initialize();
    
    // Mount mapping bridge routes
    const mappingBridgeRouter = require('../../routes/api/mapping-bridge');
    app.use('/api/mapping-bridge', mappingBridgeRouter);
    
    // Start test server
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (integration) {
      await integration.shutdown();
    }
  });

  describe('Health and Status Endpoints', () => {
    it('should return healthy status for enhanced mappings', async () => {
      const response = await request(app)
        .get('/health/enhanced-mappings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.health.status).toBe('healthy');
      expect(response.body.health.components).toMatchObject({
        enhancedMappingEngine: 'available',
        apiRoutes: 'mounted',
        integration: 'active'
      });
    });

    it('should return enhanced mapping capabilities', async () => {
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

  describe('Complete Mapping Workflow', () => {
    const sampleMapping = {
      id: 'e2e-test-mapping',
      version: '1.0.0',
      source: {
        type: 'object',
        properties: {
          customer: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' }
            }
          },
          order: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              orderDate: { type: 'string' },
              totalAmount: { type: 'number' },
              currency: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    productName: { type: 'string' },
                    quantity: { type: 'number' },
                    unitPrice: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      },
      target: {
        type: 'object',
        properties: {
          customerId: { type: 'number' },
          customerName: { type: 'string' },
          contactInfo: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              phone: { type: 'string' }
            }
          },
          orderSummary: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              date: { type: 'string' },
              total: { type: 'number' },
              currency: { type: 'string' },
              itemCount: { type: 'number' },
              totalValue: { type: 'number' }
            }
          }
        }
      },
      rules: [
        { type: 'direct', source: 'customer.id', target: 'customerId' },
        { type: 'concatenation', sources: ['customer.firstName', 'customer.lastName'], target: 'customerName', separator: ' ' },
        { type: 'direct', source: 'customer.email', target: 'contactInfo.email' },
        { type: 'direct', source: 'customer.phone', target: 'contactInfo.phone' },
        { type: 'direct', source: 'order.orderId', target: 'orderSummary.id' },
        { type: 'direct', source: 'order.orderDate', target: 'orderSummary.date' },
        { type: 'direct', source: 'order.totalAmount', target: 'orderSummary.total' },
        { type: 'direct', source: 'order.currency', target: 'orderSummary.currency' },
        { type: 'aggregation', source: 'order.items', target: 'orderSummary.itemCount', operation: 'count' },
        { type: 'aggregation', source: 'order.items', target: 'orderSummary.totalValue', operation: 'sum', field: 'quantity' }
      ]
    };

    const sampleData = {
      customer: {
        id: 12345,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-123-4567'
      },
      order: {
        orderId: 'ORD-2024-001',
        orderDate: '2024-07-16T00:00:00Z',
        totalAmount: 299.99,
        currency: 'USD',
        items: [
          { productId: 'PROD-001', productName: 'Widget A', quantity: 2, unitPrice: 49.99 },
          { productId: 'PROD-002', productName: 'Widget B', quantity: 1, unitPrice: 199.99 },
          { productId: 'PROD-003', productName: 'Widget C', quantity: 3, unitPrice: 19.99 }
        ]
      }
    };

    beforeEach(() => {
      // Mock the Mapping model to return our test mapping
      const { Mapping } = require('../../models');
      Mapping.findByPk.mockResolvedValue({
        id: 'e2e-test-mapping',
        config: JSON.stringify(sampleMapping),
        version: '1.0.0',
        status: 'active'
      });
    });

    it('should execute single enhanced mapping through API', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/e2e-test-mapping/execute')
        .send({
          sourceData: sampleData,
          options: {
            enablePerformanceOptimization: true,
            enableCache: true,
            enableRollback: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toMatchObject({
        customerId: 12345,
        customerName: 'John Doe',
        contactInfo: {
          email: 'john.doe@example.com',
          phone: '+1-555-123-4567'
        },
        orderSummary: {
          id: 'ORD-2024-001',
          date: '2024-07-16T00:00:00Z',
          total: 299.99,
          currency: 'USD',
          itemCount: 3,
          totalValue: 6 // 2 + 1 + 3
        }
      });

      expect(response.body.execution).toMatchObject({
        mappingId: 'e2e-test-mapping',
        enhanced: true
      });
    });

    it('should execute batch enhanced mapping through API', async () => {
      const batchData = Array.from({ length: 10 }, (_, index) => ({
        customer: {
          id: 12345 + index,
          firstName: `Customer`,
          lastName: `${index + 1}`,
          email: `customer${index + 1}@example.com`,
          phone: `+1-555-000-${String(index + 1).padStart(4, '0')}`
        },
        order: {
          orderId: `ORD-2024-${String(index + 1).padStart(3, '0')}`,
          orderDate: '2024-07-16T00:00:00Z',
          totalAmount: (index + 1) * 50,
          currency: 'USD',
          items: [
            { productId: 'PROD-001', productName: 'Widget A', quantity: index + 1, unitPrice: 50 }
          ]
        }
      }));

      const response = await request(app)
        .post('/api/enhanced-mappings/e2e-test-mapping/execute-batch')
        .send({
          dataArray: batchData,
          batchSize: 5,
          parallelism: 2,
          continueOnError: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.totalProcessed).toBe(10);
      expect(response.body.result.successful).toBe(10);
      expect(response.body.result.failed).toBe(0);
      expect(response.body.result.results).toHaveLength(10);

      // Verify first result
      expect(response.body.result.results[0]).toMatchObject({
        customerId: 12345,
        customerName: 'Customer 1',
        orderSummary: {
          id: 'ORD-2024-001',
          itemCount: 1,
          totalValue: 1
        }
      });
    });

    it('should process streaming data through API', async () => {
      const streamData = Array.from({ length: 100 }, (_, index) => ({
        customer: {
          id: 20000 + index,
          firstName: `Stream`,
          lastName: `User ${index + 1}`,
          email: `stream${index + 1}@example.com`,
          phone: `+1-555-999-${String(index + 1).padStart(4, '0')}`
        },
        order: {
          orderId: `STR-2024-${String(index + 1).padStart(3, '0')}`,
          orderDate: '2024-07-16T00:00:00Z',
          totalAmount: Math.random() * 1000,
          currency: 'USD',
          items: [
            { productId: 'PROD-STREAM', productName: 'Stream Widget', quantity: 1, unitPrice: Math.random() * 100 }
          ]
        }
      }));

      const response = await request(app)
        .post('/api/enhanced-mappings/e2e-test-mapping/stream')
        .send({
          data: streamData,
          options: {
            highWaterMark: 16384,
            maxConcurrency: 10,
            enableBackpressureControl: true,
            enableAdaptiveBuffering: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.results).toHaveLength(100);
      expect(response.body.result.errors).toHaveLength(0);
      expect(response.body.result.processingTime).toBeGreaterThan(0);
      expect(response.body.execution.enhanced).toBe(true);
    });

    it('should validate mapping through API', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/e2e-test-mapping/validate')
        .send({
          sampleData: sampleData,
          validationLevel: 'comprehensive',
          options: {
            checkPerformance: true,
            checkCompatibility: true,
            estimatedDataSize: 1000
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validation).toBeDefined();
      expect(response.body.validation.valid).toBe(true);
      expect(response.body.analysis).toBeDefined();
      expect(response.body.enhanced).toBe(true);
    });
  });

  describe('Bridge API Integration', () => {
    it('should execute enhanced mapping through bridge API', async () => {
      const testData = {
        id: 1,
        name: 'Bridge Test',
        value: 100
      };

      const response = await request(app)
        .post('/api/mapping-bridge/bridge-test-mapping/execute-enhanced')
        .send({
          sourceData: testData,
          options: {
            enablePerformanceOptimization: true,
            enableCache: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.execution.enhanced).toBe(true);
    });

    it('should compare performance through bridge API', async () => {
      const testData = [
        { id: 1, name: 'Performance Test 1', value: 100 },
        { id: 2, name: 'Performance Test 2', value: 200 }
      ];

      const response = await request(app)
        .post('/api/mapping-bridge/performance-test-mapping/compare-performance')
        .send({
          sampleData: testData,
          testIterations: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.comparison).toBeDefined();
      expect(response.body.comparison.testConfiguration).toMatchObject({
        mappingId: 'performance-test-mapping',
        sampleDataSize: 2,
        iterations: 3
      });
      expect(response.body.comparison.enhancedMapping).toBeDefined();
      expect(response.body.comparison.standardMapping).toBeDefined();
      expect(response.body.comparison.recommendations).toHaveLength(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid mapping IDs gracefully', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/non-existent-mapping/execute')
        .send({
          sourceData: { test: 'data' }
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should handle malformed data gracefully', async () => {
      const response = await request(app)
        .post('/api/enhanced-mappings/e2e-test-mapping/execute')
        .send({
          sourceData: null
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Source data is required');
    });

    it('should handle large payloads', async () => {
      const largeData = {
        id: 1,
        name: 'Large Data Test',
        data: 'x'.repeat(1000000) // 1MB string
      };

      const response = await request(app)
        .post('/api/mapping-bridge/large-data-mapping/execute-enhanced')
        .send({
          sourceData: largeData
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, index) => 
        request(app)
          .post('/api/enhanced-mappings/e2e-test-mapping/execute')
          .send({
            sourceData: {
              customer: { id: index, firstName: `User`, lastName: `${index}` },
              order: { orderId: `CONC-${index}`, items: [] }
            }
          })
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result.customerId).toBe(index);
      });
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should collect and return metrics', async () => {
      // Execute some mappings to generate metrics
      await request(app)
        .post('/api/enhanced-mappings/e2e-test-mapping/execute')
        .send({
          sourceData: {
            customer: { id: 999, firstName: 'Metrics', lastName: 'Test' },
            order: { orderId: 'METRICS-001', items: [] }
          }
        });

      const response = await request(app)
        .get('/api/enhanced-mappings/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metrics).toBeDefined();
      expect(response.body.metrics.executionCount).toBeGreaterThan(0);
    });

    it('should reset metrics when requested', async () => {
      const response = await request(app)
        .post('/api/mapping-bridge/reset-metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Enhanced mapping service metrics reset successfully');
    });

    it('should provide health status', async () => {
      const response = await request(app)
        .get('/api/enhanced-mappings/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.health.status).toBe('healthy');
      expect(response.body.health.checks).toBeDefined();
    });
  });

  describe('Connection Pool Management', () => {
    it('should manage connection pools through API', async () => {
      // Create a connection pool
      const createResponse = await request(app)
        .post('/api/enhanced-mappings/connections/pools')
        .send({
          poolName: 'e2e-test-pool',
          factory: 'testConnectionFactory',
          config: {
            min: 2,
            max: 10,
            acquireTimeoutMillis: 5000,
            idleTimeoutMillis: 30000
          }
        })
        .expect(200);

      expect(createResponse.body.success).toBe(true);

      // Get pool statistics
      const statsResponse = await request(app)
        .get('/api/enhanced-mappings/connections/pools/stats')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.connectionPools).toBeDefined();
    });
  });
});