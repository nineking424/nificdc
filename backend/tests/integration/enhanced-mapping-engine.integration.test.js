const { EnhancedMappingEngine } = require('../../services/mappingEngine/EnhancedMappingEngine');
const { EnhancedMappingService } = require('../../services/enhanced-mapping');

describe('Enhanced Mapping Engine Integration Tests', () => {
  let engine;
  let service;

  beforeAll(async () => {
    // Initialize engine with test configuration
    engine = new EnhancedMappingEngine({
      enableCache: true,
      enableMetrics: true,
      enablePerformanceOptimization: true,
      performanceOptions: {
        memoryThreshold: 0.8,
        optimizationStrategies: ['compression', 'batching', 'caching'],
        batchSizeMin: 10,
        batchSizeMax: 1000
      }
    });

    await engine.initialize();

    // Initialize service
    service = new EnhancedMappingService({
      autoInitialize: false,
      engineOptions: {
        enableCache: true,
        enableMetrics: true,
        enablePerformanceOptimization: true
      }
    });

    await service.initialize();
  });

  afterAll(async () => {
    if (engine) {
      await engine.shutdown();
    }
    if (service) {
      await service.shutdown();
    }
  });

  describe('End-to-End Mapping Execution', () => {
    const testMapping = {
      id: 'integration-test-mapping',
      version: '1.0.0',
      source: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          email: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              zipCode: { type: 'string' }
            }
          },
          orders: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                orderId: { type: 'string' },
                amount: { type: 'number' },
                date: { type: 'string' }
              }
            }
          }
        }
      },
      target: {
        type: 'object',
        properties: {
          customerId: { type: 'number' },
          fullName: { type: 'string' },
          contactEmail: { type: 'string' },
          mailingAddress: { type: 'string' },
          totalOrderValue: { type: 'number' },
          orderCount: { type: 'number' },
          lastOrderDate: { type: 'string' }
        }
      },
      rules: [
        {
          type: 'direct',
          source: 'id',
          target: 'customerId'
        },
        {
          type: 'direct',
          source: 'name',
          target: 'fullName'
        },
        {
          type: 'direct',
          source: 'email',
          target: 'contactEmail'
        },
        {
          type: 'concatenation',
          sources: ['address.street', 'address.city', 'address.zipCode'],
          target: 'mailingAddress',
          separator: ', '
        },
        {
          type: 'aggregation',
          source: 'orders',
          target: 'totalOrderValue',
          operation: 'sum',
          field: 'amount'
        },
        {
          type: 'aggregation',
          source: 'orders',
          target: 'orderCount',
          operation: 'count'
        },
        {
          type: 'aggregation',
          source: 'orders',
          target: 'lastOrderDate',
          operation: 'max',
          field: 'date'
        }
      ]
    };

    const testData = {
      id: 12345,
      name: 'John Doe',
      email: 'john.doe@example.com',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        zipCode: '12345'
      },
      orders: [
        { orderId: 'ORD001', amount: 99.99, date: '2024-01-15' },
        { orderId: 'ORD002', amount: 149.50, date: '2024-02-20' },
        { orderId: 'ORD003', amount: 75.25, date: '2024-03-10' }
      ]
    };

    it('should execute complete mapping transformation successfully', async () => {
      const result = await engine.executeMapping(testMapping, testData);

      expect(result.success).toBe(true);
      expect(result.result).toMatchObject({
        customerId: 12345,
        fullName: 'John Doe',
        contactEmail: 'john.doe@example.com',
        mailingAddress: '123 Main St, Anytown, 12345',
        totalOrderValue: 324.74,
        orderCount: 3,
        lastOrderDate: '2024-03-10'
      });

      expect(result.executionMetrics).toBeDefined();
      expect(result.executionMetrics.executionTime).toBeGreaterThan(0);
    });

    it('should handle large datasets with performance optimization', async () => {
      // Generate large dataset
      const largeDataset = Array.from({ length: 5000 }, (_, index) => ({
        id: index + 1,
        name: `User ${index + 1}`,
        email: `user${index + 1}@example.com`,
        address: {
          street: `${index + 1} Test St`,
          city: 'Test City',
          zipCode: `${String(index + 1).padStart(5, '0')}`
        },
        orders: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, orderIndex) => ({
          orderId: `ORD${index + 1}-${orderIndex + 1}`,
          amount: Math.round((Math.random() * 500 + 10) * 100) / 100,
          date: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`
        }))
      }));

      const startTime = Date.now();
      const results = [];

      // Process in chunks to test batch optimization
      for (let i = 0; i < largeDataset.length; i += 100) {
        const chunk = largeDataset.slice(i, i + 100);
        const chunkResults = await Promise.all(
          chunk.map(data => engine.executeMapping(testMapping, data))
        );
        results.push(...chunkResults);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(5000);
      expect(results.every(result => result.success)).toBe(true);
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify performance optimization was used
      const metrics = engine.getMetrics();
      expect(metrics.performance.optimizationsApplied).toBeGreaterThan(0);
    });

    it('should handle errors gracefully with recovery mechanism', async () => {
      const invalidData = {
        id: 'invalid-id', // Should be number
        name: null,
        email: 'invalid-email',
        // Missing address and orders
      };

      const result = await engine.executeMapping(testMapping, invalidData, {
        enableErrorRecovery: true,
        continueOnError: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.partialResult).toBeDefined();

      // Verify error recovery metrics
      const metrics = engine.getMetrics();
      expect(metrics.errors.recoveryAttempts).toBeGreaterThan(0);
    });
  });

  describe('Service Layer Integration', () => {
    it('should execute mapping through service layer', async () => {
      const mappingId = 'service-test-mapping';
      const sourceData = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      };

      // Mock mapping configuration retrieval
      service.getMappingConfiguration = jest.fn().mockResolvedValue({
        id: mappingId,
        version: '1.0.0',
        source: { type: 'object' },
        target: { type: 'object' },
        rules: [
          { type: 'direct', source: 'id', target: 'userId' },
          { type: 'direct', source: 'name', target: 'userName' },
          { type: 'direct', source: 'email', target: 'userEmail' }
        ]
      });

      const result = await service.executeMapping(mappingId, sourceData);

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.mappingId).toBe(mappingId);
      expect(result.result).toMatchObject({
        userId: 1,
        userName: 'Test User',
        userEmail: 'test@example.com'
      });
    });

    it('should execute batch mapping through service layer', async () => {
      const mappingId = 'batch-test-mapping';
      const dataArray = [
        { id: 1, name: 'User 1', value: 100 },
        { id: 2, name: 'User 2', value: 200 },
        { id: 3, name: 'User 3', value: 300 }
      ];

      service.getMappingConfiguration = jest.fn().mockResolvedValue({
        id: mappingId,
        version: '1.0.0',
        source: { type: 'object' },
        target: { type: 'object' },
        rules: [
          { type: 'direct', source: 'id', target: 'userId' },
          { type: 'direct', source: 'name', target: 'userName' },
          { type: 'direct', source: 'value', target: 'userValue' }
        ]
      });

      const result = await service.executeBatchMapping(mappingId, dataArray, {
        batchSize: 2,
        parallelism: 2
      });

      expect(result.success).toBe(true);
      expect(result.result.totalProcessed).toBe(3);
      expect(result.result.successful).toBe(3);
      expect(result.result.failed).toBe(0);
      expect(result.result.results).toHaveLength(3);
    });

    it('should process streaming data through service layer', async () => {
      const mappingId = 'stream-test-mapping';
      const streamData = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        value: Math.random() * 1000
      }));

      service.getMappingConfiguration = jest.fn().mockResolvedValue({
        id: mappingId,
        version: '1.0.0',
        source: { type: 'object' },
        target: { type: 'object' },
        rules: [
          { type: 'direct', source: 'id', target: 'streamId' },
          { type: 'transformation', source: 'value', target: 'processedValue', expression: 'Math.round(value * 2)' }
        ]
      });

      const result = await service.processWithStreaming(mappingId, streamData, {
        maxConcurrency: 5,
        enableBackpressureControl: true
      });

      expect(result.success).toBe(true);
      expect(result.result.results).toHaveLength(1000);
      expect(result.result.errors).toHaveLength(0);
      expect(result.result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Caching and Performance', () => {
    it('should use caching for repeated operations', async () => {
      const mapping = {
        id: 'cache-test-mapping',
        version: '1.0.0',
        source: { type: 'object' },
        target: { type: 'object' },
        rules: [{ type: 'direct', source: 'input', target: 'output' }]
      };

      const testData = { input: 'cached-value' };

      // First execution
      const result1 = await engine.executeMapping(mapping, testData);
      expect(result1.success).toBe(true);

      // Second execution should use cache
      const result2 = await engine.executeMapping(mapping, testData);
      expect(result2.success).toBe(true);

      // Verify cache was used
      const metrics = engine.getMetrics();
      expect(metrics.cache.hits).toBeGreaterThan(0);
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by processing large datasets
      const largeMapping = {
        id: 'memory-test-mapping',
        version: '1.0.0',
        source: { type: 'object' },
        target: { type: 'object' },
        rules: Array.from({ length: 100 }, (_, index) => ({
          type: 'direct',
          source: `field${index}`,
          target: `output${index}`
        }))
      };

      const largeData = {};
      for (let i = 0; i < 100; i++) {
        largeData[`field${i}`] = `value${i}`.repeat(1000); // Large string values
      }

      const result = await engine.executeMapping(largeMapping, largeData);
      expect(result.success).toBe(true);

      // Verify memory optimization was triggered
      const metrics = engine.getMetrics();
      expect(metrics.performance.memoryOptimizations).toBeGreaterThan(0);
    });
  });

  describe('Connection Pool Management', () => {
    it('should manage connection pools effectively', async () => {
      // Test connection pool creation and management
      const poolManager = engine.connectionPoolManager;

      // Create test connection pool
      await poolManager.createPool('test-pool', {
        factory: async () => ({ id: Math.random(), connected: true }),
        destroyer: async (connection) => { connection.connected = false; },
        min: 2,
        max: 10
      });

      // Acquire connections
      const connection1 = await poolManager.acquire('test-pool');
      const connection2 = await poolManager.acquire('test-pool');

      expect(connection1.connected).toBe(true);
      expect(connection2.connected).toBe(true);

      // Release connections
      await poolManager.release('test-pool', connection1);
      await poolManager.release('test-pool', connection2);

      // Check pool metrics
      const metrics = poolManager.getMetrics();
      expect(metrics.pools['test-pool']).toBeDefined();
      expect(metrics.pools['test-pool'].totalCreated).toBeGreaterThanOrEqual(2);
    });

    it('should handle connection pool errors gracefully', async () => {
      const poolManager = engine.connectionPoolManager;

      // Create pool with failing factory
      await poolManager.createPool('failing-pool', {
        factory: async () => { throw new Error('Connection failed'); },
        destroyer: async () => {},
        min: 1,
        max: 5
      });

      // Attempt to acquire connection should handle error
      await expect(poolManager.acquire('failing-pool')).rejects.toThrow();

      const metrics = poolManager.getMetrics();
      expect(metrics.pools['failing-pool'].errors).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Rollback', () => {
    it('should perform rollback on execution failure', async () => {
      const rollbackMapping = {
        id: 'rollback-test-mapping',
        version: '1.0.0',
        source: { type: 'object' },
        target: { type: 'object' },
        rules: [
          { type: 'direct', source: 'id', target: 'targetId' },
          { type: 'transformation', source: 'value', target: 'result', expression: 'invalidFunction(value)' }
        ]
      };

      const testData = { id: 1, value: 'test' };

      const result = await engine.executeMapping(rollbackMapping, testData, {
        enableRollback: true,
        rollbackOnError: true
      });

      expect(result.success).toBe(false);
      expect(result.rollbackPerformed).toBe(true);
      expect(result.errors).toBeDefined();
    });

    it('should recover from transient errors', async () => {
      let attemptCount = 0;
      const originalExecute = engine.executeRule;
      
      engine.executeRule = jest.fn().mockImplementation((...args) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Transient error');
        }
        return originalExecute.apply(engine, args);
      });

      const mapping = {
        id: 'recovery-test-mapping',
        version: '1.0.0',
        source: { type: 'object' },
        target: { type: 'object' },
        rules: [{ type: 'direct', source: 'input', target: 'output' }]
      };

      const result = await engine.executeMapping(mapping, { input: 'test' }, {
        enableErrorRecovery: true,
        maxRetries: 3,
        retryDelay: 100
      });

      expect(result.success).toBe(true);
      expect(result.recoveryAttempts).toBe(2);

      // Restore original method
      engine.executeRule = originalExecute;
    });
  });
});