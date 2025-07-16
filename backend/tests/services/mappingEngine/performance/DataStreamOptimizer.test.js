const { DataStreamOptimizer, OptimizedTransform, ParallelProcessingStream, BatchProcessingStream } = require('../../../../services/mappingEngine/performance/DataStreamOptimizer');
const { Readable, Writable, pipeline } = require('stream');

describe('DataStreamOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new DataStreamOptimizer({
      highWaterMark: 1024,
      maxConcurrency: 5,
      enableMetrics: true,
      chunkSize: 10
    });
  });

  afterEach(async () => {
    if (optimizer) {
      await optimizer.shutdown();
    }
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const defaultOptimizer = new DataStreamOptimizer();
      
      expect(defaultOptimizer.options.highWaterMark).toBe(16384);
      expect(defaultOptimizer.options.objectMode).toBe(true);
      expect(defaultOptimizer.options.maxConcurrency).toBe(10);
      expect(defaultOptimizer.options.enableMetrics).toBe(true);
      
      defaultOptimizer.shutdown();
    });

    it('should initialize metrics collection', () => {
      expect(optimizer.metrics).toMatchObject({
        totalProcessed: 0,
        totalErrors: 0,
        processingRate: 0,
        averageLatency: 0,
        backpressureEvents: 0,
        bufferUtilization: 0,
        throughputHistory: [],
        latencyHistory: []
      });
    });
  });

  describe('createOptimizedStream', () => {
    it('should create an optimized transform stream', () => {
      const transformFn = (data) => ({ processed: data });
      const stream = optimizer.createOptimizedStream(transformFn);
      
      expect(stream).toBeInstanceOf(OptimizedTransform);
      expect(optimizer.activeStreams.has(stream)).toBe(true);
    });

    it('should track active streams', () => {
      const transformFn = (data) => data;
      const stream1 = optimizer.createOptimizedStream(transformFn);
      const stream2 = optimizer.createOptimizedStream(transformFn);
      
      expect(optimizer.activeStreams.size).toBe(2);
      
      stream1.destroy();
      stream2.destroy();
    });

    it('should remove streams from tracking when closed', (done) => {
      const transformFn = (data) => data;
      const stream = optimizer.createOptimizedStream(transformFn);
      
      stream.on('close', () => {
        expect(optimizer.activeStreams.has(stream)).toBe(false);
        done();
      });
      
      stream.destroy();
    });
  });

  describe('createParallelStream', () => {
    it('should create a parallel processing stream', () => {
      const transformFn = (data) => data;
      const stream = optimizer.createParallelStream(transformFn, { maxConcurrency: 3 });
      
      expect(stream).toBeInstanceOf(ParallelProcessingStream);
      expect(stream.maxConcurrency).toBe(3);
    });
  });

  describe('createBatchStream', () => {
    it('should create a batch processing stream', () => {
      const batchFn = (batch) => batch.map(item => item * 2);
      const stream = optimizer.createBatchStream(batchFn, { batchSize: 5 });
      
      expect(stream).toBeInstanceOf(BatchProcessingStream);
      expect(stream.batchSize).toBe(5);
    });
  });

  describe('processWithStreaming', () => {
    it('should process data using streaming', async () => {
      const data = [1, 2, 3, 4, 5];
      const transformFn = (item) => item * 2;
      
      const result = await optimizer.processWithStreaming(data, transformFn);
      
      expect(result.results).toEqual([2, 4, 6, 8, 10]);
      expect(result.errors).toEqual([]);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
    });

    it('should handle transformation errors', async () => {
      const data = [1, 2, 3];
      const transformFn = (item) => {
        if (item === 2) {
          throw new Error('Transform error');
        }
        return item * 2;
      };
      
      const result = await optimizer.processWithStreaming(data, transformFn);
      
      expect(result.results.length).toBe(2); // Only successful transformations
      expect(result.errors.length).toBe(1);
    });

    it('should update metrics after processing', async () => {
      const data = [1, 2, 3];
      const transformFn = (item) => item * 2;
      
      await optimizer.processWithStreaming(data, transformFn);
      
      expect(optimizer.metrics.totalProcessed).toBe(3);
      expect(optimizer.metrics.throughputHistory.length).toBe(1);
    });
  });

  describe('createDataSource', () => {
    it('should create readable stream from array', (done) => {
      const data = [1, 2, 3];
      const sourceStream = optimizer.createDataSource(data);
      
      expect(sourceStream).toBeInstanceOf(Readable);
      
      const results = [];
      sourceStream.on('data', (chunk) => {
        results.push(chunk);
      });
      
      sourceStream.on('end', () => {
        expect(results).toEqual([1, 2, 3]);
        done();
      });
    });

    it('should create readable stream from single value', (done) => {
      const data = { id: 1, name: 'test' };
      const sourceStream = optimizer.createDataSource(data);
      
      const results = [];
      sourceStream.on('data', (chunk) => {
        results.push(chunk);
      });
      
      sourceStream.on('end', () => {
        expect(results).toEqual([data]);
        done();
      });
    });
  });

  describe('updateMetrics', () => {
    it('should update processing metrics correctly', () => {
      optimizer.updateMetrics(100, 500, 5);
      
      expect(optimizer.metrics.totalProcessed).toBe(100);
      expect(optimizer.metrics.totalErrors).toBe(5);
      expect(optimizer.metrics.throughputHistory.length).toBe(1);
      expect(optimizer.metrics.latencyHistory.length).toBe(1);
    });

    it('should limit history to 100 entries', () => {
      // Add 150 entries
      for (let i = 0; i < 150; i++) {
        optimizer.updateMetrics(10, 100, 0);
      }
      
      expect(optimizer.metrics.throughputHistory.length).toBe(100);
      expect(optimizer.metrics.latencyHistory.length).toBe(100);
    });
  });

  describe('handleBackpressure', () => {
    it('should handle backpressure events', () => {
      const backpressureHandler = jest.fn();
      optimizer.on('backpressure', backpressureHandler);
      
      optimizer.handleBackpressure('test-stream', 1500);
      
      expect(optimizer.metrics.backpressureEvents).toBe(1);
      expect(backpressureHandler).toHaveBeenCalledWith({
        streamId: 'test-stream',
        bufferSize: 1500,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics', () => {
      const metrics = optimizer.getMetrics();
      
      expect(metrics).toMatchObject({
        totalProcessed: 0,
        totalErrors: 0,
        processingRate: 0,
        averageLatency: 0,
        backpressureEvents: 0,
        bufferUtilization: 0,
        throughputHistory: [],
        latencyHistory: [],
        activeStreams: 0,
        successRate: 0
      });
    });

    it('should calculate success rate correctly', () => {
      optimizer.updateMetrics(80, 100, 20); // 80 processed, 20 errors
      
      const metrics = optimizer.getMetrics();
      expect(metrics.successRate).toBe(75); // (80-20)/80 * 100
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      optimizer.updateMetrics(100, 500, 10);
      
      expect(optimizer.metrics.totalProcessed).toBe(100);
      
      optimizer.resetMetrics();
      
      expect(optimizer.metrics.totalProcessed).toBe(0);
      expect(optimizer.metrics.totalErrors).toBe(0);
      expect(optimizer.metrics.throughputHistory).toEqual([]);
      expect(optimizer.metrics.latencyHistory).toEqual([]);
    });
  });
});

describe('OptimizedTransform', () => {
  let transform;
  let transformFn;

  beforeEach(() => {
    transformFn = jest.fn((data) => ({ processed: data }));
    transform = new OptimizedTransform(transformFn, {
      objectMode: true,
      enableBackpressureControl: true
    });
  });

  afterEach(() => {
    if (!transform.destroyed) {
      transform.destroy();
    }
  });

  describe('_transform', () => {
    it('should transform data successfully', (done) => {
      const testData = { id: 1, name: 'test' };
      
      transform.on('data', (chunk) => {
        expect(chunk).toEqual({ processed: testData });
        expect(transformFn).toHaveBeenCalledWith(testData);
        expect(transform.metrics.processed).toBe(1);
        done();
      });
      
      transform.write(testData);
    });

    it('should handle transformation errors', (done) => {
      transformFn.mockImplementation(() => {
        throw new Error('Transform failed');
      });
      
      transform.on('error', (error) => {
        expect(error.message).toBe('Transform failed');
        expect(transform.metrics.errors).toBe(1);
        done();
      });
      
      transform.write({ test: 'data' });
    });

    it('should track processing metrics', (done) => {
      const testData = { id: 1 };
      
      transform.on('data', () => {
        expect(transform.metrics.processed).toBe(1);
        expect(transform.metrics.avgProcessingTime).toBeGreaterThan(0);
        expect(transform.processingTimes.length).toBe(1);
        done();
      });
      
      transform.write(testData);
    });
  });

  describe('updateMetrics', () => {
    it('should update processing metrics', () => {
      transform.updateMetrics(50);
      transform.updateMetrics(75);
      
      expect(transform.metrics.processed).toBe(2);
      expect(transform.processingTimes).toEqual([50, 75]);
      expect(transform.metrics.avgProcessingTime).toBe(62.5);
    });

    it('should limit processing times to 100 entries', () => {
      for (let i = 0; i < 150; i++) {
        transform.updateMetrics(10);
      }
      
      expect(transform.processingTimes.length).toBe(100);
      expect(transform.metrics.processed).toBe(150);
    });
  });

  describe('getBufferUtilization', () => {
    it('should calculate buffer utilization percentage', () => {
      const utilization = transform.getBufferUtilization();
      expect(utilization).toBeGreaterThanOrEqual(0);
      expect(utilization).toBeLessThanOrEqual(100);
    });
  });

  describe('getMetrics', () => {
    it('should return stream metrics', () => {
      transform.updateMetrics(25);
      
      const metrics = transform.getMetrics();
      expect(metrics).toMatchObject({
        processed: 1,
        errors: 0,
        avgProcessingTime: 25,
        bufferHighWater: expect.any(Number),
        bufferUtilization: expect.any(Number)
      });
    });
  });
});

describe('ParallelProcessingStream', () => {
  let parallelStream;
  let transformFn;

  beforeEach(() => {
    transformFn = jest.fn((data) => Promise.resolve(data * 2));
    parallelStream = new ParallelProcessingStream(transformFn, {
      maxConcurrency: 3
    });
  });

  afterEach(() => {
    if (!parallelStream.destroyed) {
      parallelStream.destroy();
    }
  });

  describe('_transform', () => {
    it('should process data in parallel', (done) => {
      const results = [];
      
      parallelStream.on('data', (chunk) => {
        results.push(chunk);
      });
      
      parallelStream.on('finish', () => {
        expect(results.sort()).toEqual([2, 4, 6]);
        expect(parallelStream.processedCount).toBe(3);
        done();
      });
      
      parallelStream.write(1);
      parallelStream.write(2);
      parallelStream.write(3);
      parallelStream.end();
    });

    it('should respect concurrency limits', () => {
      expect(parallelStream.maxConcurrency).toBe(3);
      
      // Write more items than concurrency limit
      for (let i = 0; i < 5; i++) {
        parallelStream.write(i);
      }
      
      expect(parallelStream.activePromises.size).toBeLessThanOrEqual(3);
    });

    it('should handle processing errors', (done) => {
      transformFn.mockImplementation((data) => {
        if (data === 2) {
          return Promise.reject(new Error('Processing failed'));
        }
        return Promise.resolve(data * 2);
      });
      
      parallelStream.on('error', (error) => {
        expect(error.message).toBe('Processing failed');
        done();
      });
      
      parallelStream.write(1);
      parallelStream.write(2);
      parallelStream.end();
    });
  });

  describe('getMetrics', () => {
    it('should return parallel processing metrics', () => {
      const metrics = parallelStream.getMetrics();
      
      expect(metrics).toMatchObject({
        processed: 0,
        activeTasks: 0,
        concurrency: 3
      });
    });
  });
});

describe('BatchProcessingStream', () => {
  let batchStream;
  let batchFn;

  beforeEach(() => {
    batchFn = jest.fn((batch) => Promise.resolve(batch.map(item => item * 2)));
    batchStream = new BatchProcessingStream(batchFn, {
      batchSize: 3,
      flushTimeout: 100
    });
  });

  afterEach(() => {
    if (!batchStream.destroyed) {
      batchStream.destroy();
    }
  });

  describe('_transform', () => {
    it('should batch data and process when batch is full', (done) => {
      const results = [];
      
      batchStream.on('data', (chunk) => {
        results.push(chunk);
      });
      
      batchStream.on('finish', () => {
        expect(results).toEqual([2, 4, 6]);
        expect(batchFn).toHaveBeenCalledWith([1, 2, 3]);
        expect(batchStream.processedBatches).toBe(1);
        done();
      });
      
      batchStream.write(1);
      batchStream.write(2);
      batchStream.write(3); // This should trigger batch processing
      batchStream.end();
    });

    it('should flush incomplete batch on timeout', (done) => {
      const results = [];
      
      batchStream.on('data', (chunk) => {
        results.push(chunk);
      });
      
      // Write less than batch size and wait for timeout
      batchStream.write(1);
      batchStream.write(2);
      
      setTimeout(() => {
        expect(results).toEqual([2, 4]);
        expect(batchFn).toHaveBeenCalledWith([1, 2]);
        done();
      }, 150);
    });

    it('should handle batch processing errors', (done) => {
      batchFn.mockImplementation(() => {
        throw new Error('Batch processing failed');
      });
      
      batchStream.on('error', (error) => {
        expect(error.message).toBe('Batch processing failed');
        done();
      });
      
      batchStream.write(1);
      batchStream.write(2);
      batchStream.write(3);
    });
  });

  describe('processBatch', () => {
    it('should clear batch timer when processing', async () => {
      batchStream.currentBatch = [1, 2];
      batchStream.batchTimer = setTimeout(() => {}, 1000);
      
      await batchStream.processBatch();
      
      expect(batchStream.batchTimer).toBeNull();
      expect(batchStream.currentBatch).toEqual([]);
    });

    it('should not process empty batch', async () => {
      batchStream.currentBatch = [];
      
      await batchStream.processBatch();
      
      expect(batchFn).not.toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return batch processing metrics', () => {
      batchStream.currentBatch = [1, 2];
      batchStream.processedBatches = 5;
      
      const metrics = batchStream.getMetrics();
      
      expect(metrics).toMatchObject({
        processedBatches: 5,
        currentBatchSize: 2,
        configuredBatchSize: 3
      });
    });
  });
});