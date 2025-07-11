const NiFiConnectionPool = require('../../src/services/nifiConnectionPool');
const NiFiClient = require('../../src/services/nifiClient');
const { circuitBreakerManager } = require('../../src/services/circuitBreaker');

// Mock NiFiClient
jest.mock('../../src/services/nifiClient');

describe('NiFiConnectionPool', () => {
  let connectionPool;
  let mockClient;

  beforeEach(() => {
    connectionPool = new NiFiConnectionPool({
      minConnections: 1,
      maxConnections: 3,
      acquireTimeoutMs: 1000,
      idleTimeoutMs: 5000,
      healthCheckIntervalMs: 1000
    });

    mockClient = {
      authenticate: jest.fn().mockResolvedValue('mock-token'),
      isConnected: jest.fn().mockResolvedValue(true),
      healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
      disconnect: jest.fn()
    };

    NiFiClient.mockImplementation(() => mockClient);
  });

  afterEach(() => {
    connectionPool.destroy();
    jest.clearAllMocks();
  });

  describe('Pool Management', () => {
    it('should create new pool for system', () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const pool = connectionPool.getPool(systemId, config);

      expect(pool).toBeDefined();
      expect(pool.systemId).toBe(systemId);
      expect(pool.connections).toEqual([]);
      expect(pool.activeConnections).toBeInstanceOf(Set);
      expect(pool.waitingQueue).toEqual([]);
      expect(pool.circuitBreaker).toBeDefined();
    });

    it('should reuse existing pool', () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const pool1 = connectionPool.getPool(systemId, config);
      const pool2 = connectionPool.getPool(systemId, config);

      expect(pool1).toBe(pool2);
    });

    it('should configure circuit breaker with custom settings', () => {
      const systemId = 'test-system';
      const config = {
        url: 'http://localhost:8080',
        circuitBreakerFailureThreshold: 75,
        circuitBreakerTimeout: 5000
      };

      const pool = connectionPool.getPool(systemId, config);

      expect(pool.circuitBreaker).toBeDefined();
      expect(pool.circuitBreaker.name).toBe(`nifi-${systemId}`);
    });
  });

  describe('Connection Acquisition', () => {
    it('should acquire connection successfully', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.systemId).toBe(systemId);
      expect(connection.client).toBe(mockClient);
      expect(connection.isHealthy).toBe(true);
      expect(mockClient.authenticate).toHaveBeenCalled();
    });

    it('should reuse idle connection', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection1 = await connectionPool.acquire(systemId, config);
      connectionPool.release(systemId, connection1);

      const connection2 = await connectionPool.acquire(systemId, config);

      expect(connection2).toBe(connection1);
      expect(NiFiClient).toHaveBeenCalledTimes(1); // Should reuse client
    });

    it('should create new connection when pool is empty', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection1 = await connectionPool.acquire(systemId, config);
      const connection2 = await connectionPool.acquire(systemId, config);

      expect(connection1).not.toBe(connection2);
      expect(NiFiClient).toHaveBeenCalledTimes(2);
    });

    it('should timeout when no connections available', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      // Acquire all connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        connections.push(await connectionPool.acquire(systemId, config));
      }

      // This should timeout
      await expect(connectionPool.acquire(systemId, config)).rejects.toThrow('Connection acquire timeout');
    });

    it('should handle connection creation failure', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      mockClient.authenticate.mockRejectedValue(new Error('Authentication failed'));

      await expect(connectionPool.acquire(systemId, config)).rejects.toThrow('Authentication failed');
    });
  });

  describe('Connection Release', () => {
    it('should release connection back to pool', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);
      const pool = connectionPool.getPool(systemId, config);

      expect(pool.activeConnections.has(connection)).toBe(true);

      connectionPool.release(systemId, connection);

      expect(pool.activeConnections.has(connection)).toBe(false);
      expect(connection.lastUsed).toBeDefined();
    });

    it('should serve waiting requests when connection is released', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      // Acquire all connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        connections.push(await connectionPool.acquire(systemId, config));
      }

      // Start acquiring another connection (will be queued)
      const pendingAcquisition = connectionPool.acquire(systemId, config);

      // Release one connection
      connectionPool.release(systemId, connections[0]);

      // The pending acquisition should now succeed
      const newConnection = await pendingAcquisition;
      expect(newConnection).toBe(connections[0]);
    });

    it('should handle release of non-existent pool', () => {
      const systemId = 'non-existent-system';
      const mockConnection = { id: 'test-connection' };

      expect(() => connectionPool.release(systemId, mockConnection)).not.toThrow();
    });
  });

  describe('Connection Creation', () => {
    it('should create connection with unique ID', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection1 = await connectionPool.createConnection(systemId, config);
      const connection2 = await connectionPool.createConnection(systemId, config);

      expect(connection1.id).toBeDefined();
      expect(connection2.id).toBeDefined();
      expect(connection1.id).not.toBe(connection2.id);
    });

    it('should initialize connection properties', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.createConnection(systemId, config);

      expect(connection.systemId).toBe(systemId);
      expect(connection.client).toBe(mockClient);
      expect(connection.created).toBeDefined();
      expect(connection.lastUsed).toBeDefined();
      expect(connection.isHealthy).toBe(true);
      expect(connection.consecutiveFailures).toBe(0);
    });

    it('should handle connection creation failure', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      mockClient.authenticate.mockRejectedValue(new Error('Connection failed'));

      await expect(connectionPool.createConnection(systemId, config)).rejects.toThrow('Connection failed');
    });
  });

  describe('Execute with Retry', () => {
    it('should execute operation successfully', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await connectionPool.executeWithRetry(systemId, config, mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledWith(mockClient);
    });

    it('should retry on failure', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080', maxRetries: 3 };
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const result = await connectionPool.executeWithRetry(systemId, config, mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080', maxRetries: 2 };
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(connectionPool.executeWithRetry(systemId, config, mockOperation)).rejects.toThrow('Operation failed');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should use circuit breaker', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };
      const mockOperation = jest.fn().mockResolvedValue('success');

      const pool = connectionPool.getPool(systemId, config);
      const circuitBreakerExecute = jest.spyOn(pool.circuitBreaker, 'execute');

      await connectionPool.executeWithRetry(systemId, config, mockOperation);

      expect(circuitBreakerExecute).toHaveBeenCalled();
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should perform health checks on connections', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);
      connectionPool.release(systemId, connection);

      // Trigger health check
      await connectionPool.performHealthChecks();

      expect(mockClient.isConnected).toHaveBeenCalled();
    });

    it('should mark unhealthy connections', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);
      connectionPool.release(systemId, connection);

      mockClient.isConnected.mockResolvedValue(false);

      await connectionPool.performHealthChecks();

      expect(connection.isHealthy).toBe(false);
      expect(connection.consecutiveFailures).toBe(1);
    });
  });

  describe('Idle Connection Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should cleanup idle connections', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);
      connectionPool.release(systemId, connection);

      const pool = connectionPool.getPool(systemId, config);

      // Simulate time passing
      connection.lastUsed = Date.now() - 10000; // 10 seconds ago
      jest.advanceTimersByTime(10000);

      connectionPool.cleanupIdleConnections();

      expect(pool.connections.length).toBe(1); // Should keep minimum connections
    });

    it('should remove unhealthy connections', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);
      connectionPool.release(systemId, connection);

      connection.isHealthy = false;
      connection.consecutiveFailures = 6;

      const pool = connectionPool.getPool(systemId, config);

      connectionPool.cleanupIdleConnections();

      expect(pool.connections.length).toBe(0);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should provide pool statistics', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);

      const stats = connectionPool.getPoolStats(systemId);

      expect(stats).toBeDefined();
      expect(stats.systemId).toBe(systemId);
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
      expect(stats.idleConnections).toBe(0);
      expect(stats.stats.created).toBe(1);
      expect(stats.stats.acquired).toBe(1);
    });

    it('should provide all pool statistics', async () => {
      const systemId1 = 'test-system-1';
      const systemId2 = 'test-system-2';
      const config = { url: 'http://localhost:8080' };

      await connectionPool.acquire(systemId1, config);
      await connectionPool.acquire(systemId2, config);

      const allStats = connectionPool.getAllPoolStats();

      expect(allStats).toHaveProperty(systemId1);
      expect(allStats).toHaveProperty(systemId2);
      expect(allStats[systemId1].totalConnections).toBe(1);
      expect(allStats[systemId2].totalConnections).toBe(1);
    });

    it('should provide circuit breaker statistics', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      await connectionPool.acquire(systemId, config);

      const stats = connectionPool.getCircuitBreakerStats(systemId);

      expect(stats).toBeDefined();
      expect(stats.name).toBe(`nifi-${systemId}`);
      expect(stats.state).toBe('CLOSED');
    });

    it('should provide all circuit breaker statistics', async () => {
      const systemId1 = 'test-system-1';
      const systemId2 = 'test-system-2';
      const config = { url: 'http://localhost:8080' };

      await connectionPool.acquire(systemId1, config);
      await connectionPool.acquire(systemId2, config);

      const allStats = connectionPool.getAllCircuitBreakerStats();

      expect(allStats).toHaveProperty(systemId1);
      expect(allStats).toHaveProperty(systemId2);
      expect(allStats[systemId1].name).toBe(`nifi-${systemId1}`);
      expect(allStats[systemId2].name).toBe(`nifi-${systemId2}`);
    });
  });

  describe('Pool Removal', () => {
    it('should remove pool and cleanup connections', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);
      connectionPool.release(systemId, connection);

      connectionPool.removePool(systemId);

      expect(connectionPool.pools.has(systemId)).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should reject waiting requests when pool is removed', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      // Acquire all connections
      const connections = [];
      for (let i = 0; i < 3; i++) {
        connections.push(await connectionPool.acquire(systemId, config));
      }

      // Start acquiring another connection (will be queued)
      const pendingAcquisition = connectionPool.acquire(systemId, config);

      // Remove the pool
      connectionPool.removePool(systemId);

      // The pending acquisition should be rejected
      await expect(pendingAcquisition).rejects.toThrow('Pool removed');
    });
  });

  describe('Destruction', () => {
    it('should cleanup all resources', async () => {
      const systemId = 'test-system';
      const config = { url: 'http://localhost:8080' };

      const connection = await connectionPool.acquire(systemId, config);
      connectionPool.release(systemId, connection);

      connectionPool.destroy();

      expect(connectionPool.pools.size).toBe(0);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should clear intervals', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      connectionPool.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});