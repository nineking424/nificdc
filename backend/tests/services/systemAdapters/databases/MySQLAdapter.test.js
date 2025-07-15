const MySQLAdapter = require('../../../../services/systemAdapters/databases/MySQLAdapter');
const mysql = require('mysql2/promise');

// Mock mysql2 module
jest.mock('mysql2/promise', () => {
  const mockConnection = {
    query: jest.fn(),
    ping: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn()
  };
  
  const mockPool = {
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    end: jest.fn().mockResolvedValue(undefined),
    config: {
      connectionLimit: 10,
      acquireTimeout: 10000,
      timeout: 60000
    }
  };
  
  return {
    createPool: jest.fn(() => mockPool),
    escapeId: jest.fn((id) => `\`${id}\``),
    mockConnection,
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

describe('MySQLAdapter Tests', () => {
  let adapter;
  let mockConfig;
  let mockPool;
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      host: 'localhost',
      port: 3306,
      database: 'testdb',
      user: 'testuser',
      password: 'testpass',
      connectionLimit: 10
    };

    // Get references to mocked objects
    const { mockPool: poolMock, mockConnection: connectionMock } = require('mysql2/promise');
    mockPool = poolMock;
    mockConnection = connectionMock;
    
    adapter = new MySQLAdapter(mockConfig);
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
    it('should initialize with MySQL specific defaults', () => {
      expect(adapter.adapterInfo.name).toBe('mysql-adapter');
      expect(adapter.adapterInfo.type).toBe('mysql');
      expect(adapter.adapterInfo.category).toBe('database');
      expect(adapter.queryTimeout).toBe(30000);
      expect(adapter.charset).toBe('utf8mb4');
      expect(adapter.timezone).toBe('local');
    });

    it('should set custom configuration options', () => {
      const customAdapter = new MySQLAdapter({
        ...mockConfig,
        queryTimeout: 60000,
        charset: 'latin1',
        timezone: 'UTC'
      });
      
      expect(customAdapter.queryTimeout).toBe(60000);
      expect(customAdapter.charset).toBe('latin1');
      expect(customAdapter.timezone).toBe('UTC');
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
    it('should connect to MySQL database successfully', async () => {
      mockConnection.query.mockResolvedValueOnce([
        [{ version: 'MySQL 8.0.33' }]
      ]);

      await adapter.connect();

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
        connectionLimit: 10,
        acquireTimeout: 10000,
        timeout: 60000,
        charset: 'utf8mb4',
        timezone: 'local'
      });
      
      expect(adapter.isConnected).toBe(true);
      expect(adapter.metrics.connectTime).toBeDefined();
    });

    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection failed');
      mockPool.getConnection.mockRejectedValueOnce(connectionError);

      await expect(adapter.connect()).rejects.toThrow('Connection failed');
      expect(adapter.isConnected).toBe(false);
    });

    it('should disconnect from MySQL database', async () => {
      mockConnection.query.mockResolvedValueOnce([
        [{ version: 'MySQL 8.0.33' }]
      ]);

      await adapter.connect();
      await adapter.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
      expect(adapter.isConnected).toBe(false);
      expect(adapter.pool).toBeNull();
    });

    it('should test connection successfully', async () => {
      adapter.pool = mockPool;
      mockConnection.ping.mockResolvedValueOnce();

      const result = await adapter.testConnection();

      expect(result).toBe(true);
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should return false for failed connection test', async () => {
      adapter.pool = mockPool;
      mockConnection.ping.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });

    it('should return false when no pool exists', async () => {
      const result = await adapter.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('Schema Discovery', () => {
    beforeEach(() => {
      adapter.pool = mockPool;
    });

    it('should discover MySQL schemas successfully', async () => {
      // Mock databases query
      mockConnection.query
        .mockResolvedValueOnce([
          [{ name: 'testdb', charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }]
        ])
        // Mock tables query
        .mockResolvedValueOnce([
          [{
            name: 'users',
            type: 'BASE TABLE',
            engine: 'InnoDB',
            row_count: 100,
            data_length: 16384,
            index_length: 0,
            auto_increment: 101,
            created_at: new Date(),
            updated_at: new Date(),
            comment: 'User table'
          }]
        ])
        // Mock columns query
        .mockResolvedValueOnce([
          [{
            name: 'id',
            data_type: 'int',
            column_type: 'int(11)',
            is_nullable: 'NO',
            default_value: null,
            key_type: 'PRI',
            extra: 'auto_increment',
            comment: 'Primary key',
            position: 1,
            max_length: null,
            precision: 10,
            scale: 0
          }]
        ])
        // Mock indexes query
        .mockResolvedValueOnce([
          [{
            table_name: 'users',
            name: 'idx_email',
            column_name: 'email',
            non_unique: 0,
            type: 'BTREE',
            sequence: 1
          }]
        ])
        // Mock triggers query
        .mockResolvedValueOnce([
          [{
            name: 'users_audit',
            event: 'INSERT',
            table_name: 'users',
            timing: 'AFTER',
            statement: 'INSERT INTO audit_log...'
          }]
        ])
        // Mock procedures query
        .mockResolvedValueOnce([
          [{
            name: 'get_user_count',
            type: 'PROCEDURE',
            return_type: null,
            definition: 'BEGIN SELECT COUNT(*) FROM users; END',
            created_at: new Date(),
            modified_at: new Date()
          }]
        ]);

      const result = await adapter.discoverSchemas();

      expect(result).toBeDefined();
      expect(result.schemas).toHaveLength(1);
      expect(result.schemas[0].name).toBe('testdb');
      expect(result.schemas[0].tables).toHaveLength(1);
      expect(result.schemas[0].tables[0].name).toBe('users');
      expect(result.schemas[0].tables[0].columns).toHaveLength(1);
      expect(result.schemas[0].indexes).toHaveLength(1);
      expect(result.schemas[0].triggers).toHaveLength(1);
      expect(result.schemas[0].procedures).toHaveLength(1);
      expect(result.metadata.totalSchemas).toBe(1);
    });

    it('should handle schema discovery errors', async () => {
      const error = new Error('Schema discovery failed');
      mockConnection.query.mockRejectedValueOnce(error);

      await expect(adapter.discoverSchemas()).rejects.toThrow('Schema discovery failed');
    });

    it('should throw error when not connected', async () => {
      adapter.pool = null;
      await expect(adapter.discoverSchemas()).rejects.toThrow('MySQL connection not established');
    });
  });

  describe('Data Reading', () => {
    beforeEach(() => {
      adapter.pool = mockPool;
    });

    it('should read data from MySQL table successfully', async () => {
      const mockRows = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
      ];
      
      mockConnection.query
        .mockResolvedValueOnce([mockRows])
        .mockResolvedValueOnce([[{ total: 2 }]]);

      const schema = { name: 'users' };
      const result = await adapter.readData(schema);

      expect(result.data).toEqual(mockRows);
      expect(result.metadata.total).toBe(2);
      expect(result.metadata.count).toBe(2);
      expect(result.metadata.schema).toBe('users');
    });

    it('should handle complex filters', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ id: 1, name: 'John' }]])
        .mockResolvedValueOnce([[{ total: 1 }]]);

      const schema = { name: 'users' };
      const options = {
        filters: {
          id: { $gt: 0 },
          name: { $like: '%John%' },
          age: { $between: [18, 65] },
          status: { $in: ['active', 'pending'] }
        }
      };

      const result = await adapter.readData(schema, options);

      expect(result.data).toHaveLength(1);
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });

    it('should handle joins and sorting', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ id: 1, name: 'John', department: 'IT' }]])
        .mockResolvedValueOnce([[{ total: 1 }]]);

      const schema = { name: 'users' };
      const options = {
        joins: [
          { type: 'INNER', table: 'departments', on: 'users.dept_id = departments.id' }
        ],
        sort: { name: 'asc', id: 'desc' },
        limit: 10,
        offset: 0
      };

      const result = await adapter.readData(schema, options);

      expect(result.data).toHaveLength(1);
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });

    it('should handle JSON field queries', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ id: 1, metadata: '{"role": "admin"}' }]])
        .mockResolvedValueOnce([[{ total: 1 }]]);

      const schema = { name: 'users' };
      const options = {
        filters: {
          metadata: { $json: { path: '$.role', value: 'admin' } }
        }
      };

      const result = await adapter.readData(schema, options);

      expect(result.data).toHaveLength(1);
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error when not connected', async () => {
      adapter.pool = null;
      const schema = { name: 'users' };
      
      await expect(adapter.readData(schema)).rejects.toThrow('MySQL connection not established');
    });
  });

  describe('Data Writing', () => {
    beforeEach(() => {
      adapter.pool = mockPool;
    });

    it('should insert data successfully', async () => {
      const mockResult = { affectedRows: 2, insertId: 1 };
      mockConnection.query.mockResolvedValueOnce([mockResult]);

      const schema = { name: 'users' };
      const data = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
      ];

      const result = await adapter.writeData(schema, data, { mode: 'insert' });

      expect(result.processed).toBe(2);
      expect(result.mode).toBe('insert');
      expect(result.schema).toBe('users');
      expect(mockConnection.query).toHaveBeenCalledTimes(1);
    });

    it('should handle upsert with on duplicate key update', async () => {
      const mockResult = { affectedRows: 1, insertId: 1 };
      mockConnection.query.mockResolvedValueOnce([mockResult]);

      const schema = { name: 'users' };
      const data = [{ id: 1, name: 'John Updated', email: 'john@example.com' }];

      const result = await adapter.writeData(schema, data, { 
        mode: 'upsert',
        updateFields: ['name']
      });

      expect(result.processed).toBe(1);
      expect(result.mode).toBe('upsert');
      expect(mockConnection.query).toHaveBeenCalledTimes(1);
    });

    it('should handle replace operation', async () => {
      const mockResult = { affectedRows: 1 };
      mockConnection.query.mockResolvedValueOnce([mockResult]);

      const schema = { name: 'users' };
      const data = [{ id: 1, name: 'John', email: 'john@example.com' }];

      const result = await adapter.writeData(schema, data, { mode: 'replace' });

      expect(result.processed).toBe(1);
      expect(result.mode).toBe('replace');
      expect(mockConnection.query).toHaveBeenCalledTimes(1);
    });

    it('should handle update operation', async () => {
      const mockResult = { affectedRows: 1 };
      mockConnection.query.mockResolvedValueOnce([mockResult]);

      const schema = { name: 'users' };
      const data = [{ name: 'John Updated' }];

      const result = await adapter.writeData(schema, data, { 
        mode: 'update',
        whereConditions: { id: 1 }
      });

      expect(result.processed).toBe(1);
      expect(result.mode).toBe('update');
      expect(mockConnection.query).toHaveBeenCalledTimes(1);
    });

    it('should handle transaction mode', async () => {
      const mockResult = { affectedRows: 1, insertId: 1 };
      mockConnection.query.mockResolvedValueOnce([mockResult]);

      const schema = { name: 'users' };
      const data = [{ name: 'John', email: 'john@example.com' }];

      const result = await adapter.writeData(schema, data, { 
        mode: 'insert',
        transaction: true
      });

      expect(result.processed).toBe(1);
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Insert failed');
      mockConnection.query.mockRejectedValueOnce(error);

      const schema = { name: 'users' };
      const data = [{ name: 'John', email: 'john@example.com' }];

      await expect(adapter.writeData(schema, data, { 
        mode: 'insert',
        transaction: true
      })).rejects.toThrow('Insert failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
    });

    it('should handle batch processing', async () => {
      const mockResult = { affectedRows: 1, insertId: 1 };
      mockConnection.query
        .mockResolvedValueOnce([mockResult])
        .mockResolvedValueOnce([mockResult]);

      const schema = { name: 'users' };
      const data = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
      ];

      const result = await adapter.writeData(schema, data, { 
        mode: 'insert',
        batchSize: 1
      });

      expect(result.processed).toBe(2);
      expect(result.batches).toBe(2);
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error for unsupported write mode', async () => {
      const schema = { name: 'users' };
      const data = [{ name: 'John' }];

      await expect(adapter.writeData(schema, data, { mode: 'invalid' }))
        .rejects.toThrow('Unsupported write mode: invalid');
    });

    it('should throw error for empty data', async () => {
      const schema = { name: 'users' };
      const data = [];

      await expect(adapter.writeData(schema, data))
        .rejects.toThrow('Data must be a non-empty array');
    });

    it('should throw error when not connected', async () => {
      adapter.pool = null;
      const schema = { name: 'users' };
      const data = [{ name: 'John' }];

      await expect(adapter.writeData(schema, data))
        .rejects.toThrow('MySQL connection not established');
    });
  });

  describe('Custom Query Execution', () => {
    beforeEach(() => {
      adapter.pool = mockPool;
    });

    it('should execute custom query successfully', async () => {
      const mockRows = [{ count: 5 }];
      const mockFields = [{ name: 'count', type: 'int' }];
      mockConnection.query.mockResolvedValueOnce([mockRows, mockFields]);

      const query = 'SELECT COUNT(*) as count FROM users';
      const result = await adapter.executeQuery(query);

      expect(result.rows).toEqual(mockRows);
      expect(result.fields).toEqual(mockFields);
      expect(result.rowCount).toBe(1);
      expect(result.metadata.query).toBe(query);
      expect(mockConnection.query).toHaveBeenCalledWith(query, []);
    });

    it('should execute parameterized query', async () => {
      const mockRows = [{ id: 1, name: 'John' }];
      const mockFields = [{ name: 'id' }, { name: 'name' }];
      mockConnection.query.mockResolvedValueOnce([mockRows, mockFields]);

      const query = 'SELECT * FROM users WHERE id = ? AND name = ?';
      const params = [1, 'John'];
      const result = await adapter.executeQuery(query, params);

      expect(result.rows).toEqual(mockRows);
      expect(mockConnection.query).toHaveBeenCalledWith(query, params);
    });

    it('should handle query execution errors', async () => {
      const error = new Error('Query failed');
      mockConnection.query.mockRejectedValueOnce(error);

      const query = 'INVALID SQL';
      await expect(adapter.executeQuery(query)).rejects.toThrow('Query failed');
    });

    it('should throw error when not connected', async () => {
      adapter.pool = null;
      const query = 'SELECT 1';
      
      await expect(adapter.executeQuery(query)).rejects.toThrow('MySQL connection not established');
    });
  });

  describe('System Metadata', () => {
    beforeEach(() => {
      adapter.pool = mockPool;
    });

    it('should get system metadata successfully', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ version: 'MySQL 8.0.33' }]])
        .mockResolvedValueOnce([[
          { Variable_name: 'version', Value: '8.0.33' },
          { Variable_name: 'character_set_server', Value: 'utf8mb4' }
        ]])
        .mockResolvedValueOnce([[
          { database_name: 'testdb', size_mb: 10.5 }
        ]]);

      const result = await adapter.getSystemMetadata();

      expect(result.version).toBe('MySQL 8.0.33');
      expect(result.serverVariables.version).toBe('8.0.33');
      expect(result.serverVariables.character_set_server).toBe('utf8mb4');
      expect(result.databases).toHaveLength(1);
      expect(result.databases[0].name).toBe('testdb');
      expect(result.databases[0].sizeMB).toBeCloseTo(10.5, 2);
      expect(result.connectionPool).toBeDefined();
      expect(result.capabilities).toBeDefined();
    });

    it('should handle metadata retrieval errors', async () => {
      const error = new Error('Metadata retrieval failed');
      mockConnection.query.mockRejectedValueOnce(error);

      await expect(adapter.getSystemMetadata()).rejects.toThrow('Metadata retrieval failed');
    });

    it('should throw error when not connected', async () => {
      adapter.pool = null;
      await expect(adapter.getSystemMetadata()).rejects.toThrow('MySQL connection not established');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      adapter.pool = mockPool;
      
      await adapter.cleanup();
      
      expect(mockPool.end).toHaveBeenCalled();
      expect(adapter.pool).toBeNull();
    });

    it('should handle cleanup when no pool exists', async () => {
      await expect(adapter.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup errors', async () => {
      adapter.pool = mockPool;
      const error = new Error('Cleanup failed');
      mockPool.end.mockRejectedValueOnce(error);

      await expect(adapter.cleanup()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      adapter.pool = mockPool;
    });

    it('should emit connected event on successful connection', async () => {
      const connectedSpy = jest.fn();
      adapter.on('connected', connectedSpy);

      mockConnection.query.mockResolvedValueOnce([
        [{ version: 'MySQL 8.0.33' }]
      ]);

      await adapter.connect();

      expect(connectedSpy).toHaveBeenCalledWith({
        host: 'localhost',
        database: 'testdb',
        version: 'MySQL 8.0.33'
      });
    });

    it('should emit disconnected event on disconnection', async () => {
      const disconnectedSpy = jest.fn();
      adapter.on('disconnected', disconnectedSpy);

      mockConnection.query.mockResolvedValueOnce([
        [{ version: 'MySQL 8.0.33' }]
      ]);

      await adapter.connect();
      await adapter.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should emit error event on failures', async () => {
      const errorSpy = jest.fn();
      adapter.on('error', errorSpy);

      const error = new Error('Connection failed');
      mockPool.getConnection.mockRejectedValueOnce(error);

      await expect(adapter.connect()).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });
});