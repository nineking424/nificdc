const BaseSystemAdapter = require('../base/BaseAdapter');
const { Pool } = require('pg');
const logger = require('../../../src/utils/logger');

/**
 * PostgreSQL System Adapter
 * PostgreSQL 데이터베이스 연결 및 작업을 처리하는 어댑터
 */
class PostgreSQLAdapter extends BaseSystemAdapter {
  constructor(config = {}, adapterInfo = {}) {
    // Set default adapter info for PostgreSQL
    const pgAdapterInfo = {
      name: 'postgresql-adapter',
      displayName: 'PostgreSQL Adapter',
      type: 'postgresql',
      category: 'database',
      version: '1.0.0',
      capabilities: {
        supportsSchemaDiscovery: true,
        supportsBatchOperations: true,
        supportsStreaming: true,
        supportsTransactions: true,
        supportsPartitioning: true,
        supportsChangeDataCapture: false,
        supportsIncrementalSync: true,
        supportsCustomQuery: true
      },
      supportedOperations: {
        read: true,
        write: true,
        update: true,
        delete: true,
        upsert: true,
        truncate: true,
        createSchema: true,
        dropSchema: true
      },
      configSchema: {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
          database: { type: 'string' },
          user: { type: 'string' },
          password: { type: 'string' },
          schema: { type: 'string' },
          connectionTimeoutMillis: { type: 'number' },
          idleTimeoutMillis: { type: 'number' },
          max: { type: 'number' },
          ssl: {
            type: 'object',
            properties: {
              rejectUnauthorized: { type: 'boolean' },
              ca: { type: 'string' },
              cert: { type: 'string' },
              key: { type: 'string' }
            }
          }
        },
        required: ['host', 'database', 'user']
      },
      ...adapterInfo
    };

    super(config, pgAdapterInfo);
    
    // PostgreSQL specific properties
    this.pool = null;
    this.defaultSchema = config.schema || 'public';
    this.queryTimeout = config.queryTimeout || 30000; // 30 seconds
  }

  /**
   * PostgreSQL 데이터베이스에 연결
   */
  async connect() {
    try {
      logger.info('Connecting to PostgreSQL database...');
      
      // Create connection pool
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port || 5432,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 10000,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        max: this.config.max || 10,
        ...(this.config.ssl && { ssl: this.config.ssl })
      });

      // Test connection
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT version()');
        logger.info('PostgreSQL connection established:', result.rows[0].version);
        this.isConnected = true;
        this.metrics.connectTime = Date.now();
        
        this.emit('connected', {
          version: result.rows[0].version,
          database: this.config.database
        });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }

  /**
   * PostgreSQL 연결 종료
   */
  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
        this.isConnected = false;
        logger.info('PostgreSQL connection closed');
        
        this.emit('disconnected');
      } else if (this.isConnected) {
        // If pool is already null but we're still marked as connected, update state
        this.isConnected = false;
        logger.info('PostgreSQL connection already closed');
      }
    } catch (error) {
      logger.error('Error disconnecting from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * 연결 상태 테스트
   */
  async testConnection() {
    if (!this.pool) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * PostgreSQL 버전 및 메타데이터 조회
   */
  async getSystemMetadata() {
    const client = await this.pool.connect();
    try {
      const queries = {
        version: 'SELECT version()',
        currentDatabase: 'SELECT current_database()',
        currentUser: 'SELECT current_user',
        currentSchema: 'SELECT current_schema()',
        encoding: 'SELECT pg_encoding_to_char(encoding) as encoding FROM pg_database WHERE datname = current_database()',
        timezone: 'SHOW timezone',
        maxConnections: 'SHOW max_connections'
      };

      const metadata = {};
      
      for (const [key, query] of Object.entries(queries)) {
        try {
          const result = await client.query(query);
          if (key === 'timezone' || key === 'maxConnections') {
            metadata[key] = result.rows[0][key.toLowerCase().replace('_', '')];
          } else {
            metadata[key] = result.rows[0][Object.keys(result.rows[0])[0]];
          }
        } catch (error) {
          logger.warn(`Failed to get ${key}:`, error.message);
        }
      }

      // Get database size
      try {
        const sizeResult = await client.query(`
          SELECT pg_database_size(current_database()) as size,
                 pg_size_pretty(pg_database_size(current_database())) as size_pretty
        `);
        metadata.databaseSize = sizeResult.rows[0].size;
        metadata.databaseSizePretty = sizeResult.rows[0].size_pretty;
      } catch (error) {
        logger.warn('Failed to get database size:', error.message);
      }

      // Get available extensions
      try {
        const extResult = await client.query(`
          SELECT name, installed_version 
          FROM pg_available_extensions 
          WHERE installed_version IS NOT NULL
          ORDER BY name
        `);
        metadata.installedExtensions = extResult.rows;
      } catch (error) {
        logger.warn('Failed to get extensions:', error.message);
      }

      return metadata;
    } finally {
      client.release();
    }
  }

  /**
   * 데이터베이스 스키마 탐색 (스텁 - subtask 4.2에서 구현)
   */
  async discoverSchemas(options = {}) {
    // Will be implemented in subtask 4.2
    throw new Error('discoverSchemas will be implemented in subtask 4.2');
  }

  /**
   * 데이터 읽기 (스텁 - subtask 4.3에서 구현)
   */
  async readData(schema, options = {}) {
    // Will be implemented in subtask 4.3
    throw new Error('readData will be implemented in subtask 4.3');
  }

  /**
   * 데이터 쓰기 (스텁 - subtask 4.3에서 구현)
   */
  async writeData(schema, data, options = {}) {
    // Will be implemented in subtask 4.3
    throw new Error('writeData will be implemented in subtask 4.3');
  }

  /**
   * 사용자 정의 쿼리 실행
   */
  async executeQuery(query, params = []) {
    if (!this.hasCapability('supportsCustomQuery')) {
      throw new Error('Custom query execution is not supported');
    }

    const client = await this.pool.connect();
    try {
      const startTime = Date.now();
      
      // Set query timeout
      await client.query(`SET statement_timeout = ${this.queryTimeout}`);
      
      // Execute query with parameters
      const result = await client.query(query, params);
      
      const duration = Date.now() - startTime;
      logger.debug(`Query executed in ${duration}ms`);
      
      this.emit('queryExecuted', {
        query,
        duration,
        rowCount: result.rowCount
      });

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields.map(field => ({
          name: field.name,
          dataTypeID: field.dataTypeID,
          dataTypeName: this._getDataTypeName(field.dataTypeID)
        })),
        command: result.command,
        duration
      };
    } catch (error) {
      logger.error('Query execution failed:', error);
      throw new Error(`Query execution failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * 트랜잭션 시작
   */
  async beginTransaction() {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    
    return {
      client,
      commit: async () => {
        try {
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      },
      rollback: async () => {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      }
    };
  }

  /**
   * Helper: PostgreSQL 데이터 타입 ID를 이름으로 변환
   */
  _getDataTypeName(oid) {
    // Common PostgreSQL type OIDs
    const typeMap = {
      16: 'bool',
      20: 'int8',
      21: 'int2',
      23: 'int4',
      25: 'text',
      114: 'json',
      199: 'json[]',
      700: 'float4',
      701: 'float8',
      1043: 'varchar',
      1082: 'date',
      1083: 'time',
      1114: 'timestamp',
      1184: 'timestamptz',
      1186: 'interval',
      1700: 'numeric',
      2950: 'uuid',
      3802: 'jsonb',
      3807: 'jsonb[]'
    };
    
    return typeMap[oid] || `oid:${oid}`;
  }

  /**
   * Helper: 연결 풀 상태 조회
   */
  getPoolStatus() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * 리소스 정리
   */
  async cleanup() {
    // Clean up pool first, then call super.cleanup() which will call disconnect()
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
      } catch (error) {
        logger.error('Error cleaning up PostgreSQL adapter:', error);
        // Still set pool to null even if cleanup fails
        this.pool = null;
        throw error;
      }
    }
    
    await super.cleanup();
  }
}

module.exports = PostgreSQLAdapter;