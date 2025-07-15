const {
  EnhancedMappingEngine,
  MappingValidationError,
  createMappingEngine,
  createPipelineBuilder,
  createStandardPipeline,
  validateMappingConfiguration,
  createMappingRule,
  MappingProfiler,
  MappingStatistics
} = require('../../../services/mappingEngine');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock transform library
jest.mock('../../../utils/transformLibrary', () => ({
  uppercase: (value) => value ? value.toString().toUpperCase() : value,
  lowercase: (value) => value ? value.toString().toLowerCase() : value,
  trim: (value) => value ? value.toString().trim() : value,
  formatDate: (value) => value ? new Date(value).toISOString() : value,
  formatNumber: (value) => value ? Number(value).toFixed(2) : value
}));

describe('Enhanced Mapping Engine Tests', () => {
  let engine;
  let mockMapping;
  let mockSourceData;

  beforeEach(() => {
    engine = new EnhancedMappingEngine({
      enableCache: true,
      enableMetrics: true,
      cacheSize: 100,
      maxConcurrency: 4
    });

    mockMapping = {
      id: 'test-mapping-1',
      version: '1.0.0',
      name: 'Test Mapping',
      description: 'Test mapping for unit tests',
      sourceSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' }
        }
      },
      targetSchema: {
        type: 'object',
        properties: {
          userId: { type: 'number' },
          fullName: { type: 'string' },
          emailAddress: { type: 'string' },
          userAge: { type: 'number' },
          isActive: { type: 'boolean' }
        }
      },
      rules: [
        {
          name: 'mapId',
          type: 'direct',
          sourceField: 'id',
          targetField: 'userId'
        },
        {
          name: 'mapName',
          type: 'transform',
          sourceField: 'name',
          targetField: 'fullName',
          transformType: 'uppercase'
        },
        {
          name: 'mapEmail',
          type: 'direct',
          sourceField: 'email',
          targetField: 'emailAddress'
        },
        {
          name: 'mapAge',
          type: 'direct',
          sourceField: 'age',
          targetField: 'userAge'
        },
        {
          name: 'mapActive',
          type: 'direct',
          sourceField: 'active',
          targetField: 'isActive'
        }
      ],
      defaultValues: {
        isActive: true,
        createdAt: new Date().toISOString()
      }
    };

    mockSourceData = {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      age: 30,
      active: true
    };
  });

  afterEach(() => {
    engine.clearCaches();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default options', () => {
      const defaultEngine = new EnhancedMappingEngine();
      
      expect(defaultEngine.options.enableCache).toBe(false);
      expect(defaultEngine.options.enableMetrics).toBe(true);
      expect(defaultEngine.options.cacheSize).toBe(1000);
      expect(defaultEngine.options.maxConcurrency).toBe(10);
      expect(defaultEngine.transformers.size).toBeGreaterThan(0);
      expect(defaultEngine.validators.size).toBeGreaterThan(0);
      expect(defaultEngine.executors.size).toBeGreaterThan(0);
    });

    it('should initialize with custom options', () => {
      expect(engine.options.enableCache).toBe(true);
      expect(engine.options.enableMetrics).toBe(true);
      expect(engine.options.cacheSize).toBe(100);
      expect(engine.options.maxConcurrency).toBe(4);
    });

    it('should load built-in transformations', () => {
      expect(engine.transformers.has('uppercase')).toBe(true);
      expect(engine.transformers.has('lowercase')).toBe(true);
      expect(engine.transformers.has('trim')).toBe(true);
    });

    it('should load built-in validators', () => {
      expect(engine.validators.has('required')).toBe(true);
      expect(engine.validators.has('email')).toBe(true);
      expect(engine.validators.has('number')).toBe(true);
    });

    it('should load built-in executors', () => {
      expect(engine.executors.has('batch')).toBe(true);
      expect(engine.executors.has('stream')).toBe(true);
      expect(engine.executors.has('parallel')).toBe(true);
      expect(engine.executors.has('sequential')).toBe(true);
    });
  });

  describe('Mapping Execution', () => {
    it('should execute simple mapping successfully', async () => {
      const result = await engine.executeMapping(mockMapping, mockSourceData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.userId).toBe(1);
      expect(result.data.fullName).toBe('JOHN DOE');
      expect(result.data.emailAddress).toBe('john.doe@example.com');
      expect(result.data.userAge).toBe(30);
      expect(result.data.isActive).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle array data', async () => {
      const arrayData = [
        mockSourceData,
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          age: 25,
          active: false
        }
      ];

      const result = await engine.executeMapping(mockMapping, arrayData);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].userId).toBe(1);
      expect(result.data[0].fullName).toBe('JOHN DOE');
      expect(result.data[1].userId).toBe(2);
      expect(result.data[1].fullName).toBe('JANE SMITH');
    });

    it('should apply default values', async () => {
      const dataWithoutActive = {
        id: 1,
        name: 'John Doe',
        email: 'john.doe@example.com',
        age: 30
      };

      const result = await engine.executeMapping(mockMapping, dataWithoutActive);
      
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
      expect(result.data.createdAt).toBeDefined();
    });

    it('should handle missing source fields gracefully', async () => {
      const incompleteData = {
        id: 1,
        name: 'John Doe'
        // Missing email, age, active
      };

      const result = await engine.executeMapping(mockMapping, incompleteData);
      
      expect(result.success).toBe(true);
      expect(result.data.userId).toBe(1);
      expect(result.data.fullName).toBe('JOHN DOE');
      expect(result.data.emailAddress).toBeUndefined();
      expect(result.data.userAge).toBeUndefined();
      expect(result.data.isActive).toBe(true); // Default value
    });

    it('should use cache when enabled', async () => {
      // First execution
      const result1 = await engine.executeMapping(mockMapping, mockSourceData);
      expect(result1.success).toBe(true);
      
      // Second execution (should use cache)
      const result2 = await engine.executeMapping(mockMapping, mockSourceData);
      expect(result2.success).toBe(true);
      
      const metrics = engine.getMetrics();
      expect(metrics.engine.cacheHits).toBe(1);
      expect(metrics.engine.cacheMisses).toBe(1);
    });

    it('should handle execution timeout', async () => {
      const slowMapping = {
        ...mockMapping,
        rules: [
          {
            name: 'slowRule',
            type: 'transform',
            sourceField: 'name',
            targetField: 'fullName',
            transformType: 'uppercase'
          }
        ]
      };

      // Mock a slow transformation
      const originalTransform = engine.transformers.get('uppercase');
      engine.transformers.set('uppercase', async (value) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return originalTransform(value);
      });

      const result = await engine.executeMapping(slowMapping, mockSourceData, {
        timeout: 50
      });
      
      // Should still complete but may show timeout warnings
      expect(result.success).toBe(true);
      
      // Restore original transformer
      engine.transformers.set('uppercase', originalTransform);
    });

    it('should emit events during execution', async () => {
      const events = [];
      
      engine.on('mappingComplete', (event) => events.push({ type: 'complete', ...event }));
      engine.on('mappingError', (event) => events.push({ type: 'error', ...event }));
      
      await engine.executeMapping(mockMapping, mockSourceData);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('complete');
      expect(events[0].success).toBe(true);
      expect(events[0].recordsProcessed).toBe(1);
    });
  });

  describe('Batch Execution', () => {
    it('should execute batch mapping successfully', async () => {
      const batchData = [
        mockSourceData,
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          age: 25,
          active: false
        },
        {
          id: 3,
          name: 'Bob Johnson',
          email: 'bob.johnson@example.com',
          age: 35,
          active: true
        }
      ];

      const result = await engine.executeBatchMapping(mockMapping, batchData, {
        batchSize: 2,
        parallelism: 2
      });
      
      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should handle batch execution errors', async () => {
      const invalidMapping = {
        ...mockMapping,
        rules: [
          {
            name: 'invalidRule',
            type: 'invalid_type',
            sourceField: 'name',
            targetField: 'fullName'
          }
        ]
      };

      const batchData = [mockSourceData, mockSourceData];

      const result = await engine.executeBatchMapping(invalidMapping, batchData, {
        continueOnError: true,
        strictMode: true
      });
      
      expect(result.errorCount).toBe(2);
      expect(result.successCount).toBe(0);
    });

    it('should provide progress callbacks', async () => {
      const progressEvents = [];
      const batchData = Array.from({ length: 5 }, (_, i) => ({
        ...mockSourceData,
        id: i + 1,
        name: `User ${i + 1}`
      }));

      await engine.executeBatchMapping(mockMapping, batchData, {
        batchSize: 2,
        progressCallback: (progress) => progressEvents.push(progress)
      });
      
      expect(progressEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should validate required mapping fields', async () => {
      await expect(engine.executeMapping(null, mockSourceData))
        .rejects.toThrow(MappingValidationError);
      
      await expect(engine.executeMapping({}, mockSourceData))
        .rejects.toThrow(MappingValidationError);
      
      await expect(engine.executeMapping({ id: 'test' }, mockSourceData))
        .rejects.toThrow(MappingValidationError);
    });

    it('should validate source data', async () => {
      await expect(engine.executeMapping(mockMapping, null))
        .rejects.toThrow(MappingValidationError);
      
      await expect(engine.executeMapping(mockMapping, undefined))
        .rejects.toThrow(MappingValidationError);
    });

    it('should validate mapping rules', async () => {
      const invalidMapping = {
        ...mockMapping,
        rules: [
          {
            name: 'invalidRule',
            type: 'unknown_type',
            sourceField: 'name',
            targetField: 'fullName'
          }
        ]
      };

      await expect(engine.executeMapping(invalidMapping, mockSourceData, { strictMode: true }))
        .rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle transformation errors gracefully', async () => {
      // Mock a failing transformation
      engine.transformers.set('failing_transform', () => {
        throw new Error('Transformation failed');
      });

      const failingMapping = {
        ...mockMapping,
        rules: [
          {
            name: 'failingRule',
            type: 'transform',
            sourceField: 'name',
            targetField: 'fullName',
            transformType: 'failing_transform'
          }
        ]
      };

      await expect(engine.executeMapping(failingMapping, mockSourceData, { strictMode: true }))
        .rejects.toThrow();
    });

    it('should update error metrics', async () => {
      const initialMetrics = engine.getMetrics();
      
      try {
        await engine.executeMapping(null, mockSourceData);
      } catch (error) {
        // Expected to fail
      }
      
      const updatedMetrics = engine.getMetrics();
      expect(updatedMetrics.engine.errorCount).toBe(initialMetrics.engine.errorCount + 1);
    });
  });

  describe('Performance Metrics', () => {
    it('should track execution metrics', async () => {
      const initialMetrics = engine.getMetrics();
      
      await engine.executeMapping(mockMapping, mockSourceData);
      
      const updatedMetrics = engine.getMetrics();
      expect(updatedMetrics.engine.executionCount).toBe(initialMetrics.engine.executionCount + 1);
      expect(updatedMetrics.engine.successCount).toBe(initialMetrics.engine.successCount + 1);
      expect(updatedMetrics.engine.totalExecutionTime).toBeGreaterThan(initialMetrics.engine.totalExecutionTime);
    });

    it('should calculate success rate', async () => {
      await engine.executeMapping(mockMapping, mockSourceData);
      
      const metrics = engine.getMetrics();
      expect(metrics.engine.successRate).toBeGreaterThan(0);
    });

    it('should track cache hit rate', async () => {
      await engine.executeMapping(mockMapping, mockSourceData);
      await engine.executeMapping(mockMapping, mockSourceData);
      
      const metrics = engine.getMetrics();
      expect(metrics.engine.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Custom Extensions', () => {
    it('should allow custom transformer registration', async () => {
      const customTransformer = (value) => `custom_${value}`;
      engine.registerTransformer('custom', customTransformer);
      
      expect(engine.transformers.has('custom')).toBe(true);
      expect(engine.transformers.get('custom')).toBe(customTransformer);
    });

    it('should allow custom validator registration', async () => {
      const customValidator = (value) => value.startsWith('custom_');
      engine.registerValidator('custom', customValidator);
      
      expect(engine.validators.has('custom')).toBe(true);
      expect(engine.validators.get('custom')).toBe(customValidator);
    });

    it('should allow custom executor registration', async () => {
      const customExecutor = {
        execute: async (sourceData, mapping, context) => sourceData
      };
      engine.registerExecutor('custom', customExecutor);
      
      expect(engine.executors.has('custom')).toBe(true);
      expect(engine.executors.get('custom')).toBe(customExecutor);
    });
  });

  describe('Cache Management', () => {
    it('should clear caches', () => {
      engine.cache.set('test', 'value');
      engine.pipelines.set('test', {});
      
      engine.clearCaches();
      
      expect(engine.cache.size).toBe(0);
      expect(engine.pipelines.size).toBe(0);
    });

    it('should cleanup cache when size exceeds limit', async () => {
      const smallCacheEngine = new EnhancedMappingEngine({
        enableCache: true,
        cacheSize: 2
      });

      // Add items to exceed cache size
      smallCacheEngine.cache.set('key1', 'value1');
      smallCacheEngine.cache.set('key2', 'value2');
      smallCacheEngine.cache.set('key3', 'value3');
      
      smallCacheEngine.cleanupCache();
      
      expect(smallCacheEngine.cache.size).toBeLessThanOrEqual(2);
    });
  });
});

describe('Factory Functions', () => {
  describe('createMappingEngine', () => {
    it('should create engine with options', () => {
      const engine = createMappingEngine({
        enableCache: true,
        maxConcurrency: 5
      });
      
      expect(engine).toBeInstanceOf(EnhancedMappingEngine);
      expect(engine.options.enableCache).toBe(true);
      expect(engine.options.maxConcurrency).toBe(5);
    });
  });

  describe('createPipelineBuilder', () => {
    it('should create pipeline builder', () => {
      const builder = createPipelineBuilder();
      expect(builder).toBeDefined();
      expect(typeof builder.preprocessing).toBe('function');
      expect(typeof builder.transformation).toBe('function');
      expect(typeof builder.validation).toBe('function');
      expect(typeof builder.postprocessing).toBe('function');
    });
  });

  describe('createStandardPipeline', () => {
    it('should create standard pipeline', () => {
      const pipeline = createStandardPipeline({
        mappingRules: [
          {
            name: 'test',
            type: 'direct',
            sourceField: 'name',
            targetField: 'fullName'
          }
        ]
      });
      
      expect(pipeline).toBeDefined();
      expect(typeof pipeline.execute).toBe('function');
    });
  });

  describe('createMappingRule', () => {
    it('should create valid mapping rule', () => {
      const rule = createMappingRule({
        name: 'testRule',
        type: 'direct',
        sourceField: 'name',
        targetField: 'fullName'
      });
      
      expect(rule.name).toBe('testRule');
      expect(rule.type).toBe('direct');
      expect(rule.sourceField).toBe('name');
      expect(rule.targetField).toBe('fullName');
      expect(rule.enabled).toBe(true);
    });

    it('should throw error for invalid rule', () => {
      expect(() => {
        createMappingRule({
          type: 'invalid_type',
          targetField: 'fullName'
        });
      }).toThrow(MappingValidationError);
    });
  });
});

describe('Validation Functions', () => {
  describe('validateMappingConfiguration', () => {
    it('should validate correct mapping configuration', () => {
      const validMapping = {
        id: 'test-mapping',
        rules: [
          {
            name: 'testRule',
            type: 'direct',
            sourceField: 'name',
            targetField: 'fullName'
          }
        ],
        sourceSchema: { type: 'object' },
        targetSchema: { type: 'object' }
      };

      const result = validateMappingConfiguration(validMapping);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidMapping = {
        rules: []
      };

      const result = validateMappingConfiguration(invalidMapping);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mapping ID is required');
    });

    it('should detect invalid rules', () => {
      const invalidMapping = {
        id: 'test-mapping',
        rules: [
          {
            name: 'invalidRule',
            type: 'direct'
            // Missing targetField
          }
        ]
      };

      const result = validateMappingConfiguration(invalidMapping);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('targetField is required'))).toBe(true);
    });
  });
});

describe('Utility Classes', () => {
  describe('MappingProfiler', () => {
    it('should profile operations', () => {
      const profiler = new MappingProfiler();
      
      profiler.startProfile('test');
      
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }
      
      const profile = profiler.endProfile('test');
      
      expect(profile).toBeDefined();
      expect(profile.duration).toBeGreaterThan(0);
      expect(profile.memoryUsage).toBeDefined();
    });

    it('should handle missing profiles', () => {
      const profiler = new MappingProfiler();
      const profile = profiler.endProfile('nonexistent');
      
      expect(profile).toBeNull();
    });
  });

  describe('MappingStatistics', () => {
    it('should record execution statistics', () => {
      const stats = new MappingStatistics();
      
      stats.recordExecution('mapping1', 100, 50, true);
      stats.recordExecution('mapping1', 200, 75, false, new Error('Test error'));
      
      const result = stats.getStats();
      
      expect(result.totalExecutions).toBe(2);
      expect(result.successfulExecutions).toBe(1);
      expect(result.failedExecutions).toBe(1);
      expect(result.totalRecordsProcessed).toBe(300);
      expect(result.successRate).toBe(50);
    });

    it('should reset statistics', () => {
      const stats = new MappingStatistics();
      
      stats.recordExecution('mapping1', 100, 50, true);
      stats.reset();
      
      const result = stats.getStats();
      
      expect(result.totalExecutions).toBe(0);
      expect(result.successfulExecutions).toBe(0);
      expect(result.failedExecutions).toBe(0);
    });
  });
});