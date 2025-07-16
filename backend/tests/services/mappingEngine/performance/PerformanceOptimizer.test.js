const { PerformanceOptimizer, MemoryManager, CacheManager, BatchOptimizer } = require('../../../../services/mappingEngine/performance/PerformanceOptimizer');

describe('PerformanceOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      enableMemoryManagement: true,
      enableDataCompression: true,
      enableBatchOptimization: true,
      enableCaching: true,
      memoryThreshold: 0.8,
      maxCacheSize: 1000
    });
  });

  afterEach(async () => {
    if (optimizer) {
      await optimizer.shutdown();
    }
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const defaultOptimizer = new PerformanceOptimizer();
      
      expect(defaultOptimizer.options.enableMemoryManagement).toBe(true);
      expect(defaultOptimizer.options.enableDataCompression).toBe(true);
      expect(defaultOptimizer.options.enableBatchOptimization).toBe(true);
      expect(defaultOptimizer.options.enableCaching).toBe(true);
      expect(defaultOptimizer.options.memoryThreshold).toBe(0.8);
      
      defaultOptimizer.shutdown();
    });

    it('should initialize performance monitoring', () => {
      expect(optimizer.monitoringInterval).toBeDefined();
      expect(optimizer.metrics).toBeDefined();
      expect(optimizer.metrics.memoryUsage).toEqual([]);
      expect(optimizer.metrics.processingTimes).toEqual([]);
    });
  });

  describe('optimizeDataProcessing', () => {
    it('should optimize simple data', async () => {
      const testData = { id: 1, name: 'test' };
      const result = await optimizer.optimizeDataProcessing(testData);
      
      expect(result).toBeDefined();
      expect(optimizer.metrics.processingTimes.length).toBe(1);
    });

    it('should optimize array data with batch optimization', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item${i}` }));
      const result = await optimizer.optimizeDataProcessing(testData);
      
      expect(result).toBeDefined();
      expect(optimizer.metrics.processingTimes.length).toBe(1);
    });

    it('should handle optimization errors gracefully', async () => {
      // Mock compression manager to throw error
      optimizer.compressionManager.compress = jest.fn().mockRejectedValue(new Error('Compression failed'));
      
      const testData = { id: 1, name: 'test' };
      
      await expect(optimizer.optimizeDataProcessing(testData)).rejects.toThrow('Compression failed');
    });

    it('should emit dataOptimized event', async () => {
      const optimizedHandler = jest.fn();
      optimizer.on('dataOptimized', optimizedHandler);
      
      const testData = { id: 1, name: 'test' };
      await optimizer.optimizeDataProcessing(testData);
      
      expect(optimizedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          originalSize: expect.any(Number),
          optimizedSize: expect.any(Number),
          processingTime: expect.any(Number),
          optimizations: expect.any(Object)
        })
      );
    });
  });

  describe('optimizeExecutionStrategy', () => {
    it('should recommend batch processing for large datasets', () => {
      const recommendation = optimizer.optimizeExecutionStrategy(
        15000, // dataSize
        0.5,   // complexity
        { availableMemory: 0.6, cpuUsage: 0.4 }
      );
      
      expect(recommendation.executorType).toBe('batch');
      expect(recommendation.batchSize).toBeGreaterThan(100);
      expect(recommendation.reason).toContain('Large dataset detected, using batch processing');
    });

    it('should recommend streaming for very large datasets', () => {
      const recommendation = optimizer.optimizeExecutionStrategy(
        150000, // dataSize
        0.3,    // complexity
        { availableMemory: 0.8, cpuUsage: 0.3 }
      );
      
      expect(recommendation.executorType).toBe('stream');
      expect(recommendation.memoryStrategy).toBe('streaming');
      expect(recommendation.reason).toContain('Very large dataset, using streaming');
    });

    it('should recommend parallel processing for high complexity', () => {
      const recommendation = optimizer.optimizeExecutionStrategy(
        5000, // dataSize
        0.8,  // complexity
        { availableMemory: 0.7, cpuUsage: 0.3 }
      );
      
      expect(recommendation.executorType).toBe('parallel');
      expect(recommendation.parallelism).toBeGreaterThan(1);
      expect(recommendation.reason).toContain('High complexity, using parallel processing');
    });

    it('should adjust for low memory conditions', () => {
      const recommendation = optimizer.optimizeExecutionStrategy(
        10000, // dataSize
        0.5,   // complexity
        { availableMemory: 0.2, cpuUsage: 0.4 } // Low memory
      );
      
      expect(recommendation.memoryStrategy).toBe('conservative');
      expect(recommendation.reason).toContain('Low memory, reducing batch size');
    });

    it('should adjust for high CPU usage', () => {
      const recommendation = optimizer.optimizeExecutionStrategy(
        5000, // dataSize
        0.8,  // complexity
        { availableMemory: 0.7, cpuUsage: 0.9 } // High CPU
      );
      
      expect(recommendation.parallelism).toBeLessThanOrEqual(2);
      expect(recommendation.reason).toContain('High CPU usage, reducing parallelism');
    });
  });

  describe('handleMemoryPressure', () => {
    it('should handle memory pressure events', async () => {
      const warningHandler = jest.fn();
      optimizer.on('performanceWarning', warningHandler);
      
      await optimizer.handleMemoryPressure({ pressure: 0.9 });
      
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory_pressure',
          level: 0.9,
          actions: expect.arrayContaining(['cache_cleared', 'gc_forced'])
        })
      );
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics', () => {
      const metrics = optimizer.getMetrics();
      
      expect(metrics).toMatchObject({
        uptime: expect.any(Number),
        memoryUsage: null, // No metrics collected yet
        cpuUsage: null,
        averageProcessingTime: 0,
        averageCompressionRatio: 0,
        cacheHitRate: 0,
        throughput: 0,
        optimizationsSummary: expect.any(Object)
      });
    });

    it('should calculate averages correctly after processing', async () => {
      // Process some data to generate metrics
      await optimizer.optimizeDataProcessing({ test: 'data1' });
      await optimizer.optimizeDataProcessing({ test: 'data2' });
      
      const metrics = optimizer.getMetrics();
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', async () => {
      // Generate some metrics
      await optimizer.optimizeDataProcessing({ test: 'data' });
      
      expect(optimizer.metrics.processingTimes.length).toBeGreaterThan(0);
      
      optimizer.resetMetrics();
      
      expect(optimizer.metrics.processingTimes.length).toBe(0);
      expect(optimizer.metrics.memoryUsage.length).toBe(0);
      expect(optimizer.metrics.startTime).toBeCloseTo(Date.now(), -2);
    });
  });

  describe('getDataSize', () => {
    it('should calculate string size correctly', () => {
      const testString = 'Hello World';
      const size = optimizer.getDataSize(testString);
      
      expect(size).toBe(Buffer.byteLength(testString, 'utf8'));
    });

    it('should calculate buffer size correctly', () => {
      const testBuffer = Buffer.from('Hello World');
      const size = optimizer.getDataSize(testBuffer);
      
      expect(size).toBe(testBuffer.length);
    });

    it('should estimate object size', () => {
      const testObject = { id: 1, name: 'test', data: [1, 2, 3] };
      const size = optimizer.getDataSize(testObject);
      
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });
  });
});

describe('MemoryManager', () => {
  let memoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      memoryThreshold: 0.8
    });
  });

  afterEach(async () => {
    await memoryManager.shutdown();
  });

  describe('optimizeData', () => {
    it('should process large arrays in chunks', async () => {
      const largeArray = Array.from({ length: 2000 }, (_, i) => i);
      const result = await memoryManager.optimizeData(largeArray);
      
      expect(result).toEqual(largeArray);
      expect(memoryManager.getOptimizationCount()).toBe(1);
    });

    it('should return small data unchanged', async () => {
      const smallData = { id: 1, name: 'test' };
      const result = await memoryManager.optimizeData(smallData);
      
      expect(result).toEqual(smallData);
      expect(memoryManager.getOptimizationCount()).toBe(0);
    });
  });

  describe('processInChunks', () => {
    it('should process data in specified chunk sizes', async () => {
      const data = Array.from({ length: 150 }, (_, i) => i);
      const result = await memoryManager.processInChunks(data, 50);
      
      expect(result).toEqual(data);
      expect(result.length).toBe(150);
    });
  });

  describe('handleMemoryPressure', () => {
    it('should emit memory pressure events', () => {
      const pressureHandler = jest.fn();
      memoryManager.on('memoryPressure', pressureHandler);
      
      const event = { pressure: 0.9 };
      memoryManager.handleMemoryPressure(event);
      
      expect(pressureHandler).toHaveBeenCalledWith(event);
    });
  });
});

describe('CacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      maxCacheSize: 5
    });
  });

  afterEach(async () => {
    await cacheManager.shutdown();
  });

  describe('cacheData and getCachedData', () => {
    it('should cache and retrieve data successfully', async () => {
      const testData = { id: 1, name: 'test' };
      const cacheKey = 'test-key';
      
      await cacheManager.cacheData(testData, cacheKey);
      const cached = cacheManager.getCachedData(cacheKey);
      
      expect(cached).toEqual(testData);
      expect(cacheManager.getHitRate()).toBe(100);
    });

    it('should return null for non-existent keys', () => {
      const cached = cacheManager.getCachedData('non-existent');
      
      expect(cached).toBeNull();
      expect(cacheManager.getHitRate()).toBe(0);
    });

    it('should update access times on cache hits', async () => {
      const testData = { id: 1, name: 'test' };
      const cacheKey = 'test-key';
      
      await cacheManager.cacheData(testData, cacheKey);
      
      // Get cached data multiple times
      cacheManager.getCachedData(cacheKey);
      cacheManager.getCachedData(cacheKey);
      
      expect(cacheManager.getHitRate()).toBe(100);
    });
  });

  describe('clearOldEntries', () => {
    it('should remove oldest entries when cache is full', async () => {
      // Fill cache beyond capacity
      for (let i = 0; i < 10; i++) {
        await cacheManager.cacheData({ id: i }, `key-${i}`);
      }
      
      expect(cacheManager.cache.size).toBeLessThanOrEqual(5);
    });

    it('should emit cache eviction events', async () => {
      const evictionHandler = jest.fn();
      cacheManager.on('cacheEviction', evictionHandler);
      
      // Fill cache beyond capacity
      for (let i = 0; i < 10; i++) {
        await cacheManager.cacheData({ id: i }, `key-${i}`);
      }
      
      expect(evictionHandler).toHaveBeenCalled();
    });
  });

  describe('getHitRate', () => {
    it('should calculate hit rate correctly', async () => {
      await cacheManager.cacheData({ id: 1 }, 'key1');
      await cacheManager.cacheData({ id: 2 }, 'key2');
      
      // 2 hits, 1 miss
      cacheManager.getCachedData('key1');
      cacheManager.getCachedData('key2');
      cacheManager.getCachedData('key3'); // miss
      
      expect(cacheManager.getHitRate()).toBeCloseTo(66.67, 1);
    });

    it('should return 0 for no accesses', () => {
      expect(cacheManager.getHitRate()).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset hit and miss counts', async () => {
      await cacheManager.cacheData({ id: 1 }, 'key1');
      cacheManager.getCachedData('key1');
      cacheManager.getCachedData('key2'); // miss
      
      expect(cacheManager.getHitRate()).toBe(50);
      
      cacheManager.resetMetrics();
      
      expect(cacheManager.getHitRate()).toBe(0);
    });
  });
});

describe('BatchOptimizer', () => {
  let batchOptimizer;

  beforeEach(() => {
    batchOptimizer = new BatchOptimizer({});
  });

  describe('getOptimalBatchSize', () => {
    it('should calculate optimal batch size for different data sizes', () => {
      expect(batchOptimizer.getOptimalBatchSize(Array(50))).toBe(50);
      expect(batchOptimizer.getOptimalBatchSize(Array(500))).toBe(100);
      expect(batchOptimizer.getOptimalBatchSize(Array(5000))).toBe(500);
      expect(batchOptimizer.getOptimalBatchSize(Array(50000))).toBe(1000);
      expect(batchOptimizer.getOptimalBatchSize(Array(200000))).toBe(2000);
    });

    it('should use performance history when available', () => {
      // Record performance data
      batchOptimizer.recordPerformance(200, 100, 200); // 2 items/ms
      batchOptimizer.recordPerformance(100, 75, 100);  // ~1.33 items/ms
      
      const optimalSize = batchOptimizer.getOptimalBatchSize(Array(1000));
      expect(optimalSize).toBe(200); // Should pick the better performing batch size
    });
  });

  describe('calculateOptimalBatchSize', () => {
    it('should return appropriate batch sizes for different data sizes', () => {
      expect(batchOptimizer.calculateOptimalBatchSize(50)).toBe(50);
      expect(batchOptimizer.calculateOptimalBatchSize(500)).toBe(100);
      expect(batchOptimizer.calculateOptimalBatchSize(5000)).toBe(500);
      expect(batchOptimizer.calculateOptimalBatchSize(50000)).toBe(1000);
      expect(batchOptimizer.calculateOptimalBatchSize(150000)).toBe(2000);
    });
  });

  describe('createOptimizedBatches', () => {
    it('should create correct number of batches', () => {
      const data = Array.from({ length: 250 }, (_, i) => i);
      const batches = batchOptimizer.createOptimizedBatches(data, 100);
      
      expect(batches.length).toBe(3); // 100, 100, 50
      expect(batches[0].length).toBe(100);
      expect(batches[1].length).toBe(100);
      expect(batches[2].length).toBe(50);
      expect(batchOptimizer.getOptimizationCount()).toBe(1);
    });

    it('should handle exact multiples', () => {
      const data = Array.from({ length: 200 }, (_, i) => i);
      const batches = batchOptimizer.createOptimizedBatches(data, 100);
      
      expect(batches.length).toBe(2);
      expect(batches[0].length).toBe(100);
      expect(batches[1].length).toBe(100);
    });

    it('should handle single batch', () => {
      const data = Array.from({ length: 50 }, (_, i) => i);
      const batches = batchOptimizer.createOptimizedBatches(data, 100);
      
      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(50);
    });
  });

  describe('recordPerformance', () => {
    it('should record performance metrics', () => {
      batchOptimizer.recordPerformance(100, 50, 100);
      batchOptimizer.recordPerformance(200, 80, 200);
      
      expect(batchOptimizer.performanceHistory.length).toBe(2);
      expect(batchOptimizer.performanceHistory[0]).toMatchObject({
        batchSize: 100,
        processingTime: 50,
        itemsProcessed: 100
      });
    });

    it('should limit history to 100 entries', () => {
      // Record 150 performance entries
      for (let i = 0; i < 150; i++) {
        batchOptimizer.recordPerformance(100, 10, 100);
      }
      
      expect(batchOptimizer.performanceHistory.length).toBe(100);
    });
  });

  describe('resetMetrics', () => {
    it('should reset optimization count and performance history', () => {
      const data = Array.from({ length: 100 }, (_, i) => i);
      batchOptimizer.createOptimizedBatches(data, 50);
      batchOptimizer.recordPerformance(50, 25, 50);
      
      expect(batchOptimizer.getOptimizationCount()).toBe(1);
      expect(batchOptimizer.performanceHistory.length).toBe(1);
      
      batchOptimizer.resetMetrics();
      
      expect(batchOptimizer.getOptimizationCount()).toBe(0);
      expect(batchOptimizer.performanceHistory.length).toBe(0);
    });
  });
});