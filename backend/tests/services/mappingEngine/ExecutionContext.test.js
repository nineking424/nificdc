const ExecutionContext = require('../../../services/mappingEngine/executors/ExecutionContext');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('ExecutionContext Tests', () => {
  describe('Basic functionality', () => {
    it('should create execution context with default values', () => {
      const context = new ExecutionContext();
      
      expect(context.id).toBeDefined();
      expect(context.parentId).toBeNull();
      expect(context.state.status).toBe('initialized');
      expect(context.metadata.source).toBe('unknown');
      expect(context.metadata.target).toBe('unknown');
    });
    
    it('should create execution context with options', () => {
      const options = {
        id: 'test-id',
        source: 'database',
        target: 'api',
        mappingId: 'mapping-123',
        userId: 'user-456'
      };
      
      const context = new ExecutionContext(options);
      
      expect(context.id).toBe('test-id');
      expect(context.metadata.source).toBe('database');
      expect(context.metadata.target).toBe('api');
      expect(context.metadata.mappingId).toBe('mapping-123');
      expect(context.metadata.userId).toBe('user-456');
    });
  });
  
  describe('State management', () => {
    it('should start execution', () => {
      const context = new ExecutionContext();
      
      context.start();
      
      expect(context.state.status).toBe('running');
      expect(context.state.startTime).toBeDefined();
    });
    
    it('should complete execution', () => {
      const context = new ExecutionContext();
      
      context.start();
      context.complete({ result: 'success' });
      
      expect(context.state.status).toBe('completed');
      expect(context.state.endTime).toBeDefined();
      expect(context.state.duration).toBeGreaterThanOrEqual(0);
      expect(context.state.progress).toBe(100);
    });
    
    it('should fail execution', () => {
      const context = new ExecutionContext();
      const error = new Error('Test error');
      
      context.start();
      context.fail(error);
      
      expect(context.state.status).toBe('failed');
      expect(context.state.errors).toHaveLength(1);
      expect(context.state.errors[0].message).toBe('Test error');
    });
    
    it('should cancel execution', () => {
      const context = new ExecutionContext();
      
      context.start();
      context.cancel('User requested cancellation');
      
      expect(context.state.status).toBe('cancelled');
      expect(context.state.endTime).toBeDefined();
    });
  });
  
  describe('Progress tracking', () => {
    it('should update progress', () => {
      const context = new ExecutionContext();
      
      context.updateProgress(50, 100);
      
      expect(context.state.progress).toBe(50);
      expect(context.state.recordsProcessed).toBe(50);
    });
    
    it('should call progress callback', () => {
      const progressCallback = jest.fn();
      const context = new ExecutionContext({ onProgress: progressCallback });
      
      context.updateProgress(75, 100, 'Processing batch');
      
      expect(progressCallback).toHaveBeenCalledWith({
        contextId: context.id,
        current: 75,
        total: 100,
        progress: 75,
        message: 'Processing batch'
      });
    });
  });
  
  describe('Error handling', () => {
    it('should add errors', () => {
      const context = new ExecutionContext();
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      context.addError(error1);
      context.addError(error2, { id: 123 });
      
      expect(context.state.errors).toHaveLength(2);
      expect(context.metrics.recordsFailed).toBe(2);
    });
    
    it('should add warnings', () => {
      const context = new ExecutionContext();
      
      context.addWarning('This is a warning', { field: 'name' });
      
      expect(context.state.warnings).toHaveLength(1);
      expect(context.state.warnings[0].message).toBe('This is a warning');
    });
  });
  
  describe('Retry management', () => {
    it('should track retry attempts', () => {
      const context = new ExecutionContext({ 
        retryAttempts: 3,
        retryDelay: 1000 
      });
      
      expect(context.incrementRetry()).toBe(true);
      expect(context.state.retryCount).toBe(1);
      
      expect(context.incrementRetry()).toBe(true);
      expect(context.state.retryCount).toBe(2);
      
      expect(context.incrementRetry()).toBe(true);
      expect(context.state.retryCount).toBe(3);
      
      expect(context.incrementRetry()).toBe(false);
      expect(context.state.retryCount).toBe(4);
    });
    
    it('should calculate exponential backoff', () => {
      const context = new ExecutionContext({ retryDelay: 1000 });
      
      context.incrementRetry();
      expect(context.getRetryDelay()).toBe(1000);
      
      context.incrementRetry();
      expect(context.getRetryDelay()).toBe(2000);
      
      context.incrementRetry();
      expect(context.getRetryDelay()).toBe(4000);
    });
  });
  
  describe('Metrics', () => {
    it('should update metrics', () => {
      const context = new ExecutionContext();
      
      context.updateMetrics({
        executionTime: 100,
        memoryUsage: 1024
      });
      
      expect(context.metrics.recordsProcessed).toBe(1);
      expect(context.metrics.totalExecutionTime).toBe(100);
      expect(context.metrics.averageRecordTime).toBe(100);
      expect(context.metrics.peakMemoryUsage).toBe(1024);
    });
    
    it('should calculate final metrics', async () => {
      const context = new ExecutionContext();
      
      context.start();
      context.metrics.recordsProcessed = 100;
      
      // Add a small delay to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 10));
      
      context.complete();
      
      expect(context.metrics.throughput).toBeGreaterThan(0);
    });
    
    it('should get metrics summary', () => {
      const context = new ExecutionContext();
      
      context.metrics.recordsProcessed = 100;
      context.metrics.recordsFailed = 5;
      
      const metrics = context.getMetrics();
      
      expect(metrics.errorRate).toBe(5);
      expect(metrics.successRate).toBe(95);
    });
  });
  
  describe('Child contexts', () => {
    it('should create child context', () => {
      const parent = new ExecutionContext({ 
        mappingId: 'parent-mapping',
        metadata: { environment: 'production' }
      });
      
      const child = parent.createChildContext({
        mappingId: 'child-mapping',
        metadata: { 
          step: 'validation',
          environment: 'production' // Need to explicitly pass inherited values
        }
      });
      
      expect(child.parentId).toBe(parent.id);
      expect(child.metadata.mappingId).toBe('child-mapping');
      expect(child.metadata.environment).toBe('production');
      expect(child.metadata.step).toBe('validation');
    });
    
    it('should merge child context results', () => {
      const parent = new ExecutionContext();
      const child = new ExecutionContext();
      
      // Add data to child - metrics.recordsFailed is incremented by addError
      child.metrics.recordsProcessed = 50;
      child.metrics.peakMemoryUsage = 2048;
      child.addError(new Error('Child error 1'));
      child.addError(new Error('Child error 2'));
      child.addError(new Error('Child error 3'));
      child.addError(new Error('Child error 4'));
      child.addError(new Error('Child error 5'));
      child.addWarning('Child warning');
      
      // Merge into parent
      parent.mergeChildContext(child);
      
      expect(parent.metrics.recordsProcessed).toBe(50);
      expect(parent.metrics.recordsFailed).toBe(5);
      expect(parent.metrics.peakMemoryUsage).toBe(2048);
      expect(parent.state.errors).toHaveLength(5);
      expect(parent.state.warnings).toHaveLength(1);
    });
  });
  
  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const context = new ExecutionContext({
        mappingId: 'test-mapping',
        userId: 'test-user'
      });
      
      context.start();
      context.updateProgress(50, 100);
      context.addError(new Error('Test error'));
      
      const json = context.toJSON();
      
      expect(json.id).toBe(context.id);
      expect(json.metadata.mappingId).toBe('test-mapping');
      expect(json.state.progress).toBe(50);
      expect(json.state.errors).toHaveLength(1);
    });
    
    it('should deserialize from JSON', () => {
      const original = new ExecutionContext({
        mappingId: 'test-mapping'
      });
      
      original.start();
      original.complete();
      
      const json = original.toJSON();
      const restored = ExecutionContext.fromJSON(json);
      
      expect(restored.id).toBe(original.id);
      expect(restored.state.status).toBe('completed');
      expect(restored.createdAt).toBeInstanceOf(Date);
      expect(restored.state.startTime).toBeInstanceOf(Date);
      expect(restored.state.endTime).toBeInstanceOf(Date);
    });
  });
});