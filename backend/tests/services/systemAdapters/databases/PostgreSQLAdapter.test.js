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

  describe('Schema Discovery', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
    });

    it('should discover basic schema structure', async () => {
      // Mock tables query
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'public',
              table_name: 'users',
              table_type: 'r',
              table_comment: 'User accounts',
              estimated_rows: 1000,
              table_size: '1024 kB',
              table_size_bytes: 1048576,
              owner: 'testuser'
            }
          ]
        })
        // Mock views query
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'public',
              view_name: 'user_summary',
              view_comment: 'User summary view',
              owner: 'testuser',
              view_definition: 'SELECT id, name FROM users'
            }
          ]
        })
        // Mock columns query for table
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'id',
              ordinal_position: 1,
              data_type: 'integer',
              base_type: 'int4',
              type_category: 'N',
              max_length: 4,
              numeric_precision: null,
              numeric_scale: null,
              is_not_null: true,
              has_default: true,
              default_value: 'nextval(\'users_id_seq\'::regclass)',
              column_comment: 'Primary key'
            },
            {
              column_name: 'name',
              ordinal_position: 2,
              data_type: 'character varying(100)',
              base_type: 'varchar',
              type_category: 'S',
              max_length: 104,
              numeric_precision: null,
              numeric_scale: null,
              is_not_null: false,
              has_default: false,
              default_value: null,
              column_comment: 'User name'
            }
          ]
        })
        // Mock primary key query for table
        .mockResolvedValueOnce({
          rows: [{ column_name: 'id', is_primary: true }]
        })
        // Mock foreign key query for table
        .mockResolvedValueOnce({ rows: [] })
        // Mock columns query for view
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'id',
              ordinal_position: 1,
              data_type: 'integer',
              base_type: 'int4',
              type_category: 'N',
              max_length: 4,
              numeric_precision: null,
              numeric_scale: null,
              is_not_null: true,
              has_default: false,
              default_value: null,
              column_comment: null
            }
          ]
        })
        // Mock primary key query for view
        .mockResolvedValueOnce({ rows: [] })
        // Mock foreign key query for view
        .mockResolvedValueOnce({ rows: [] })
        // Mock schema metadata query
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'public',
              owner: 'testuser',
              comment: 'Public schema'
            }
          ]
        });

      const schemas = await adapter.discoverSchemas();

      expect(schemas).toHaveLength(1);
      expect(schemas[0]).toMatchObject({
        name: 'public',
        type: 'schema',
        metadata: {
          owner: 'testuser',
          comment: 'Public schema',
          tableCount: 1,
          viewCount: 1
        }
      });

      const table = schemas[0].tables[0];
      expect(table).toMatchObject({
        name: 'users',
        type: 'table',
        schema: 'public',
        comment: 'User accounts',
        owner: 'testuser',
        primaryKeys: ['id']
      });

      expect(table.columns).toHaveLength(2);
      expect(table.columns[0]).toMatchObject({
        name: 'id',
        dataType: 'integer',
        universalType: 'INTEGER',
        isPrimaryKey: true,
        isNullable: false,
        hasDefault: true
      });

      const view = schemas[0].views[0];
      expect(view).toMatchObject({
        name: 'user_summary',
        type: 'view',
        schema: 'public',
        comment: 'User summary view',
        metadata: {
          viewDefinition: 'SELECT id, name FROM users'
        }
      });
    });

    it('should discover schema with specific filters', async () => {
      // Clear existing mocks from beforeEach
      mockClient.query.mockClear();
      
      // Setup fresh connection
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'custom',
              table_name: 'products',
              table_type: 'r',
              table_comment: null,
              estimated_rows: 500,
              table_size: '512 kB',
              table_size_bytes: 524288,
              owner: 'testuser'
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // No views
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'id',
              ordinal_position: 1,
              data_type: 'uuid',
              base_type: 'uuid',
              type_category: 'U',
              max_length: 16,
              numeric_precision: null,
              numeric_scale: null,
              is_not_null: true,
              has_default: true,
              default_value: 'gen_random_uuid()',
              column_comment: null
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ column_name: 'id', is_primary: true }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'custom',
              owner: 'testuser',
              comment: null
            }
          ]
        });

      const schemas = await adapter.discoverSchemas({
        schemaName: 'custom',
        includeViews: false
      });

      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('custom');
      expect(schemas[0].views).toHaveLength(0);
      expect(schemas[0].tables).toHaveLength(1);
      expect(schemas[0].tables[0].columns[0]).toMatchObject({
        name: 'id',
        dataType: 'uuid',
        universalType: 'STRING',
        isPrimaryKey: true
      });
    });

    it('should discover schema with indexes', async () => {
      // Clear existing mocks from beforeEach
      mockClient.query.mockClear();
      
      // Setup fresh connection
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'public',
              table_name: 'users',
              table_type: 'r',
              table_comment: null,
              estimated_rows: 1000,
              table_size: '1024 kB',
              table_size_bytes: 1048576,
              owner: 'testuser'
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // No views
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'email',
              ordinal_position: 1,
              data_type: 'character varying(255)',
              base_type: 'varchar',
              type_category: 'S',
              max_length: 259,
              numeric_precision: null,
              numeric_scale: null,
              is_not_null: false,
              has_default: false,
              default_value: null,
              column_comment: null
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ column_name: 'email', is_primary: true }] }) // Primary key
        .mockResolvedValueOnce({ rows: [] }) // No foreign keys
        .mockResolvedValueOnce({
          rows: [
            {
              index_name: 'users_email_idx',
              column_name: 'email',
              is_unique: true,
              is_primary: false,
              index_type: 'btree',
              index_definition: 'CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email)'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'public',
              owner: 'testuser',
              comment: null
            }
          ]
        });

      const schemas = await adapter.discoverSchemas({
        includeViews: false,
        includeIndexes: true
      });

      expect(schemas[0].tables[0].indexes).toHaveLength(1);
      expect(schemas[0].tables[0].indexes[0]).toMatchObject({
        name: 'users_email_idx',
        type: 'btree',
        isUnique: true,
        columns: ['email']
      });
    });

    it('should handle foreign key relationships', async () => {
      // Clear existing mocks from beforeEach
      mockClient.query.mockClear();
      
      // Setup fresh connection
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'public',
              table_name: 'orders',
              table_type: 'r',
              table_comment: null,
              estimated_rows: 500,
              table_size: '512 kB',
              table_size_bytes: 524288,
              owner: 'testuser'
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // No views
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'user_id',
              ordinal_position: 1,
              data_type: 'integer',
              base_type: 'int4',
              type_category: 'N',
              max_length: 4,
              numeric_precision: null,
              numeric_scale: null,
              is_not_null: true,
              has_default: false,
              default_value: null,
              column_comment: null
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // No primary keys
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'user_id',
              foreign_table: 'users',
              foreign_schema: 'public',
              foreign_column: 'id',
              constraint_name: 'fk_orders_user_id',
              on_delete: 'a',
              on_update: 'a'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              schema_name: 'public',
              owner: 'testuser',
              comment: null
            }
          ]
        });

      const schemas = await adapter.discoverSchemas({
        includeViews: false
      });

      const table = schemas[0].tables[0];
      expect(table.columns[0].foreignKeys).toHaveLength(1);
      expect(table.columns[0].foreignKeys[0]).toMatchObject({
        constraintName: 'fk_orders_user_id',
        referencedSchema: 'public',
        referencedTable: 'users',
        referencedColumn: 'id'
      });
    });

    it('should handle empty schema discovery', async () => {
      // Clear existing mocks from beforeEach
      mockClient.query.mockClear();
      
      // Setup fresh connection
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No tables
        .mockResolvedValueOnce({ rows: [] }) // No views
        .mockResolvedValueOnce({ rows: [] }); // No schema metadata

      const schemas = await adapter.discoverSchemas();

      expect(schemas).toHaveLength(0);
    });

    it('should handle discovery errors gracefully', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(adapter.discoverSchemas()).rejects.toThrow('Database error');
    });
  });

  describe('Type Mapping', () => {
    it('should map PostgreSQL types to universal types correctly', () => {
      // Test common type mappings
      expect(adapter._mapPostgreSQLTypeToUniversal('int4')).toBe('INTEGER');
      expect(adapter._mapPostgreSQLTypeToUniversal('int8')).toBe('LONG');
      expect(adapter._mapPostgreSQLTypeToUniversal('varchar')).toBe('STRING');
      expect(adapter._mapPostgreSQLTypeToUniversal('text')).toBe('STRING');
      expect(adapter._mapPostgreSQLTypeToUniversal('bool')).toBe('BOOLEAN');
      expect(adapter._mapPostgreSQLTypeToUniversal('timestamp')).toBe('DATETIME');
      expect(adapter._mapPostgreSQLTypeToUniversal('json')).toBe('JSON');
      expect(adapter._mapPostgreSQLTypeToUniversal('jsonb')).toBe('JSON');
      expect(adapter._mapPostgreSQLTypeToUniversal('uuid')).toBe('STRING');
      expect(adapter._mapPostgreSQLTypeToUniversal('bytea')).toBe('BINARY');
      expect(adapter._mapPostgreSQLTypeToUniversal('numeric')).toBe('DECIMAL');
      expect(adapter._mapPostgreSQLTypeToUniversal('float4')).toBe('FLOAT');
      expect(adapter._mapPostgreSQLTypeToUniversal('float8')).toBe('DOUBLE');
      expect(adapter._mapPostgreSQLTypeToUniversal('date')).toBe('DATE');
      expect(adapter._mapPostgreSQLTypeToUniversal('time')).toBe('TIME');
      expect(adapter._mapPostgreSQLTypeToUniversal('_text')).toBe('ARRAY');
      expect(adapter._mapPostgreSQLTypeToUniversal('xml')).toBe('XML');
      
      // Test unknown type fallback
      expect(adapter._mapPostgreSQLTypeToUniversal('unknown_type')).toBe('STRING');
    });
  });

  describe('Data CRUD Operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 14.5' }]
      });
      await adapter.connect();
    });

    describe('Read Data', () => {
      it('should read data with basic options', async () => {
        const schema = {
          name: 'users',
          schema: 'public',
          columns: [
            { name: 'id', dataType: 'integer' },
            { name: 'name', dataType: 'varchar' }
          ]
        };

        mockClient.query.mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'John Doe' },
            { id: 2, name: 'Jane Smith' }
          ],
          rowCount: 2,
          fields: [
            { name: 'id', dataTypeID: 23 },
            { name: 'name', dataTypeID: 1043 }
          ]
        });

        const result = await adapter.readData(schema, { limit: 10 });

        expect(result.data).toHaveLength(2);
        expect(result.rowCount).toBe(2);
        expect(result.data[0]).toEqual({ id: 1, name: 'John Doe' });
        expect(result.metadata.pagination.limit).toBe(10);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM "public"."users" LIMIT $1'),
          [10]
        );
      });

      it('should read data with filters', async () => {
        const schema = { name: 'users', schema: 'public' };

        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'John Doe' }],
          rowCount: 1,
          fields: [{ name: 'id', dataTypeID: 23 }]
        });

        const result = await adapter.readData(schema, {
          filters: { id: 1, name: 'John Doe' },
          limit: 10
        });

        expect(result.rowCount).toBe(1);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE "id" = $1 AND "name" = $2'),
          [1, 'John Doe', 10]
        );
      });

      it('should read data with complex filters', async () => {
        const schema = { name: 'users', schema: 'public' };

        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'John Doe' }],
          rowCount: 1,
          fields: [{ name: 'id', dataTypeID: 23 }]
        });

        const result = await adapter.readData(schema, {
          filters: {
            id: { gt: 0 },
            name: { like: 'John%' },
            age: { between: [18, 65] }
          },
          limit: 10
        });

        expect(result.rowCount).toBe(1);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE "id" > $1 AND "name" LIKE $2 AND "age" BETWEEN $3 AND $4'),
          [0, 'John%', 18, 65, 10]
        );
      });

      it('should read data with specific columns', async () => {
        const schema = { name: 'users', schema: 'public' };

        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'John Doe' }],
          rowCount: 1,
          fields: [{ name: 'id', dataTypeID: 23 }]
        });

        const result = await adapter.readData(schema, {
          columns: ['id', 'name'],
          limit: 10
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT "id", "name" FROM "public"."users"'),
          [10]
        );
      });

      it('should read data with ordering', async () => {
        const schema = { name: 'users', schema: 'public' };

        mockClient.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'John Doe' }],
          rowCount: 1,
          fields: [{ name: 'id', dataTypeID: 23 }]
        });

        const result = await adapter.readData(schema, {
          orderBy: 'name',
          orderDirection: 'DESC',
          limit: 10
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY "name" DESC'),
          [10]
        );
      });

      it('should include total count when requested', async () => {
        const schema = { name: 'users', schema: 'public' };

        mockClient.query
          .mockResolvedValueOnce({
            rows: [{ id: 1, name: 'John Doe' }],
            rowCount: 1,
            fields: [{ name: 'id', dataTypeID: 23 }]
          })
          .mockResolvedValueOnce({
            rows: [{ total: '100' }]
          });

        const result = await adapter.readData(schema, {
          limit: 10,
          includeTotalCount: true
        });

        expect(result.totalCount).toBe(100);
        expect(mockClient.query).toHaveBeenCalledTimes(3); // +1 for beforeEach connect
      });
    });

    describe('Write Data', () => {
      it('should insert data', async () => {
        const schema = {
          name: 'users',
          schema: 'public',
          columns: [
            { name: 'id', dataType: 'integer' },
            { name: 'name', dataType: 'varchar' }
          ]
        };

        const data = [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' }
        ];

        mockClient.query
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({
            rows: [],
            rowCount: 2
          }) // INSERT
          .mockResolvedValueOnce({}); // COMMIT

        const result = await adapter.writeData(schema, data);

        expect(result.written).toBe(0); // No returning clause
        expect(result.metadata.totalProcessed).toBe(2);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(
          'INSERT INTO "public"."users" ("id", "name") VALUES ($1, $2), ($3, $4)',
          [1, 'John Doe', 2, 'Jane Smith']
        );
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });

      it('should insert data with returning clause', async () => {
        const schema = { name: 'users', schema: 'public' };
        const data = [{ id: 1, name: 'John Doe' }];

        mockClient.query
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 1, name: 'John Doe' }],
            rowCount: 1
          }) // INSERT
          .mockResolvedValueOnce({}); // COMMIT

        const result = await adapter.writeData(schema, data, {
          returning: ['id', 'name']
        });

        expect(result.written).toBe(1);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({ id: 1, name: 'John Doe' });
        expect(mockClient.query).toHaveBeenCalledWith(
          'INSERT INTO "public"."users" ("id", "name") VALUES ($1, $2) RETURNING "id", "name"',
          [1, 'John Doe']
        );
      });

      it('should upsert data', async () => {
        const schema = { name: 'users', schema: 'public' };
        const data = [{ id: 1, name: 'John Doe Updated' }];

        mockClient.query
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 1, name: 'John Doe Updated' }],
            rowCount: 1
          }) // UPSERT
          .mockResolvedValueOnce({}); // COMMIT

        const result = await adapter.writeData(schema, data, {
          mode: 'upsert',
          conflictColumns: ['id'],
          returning: true
        });

        expect(result.written).toBe(1);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name" RETURNING *'),
          [1, 'John Doe Updated']
        );
      });

      it('should handle batch processing', async () => {
        const schema = { name: 'users', schema: 'public' };
        const data = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}` }));

        mockClient.query
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValue({ rows: [], rowCount: 1000 }) // Batch inserts
          .mockResolvedValueOnce({}); // COMMIT

        const result = await adapter.writeData(schema, data, {
          batchSize: 1000
        });

        expect(result.metadata.batchCount).toBe(3);
        expect(result.metadata.totalProcessed).toBe(2500);
        expect(mockClient.query).toHaveBeenCalledTimes(6); // +1 for beforeEach connect + BEGIN + 3 batches + COMMIT
      });

      it('should validate data against schema', async () => {
        const schema = {
          name: 'users',
          schema: 'public',
          columns: [
            { name: 'id', dataType: 'integer' },
            { name: 'name', dataType: 'varchar' }
          ]
        };

        const data = [{ id: 1, name: 'John Doe', invalid_column: 'value' }];

        await expect(adapter.writeData(schema, data)).rejects.toThrow('Unknown columns in data: invalid_column');
      });

      it('should handle empty data array', async () => {
        const schema = { name: 'users', schema: 'public' };
        const data = [];

        await expect(adapter.writeData(schema, data)).rejects.toThrow('Data must be a non-empty array');
      });

      it('should rollback on error', async () => {
        const schema = { name: 'users', schema: 'public' };
        const data = [{ id: 1, name: 'John Doe' }];

        mockClient.query
          .mockResolvedValueOnce({}) // BEGIN
          .mockRejectedValueOnce(new Error('Database error'))
          .mockResolvedValueOnce({}); // ROLLBACK

        await expect(adapter.writeData(schema, data)).rejects.toThrow('Failed to write data: Database error');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });
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