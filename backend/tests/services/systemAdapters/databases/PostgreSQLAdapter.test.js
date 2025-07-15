const PostgreSQLAdapter = require('../../../../services/systemAdapters/databases/PostgreSQLAdapter');
const { Pool } = require('pg');

// Mock pg module
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0
  };
  
  return {
    Pool: jest.fn(() => mockPool),
    mockClient,
    mockPool
  };
});

// Mock logger
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('PostgreSQLAdapter Tests', () => {
  let adapter;
  let mockConfig;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'testuser',
      password: 'testpass',
      schema: 'public'
    };

    // Get references to mocked objects
    const { mockPool: poolMock, mockClient: clientMock } = require('pg');
    mockPool = poolMock;
    mockClient = clientMock;
    
    adapter = new PostgreSQLAdapter(mockConfig);
  });

  afterEach(async () => {
    if (adapter) {
      adapter.removeAllListeners();
      // Ensure cleanup even if tests fail
      if (adapter.pool) {
        await adapter.cleanup();
      }
    }
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with PostgreSQL specific defaults', () => {
      expect(adapter.adapterInfo.name).toBe('postgresql-adapter');
      expect(adapter.adapterInfo.type).toBe('postgresql');
      expect(adapter.adapterInfo.category).toBe('database');
      expect(adapter.defaultSchema).toBe('public');
      expect(adapter.queryTimeout).toBe(30000);
    });

    it('should set custom schema from config', () => {
      const customAdapter = new PostgreSQLAdapter({
        ...mockConfig,
        schema: 'custom_schema',
        queryTimeout: 60000
      });
      
      expect(customAdapter.defaultSchema).toBe('custom_schema');
      expect(customAdapter.queryTimeout).toBe(60000);
    });

    it('should have correct capabilities', () => {
      const capabilities = adapter.getCapabilities();
      
      expect(capabilities.supportsSchemaDiscovery).toBe(true);
      expect(capabilities.supportsBatchOperations).toBe(true);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsTransactions).toBe(true);
      expect(capabilities.supportsPartitioning).toBe(true);
      expect(capabilities.supportsCustomQuery).toBe(true);
    });

    it('should have correct supported operations', () => {
      const operations = adapter.getSupportedOperations();
      
      expect(operations.read).toBe(true);
      expect(operations.write).toBe(true);
      expect(operations.update).toBe(true);
      expect(operations.delete).toBe(true);
      expect(operations.upsert).toBe(true);
      expect(operations.truncate).toBe(true);
      expect(operations.createSchema).toBe(true);
      expect(operations.dropSchema).toBe(true);
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const connectedCallback = jest.fn();
      adapter.on('connected', connectedCallback);
      
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });

      await adapter.connect();

      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
      });

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT version()');
      expect(mockClient.release).toHaveBeenCalled();
      expect(adapter.isConnected).toBe(true);
      expect(adapter.metrics.connectTime).toBeDefined();
      expect(connectedCallback).toHaveBeenCalledWith({
        version: 'PostgreSQL 14.5',
        database: 'testdb'
      });
    });

    it('should handle connection failure', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(adapter.connect()).rejects.toThrow('PostgreSQL connection failed: Connection refused');
      expect(adapter.isConnected).toBe(false);
    });

    it('should connect with SSL configuration', async () => {
      const sslConfig = {
        ...mockConfig,
        ssl: {
          rejectUnauthorized: false,
          ca: 'ca-cert',
          cert: 'client-cert',
          key: 'client-key'
        }
      };

      const sslAdapter = new PostgreSQLAdapter(sslConfig);
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });

      await sslAdapter.connect();

      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        ssl: sslConfig.ssl
      }));
    });

    it('should disconnect successfully', async () => {
      const disconnectedCallback = jest.fn();
      adapter.on('disconnected', disconnectedCallback);
      
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });

      await adapter.connect();
      await adapter.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
      expect(adapter.pool).toBeNull();
      expect(adapter.isConnected).toBe(false);
      expect(disconnectedCallback).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(adapter.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Connection Testing', () => {
    it('should return true when connection is valid', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });

      await adapter.connect();
      
      mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const result = await adapter.testConnection();
      
      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when connection fails', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });

      await adapter.connect();
      
      mockClient.query.mockRejectedValueOnce(new Error('Connection lost'));
      const result = await adapter.testConnection();
      
      expect(result).toBe(false);
    });

    it('should return false when pool is not initialized', async () => {
      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('System Metadata', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
    });

    it('should retrieve system metadata successfully', async () => {
      // Mock metadata queries
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ version: 'PostgreSQL 14.5' }] }) // version
        .mockResolvedValueOnce({ rows: [{ current_database: 'testdb' }] }) // currentDatabase
        .mockResolvedValueOnce({ rows: [{ current_user: 'testuser' }] }) // currentUser
        .mockResolvedValueOnce({ rows: [{ current_schema: 'public' }] }) // currentSchema
        .mockResolvedValueOnce({ rows: [{ encoding: 'UTF8' }] }) // encoding
        .mockResolvedValueOnce({ rows: [{ timezone: 'UTC' }] }) // timezone
        .mockResolvedValueOnce({ rows: [{ maxconnections: '100' }] }) // maxConnections
        .mockResolvedValueOnce({ rows: [{ 
          size: 8192000, 
          size_pretty: '8192 MB' 
        }] }) // database size
        .mockResolvedValueOnce({ rows: [
          { name: 'uuid-ossp', installed_version: '1.1' },
          { name: 'pg_trgm', installed_version: '1.6' }
        ] }); // extensions

      const metadata = await adapter.getSystemMetadata();

      expect(metadata).toEqual({
        version: 'PostgreSQL 14.5',
        currentDatabase: 'testdb',
        currentUser: 'testuser',
        currentSchema: 'public',
        encoding: 'UTF8',
        timezone: 'UTC',
        maxConnections: '100',
        databaseSize: 8192000,
        databaseSizePretty: '8192 MB',
        installedExtensions: [
          { name: 'uuid-ossp', installed_version: '1.1' },
          { name: 'pg_trgm', installed_version: '1.6' }
        ]
      });
    });

    it('should handle partial metadata retrieval failures', async () => {
      // Mock some queries to fail
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ version: 'PostgreSQL 14.5' }] })
        .mockResolvedValueOnce({ rows: [{ current_database: 'testdb' }] })
        .mockRejectedValueOnce(new Error('Permission denied')) // currentUser fails
        .mockResolvedValueOnce({ rows: [{ current_schema: 'public' }] })
        .mockRejectedValueOnce(new Error('Permission denied')) // encoding fails
        .mockResolvedValueOnce({ rows: [{ timezone: 'UTC' }] })
        .mockResolvedValueOnce({ rows: [{ maxconnections: '100' }] })
        .mockResolvedValueOnce({ rows: [{ size: 8192000, size_pretty: '8192 MB' }] })
        .mockResolvedValueOnce({ rows: [] }); // extensions

      const metadata = await adapter.getSystemMetadata();

      expect(metadata.version).toBe('PostgreSQL 14.5');
      expect(metadata.currentDatabase).toBe('testdb');
      expect(metadata.currentUser).toBeUndefined();
      expect(metadata.currentSchema).toBe('public');
      expect(metadata.encoding).toBeUndefined();
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
    });

    it('should execute custom query successfully', async () => {
      const queryExecutedCallback = jest.fn();
      adapter.on('queryExecuted', queryExecutedCallback);

      mockClient.query
        .mockResolvedValueOnce({}) // SET statement_timeout
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Test 1' },
            { id: 2, name: 'Test 2' }
          ],
          rowCount: 2,
          fields: [
            { name: 'id', dataTypeID: 23 },
            { name: 'name', dataTypeID: 25 }
          ],
          command: 'SELECT'
        });

      const result = await adapter.executeQuery('SELECT * FROM users WHERE active = $1', [true]);

      expect(mockClient.query).toHaveBeenCalledWith('SET statement_timeout = 30000');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users WHERE active = $1', [true]);
      
      expect(result.rowCount).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.fields).toEqual([
        { name: 'id', dataTypeID: 23, dataTypeName: 'int4' },
        { name: 'name', dataTypeID: 25, dataTypeName: 'text' }
      ]);
      expect(result.command).toBe('SELECT');
      expect(result.duration).toBeDefined();
      
      expect(queryExecutedCallback).toHaveBeenCalledWith(expect.objectContaining({
        query: 'SELECT * FROM users WHERE active = $1',
        rowCount: 2
      }));
    });

    it('should handle query execution errors', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // SET statement_timeout
        .mockRejectedValueOnce(new Error('Syntax error'));

      await expect(
        adapter.executeQuery('SELECT * FROM invalid_table')
      ).rejects.toThrow('Query execution failed: Syntax error');
    });

    it('should map unknown data type OIDs', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // SET statement_timeout
        .mockResolvedValueOnce({
          rows: [{ custom: 'value' }],
          rowCount: 1,
          fields: [{ name: 'custom', dataTypeID: 99999 }],
          command: 'SELECT'
        });

      const result = await adapter.executeQuery('SELECT custom FROM table');
      
      expect(result.fields[0].dataTypeName).toBe('oid:99999');
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
    });

    it('should begin transaction and commit', async () => {
      mockClient.query.mockResolvedValue({});
      
      const transaction = await adapter.beginTransaction();
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(transaction).toHaveProperty('client');
      expect(transaction).toHaveProperty('commit');
      expect(transaction).toHaveProperty('rollback');
      
      await transaction.commit();
      
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should begin transaction and rollback', async () => {
      mockClient.query.mockResolvedValue({});
      
      const transaction = await adapter.beginTransaction();
      
      await transaction.rollback();
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even if commit fails', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Commit failed')); // COMMIT
      
      const transaction = await adapter.beginTransaction();
      
      await expect(transaction.commit()).rejects.toThrow();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    it('should get pool status', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();

      const status = adapter.getPoolStatus();
      
      expect(status).toEqual({
        totalCount: 10,
        idleCount: 8,
        waitingCount: 0
      });
    });

    it('should return null pool status when not connected', () => {
      const status = adapter.getPoolStatus();
      expect(status).toBeNull();
    });
  });

  describe('Stub Methods', () => {
    it('should throw error for discoverSchemas (to be implemented)', async () => {
      await expect(adapter.discoverSchemas()).rejects.toThrow('discoverSchemas will be implemented in subtask 4.2');
    });

    it('should throw error for readData (to be implemented)', async () => {
      await expect(adapter.readData({})).rejects.toThrow('readData will be implemented in subtask 4.3');
    });

    it('should throw error for writeData (to be implemented)', async () => {
      await expect(adapter.writeData({}, [])).rejects.toThrow('writeData will be implemented in subtask 4.3');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();

      await adapter.cleanup();

      expect(mockPool.end).toHaveBeenCalled();
      expect(adapter.pool).toBeNull();
      expect(adapter.isConnected).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
      
      // Make sure to mock the end method on the actual pool instance
      adapter.pool.end.mockRejectedValueOnce(new Error('Cleanup failed'));

      let errorCaught = false;
      try {
        await adapter.cleanup();
      } catch (error) {
        errorCaught = true;
        expect(error.message).toBe('Cleanup failed');
      }
      
      expect(errorCaught).toBe(true);
      expect(adapter.pool).toBeNull();
    });
  });
});