const { ConnectionPoolManager, ConnectionPool } = require('../../../../services/mappingEngine/performance/ConnectionPoolManager');

describe('ConnectionPoolManager', () => {
  let poolManager;
  let mockFactory;

  beforeEach(() => {
    mockFactory = {
      create: jest.fn(),
      destroy: jest.fn(),
      validate: jest.fn()
    };

    poolManager = new ConnectionPoolManager({
      minConnections: 2,
      maxConnections: 5,
      acquireTimeoutMillis: 5000,
      idleTimeoutMillis: 10000
    });
  });

  afterEach(async () => {
    if (poolManager) {
      await poolManager.shutdown();
    }
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const defaultManager = new ConnectionPoolManager();
      
      expect(defaultManager.options.minConnections).toBe(2);
      expect(defaultManager.options.maxConnections).toBe(20);
      expect(defaultManager.options.acquireTimeoutMillis).toBe(10000);
      expect(defaultManager.options.idleTimeoutMillis).toBe(30000);
      
      defaultManager.shutdown();
    });

    it('should start health check monitoring by default', () => {
      expect(poolManager.healthCheckInterval).toBeDefined();
    });
  });

  describe('createPool', () => {
    it('should create a new connection pool', () => {
      const pool = poolManager.createPool('testPool', mockFactory);
      
      expect(pool).toBeInstanceOf(ConnectionPool);
      expect(poolManager.pools.has('testPool')).toBe(true);
      expect(poolManager.pools.get('testPool')).toBe(pool);
    });

    it('should return existing pool if it already exists', () => {
      const pool1 = poolManager.createPool('testPool', mockFactory);
      const pool2 = poolManager.createPool('testPool', mockFactory);
      
      expect(pool1).toBe(pool2);
      expect(poolManager.pools.size).toBe(1);
    });

    it('should set up event handlers for the pool', () => {
      const pool = poolManager.createPool('testPool', mockFactory);
      
      const connectHandler = jest.fn();
      const errorHandler = jest.fn();
      
      poolManager.on('poolConnect', connectHandler);
      poolManager.on('poolError', errorHandler);
      
      pool.emit('connect', { connectionId: 'test-id' });
      pool.emit('error', { error: 'test error' });
      
      expect(connectHandler).toHaveBeenCalledWith({
        pool: 'testPool',
        connectionId: 'test-id'
      });
      
      expect(errorHandler).toHaveBeenCalledWith({
        pool: 'testPool',
        error: 'test error'
      });
    });
  });

  describe('getPool', () => {
    it('should return existing pool', () => {
      const pool = poolManager.createPool('testPool', mockFactory);
      const retrieved = poolManager.getPool('testPool');
      
      expect(retrieved).toBe(pool);
    });

    it('should return undefined for non-existent pool', () => {
      const retrieved = poolManager.getPool('nonExistent');
      
      expect(retrieved).toBeUndefined();
    });
  });

  describe('acquireConnection', () => {
    it('should acquire connection from pool', async () => {
      const mockConnection = { id: 'test-connection' };
      mockFactory.create.mockResolvedValue(mockConnection);
      
      const pool = poolManager.createPool('testPool', mockFactory);
      const connection = await poolManager.acquireConnection('testPool');
      
      expect(connection).toBe(mockConnection);
    });

    it('should throw error for non-existent pool', async () => {
      await expect(poolManager.acquireConnection('nonExistent'))
        .rejects.toThrow('Pool nonExistent not found');
    });
  });

  describe('releaseConnection', () => {
    it('should release connection back to pool', async () => {
      const mockConnection = { id: 'test-connection' };
      mockFactory.create.mockResolvedValue(mockConnection);
      mockFactory.validate.mockResolvedValue(true);
      
      const pool = poolManager.createPool('testPool', mockFactory);
      const connection = await poolManager.acquireConnection('testPool');
      
      await poolManager.releaseConnection('testPool', connection);
      
      // Connection should be back in the pool
      expect(pool.connections.length).toBe(1);
    });

    it('should throw error for non-existent pool', async () => {
      const mockConnection = { id: 'test-connection' };
      
      await expect(poolManager.releaseConnection('nonExistent', mockConnection))
        .rejects.toThrow('Pool nonExistent not found');
    });
  });

  describe('executeWithConnection', () => {
    it('should execute function with connection and release it', async () => {
      const mockConnection = { id: 'test-connection' };
      const queryFn = jest.fn().mockResolvedValue('query result');
      
      mockFactory.create.mockResolvedValue(mockConnection);
      mockFactory.validate.mockResolvedValue(true);
      
      poolManager.createPool('testPool', mockFactory);
      
      const result = await poolManager.executeWithConnection('testPool', queryFn);
      
      expect(result).toBe('query result');
      expect(queryFn).toHaveBeenCalledWith(mockConnection);
    });

    it('should release connection even if query function throws', async () => {
      const mockConnection = { id: 'test-connection' };
      const queryFn = jest.fn().mockRejectedValue(new Error('Query failed'));
      
      mockFactory.create.mockResolvedValue(mockConnection);
      mockFactory.validate.mockResolvedValue(true);
      
      const pool = poolManager.createPool('testPool', mockFactory);
      
      await expect(poolManager.executeWithConnection('testPool', queryFn))
        .rejects.toThrow('Query failed');
      
      // Connection should still be released back to pool
      expect(pool.connections.length).toBe(1);
    });
  });

  describe('getPoolStatistics', () => {
    it('should return statistics for all pools', () => {
      poolManager.createPool('pool1', mockFactory);
      poolManager.createPool('pool2', mockFactory);
      
      const stats = poolManager.getPoolStatistics();
      
      expect(stats).toHaveProperty('pool1');
      expect(stats).toHaveProperty('pool2');
      expect(stats.pool1).toMatchObject({
        name: 'pool1',
        size: expect.any(Number),
        activeConnections: expect.any(Number),
        idleConnections: expect.any(Number)
      });
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics', () => {
      poolManager.createPool('pool1', mockFactory);
      poolManager.createPool('pool2', mockFactory);
      
      const metrics = poolManager.getMetrics();
      
      expect(metrics).toMatchObject({
        summary: {
          totalPools: 2,
          totalConnections: expect.any(Number),
          totalActiveConnections: expect.any(Number),
          totalIdleConnections: expect.any(Number),
          totalWaitingClients: expect.any(Number),
          totalAcquiredConnections: expect.any(Number),
          totalReleasedConnections: expect.any(Number),
          totalErrors: expect.any(Number)
        },
        pools: expect.any(Object)
      });
    });
  });

  describe('drainPool', () => {
    it('should drain specific pool', async () => {
      const pool = poolManager.createPool('testPool', mockFactory);
      const drainSpy = jest.spyOn(pool, 'drain').mockResolvedValue();
      
      await poolManager.drainPool('testPool');
      
      expect(drainSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent pool', async () => {
      await expect(poolManager.drainPool('nonExistent'))
        .rejects.toThrow('Pool nonExistent not found');
    });
  });

  describe('destroyPool', () => {
    it('should destroy specific pool and remove from manager', async () => {
      const pool = poolManager.createPool('testPool', mockFactory);
      const destroySpy = jest.spyOn(pool, 'destroy').mockResolvedValue();
      
      await poolManager.destroyPool('testPool');
      
      expect(destroySpy).toHaveBeenCalled();
      expect(poolManager.pools.has('testPool')).toBe(false);
    });

    it('should throw error for non-existent pool', async () => {
      await expect(poolManager.destroyPool('nonExistent'))
        .rejects.toThrow('Pool nonExistent not found');
    });
  });

  describe('shutdown', () => {
    it('should shutdown all pools and clear health check interval', async () => {
      const pool1 = poolManager.createPool('pool1', mockFactory);
      const pool2 = poolManager.createPool('pool2', mockFactory);
      
      const destroy1Spy = jest.spyOn(pool1, 'destroy').mockResolvedValue();
      const destroy2Spy = jest.spyOn(pool2, 'destroy').mockResolvedValue();
      
      await poolManager.shutdown();
      
      expect(destroy1Spy).toHaveBeenCalled();
      expect(destroy2Spy).toHaveBeenCalled();
      expect(poolManager.pools.size).toBe(0);
      expect(poolManager.healthCheckInterval).toBeNull();
    });
  });
});

describe('ConnectionPool', () => {
  let pool;
  let mockFactory;

  beforeEach(() => {
    mockFactory = {
      create: jest.fn(),
      destroy: jest.fn(),
      validate: jest.fn()
    };

    pool = new ConnectionPool('testPool', mockFactory, {
      minConnections: 1,
      maxConnections: 3,
      acquireTimeoutMillis: 1000,
      idleTimeoutMillis: 5000,
      reapIntervalMillis: 100
    });
  });

  afterEach(async () => {
    if (pool && !pool.destroyed) {
      await pool.destroy();
    }
  });

  describe('Constructor', () => {
    it('should initialize pool with correct properties', () => {
      expect(pool.name).toBe('testPool');
      expect(pool.factory).toBe(mockFactory);
      expect(pool.connections).toEqual([]);
      expect(pool.activeConnections.size).toBe(0);
      expect(pool.waitingQueue).toEqual([]);
      expect(pool.destroyed).toBe(false);
      expect(pool.draining).toBe(false);
    });

    it('should start reaper interval', () => {
      expect(pool.reaperInterval).toBeDefined();
    });
  });

  describe('acquire', () => {
    it('should acquire connection when available', async () => {
      const mockConnection = { id: 'test-connection' };
      mockFactory.create.mockResolvedValue(mockConnection);
      
      const connection = await pool.acquire();
      
      expect(connection).toBe(mockConnection);
      expect(pool.activeConnections.has(connection)).toBe(true);
      expect(pool.stats.acquiredConnections).toBe(1);
    });

    it('should create new connection when pool is empty', async () => {
      const mockConnection = { id: 'test-connection' };
      mockFactory.create.mockResolvedValue(mockConnection);
      
      const connection = await pool.acquire();
      
      expect(mockFactory.create).toHaveBeenCalled();
      expect(connection.id).toBe('test-connection');
      expect(connection.pool).toBe('testPool');
    });

    it('should timeout when acquire takes too long', async () => {
      mockFactory.create.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      await expect(pool.acquire()).rejects.toThrow('Connection acquire timeout');
      expect(pool.stats.timeouts).toBe(1);
    });

    it('should reject when pool is destroyed', async () => {
      pool.destroyed = true;
      
      await expect(pool.acquire()).rejects.toThrow('Pool testPool has been destroyed');
    });

    it('should reject when pool is draining', async () => {
      pool.draining = true;
      
      await expect(pool.acquire()).rejects.toThrow('Pool testPool is draining');
    });
  });

  describe('release', () => {
    it('should release valid connection back to pool', async () => {
      const mockConnection = { id: 'test-connection', lastUsed: Date.now() };
      mockFactory.validate.mockResolvedValue(true);
      
      pool.activeConnections.add(mockConnection);
      
      await pool.release(mockConnection);
      
      expect(pool.activeConnections.has(mockConnection)).toBe(false);
      expect(pool.connections.includes(mockConnection)).toBe(true);
      expect(pool.stats.releasedConnections).toBe(1);
    });

    it('should destroy invalid connection', async () => {
      const mockConnection = { id: 'test-connection' };
      mockFactory.validate.mockResolvedValue(false);
      mockFactory.destroy.mockResolvedValue();
      
      pool.activeConnections.add(mockConnection);
      
      await pool.release(mockConnection);
      
      expect(pool.activeConnections.has(mockConnection)).toBe(false);
      expect(pool.connections.includes(mockConnection)).toBe(false);
      expect(mockFactory.destroy).toHaveBeenCalledWith(mockConnection);
    });

    it('should destroy connection when pool is destroyed', async () => {
      const mockConnection = { id: 'test-connection' };
      mockFactory.destroy.mockResolvedValue();
      
      pool.destroyed = true;
      
      await pool.release(mockConnection);
      
      expect(mockFactory.destroy).toHaveBeenCalledWith(mockConnection);
    });
  });

  describe('createConnection', () => {
    it('should create connection with metadata', async () => {
      const mockConnection = { id: 'original-id' };
      mockFactory.create.mockResolvedValue(mockConnection);
      
      const connection = await pool.createConnection();
      
      expect(connection.id).toMatch(/testPool_\d+_\w+/);
      expect(connection.createdAt).toBeDefined();
      expect(connection.lastUsed).toBeDefined();
      expect(connection.pool).toBe('testPool');
      expect(pool.stats.createdConnections).toBe(1);
    });

    it('should timeout connection creation', async () => {
      const shortTimeoutPool = new ConnectionPool('testPool', mockFactory, {
        createTimeoutMillis: 10
      });
      
      mockFactory.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      );
      
      await expect(shortTimeoutPool.createConnection())
        .rejects.toThrow('Connection creation timeout');
      
      await shortTimeoutPool.destroy();
    });

    it('should handle creation errors', async () => {
      mockFactory.create.mockRejectedValue(new Error('Creation failed'));
      
      await expect(pool.createConnection()).rejects.toThrow('Creation failed');
      expect(pool.stats.errors).toBe(1);
    });
  });

  describe('validateConnection', () => {
    it('should use factory validation when available', async () => {
      const mockConnection = { id: 'test-connection' };
      mockFactory.validate.mockResolvedValue(true);
      
      const isValid = await pool.validateConnection(mockConnection);
      
      expect(isValid).toBe(true);
      expect(mockFactory.validate).toHaveBeenCalledWith(mockConnection);
    });

    it('should use default validation when factory validation not available', async () => {
      delete mockFactory.validate;
      const mockConnection = { id: 'test-connection' };
      
      const isValid = await pool.validateConnection(mockConnection);
      
      expect(isValid).toBe(true);
    });

    it('should return false for invalid connections', async () => {
      const mockConnection = { id: 'test-connection', destroyed: true };
      
      const isValid = await pool.validateConnection(mockConnection);
      
      expect(isValid).toBe(false);
    });

    it('should handle validation errors', async () => {
      mockFactory.validate.mockRejectedValue(new Error('Validation failed'));
      const mockConnection = { id: 'test-connection' };
      
      const isValid = await pool.validateConnection(mockConnection);
      
      expect(isValid).toBe(false);
    });
  });

  describe('performHealthCheck', () => {
    it('should validate idle connections and remove invalid ones', async () => {
      const validConnection = { id: 'valid', lastUsed: Date.now() };
      const invalidConnection = { id: 'invalid', lastUsed: Date.now() };
      
      pool.connections = [validConnection, invalidConnection];
      
      mockFactory.validate
        .mockResolvedValueOnce(true)  // valid connection
        .mockResolvedValueOnce(false); // invalid connection
      
      mockFactory.destroy.mockResolvedValue();
      
      await pool.performHealthCheck();
      
      expect(pool.connections).toContain(validConnection);
      expect(pool.connections).not.toContain(invalidConnection);
      expect(mockFactory.destroy).toHaveBeenCalledWith(invalidConnection);
    });
  });

  describe('reapIdleConnections', () => {
    it('should remove idle connections exceeding timeout', async () => {
      const oldConnection = { 
        id: 'old', 
        lastUsed: Date.now() - 10000 // 10 seconds ago
      };
      const recentConnection = { 
        id: 'recent', 
        lastUsed: Date.now() - 1000  // 1 second ago
      };
      
      pool.connections = [oldConnection, recentConnection];
      pool.options.idleTimeoutMillis = 5000; // 5 seconds
      
      mockFactory.destroy.mockResolvedValue();
      
      await pool.reapIdleConnections();
      
      expect(pool.connections).not.toContain(oldConnection);
      expect(pool.connections).toContain(recentConnection);
      expect(mockFactory.destroy).toHaveBeenCalledWith(oldConnection);
    });

    it('should not reap connections below minimum', async () => {
      const oldConnection = { 
        id: 'old', 
        lastUsed: Date.now() - 10000
      };
      
      pool.connections = [oldConnection];
      pool.options.minConnections = 1;
      pool.options.idleTimeoutMillis = 5000;
      
      await pool.reapIdleConnections();
      
      expect(pool.connections).toContain(oldConnection);
      expect(mockFactory.destroy).not.toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return comprehensive pool statistics', () => {
      const stats = pool.getStatistics();
      
      expect(stats).toMatchObject({
        name: 'testPool',
        size: expect.any(Number),
        activeConnections: expect.any(Number),
        idleConnections: expect.any(Number),
        waitingClients: expect.any(Number),
        createdConnections: expect.any(Number),
        destroyedConnections: expect.any(Number),
        acquiredConnections: expect.any(Number),
        releasedConnections: expect.any(Number),
        timeouts: expect.any(Number),
        errors: expect.any(Number),
        rejections: expect.any(Number),
        destroyed: false,
        draining: false
      });
    });
  });

  describe('drain', () => {
    it('should drain pool and reject waiting clients', async () => {
      // Add mock waiting requests
      const mockRequest = {
        reject: jest.fn(),
        timeout: setTimeout(() => {}, 1000)
      };
      
      pool.waitingQueue = [mockRequest];
      
      await pool.drain();
      
      expect(pool.draining).toBe(true);
      expect(pool.waitingQueue.length).toBe(0);
      expect(mockRequest.reject).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Pool testPool is draining'
        })
      );
      expect(pool.stats.rejections).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should destroy pool and all connections', async () => {
      const mockConnection1 = { id: 'conn1' };
      const mockConnection2 = { id: 'conn2' };
      
      pool.connections = [mockConnection1, mockConnection2];
      mockFactory.destroy.mockResolvedValue();
      
      await pool.destroy();
      
      expect(pool.destroyed).toBe(true);
      expect(pool.connections.length).toBe(0);
      expect(mockFactory.destroy).toHaveBeenCalledTimes(2);
      expect(pool.reaperInterval).toBeUndefined();
    });

    it('should not destroy twice', async () => {
      pool.destroyed = true;
      
      await pool.destroy();
      
      expect(mockFactory.destroy).not.toHaveBeenCalled();
    });
  });

  describe('getTotalConnections', () => {
    it('should return sum of idle and active connections', () => {
      pool.connections = [{ id: 'idle1' }, { id: 'idle2' }];
      pool.activeConnections.add({ id: 'active1' });
      
      expect(pool.getTotalConnections()).toBe(3);
    });
  });
});