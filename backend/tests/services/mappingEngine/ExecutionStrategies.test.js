const {
  SequentialExecutor,
  BatchExecutor,
  StreamExecutor,
  ParallelExecutor,
  ExecutionContext,
  createExecutor
} = require('../../../services/mappingEngine/executors');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Execution Strategies Tests', () => {
  let mockPipeline;
  
  beforeEach(() => {
    // Create mock pipeline
    mockPipeline = {
      execute: jest.fn().mockImplementation(async (data) => {
        return { ...data, processed: true };
      })
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('SequentialExecutor', () => {
    it('should process single record', async () => {
      const executor = new SequentialExecutor();
      const context = new ExecutionContext();
      const data = { id: 1, name: 'Test' };
      
      const result = await executor.execute(data, mockPipeline, context);
      
      expect(result).toEqual({ id: 1, name: 'Test', processed: true });
      expect(mockPipeline.execute).toHaveBeenCalledTimes(1);
    });
    
    it('should process array of records', async () => {
      const executor = new SequentialExecutor();
      const context = new ExecutionContext();
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];
      
      const result = await executor.execute(data, mockPipeline, context);
      
      expect(result).toHaveLength(2);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(2);
    });
    
    it('should handle errors with stopOnError', async () => {
      const executor = new SequentialExecutor({ stopOnError: true });
      const context = new ExecutionContext();
      
      mockPipeline.execute.mockRejectedValueOnce(new Error('Test error'));
      
      await expect(executor.execute([{ id: 1 }], mockPipeline, context))
        .rejects.toThrow('Sequential execution failed at record 0');
    });
  });
  
  describe('BatchExecutor', () => {
    it('should process records in batches', async () => {
      const executor = new BatchExecutor({ batchSize: 2 });
      const context = new ExecutionContext();
      const data = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];
      
      const result = await executor.execute(data, mockPipeline, context);
      
      expect(result).toHaveLength(3);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(3);
    });
    
    it('should emit batch events', async () => {
      const executor = new BatchExecutor({ batchSize: 2 });
      const batchHandler = jest.fn();
      executor.on('batchComplete', batchHandler);
      
      const context = new ExecutionContext();
      await executor.execute([1, 2, 3].map(id => ({ id })), mockPipeline, context);
      
      expect(batchHandler).toHaveBeenCalledTimes(2); // 3 items / 2 batch size
    });
  });
  
  describe('StreamExecutor', () => {
    it('should process records as stream', async () => {
      const executor = new StreamExecutor({ highWaterMark: 2 });
      const context = new ExecutionContext();
      const data = [{ id: 1 }, { id: 2 }];
      
      const result = await executor.execute(data, mockPipeline, context);
      
      expect(result).toHaveLength(2);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(2);
    });
    
    it('should handle empty data', async () => {
      const executor = new StreamExecutor();
      const context = new ExecutionContext();
      
      const result = await executor.execute([], mockPipeline, context);
      
      expect(result).toEqual([]);
      expect(mockPipeline.execute).not.toHaveBeenCalled();
    });
  });
  
  describe('ParallelExecutor', () => {
    it('should process records in parallel', async () => {
      const executor = new ParallelExecutor({ 
        maxConcurrency: 2,
        chunkSize: 1 
      });
      const context = new ExecutionContext();
      const data = [{ id: 1 }, { id: 2 }];
      
      const result = await executor.execute(data, mockPipeline, context);
      
      expect(result).toHaveLength(2);
      expect(mockPipeline.execute).toHaveBeenCalledTimes(2);
    });
    
    it('should maintain order', async () => {
      const executor = new ParallelExecutor({ 
        maxConcurrency: 2,
        chunkSize: 2 
      });
      const context = new ExecutionContext();
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      
      // Make pipeline add index
      mockPipeline.execute.mockImplementation(async (data) => ({
        ...data,
        processed: true
      }));
      
      const result = await executor.execute(data, mockPipeline, context);
      
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });
  });
  
  describe('Factory function', () => {
    it('should create executors by type', () => {
      expect(createExecutor('sequential')).toBeInstanceOf(SequentialExecutor);
      expect(createExecutor('batch')).toBeInstanceOf(BatchExecutor);
      expect(createExecutor('stream')).toBeInstanceOf(StreamExecutor);
      expect(createExecutor('parallel')).toBeInstanceOf(ParallelExecutor);
    });
    
    it('should throw for unknown type', () => {
      expect(() => createExecutor('invalid'))
        .toThrow('Unknown executor type: invalid');
    });
  });
  
  describe('ExecutionContext integration', () => {
    it('should track metrics', async () => {
      const executor = new SequentialExecutor();
      const context = new ExecutionContext();
      
      context.start();
      
      await executor.execute([{ id: 1 }, { id: 2 }], mockPipeline, context);
      
      context.complete();
      
      const metrics = executor.getMetrics();
      expect(metrics.executionCount).toBe(1);
      expect(metrics.recordsProcessed).toBe(2);
    });
  });
});