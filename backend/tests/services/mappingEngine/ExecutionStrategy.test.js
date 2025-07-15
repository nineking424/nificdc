const {
  SequentialExecutor,
  BatchExecutor,
  StreamExecutor,
  ParallelExecutor,
  ExecutionContext,
  createExecutor
} = require('../../../services/mappingEngine/executors');
const { TransformationPipeline, PipelineBuilder } = require('../../../services/mappingEngine/TransformationPipeline');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Execution Strategy Tests', () => {
  let mockPipeline;
  let testData;
  
  beforeEach(() => {
    // Create mock pipeline
    mockPipeline = {
      execute: jest.fn().mockImplementation(async (data) => {
        // Simulate some processing
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...data, processed: true };
      })
    };
    
    // Test data
    testData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
      { id: 4, name: 'Item 4' },
      { id: 5, name: 'Item 5' }
    ];
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('SequentialExecutor', () => {
    let executor;
    
    beforeEach(() => {
      executor = new SequentialExecutor();
    });
    
    it('should process records sequentially', async () => {
      const context = new ExecutionContext();
      const result = await executor.execute(testData, mockPipeline, context);
      
      expect(result).toHaveLength(5);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(5);
      
      // Verify sequential processing
      for (let i = 0; i < testData.length; i++) {
        expect(mockPipeline.execute).toHaveBeenNthCalledWith(
          i + 1,
          testData[i],
          expect.objectContaining({
            recordIndex: i,
            totalRecords: 5
          })
        );
      }
    });
    
    it('should handle single record', async () => {
      const context = new ExecutionContext();
      const singleRecord = { id: 1, name: 'Single' };
      const result = await executor.execute(singleRecord, mockPipeline, context);
      
      expect(result).toEqual({ id: 1, name: 'Single', processed: true });
      expect(mockPipeline.execute).toHaveBeenCalledTimes(1);
    });
    
    it('should stop on error when configured', async () => {
      executor = new SequentialExecutor({ stopOnError: true });
      
      mockPipeline.execute.mockRejectedValueOnce(new Error('Processing failed'));
      
      const context = new ExecutionContext();
      await expect(executor.execute(testData, mockPipeline, context))
        .rejects.toThrow('Sequential execution failed at record 0');
        
      expect(mockPipeline.execute).toHaveBeenCalledTimes(1);
    });
    
    it('should continue on error when configured', async () => {
      executor = new SequentialExecutor({ stopOnError: false });
      
      mockPipeline.execute
        .mockResolvedValueOnce({ id: 1, processed: true })
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce({ id: 3, processed: true });
      
      const context = new ExecutionContext();
      const result = await executor.execute(testData.slice(0, 3), mockPipeline, context);
      
      expect(result).toHaveLength(3);
      expect(context.executionErrors).toHaveLength(1);
      expect(context.executionErrors[0].recordIndex).toBe(1);
    });
    
    it('should emit progress events', async () => {
      const progressHandler = jest.fn();
      executor.on('progress', progressHandler);
      
      const context = new ExecutionContext();
      await executor.execute(testData, mockPipeline, context);
      
      expect(progressHandler).toHaveBeenCalledTimes(5);
      expect(progressHandler).toHaveBeenLastCalledWith({
        current: 5,
        total: 5,
        percentage: 100
      });
    });
  });
  
  describe('BatchExecutor', () => {
    let executor;
    
    beforeEach(() => {
      executor = new BatchExecutor({ batchSize: 2 });
    });
    
    it('should process records in batches', async () => {
      const context = new ExecutionContext();
      const result = await executor.execute(testData, mockPipeline, context);
      
      expect(result).toHaveLength(5);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(5);
      
      // Should emit batch complete events
      const batchCompleteHandler = jest.fn();
      executor.on('batchComplete', batchCompleteHandler);
      
      await executor.execute(testData, mockPipeline, context);
      
      expect(batchCompleteHandler).toHaveBeenCalledTimes(3); // 5 records / 2 batch size = 3 batches
    });
    
    it('should validate array input', async () => {
      const context = new ExecutionContext();
      
      await expect(executor.execute('not an array', mockPipeline, context))
        .rejects.toThrow('Batch execution requires an array of records');
    });
    
    it('should respect batch size configuration', async () => {
      executor = new BatchExecutor({ batchSize: 3 });
      
      const batchCompleteHandler = jest.fn();
      executor.on('batchComplete', batchCompleteHandler);
      
      const context = new ExecutionContext();
      await executor.execute(testData, mockPipeline, context);
      
      // 5 records / 3 batch size = 2 batches
      expect(batchCompleteHandler).toHaveBeenCalledTimes(2);
      
      // First batch should have 3 records
      expect(batchCompleteHandler).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({
          recordsProcessed: 3
        })
      );
      
      // Second batch should have 2 records
      expect(batchCompleteHandler).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          recordsProcessed: 2
        })
      );
    });
    
    it('should handle batch delay', async () => {
      executor = new BatchExecutor({ 
        batchSize: 2,
        delayBetweenBatches: 50 
      });
      
      const startTime = Date.now();
      const context = new ExecutionContext();
      await executor.execute(testData, mockPipeline, context);
      const endTime = Date.now();
      
      // Should have delays between batches
      expect(endTime - startTime).toBeGreaterThanOrEqual(100); // 2 delays of 50ms
    });
    
    it('should skip failed records when configured', async () => {
      executor = new BatchExecutor({ 
        batchSize: 2,
        skipFailedRecords: true
      });
      
      mockPipeline.execute
        .mockResolvedValueOnce({ id: 1, processed: true })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ id: 3, processed: true });
      
      const context = new ExecutionContext();
      const result = await executor.execute(testData.slice(0, 3), mockPipeline, context);
      
      expect(result).toHaveLength(3);
      expect(result[1]).toMatchObject({
        error: true,
        message: 'Failed'
      });
    });
  });
  
  describe('StreamExecutor', () => {
    let executor;
    
    beforeEach(() => {
      executor = new StreamExecutor({ 
        highWaterMark: 2,
        backpressureThreshold: 10 
      });
    });
    
    it('should process records as a stream', async () => {
      const context = new ExecutionContext();
      const result = await executor.execute(testData, mockPipeline, context);
      
      expect(result).toHaveLength(5);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(5);
    });
    
    it('should respect high water mark', async () => {
      const progressHandler = jest.fn();
      executor.on('streamProgress', progressHandler);
      
      const context = new ExecutionContext();
      await executor.execute(testData, mockPipeline, context);
      
      // Should process in chunks of highWaterMark size
      expect(progressHandler).toHaveBeenCalled();
    });
    
    it('should handle pause and resume', async () => {
      const context = new ExecutionContext();
      
      // Start execution
      const executionPromise = executor.execute(testData, mockPipeline, context);
      
      // Pause after a short delay
      setTimeout(() => executor.pause(), 20);
      
      // Check if paused
      await new Promise(resolve => setTimeout(resolve, 50));
      const callCountWhilePaused = mockPipeline.execute.mock.calls.length;
      
      // Resume
      executor.resume();
      
      // Wait for completion
      await executionPromise;
      
      // Should have completed all executions
      expect(mockPipeline.execute).toHaveBeenCalledTimes(5);
      expect(callCountWhilePaused).toBeLessThan(5);
    });
    
    it('should emit backpressure events', async () => {
      executor = new StreamExecutor({ 
        highWaterMark: 2,
        backpressureThreshold: 3 
      });
      
      const backpressureHandler = jest.fn();
      executor.on('backpressure', backpressureHandler);
      
      const context = new ExecutionContext();
      await executor.execute(testData, mockPipeline, context);
      
      // Should emit backpressure when threshold is reached
      expect(backpressureHandler).toHaveBeenCalled();
    });
  });
  
  describe('ParallelExecutor', () => {
    let executor;
    
    beforeEach(() => {
      executor = new ParallelExecutor({ 
        maxConcurrency: 2,
        chunkSize: 2 
      });
    });
    
    it('should process records in parallel', async () => {
      const context = new ExecutionContext();
      const startTime = Date.now();
      const result = await executor.execute(testData, mockPipeline, context);
      const endTime = Date.now();
      
      expect(result).toHaveLength(5);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(5);
      
      // Should be faster than sequential processing (5 * 10ms = 50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });
    
    it('should respect max concurrency', async () => {
      executor = new ParallelExecutor({ 
        maxConcurrency: 1,
        chunkSize: 1 
      });
      
      const context = new ExecutionContext();
      const startTime = Date.now();
      await executor.execute(testData, mockPipeline, context);
      const endTime = Date.now();
      
      // With concurrency 1, should take approximately sequential time
      expect(endTime - startTime).toBeGreaterThanOrEqual(40);
    });
    
    it('should handle chunk completion events', async () => {
      const chunkCompleteHandler = jest.fn();
      executor.on('chunkComplete', chunkCompleteHandler);
      
      const context = new ExecutionContext();
      await executor.execute(testData, mockPipeline, context);
      
      // 5 records / 2 chunk size = 3 chunks
      expect(chunkCompleteHandler).toHaveBeenCalledTimes(3);
    });
    
    it('should maintain result order', async () => {
      // Make processing times random
      mockPipeline.execute.mockImplementation(async (data) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        return { ...data, processed: true };
      });
      
      const context = new ExecutionContext();
      const result = await executor.execute(testData, mockPipeline, context);
      
      // Results should be in original order despite parallel processing
      for (let i = 0; i < testData.length; i++) {
        expect(result[i].id).toBe(testData[i].id);
      }
    });
    
    it('should handle timeout', async () => {
      executor = new ParallelExecutor({ 
        maxConcurrency: 2,
        chunkSize: 2,
        timeout: 5 // Very short timeout
      });
      
      mockPipeline.execute.mockImplementation(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Longer than timeout
        return data;
      });
      
      const context = new ExecutionContext();
      
      await expect(executor.execute(testData, mockPipeline, context))
        .rejects.toThrow('timeout');
    });
  });
  
  describe('ExecutionContext', () => {
    it('should track execution state', () => {
      const context = new ExecutionContext({
        mappingId: 'test-mapping',
        userId: 'user-123'
      });
      
      expect(context.state.status).toBe('initialized');
      
      context.start();
      expect(context.state.status).toBe('running');
      expect(context.state.startTime).toBeDefined();
      
      context.complete({ success: true });
      expect(context.state.status).toBe('completed');
      expect(context.state.endTime).toBeDefined();
      expect(context.state.duration).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle progress updates', () => {
      const progressCallback = jest.fn();
      const context = new ExecutionContext({
        onProgress: progressCallback
      });
      
      context.updateProgress(50, 100, 'Processing...');
      
      expect(context.state.progress).toBe(50);
      expect(context.state.recordsProcessed).toBe(50);
      expect(progressCallback).toHaveBeenCalledWith({
        contextId: context.id,
        current: 50,
        total: 100,
        progress: 50,
        message: 'Processing...'
      });
    });
    
    it('should track errors', () => {
      const errorCallback = jest.fn();
      const context = new ExecutionContext({
        onError: errorCallback
      });
      
      const error = new Error('Test error');
      context.addError(error, { id: 1 });
      
      expect(context.state.errors).toHaveLength(1);
      expect(context.metrics.recordsFailed).toBe(1);
      expect(errorCallback).toHaveBeenCalled();
    });
    
    it('should support profiling', () => {
      const context = new ExecutionContext({
        enableProfiling: true
      });
      
      context.startProfiling();
      
      // Profile a stage
      const result = context.profileStage('testStage', () => {
        // Simulate some work
        return 'stage result';
      });
      
      expect(result).toBe('stage result');
      expect(context.profiling.stages.testStage).toBeDefined();
      expect(context.profiling.stages.testStage.count).toBe(1);
    });
    
    it('should create child contexts', () => {
      const parentContext = new ExecutionContext({
        mappingId: 'parent-mapping'
      });
      
      const childContext = parentContext.createChildContext({
        mappingId: 'child-mapping'
      });
      
      expect(childContext.parentId).toBe(parentContext.id);
      expect(childContext.metadata.mappingId).toBe('child-mapping');
    });
    
    it('should merge child context results', () => {
      const parentContext = new ExecutionContext();
      const childContext = new ExecutionContext();
      
      childContext.metrics.recordsProcessed = 10;
      childContext.metrics.recordsFailed = 2;
      childContext.addError(new Error('Child error'));
      
      parentContext.mergeChildContext(childContext);
      
      expect(parentContext.metrics.recordsProcessed).toBe(10);
      expect(parentContext.metrics.recordsFailed).toBe(2);
      expect(parentContext.state.errors).toHaveLength(1);
    });
    
    it('should serialize and deserialize', () => {
      const context = new ExecutionContext({
        mappingId: 'test-mapping',
        userId: 'user-123'
      });
      
      context.start();
      context.updateProgress(50, 100);
      context.addError(new Error('Test error'));
      
      const json = context.toJSON();
      const restored = ExecutionContext.fromJSON(json);
      
      expect(restored.id).toBe(context.id);
      expect(restored.state.status).toBe(context.state.status);
      expect(restored.state.progress).toBe(50);
      expect(restored.state.errors).toHaveLength(1);
    });
  });
  
  describe('Factory Functions', () => {
    it('should create executors by type', () => {
      const sequential = createExecutor('sequential');
      expect(sequential).toBeInstanceOf(SequentialExecutor);
      
      const batch = createExecutor('batch', { batchSize: 50 });
      expect(batch).toBeInstanceOf(BatchExecutor);
      expect(batch.batchSize).toBe(50);
      
      const stream = createExecutor('stream');
      expect(stream).toBeInstanceOf(StreamExecutor);
      
      const parallel = createExecutor('parallel');
      expect(parallel).toBeInstanceOf(ParallelExecutor);
    });
    
    it('should throw for unknown executor type', () => {
      expect(() => createExecutor('unknown'))
        .toThrow('Unknown executor type: unknown');
    });
  });
  
  describe('Integration Tests', () => {
    it('should work with real pipeline', async () => {
      // Create a real pipeline with stages
      const pipeline = new PipelineBuilder()
        .addStage({
          name: 'transform',
          execute: async (data) => ({
            ...data,
            transformed: true,
            value: data.value * 2
          })
        })
        .addStage({
          name: 'validate',
          execute: async (data) => {
            if (data.value < 0) {
              throw new Error('Invalid value');
            }
            return data;
          }
        })
        .build();
      
      const testData = [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 }
      ];
      
      // Test with different executors
      const executors = [
        new SequentialExecutor(),
        new BatchExecutor({ batchSize: 2 }),
        new StreamExecutor({ highWaterMark: 2 }),
        new ParallelExecutor({ maxConcurrency: 2 })
      ];
      
      for (const executor of executors) {
        const context = new ExecutionContext();
        const result = await executor.execute(testData, pipeline, context);
        
        expect(result).toHaveLength(3);
        expect(result[0].transformed).toBe(true);
        expect(result[0].value).toBe(20);
        expect(result[1].value).toBe(40);
        expect(result[2].value).toBe(60);
      }
    });
  });
});