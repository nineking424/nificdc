const SchemaDiscoveryService = require('../../../services/schemaDiscovery');
const { PostgreSQLAdapter, MySQLAdapter } = require('../../../services/systemAdapters');
const { UNIVERSAL_TYPES } = require('../../../services/schemaDiscovery/TypeMapper');

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../src/models', () => ({
  System: {
    findByPk: jest.fn()
  }
}));

// Mock base adapter class
class MockBaseSystemAdapter {
  constructor() {
    this.isConnected = false;
  }
  async connect() { this.isConnected = true; }
  async disconnect() { this.isConnected = false; }
}

jest.mock('../../../services/systemAdapters', () => {
  const MockBaseSystemAdapter = class MockBaseSystemAdapter {
    constructor() {
      this.isConnected = false;
    }
    async connect() { this.isConnected = true; }
    async disconnect() { this.isConnected = false; }
  };

  return {
    BaseSystemAdapter: MockBaseSystemAdapter,
    PostgreSQLAdapter: jest.fn(),
    MySQLAdapter: jest.fn()
  };
});

describe('SchemaDiscoveryService', () => {
  let service;
  let mockSystem;
  let mockPostgreSQLAdapter;
  let mockMySQLAdapter;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create service instance
    service = new SchemaDiscoveryService({
      cacheTimeout: 1000, // 1 second for testing
      maxCacheSize: 10,
      enableCache: true
    });

    // Mock system data
    mockSystem = {
      id: 1,
      name: 'Test Database',
      type: 'postgresql',
      connectionInfo: {
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'test',
        password: 'test'
      },
      status: 'active'
    };

    // Get the mocked BaseSystemAdapter class
    const { BaseSystemAdapter } = require('../../../services/systemAdapters');

    // Create mock adapters that extend BaseSystemAdapter
    class MockPostgreSQLAdapter extends BaseSystemAdapter {
      constructor(config, info) {
        super();
        this.isConnected = false;
        this.connect = jest.fn().mockResolvedValue();
        this.disconnect = jest.fn().mockResolvedValue();
        this.discoverSchemas = jest.fn();
        this.getSampleData = jest.fn();
      }
    }

    class MockMySQLAdapter extends BaseSystemAdapter {
      constructor(config, info) {
        super();
        this.isConnected = false;
        this.connect = jest.fn().mockResolvedValue();
        this.disconnect = jest.fn().mockResolvedValue();
        this.discoverSchemas = jest.fn();
        this.getSampleData = jest.fn();
      }
    }

    mockPostgreSQLAdapter = new MockPostgreSQLAdapter();
    mockMySQLAdapter = new MockMySQLAdapter();

    // Set up default mock implementations
    mockPostgreSQLAdapter.getSampleData.mockImplementation(async (schema, table, options) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return [
        { id: 1, email: 'user1@example.com' },
        { id: 2, email: 'user2@example.com' }
      ];
    });

    // Mock adapter constructors
    PostgreSQLAdapter.mockImplementation(() => mockPostgreSQLAdapter);
    MySQLAdapter.mockImplementation(() => mockMySQLAdapter);

    // Mock System.findByPk
    const { System } = require('../../../src/models');
    System.findByPk.mockResolvedValue(mockSystem);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const defaultService = new SchemaDiscoveryService();
      
      expect(defaultService.options.cacheTimeout).toBe(3600000); // 1 hour
      expect(defaultService.options.maxCacheSize).toBe(1000);
      expect(defaultService.options.enableCache).toBe(true);
      expect(defaultService.options.defaultSampleSize).toBe(100);
      
      defaultService.shutdown();
    });

    it('should register built-in adapters', () => {
      const registeredTypes = service.getRegisteredAdapterTypes();
      
      expect(registeredTypes).toContain('postgresql');
      expect(registeredTypes).toContain('mysql');
      expect(registeredTypes).toHaveLength(2);
    });

    it('should initialize cache and stats', () => {
      expect(service.cache).toBeDefined();
      expect(service.cacheStats).toEqual({
        hits: 0,
        misses: 0,
        evictions: 0
      });
    });

    it('should initialize TypeMapper', () => {
      expect(service.typeMapper).toBeDefined();
      expect(typeof service.getUniversalTypes).toBe('function');
      expect(typeof service.mapToUniversalType).toBe('function');
      expect(typeof service.getTypeMappingStats).toBe('function');
    });
  });

  describe('Adapter Management', () => {
    it('should register custom adapter factory', () => {
      const customFactory = jest.fn(() => mockPostgreSQLAdapter);
      
      service.registerAdapterFactory('custom', customFactory);
      
      const types = service.getRegisteredAdapterTypes();
      expect(types).toContain('custom');
    });

    it('should throw error for invalid adapter factory', () => {
      expect(() => {
        service.registerAdapterFactory('invalid', 'not-a-function');
      }).toThrow('Adapter factory must be a function');
    });

    it('should get adapter for registered type', () => {
      const adapter = service.getAdapter('postgresql', mockSystem.connectionInfo);
      
      expect(adapter).toBe(mockPostgreSQLAdapter);
      expect(PostgreSQLAdapter).toHaveBeenCalledWith(
        mockSystem.connectionInfo,
        expect.objectContaining({
          name: 'PostgreSQL',
          version: '1.0.0'
        })
      );
    });

    it('should cache and reuse adapters', () => {
      const adapter1 = service.getAdapter('postgresql', mockSystem.connectionInfo);
      const adapter2 = service.getAdapter('postgresql', mockSystem.connectionInfo);
      
      expect(adapter1).toBe(adapter2);
      expect(PostgreSQLAdapter).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unregistered adapter type', () => {
      expect(() => {
        service.getAdapter('unknown', {});
      }).toThrow('No adapter factory registered for system type: unknown');
    });
  });

  describe('Schema Discovery', () => {
    beforeEach(() => {
      const mockSchemas = [
        {
          name: 'public',
          tables: [
            {
              name: 'users',
              type: 'table',
              columns: [
                {
                  name: 'id',
                  dataType: 'integer',
                  isNullable: false,
                  isPrimaryKey: true
                },
                {
                  name: 'email',
                  dataType: 'varchar',
                  characterMaximumLength: 255,
                  isNullable: false
                }
              ]
            }
          ]
        }
      ];

      // Set up mock data for all cache tests too
      mockPostgreSQLAdapter.discoverSchemas.mockResolvedValue(mockSchemas);
      
      // Add a small delay to ensure discoveryTime > 0
      mockPostgreSQLAdapter.discoverSchemas.mockImplementation(async (options) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return mockSchemas;
      });
    });

    it('should discover schemas successfully', async () => {
      const result = await service.discoverSchemas(1);
      
      expect(result.systemId).toBe(1);
      expect(result.systemType).toBe('postgresql');
      expect(result.schemas).toHaveLength(1);
      expect(result.universalSchemas).toHaveLength(1);
      expect(result.metadata.schemaCount).toBe(1);
      expect(result.fromCache).toBe(false);
      expect(result.discoveryTime).toBeGreaterThan(0);
      
      // Check universal schema conversion
      const universalSchema = result.universalSchemas[0];
      expect(universalSchema.name).toBe('public');
      expect(universalSchema.systemType).toBe('postgresql');
      expect(universalSchema.tables).toHaveLength(1);
      
      const universalTable = universalSchema.tables[0];
      expect(universalTable.name).toBe('users');
      expect(universalTable.columns).toHaveLength(2);
      
      const idColumn = universalTable.columns[0];
      expect(idColumn.name).toBe('id');
      expect(idColumn.universalType).toBe(UNIVERSAL_TYPES.INTEGER);
      expect(idColumn.isPrimaryKey).toBe(true);
      
      const emailColumn = universalTable.columns[1];
      expect(emailColumn.name).toBe('email');
      expect(emailColumn.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);
      
      expect(mockPostgreSQLAdapter.connect).toHaveBeenCalled();
      expect(mockPostgreSQLAdapter.discoverSchemas).toHaveBeenCalledWith({
        includeViews: false,
        includeSystemTables: false,
        sampleSize: 100
      });
    });

    it('should use cached results', async () => {
      // First call
      const result1 = await service.discoverSchemas(1);
      expect(result1.fromCache).toBe(false);
      expect(service.cacheStats.misses).toBe(1);
      
      // Second call should use cache
      const result2 = await service.discoverSchemas(1);
      expect(result2.fromCache).toBe(true);
      expect(service.cacheStats.hits).toBe(1);
      
      // Adapter should only be called once
      expect(mockPostgreSQLAdapter.discoverSchemas).toHaveBeenCalledTimes(1);
    });

    it('should force refresh when requested', async () => {
      // First call
      await service.discoverSchemas(1);
      
      // Force refresh
      const result = await service.discoverSchemas(1, { forceRefresh: true });
      expect(result.fromCache).toBe(false);
      
      // Adapter should be called twice
      expect(mockPostgreSQLAdapter.discoverSchemas).toHaveBeenCalledTimes(2);
    });

    it('should pass discovery options to adapter', async () => {
      const options = {
        includeViews: true,
        includeSystemTables: true,
        sampleSize: 50
      };
      
      await service.discoverSchemas(1, options);
      
      expect(mockPostgreSQLAdapter.discoverSchemas).toHaveBeenCalledWith({
        includeViews: true,
        includeSystemTables: true,
        sampleSize: 50
      });
    });

    it('should handle discovery errors', async () => {
      const error = new Error('Connection failed');
      mockPostgreSQLAdapter.discoverSchemas.mockRejectedValue(error);
      
      await expect(service.discoverSchemas(1)).rejects.toThrow('Connection failed');
    });

    it('should handle system not found', async () => {
      const { System } = require('../../../src/models');
      System.findByPk.mockResolvedValue(null);
      
      await expect(service.discoverSchemas(999)).rejects.toThrow('System not found: 999');
    });
  });

  describe('Sample Data Retrieval', () => {

    it('should retrieve sample data successfully', async () => {
      const result = await service.getSampleData(1, 'public', 'users');
      
      expect(result.systemId).toBe(1);
      expect(result.schemaName).toBe('public');
      expect(result.tableName).toBe('users');
      expect(result.sampleData).toHaveLength(2);
      expect(result.metadata.recordCount).toBe(2);
      expect(result.samplingTime).toBeGreaterThan(0);
      
      expect(mockPostgreSQLAdapter.getSampleData).toHaveBeenCalledWith('public', 'users', {
        limit: 100,
        offset: 0
      });
    });

    it('should pass sampling options to adapter', async () => {
      const options = { limit: 50, offset: 10 };
      
      await service.getSampleData(1, 'public', 'users', options);
      
      expect(mockPostgreSQLAdapter.getSampleData).toHaveBeenCalledWith('public', 'users', {
        limit: 50,
        offset: 10
      });
    });

    it('should handle sample data errors', async () => {
      const error = new Error('Table not found');
      mockPostgreSQLAdapter.getSampleData.mockRejectedValue(error);
      
      await expect(service.getSampleData(1, 'public', 'nonexistent')).rejects.toThrow('Table not found');
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      const mockSchemas = [
        {
          name: 'public',
          tables: [
            {
              name: 'users',
              type: 'table',
              columns: [
                { name: 'id', dataType: 'integer' },
                { name: 'email', dataType: 'varchar' }
              ]
            }
          ]
        }
      ];

      mockPostgreSQLAdapter.discoverSchemas.mockResolvedValue(mockSchemas);
    });

    it('should cache discovery results', async () => {
      await service.discoverSchemas(1);
      
      const cached = service.getCachedResult(1);
      expect(cached).toBeDefined();
      expect(cached.systemId).toBe(1);
    });

    it('should expire cache entries', async () => {
      await service.discoverSchemas(1);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const cached = service.getCachedResult(1);
      expect(cached).toBeNull();
    });

    it('should clear specific cache entries', async () => {
      await service.discoverSchemas(1);
      
      service.clearCache(1);
      
      const cached = service.getCachedResult(1);
      expect(cached).toBeNull();
    });

    it('should clear all cache entries', async () => {
      await service.discoverSchemas(1);
      
      service.clearCache();
      
      const cached = service.getCachedResult(1);
      expect(cached).toBeNull();
    });

    it('should respect max cache size', async () => {
      // Fill cache beyond max size
      for (let i = 1; i <= 12; i++) {
        mockSystem.id = i;
        const { System } = require('../../../src/models');
        System.findByPk.mockResolvedValue(mockSystem);
        
        await service.discoverSchemas(i);
      }
      
      expect(service.cache.size).toBe(10); // Should not exceed maxCacheSize
      expect(service.cacheStats.evictions).toBeGreaterThan(0);
    });

    it('should provide cache statistics', () => {
      const stats = service.getCacheStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('currentSize');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('Schema Conversion', () => {
    beforeEach(() => {
      const mockSchemas = [
        {
          name: 'public',
          tables: [
            {
              name: 'users',
              type: 'table',
              columns: [
                {
                  name: 'id',
                  dataType: 'integer',
                  isNullable: false,
                  isPrimaryKey: true
                },
                {
                  name: 'email',
                  dataType: 'varchar',
                  characterMaximumLength: 255,
                  isNullable: false
                }
              ]
            }
          ]
        }
      ];

      mockPostgreSQLAdapter.discoverSchemas.mockResolvedValue(mockSchemas);
    });

    it('should convert schemas to universal format', async () => {
      const mockSchemas = [
        {
          name: 'test_schema',
          tables: [
            {
              name: 'test_table',
              columns: [
                { name: 'id', dataType: 'bigint' },
                { name: 'name', dataType: 'text' },
                { name: 'created_at', dataType: 'timestamp' }
              ]
            }
          ]
        }
      ];

      const universalSchemas = await service.convertToUniversalSchema(mockSchemas, 'postgresql');
      
      expect(universalSchemas).toHaveLength(1);
      
      const schema = universalSchemas[0];
      expect(schema.name).toBe('test_schema');
      expect(schema.systemType).toBe('postgresql');
      expect(schema.tables).toHaveLength(1);
      
      const table = schema.tables[0];
      expect(table.columns).toHaveLength(3);
      
      expect(table.columns[0].universalType).toBe(UNIVERSAL_TYPES.BIGINT);
      expect(table.columns[1].universalType).toBe(UNIVERSAL_TYPES.TEXT);
      expect(table.columns[2].universalType).toBe(UNIVERSAL_TYPES.TIMESTAMP);
    });

    it('should emit schemasConverted event', async () => {
      const eventHandler = jest.fn();
      service.on('schemasConverted', eventHandler);
      
      const mockSchemas = [{ name: 'test', tables: [] }];
      await service.convertToUniversalSchema(mockSchemas, 'postgresql');
      
      expect(eventHandler).toHaveBeenCalledWith({
        systemType: 'postgresql',
        schemaCount: 1,
        conversionTime: expect.any(Number),
        universalSchemas: expect.any(Array)
      });
    });

    it('should emit conversionError event on failure', async () => {
      const eventHandler = jest.fn();
      service.on('conversionError', eventHandler);
      
      // Mock TypeMapper to throw error
      service.typeMapper.mapSchemaToUniversal = jest.fn().mockImplementation(() => {
        throw new Error('Conversion failed');
      });
      
      await expect(service.convertToUniversalSchema([{ name: 'test' }], 'postgresql'))
        .rejects.toThrow('Conversion failed');
      
      expect(eventHandler).toHaveBeenCalledWith({
        systemType: 'postgresql',
        error: 'Conversion failed',
        rawSchemas: [{ name: 'test' }]
      });
    });

    it('should provide type mapping utilities', () => {
      const universalTypes = service.getUniversalTypes();
      expect(universalTypes).toHaveProperty('INTEGER');
      expect(universalTypes).toHaveProperty('VARCHAR');
      
      const mapping = service.mapToUniversalType('varchar', 'postgresql');
      expect(mapping.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);
      
      const stats = service.getTypeMappingStats('postgresql');
      expect(stats).toHaveProperty('systemType');
      expect(stats).toHaveProperty('supportedTypes');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      const mockSchemas = [
        {
          name: 'public',
          tables: [
            {
              name: 'users',
              type: 'table',
              columns: [
                { name: 'id', dataType: 'integer' },
                { name: 'email', dataType: 'varchar' }
              ]
            }
          ]
        }
      ];

      mockPostgreSQLAdapter.discoverSchemas.mockResolvedValue(mockSchemas);
    });

    it('should emit schemasDiscovered event', async () => {
      const eventHandler = jest.fn();
      service.on('schemasDiscovered', eventHandler);
      
      await service.discoverSchemas(1);
      
      expect(eventHandler).toHaveBeenCalledWith({
        systemId: 1,
        systemType: 'postgresql',
        schemaCount: 1,
        discoveryTime: expect.any(Number)
      });
    });

    it('should emit discoveryError event', async () => {
      const eventHandler = jest.fn();
      service.on('discoveryError', eventHandler);
      
      const error = new Error('Discovery failed');
      mockPostgreSQLAdapter.discoverSchemas.mockRejectedValue(error);
      
      try {
        await service.discoverSchemas(1);
      } catch (e) {
        // Expected error
      }
      
      expect(eventHandler).toHaveBeenCalledWith({
        systemId: 1,
        error: 'Discovery failed',
        discoveryTime: expect.any(Number)
      });
    });

    it('should emit cacheCleared event', () => {
      const eventHandler = jest.fn();
      service.on('cacheCleared', eventHandler);
      
      service.clearCache(1);
      
      expect(eventHandler).toHaveBeenCalledWith({ systemId: 1 });
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      // Add some adapters
      service.getAdapter('postgresql', mockSystem.connectionInfo);
      service.getAdapter('mysql', { host: 'localhost' });
      
      // Make adapters connected
      mockPostgreSQLAdapter.isConnected = true;
      mockMySQLAdapter.isConnected = true;
      
      await service.shutdown();
      
      expect(mockPostgreSQLAdapter.disconnect).toHaveBeenCalled();
      expect(mockMySQLAdapter.disconnect).toHaveBeenCalled();
      expect(service.cache.size).toBe(0);
      expect(service.adapters.size).toBe(0);
    });

    it('should handle adapter disconnect errors during shutdown', async () => {
      service.getAdapter('postgresql', mockSystem.connectionInfo);
      mockPostgreSQLAdapter.isConnected = true;
      mockPostgreSQLAdapter.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      
      // Should not throw
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    it('should emit shutdown event', async () => {
      const eventHandler = jest.fn();
      service.on('shutdown', eventHandler);
      
      await service.shutdown();
      
      expect(eventHandler).toHaveBeenCalled();
    });
  });
});