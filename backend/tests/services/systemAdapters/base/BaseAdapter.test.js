const BaseSystemAdapter = require('../../../../services/systemAdapters/base/BaseAdapter');

// Mock logger to avoid console output during tests
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Test implementation of BaseSystemAdapter
class TestAdapter extends BaseSystemAdapter {
  async connect() {
    this.isConnected = true;
    this.metrics.connectTime = Date.now();
  }

  async disconnect() {
    this.isConnected = false;
  }

  async testConnection() {
    return this.isConnected;
  }

  async discoverSchemas() {
    return [
      { name: 'users', type: 'table' },
      { name: 'products', type: 'table' }
    ];
  }

  async readData(schema, options = {}) {
    return {
      data: [{ id: 1, name: 'Test' }],
      metadata: { count: 1, schema: schema.name }
    };
  }

  async writeData(schema, data, options = {}) {
    return {
      written: data.length,
      schema: schema.name
    };
  }

  async executeQuery(query, params = {}) {
    return { query, params, result: 'success' };
  }

  async getSystemMetadata() {
    return { version: '1.0.0', type: 'test' };
  }
}

describe('BaseSystemAdapter Tests', () => {
  let adapter;
  let mockAdapterInfo;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test'
    };

    mockAdapterInfo = {
      name: 'test-adapter',
      configSchema: {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
          database: { type: 'string' }
        },
        required: ['host', 'database']
      },
      capabilities: {
        supportsSchemaDiscovery: true,
        supportsBatchOperations: true,
        supportsStreaming: false,
        supportsTransactions: true
      },
      supportedOperations: {
        read: true,
        write: true,
        update: false,
        delete: false
      }
    };

    adapter = new TestAdapter(mockConfig, mockAdapterInfo);
  });

  afterEach(() => {
    if (adapter) {
      adapter.removeAllListeners();
    }
  });

  describe('Abstract Methods', () => {
    it('should throw error when abstract methods are not implemented', async () => {
      const baseAdapter = new BaseSystemAdapter({}, {});
      
      await expect(baseAdapter.connect()).rejects.toThrow('must implement connect() method');
      await expect(baseAdapter.disconnect()).rejects.toThrow('must implement disconnect() method');
      await expect(baseAdapter.testConnection()).rejects.toThrow('must implement testConnection() method');
      await expect(baseAdapter.discoverSchemas()).rejects.toThrow('must implement discoverSchemas() method');
      await expect(baseAdapter.readData({})).rejects.toThrow('must implement readData() method');
      await expect(baseAdapter.writeData({}, [])).rejects.toThrow('must implement writeData() method');
      await expect(baseAdapter.executeQuery('')).rejects.toThrow('must implement executeQuery() method');
      await expect(baseAdapter.getSystemMetadata()).rejects.toThrow('must implement getSystemMetadata() method');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration on instantiation', () => {
      expect(() => {
        new TestAdapter({ host: 'localhost' }, mockAdapterInfo);
      }).toThrow('Configuration validation failed: Missing required field: database');
    });

    it('should validate field types', () => {
      expect(() => {
        new TestAdapter(
          { host: 'localhost', port: 'not-a-number', database: 'test' },
          mockAdapterInfo
        );
      }).toThrow('Configuration validation failed: Invalid type for port: expected number, got string');
    });

    it('should handle missing config schema gracefully', () => {
      const adapterWithoutSchema = new TestAdapter(mockConfig, { name: 'test' });
      expect(adapterWithoutSchema).toBeDefined();
    });
  });

  describe('Capabilities and Operations', () => {
    it('should return adapter capabilities', () => {
      const capabilities = adapter.getCapabilities();
      
      expect(capabilities).toEqual({
        supportsSchemaDiscovery: true,
        supportsBatchOperations: true,
        supportsStreaming: false,
        supportsTransactions: true
      });
    });

    it('should check specific capabilities', () => {
      expect(adapter.hasCapability('supportsSchemaDiscovery')).toBe(true);
      expect(adapter.hasCapability('supportsStreaming')).toBe(false);
      expect(adapter.hasCapability('unknownCapability')).toBe(false);
    });

    it('should return supported operations', () => {
      const operations = adapter.getSupportedOperations();
      
      expect(operations).toEqual({
        read: true,
        write: true,
        update: false,
        delete: false
      });
    });

    it('should check specific operations', () => {
      expect(adapter.supportsOperation('read')).toBe(true);
      expect(adapter.supportsOperation('update')).toBe(false);
      expect(adapter.supportsOperation('unknownOperation')).toBe(false);
    });

    it('should return default capabilities when not specified', () => {
      const adapterWithoutInfo = new TestAdapter(mockConfig, {});
      const capabilities = adapterWithoutInfo.getCapabilities();
      
      expect(capabilities.supportsSchemaDiscovery).toBe(false);
      expect(capabilities.supportsBatchOperations).toBe(false);
    });
  });

  describe('Performance Measurement', () => {
    it('should measure operation performance', async () => {
      const performanceCallback = jest.fn();
      adapter.on('performance', performanceCallback);

      const result = await adapter.measurePerformance('testOperation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'success';
      });

      expect(result).toBe('success');
      expect(performanceCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'testOperation',
          duration: expect.any(Number),
          timestamp: expect.any(Date),
          success: true
        })
      );
      expect(adapter.metrics.operationCount).toBe(1);
    });

    it('should track failed operations', async () => {
      const performanceCallback = jest.fn();
      adapter.on('performance', performanceCallback);

      await expect(
        adapter.measurePerformance('failingOperation', async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');

      expect(performanceCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'failingOperation',
          success: false,
          error: 'Operation failed'
        })
      );
    });
  });

  describe('Batch Processing', () => {
    it('should process data in batches', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));
      const processor = jest.fn(async (batch) => batch.length);
      const progressCallback = jest.fn();

      adapter.on('batchProgress', progressCallback);

      const results = await adapter.processBatch(items, processor, 10);

      expect(results).toEqual([10, 10, 5]);
      expect(processor).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenLastCalledWith({
        current: 3,
        total: 3,
        processed: 25,
        totalItems: 25
      });
    });

    it('should handle batch processing errors', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn(async () => {
        throw new Error('Batch failed');
      });
      const errorCallback = jest.fn();

      adapter.on('batchError', errorCallback);

      await expect(
        adapter.processBatch(items, processor, 2)
      ).rejects.toThrow('Batch failed');

      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('Retry Operation', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await adapter.retryOperation(operation, {
        maxRetries: 3,
        initialDelay: 10
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation = jest.fn(async () => {
        throw new Error('Persistent failure');
      });

      await expect(
        adapter.retryOperation(operation, {
          maxRetries: 2,
          initialDelay: 10
        })
      ).rejects.toThrow('Operation failed after 2 attempts: Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        callback();
      });

      const operation = jest.fn(async () => {
        throw new Error('Failure');
      });

      try {
        await adapter.retryOperation(operation, {
          maxRetries: 3,
          initialDelay: 100,
          backoffMultiplier: 2
        });
      } catch (error) {
        // Expected to fail
      }

      expect(delays).toEqual([100, 200]);
      
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Data Transformation', () => {
    it('should transform data with simple field mapping', () => {
      const data = { firstName: 'John', lastName: 'Doe', age: 30 };
      const mapping = {
        name: 'firstName',
        surname: 'lastName',
        years: 'age'
      };

      const transformed = adapter.transformData(data, mapping);

      expect(transformed).toEqual({
        name: 'John',
        surname: 'Doe',
        years: 30
      });
    });

    it('should transform arrays of data', () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];
      const mapping = {
        identifier: 'id',
        title: 'name'
      };

      const transformed = adapter.transformData(data, mapping);

      expect(transformed).toEqual([
        { identifier: 1, title: 'Item 1' },
        { identifier: 2, title: 'Item 2' }
      ]);
    });

    it('should handle function transformations', () => {
      const data = { price: 100, tax: 0.1 };
      const mapping = {
        originalPrice: 'price',
        totalPrice: (item) => item.price * (1 + item.tax)
      };

      const transformed = adapter.transformData(data, mapping);

      expect(transformed.originalPrice).toBe(100);
      expect(transformed.totalPrice).toBeCloseTo(110, 2);
    });

    it('should handle complex mappings with transformations', () => {
      const data = { temp_celsius: 25 };
      const mapping = {
        celsius: 'temp_celsius',
        fahrenheit: {
          field: 'temp_celsius',
          transform: (c) => (c * 9/5) + 32
        }
      };

      const transformed = adapter.transformData(data, mapping);

      expect(transformed).toEqual({
        celsius: 25,
        fahrenheit: 77
      });
    });
  });

  describe('Nested Value Access', () => {
    it('should get nested values using dot notation', () => {
      const obj = {
        user: {
          profile: {
            name: 'John Doe'
          }
        }
      };

      const value = adapter.getNestedValue(obj, 'user.profile.name');
      expect(value).toBe('John Doe');
    });

    it('should handle missing nested values', () => {
      const obj = { user: {} };
      const value = adapter.getNestedValue(obj, 'user.profile.name');
      expect(value).toBeUndefined();
    });

    it('should set nested values using dot notation', () => {
      const obj = {};
      adapter.setNestedValue(obj, 'user.profile.name', 'John Doe');
      
      expect(obj).toEqual({
        user: {
          profile: {
            name: 'John Doe'
          }
        }
      });
    });
  });

  describe('Connection and Metrics', () => {
    it('should track connection state and metrics', async () => {
      expect(adapter.isConnected).toBe(false);
      
      await adapter.connect();
      
      expect(adapter.isConnected).toBe(true);
      expect(adapter.metrics.connectTime).toBeDefined();
      
      const metrics = adapter.getMetrics();
      expect(metrics.isConnected).toBe(true);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.operationCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });

    it('should increment error count on errors', () => {
      adapter.emit('error', new Error('Test error'));
      expect(adapter.metrics.errorCount).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on cleanup', async () => {
      await adapter.connect();
      expect(adapter.isConnected).toBe(true);
      
      await adapter.cleanup();
      
      expect(adapter.isConnected).toBe(false);
      expect(adapter.listenerCount('error')).toBe(0);
    });

    it('should handle cleanup when not connected', async () => {
      expect(adapter.isConnected).toBe(false);
      await expect(adapter.cleanup()).resolves.not.toThrow();
    });
  });
});