const EventEmitter = require('events');
const logger = require('../../src/utils/logger');
const { System } = require('../../src/models');
const { 
  BaseSystemAdapter, 
  PostgreSQLAdapter, 
  MySQLAdapter 
} = require('../systemAdapters');
const { TypeMapper } = require('./TypeMapper');

/**
 * Schema Discovery Service
 * 다양한 시스템에서 스키마를 탐색하고 Universal Schema 형식으로 변환하는 서비스
 */
class SchemaDiscoveryService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      cacheTimeout: options.cacheTimeout || 3600000, // 1 hour default
      maxCacheSize: options.maxCacheSize || 1000,
      enableCache: options.enableCache !== false,
      defaultSampleSize: options.defaultSampleSize || 100,
      ...options
    };
    
    // Adapter registry
    this.adapters = new Map();
    this.adapterFactories = new Map();
    
    // Cache for schema discovery results
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Type mapper for Universal Schema conversion
    this.typeMapper = new TypeMapper();
    
    // Initialize built-in adapters
    this.initializeBuiltInAdapters();
    
    // Setup cache cleanup interval
    if (this.options.enableCache) {
      this.setupCacheCleanup();
    }
    
    logger.info('Schema Discovery Service initialized', {
      cacheEnabled: this.options.enableCache,
      cacheTimeout: this.options.cacheTimeout,
      registeredAdapters: Array.from(this.adapterFactories.keys())
    });
  }

  /**
   * Initialize built-in system adapters
   */
  initializeBuiltInAdapters() {
    // Register PostgreSQL adapter factory
    this.registerAdapterFactory('postgresql', (config) => {
      return new PostgreSQLAdapter(config, {
        name: 'PostgreSQL',
        version: '1.0.0',
        capabilities: ['supportsSchemaDiscovery', 'supportsDataSampling']
      });
    });

    // Register MySQL adapter factory
    this.registerAdapterFactory('mysql', (config) => {
      return new MySQLAdapter(config, {
        name: 'MySQL',
        version: '1.0.0',
        capabilities: ['supportsSchemaDiscovery', 'supportsDataSampling']
      });
    });

    logger.debug('Built-in adapters registered', {
      adapters: Array.from(this.adapterFactories.keys())
    });
  }

  /**
   * Register a new adapter factory
   * @param {string} systemType - Type of the system (e.g., 'postgresql', 'mysql')
   * @param {Function} factory - Factory function that creates adapter instances
   */
  registerAdapterFactory(systemType, factory) {
    if (typeof factory !== 'function') {
      throw new Error('Adapter factory must be a function');
    }
    
    this.adapterFactories.set(systemType.toLowerCase(), factory);
    
    logger.debug('Adapter factory registered', { systemType });
    this.emit('adapterRegistered', { systemType, factory });
  }

  /**
   * Get or create an adapter for a system type
   * @param {string} systemType - Type of the system
   * @param {Object} config - Configuration for the adapter
   * @returns {BaseSystemAdapter} Adapter instance
   */
  getAdapter(systemType, config) {
    const normalizedType = systemType.toLowerCase();
    const adapterKey = `${normalizedType}_${JSON.stringify(config)}`;
    
    // Check if adapter is already created and cached
    if (this.adapters.has(adapterKey)) {
      return this.adapters.get(adapterKey);
    }
    
    // Get factory for this system type
    const factory = this.adapterFactories.get(normalizedType);
    if (!factory) {
      throw new Error(`No adapter factory registered for system type: ${systemType}`);
    }
    
    // Create new adapter instance
    const adapter = factory(config);
    
    // Validate that it extends BaseSystemAdapter
    if (!(adapter instanceof BaseSystemAdapter)) {
      throw new Error(`Adapter for ${systemType} must extend BaseSystemAdapter`);
    }
    
    // Cache the adapter
    this.adapters.set(adapterKey, adapter);
    
    logger.debug('Adapter created and cached', { systemType, adapterKey });
    
    return adapter;
  }

  /**
   * Discover schemas for a specific system
   * @param {number|string} systemId - System identifier
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} Discovery result with schemas and metadata
   */
  async discoverSchemas(systemId, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (this.options.enableCache && !options.forceRefresh) {
        const cached = this.getCachedResult(systemId);
        if (cached) {
          this.cacheStats.hits++;
          logger.debug('Schema discovery cache hit', { systemId });
          
          return {
            ...cached,
            fromCache: true,
            discoveryTime: Date.now() - startTime
          };
        }
        this.cacheStats.misses++;
      }
      
      // Get system configuration
      const system = await this.getSystemConfiguration(systemId);
      
      // Get appropriate adapter
      const adapter = this.getAdapter(system.type, system.connectionInfo);
      
      // Ensure adapter is connected
      if (!adapter.isConnected) {
        await adapter.connect();
      }
      
      // Discover schemas using the adapter
      const rawSchemas = await adapter.discoverSchemas({
        includeViews: options.includeViews || false,
        includeSystemTables: options.includeSystemTables || false,
        sampleSize: options.sampleSize || this.options.defaultSampleSize,
        ...options
      });
      
      // Convert to Universal Schema format
      const universalSchemas = await this.convertToUniversalSchema(rawSchemas, system.type, options);
      
      // Create discovery result
      const result = {
        systemId,
        systemType: system.type,
        schemas: rawSchemas,
        universalSchemas,
        metadata: {
          discoveredAt: new Date(),
          schemaCount: rawSchemas.length,
          totalTables: rawSchemas.reduce((sum, schema) => sum + (schema.tables?.length || 0), 0),
          options: {
            includeViews: options.includeViews || false,
            includeSystemTables: options.includeSystemTables || false,
            sampleSize: options.sampleSize || this.options.defaultSampleSize
          }
        },
        discoveryTime: Date.now() - startTime,
        fromCache: false
      };
      
      // Cache the result
      if (this.options.enableCache) {
        this.setCachedResult(systemId, result);
      }
      
      // Emit discovery event
      this.emit('schemasDiscovered', {
        systemId,
        systemType: system.type,
        schemaCount: result.metadata.schemaCount,
        discoveryTime: result.discoveryTime
      });
      
      logger.info('Schema discovery completed', {
        systemId,
        systemType: system.type,
        schemaCount: result.metadata.schemaCount,
        discoveryTime: result.discoveryTime
      });
      
      return result;
      
    } catch (error) {
      logger.error('Schema discovery failed', {
        systemId,
        error: error.message,
        stack: error.stack
      });
      
      this.emit('discoveryError', {
        systemId,
        error: error.message,
        discoveryTime: Date.now() - startTime
      });
      
      throw error;
    }
  }

  /**
   * Get sample data for a specific table
   * @param {number|string} systemId - System identifier
   * @param {string} schemaName - Schema name
   * @param {string} tableName - Table name
   * @param {Object} options - Sampling options
   * @returns {Promise<Object>} Sample data result
   */
  async getSampleData(systemId, schemaName, tableName, options = {}) {
    const startTime = Date.now();
    
    try {
      // Get system configuration
      const system = await this.getSystemConfiguration(systemId);
      
      // Get appropriate adapter
      const adapter = this.getAdapter(system.type, system.connectionInfo);
      
      // Ensure adapter is connected
      if (!adapter.isConnected) {
        await adapter.connect();
      }
      
      // Get sample data
      const sampleData = await adapter.getSampleData(schemaName, tableName, {
        limit: options.limit || this.options.defaultSampleSize,
        offset: options.offset || 0,
        ...options
      });
      
      const result = {
        systemId,
        schemaName,
        tableName,
        sampleData,
        metadata: {
          sampledAt: new Date(),
          recordCount: sampleData.length,
          limit: options.limit || this.options.defaultSampleSize,
          offset: options.offset || 0
        },
        samplingTime: Date.now() - startTime
      };
      
      logger.debug('Sample data retrieved', {
        systemId,
        schemaName,
        tableName,
        recordCount: result.metadata.recordCount,
        samplingTime: result.samplingTime
      });
      
      return result;
      
    } catch (error) {
      logger.error('Sample data retrieval failed', {
        systemId,
        schemaName,
        tableName,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Convert native schemas to Universal Schema format
   * @param {Array} rawSchemas - Native schemas from adapter
   * @param {string} systemType - Source system type
   * @param {Object} options - Conversion options
   * @returns {Promise<Array>} Universal schemas
   */
  async convertToUniversalSchema(rawSchemas, systemType, options = {}) {
    try {
      const startTime = Date.now();
      
      const universalSchemas = rawSchemas.map(schema => {
        return this.typeMapper.mapSchemaToUniversal(schema, systemType);
      });
      
      const conversionTime = Date.now() - startTime;
      
      logger.debug('Schema conversion completed', {
        systemType,
        schemaCount: rawSchemas.length,
        conversionTime
      });
      
      // Emit conversion event
      this.emit('schemasConverted', {
        systemType,
        schemaCount: rawSchemas.length,
        conversionTime,
        universalSchemas
      });
      
      return universalSchemas;
      
    } catch (error) {
      logger.error('Schema conversion failed', {
        systemType,
        error: error.message,
        stack: error.stack
      });
      
      this.emit('conversionError', {
        systemType,
        error: error.message,
        rawSchemas
      });
      
      throw error;
    }
  }

  /**
   * Get type mapping statistics for a system
   * @param {string} systemType - System type
   * @returns {Object} Type mapping statistics
   */
  getTypeMappingStats(systemType) {
    return this.typeMapper.getMappingStats(systemType);
  }

  /**
   * Get supported universal types
   * @returns {Object} Universal types constants
   */
  getUniversalTypes() {
    return this.typeMapper.getUniversalTypes();
  }

  /**
   * Map a single native type to universal type
   * @param {string} nativeType - Native type from source system
   * @param {string} systemType - Source system type
   * @param {Object} typeMetadata - Additional type metadata
   * @returns {Object} Type mapping result
   */
  mapToUniversalType(nativeType, systemType, typeMetadata = {}) {
    return this.typeMapper.mapToUniversalType(nativeType, systemType, typeMetadata);
  }

  /**
   * Get system configuration from database
   * @param {number|string} systemId - System identifier
   * @returns {Promise<Object>} System configuration
   */
  async getSystemConfiguration(systemId) {
    const system = await System.findByPk(systemId);
    
    if (!system) {
      throw new Error(`System not found: ${systemId}`);
    }
    
    return {
      id: system.id,
      name: system.name,
      type: system.type,
      connectionInfo: system.connectionInfo,
      status: system.status
    };
  }

  /**
   * Get cached discovery result
   * @param {number|string} systemId - System identifier
   * @returns {Object|null} Cached result or null if not found/expired
   */
  getCachedResult(systemId) {
    const cached = this.cache.get(systemId);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache entry has expired
    const now = Date.now();
    if (now - cached.timestamp > this.options.cacheTimeout) {
      this.cache.delete(systemId);
      this.cacheStats.evictions++;
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set cached discovery result
   * @param {number|string} systemId - System identifier
   * @param {Object} data - Data to cache
   */
  setCachedResult(systemId, data) {
    // Check cache size limit
    if (this.cache.size >= this.options.maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
    
    this.cache.set(systemId, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache for a specific system or all systems
   * @param {number|string} systemId - System identifier (optional)
   */
  clearCache(systemId = null) {
    if (systemId) {
      const deleted = this.cache.delete(systemId);
      if (deleted) {
        this.cacheStats.evictions++;
      }
      logger.debug('Cache cleared for system', { systemId });
    } else {
      const size = this.cache.size;
      this.cache.clear();
      this.cacheStats.evictions += size;
      logger.debug('All cache cleared', { clearedEntries: size });
    }
    
    this.emit('cacheCleared', { systemId });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      currentSize: this.cache.size,
      maxSize: this.options.maxCacheSize,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }

  /**
   * Get list of registered adapter types
   * @returns {Array<string>} Array of adapter type names
   */
  getRegisteredAdapterTypes() {
    return Array.from(this.adapterFactories.keys());
  }

  /**
   * Setup cache cleanup interval
   */
  setupCacheCleanup() {
    // Clean up expired cache entries every 15 minutes
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [systemId, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.options.cacheTimeout) {
          this.cache.delete(systemId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        this.cacheStats.evictions += cleaned;
        logger.debug('Cache cleanup completed', { cleanedEntries: cleaned });
      }
    }, 15 * 60 * 1000); // 15 minutes
  }

  /**
   * Refresh a specific schema
   * @param {string} systemId - System identifier
   * @param {string} schemaName - Schema name to refresh
   * @param {Object} options - Refresh options
   * @returns {Promise<Object>} Refreshed schema
   */
  async refreshSchema(systemId, schemaName, options = {}) {
    try {
      // Get adapter
      const adapter = this.adapters.get(systemId);
      if (!adapter) {
        throw new Error(`No adapter found for system: ${systemId}`);
      }

      // Clear cache for this system and rediscover
      this.clearCache(systemId);
      
      // Discover schemas with force refresh
      const schemas = await this.discoverSchemas(systemId, { 
        forceRefresh: true,
        ...options 
      });
      
      return schemas.find(s => s.name === schemaName);

    } catch (error) {
      logger.error('Schema refresh failed', {
        systemId,
        schemaName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get table statistics
   * @param {string} systemId - System identifier
   * @param {string} schemaName - Schema name
   * @param {string} tableName - Table name
   * @returns {Promise<Object>} Table statistics
   */
  async getTableStatistics(systemId, schemaName, tableName) {
    try {
      const adapter = this.adapters.get(systemId);
      if (!adapter) {
        throw new Error(`No adapter found for system: ${systemId}`);
      }

      // Get table statistics using adapter
      if (typeof adapter.getTableStatistics === 'function') {
        return await adapter.getTableStatistics(schemaName, tableName);
      }

      // Fallback: basic statistics from schema
      const schemas = await this.discoverSchemas(systemId);
      const schema = schemas.find(s => s.name === schemaName);
      if (!schema) {
        throw new Error(`Schema not found: ${schemaName}`);
      }

      const table = schema.tables.find(t => t.name === tableName);
      if (!table) {
        throw new Error(`Table not found: ${tableName}`);
      }

      return {
        rowCount: null,
        sizeInBytes: null,
        columns: table.columns.length,
        indexes: table.indexes?.length || 0,
        lastAnalyzed: null
      };

    } catch (error) {
      logger.error('Failed to get table statistics', {
        systemId,
        schemaName,
        tableName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Compare two schemas for compatibility
   * @param {Object} sourceSchema - Source schema info
   * @param {Object} targetSchema - Target schema info
   * @returns {Promise<Object>} Comparison result
   */
  async compareSchemas(sourceSchema, targetSchema) {
    try {
      // Get schemas
      const sourceSchemas = await this.discoverSchemas(sourceSchema.systemId);
      const targetSchemas = await this.discoverSchemas(targetSchema.systemId);

      const source = sourceSchemas.find(s => s.name === sourceSchema.schemaName);
      const target = targetSchemas.find(s => s.name === targetSchema.schemaName);

      if (!source) {
        throw new Error(`Source schema not found: ${sourceSchema.schemaName}`);
      }
      if (!target) {
        throw new Error(`Target schema not found: ${targetSchema.schemaName}`);
      }

      const sourceTable = source.tables.find(t => t.name === sourceSchema.tableName);
      const targetTable = target.tables.find(t => t.name === targetSchema.tableName);

      if (!sourceTable) {
        throw new Error(`Source table not found: ${sourceSchema.tableName}`);
      }
      if (!targetTable) {
        throw new Error(`Target table not found: ${targetSchema.tableName}`);
      }

      // Compare columns
      const comparison = {
        compatibilityScore: 100,
        issues: [],
        mappingSuggestions: []
      };

      const targetColumnMap = new Map(targetTable.columns.map(col => [col.name.toLowerCase(), col]));

      sourceTable.columns.forEach(sourceCol => {
        const targetCol = targetColumnMap.get(sourceCol.name.toLowerCase());
        
        if (!targetCol) {
          comparison.issues.push({
            type: 'MISSING_COLUMN',
            severity: 'warning',
            source: sourceCol.name,
            message: `Column '${sourceCol.name}' not found in target table`
          });
          comparison.compatibilityScore -= 5;
        } else {
          // Check type compatibility
          if (sourceCol.dataType !== targetCol.dataType) {
            const compatible = this.typeMapper.areTypesCompatible(
              sourceCol.dataType, 
              targetCol.dataType
            );
            
            if (!compatible) {
              comparison.issues.push({
                type: 'TYPE_MISMATCH',
                severity: 'error',
                source: sourceCol.name,
                target: targetCol.name,
                message: `Type mismatch: ${sourceCol.dataType} -> ${targetCol.dataType}`
              });
              comparison.compatibilityScore -= 10;
            } else {
              comparison.mappingSuggestions.push({
                source: sourceCol.name,
                target: targetCol.name,
                transformation: 'type_conversion'
              });
            }
          }
          
          // Check constraints
          if (sourceCol.isNullable === false && targetCol.isNullable === true) {
            comparison.issues.push({
              type: 'CONSTRAINT_MISMATCH',
              severity: 'warning',
              source: sourceCol.name,
              target: targetCol.name,
              message: 'Source is NOT NULL but target allows NULL'
            });
          }
        }
      });

      comparison.compatibilityScore = Math.max(0, comparison.compatibilityScore);

      return comparison;

    } catch (error) {
      logger.error('Schema comparison failed', {
        sourceSchema,
        targetSchema,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get cache status
   * @returns {Object} Cache status and statistics
   */
  getCacheStatus() {
    const cacheEntries = [];
    let totalSize = 0;

    this.cache.forEach((value, key) => {
      const size = JSON.stringify(value).length;
      totalSize += size;
      
      cacheEntries.push({
        key,
        size,
        timestamp: value.timestamp,
        age: Date.now() - value.timestamp,
        dataType: typeof value.data
      });
    });

    return {
      entries: cacheEntries.length,
      totalSize,
      maxSize: this.options.maxCacheSize,
      ttl: this.options.cacheTimeout,
      cacheEntries,
      stats: this.getCacheStats()
    };
  }

  /**
   * Check if data is cached for a system
   * @param {string} systemId - System identifier
   * @returns {boolean} True if cached
   */
  isCached(systemId) {
    return this.cache.has(systemId);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.clearCache();
  }

  /**
   * Shutdown the service and cleanup resources
   */
  async shutdown() {
    try {
      // Clear cache cleanup interval
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
      }
      
      // Disconnect all adapters
      for (const adapter of this.adapters.values()) {
        try {
          if (adapter.isConnected) {
            await adapter.disconnect();
          }
        } catch (error) {
          logger.warn('Error disconnecting adapter during shutdown', error);
        }
      }
      
      // Clear caches
      this.cache.clear();
      this.adapters.clear();
      
      logger.info('Schema Discovery Service shutdown completed');
      this.emit('shutdown');
      
    } catch (error) {
      logger.error('Error during Schema Discovery Service shutdown', error);
      throw error;
    }
  }
}

module.exports = SchemaDiscoveryService;