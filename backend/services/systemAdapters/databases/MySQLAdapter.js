const BaseSystemAdapter = require('../base/BaseAdapter');
const mysql = require('mysql2/promise');
const logger = require('../../../src/utils/logger');

/**
 * MySQL System Adapter
 * MySQL 데이터베이스 연결 및 작업을 처리하는 어댑터
 */
class MySQLAdapter extends BaseSystemAdapter {
  constructor(config = {}, adapterInfo = {}) {
    // Set default adapter info for MySQL
    const mysqlAdapterInfo = {
      name: 'mysql-adapter',
      displayName: 'MySQL Adapter',
      type: 'mysql',
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
          connectionLimit: { type: 'number' },
          acquireTimeout: { type: 'number' },
          timeout: { type: 'number' },
          ssl: {
            type: 'object',
            properties: {
              rejectUnauthorized: { type: 'boolean' },
              ca: { type: 'string' },
              cert: { type: 'string' },
              key: { type: 'string' }
            }
          },
          charset: { type: 'string' },
          timezone: { type: 'string' }
        },
        required: ['host', 'database', 'user']
      },
      ...adapterInfo
    };

    super(config, mysqlAdapterInfo);
    
    // MySQL specific properties
    this.pool = null;
    this.queryTimeout = config.queryTimeout || 30000; // 30 seconds
    this.charset = config.charset || 'utf8mb4';
    this.timezone = config.timezone || 'local';
  }

  /**
   * MySQL 데이터베이스에 연결
   */
  async connect() {
    try {
      logger.info('Connecting to MySQL database...');
      
      // Create connection pool
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port || 3306,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        connectionLimit: this.config.connectionLimit || 10,
        acquireTimeout: this.config.acquireTimeout || 10000,
        timeout: this.config.timeout || 60000,
        charset: this.charset,
        timezone: this.timezone,
        ...(this.config.ssl && { ssl: this.config.ssl })
      });

      // Test connection
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.query('SELECT VERSION() as version');
        logger.info('MySQL connection established:', rows[0].version);
        this.isConnected = true;
        this.metrics.connectTime = Date.now();
        
        // Emit connection event
        this.emit('connected', {
          host: this.config.host,
          database: this.config.database,
          version: rows[0].version
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('MySQL connection failed:', error);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * MySQL 데이터베이스 연결 해제
   */
  async disconnect() {
    try {
      if (this.pool) {
        logger.info('Disconnecting from MySQL database...');
        await this.pool.end();
        this.pool = null;
        this.isConnected = false;
        this.emit('disconnected');
        logger.info('MySQL connection closed');
      }
    } catch (error) {
      logger.error('Error during MySQL disconnection:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * MySQL 연결 상태 테스트
   */
  async testConnection() {
    try {
      if (!this.pool) {
        return false;
      }
      
      const connection = await this.pool.getConnection();
      try {
        await connection.ping();
        return true;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('MySQL connection test failed:', error);
      return false;
    }
  }

  /**
   * MySQL 데이터베이스 스키마 탐색
   */
  async discoverSchemas(options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Discovering MySQL schemas...');
      
      if (!this.pool) {
        throw new Error('MySQL connection not established');
      }

      const connection = await this.pool.getConnection();
      const schemas = [];
      
      try {
        // Get all databases (schemas in MySQL context)
        const [databases] = await connection.query(`
          SELECT 
            SCHEMA_NAME as name,
            DEFAULT_CHARACTER_SET_NAME as charset,
            DEFAULT_COLLATION_NAME as collation
          FROM information_schema.SCHEMATA 
          WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
          ORDER BY SCHEMA_NAME
        `);

        for (const db of databases) {
          const schema = {
            name: db.name,
            type: 'database',
            charset: db.charset,
            collation: db.collation,
            tables: [],
            views: [],
            indexes: [],
            triggers: [],
            procedures: [],
            functions: []
          };

          // Get tables for this database
          const [tables] = await connection.query(`
            SELECT 
              TABLE_NAME as name,
              TABLE_TYPE as type,
              ENGINE as engine,
              TABLE_ROWS as row_count,
              DATA_LENGTH as data_length,
              INDEX_LENGTH as index_length,
              AUTO_INCREMENT as auto_increment,
              CREATE_TIME as created_at,
              UPDATE_TIME as updated_at,
              TABLE_COMMENT as comment
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? 
            ORDER BY TABLE_NAME
          `, [db.name]);

          for (const table of tables) {
            const tableInfo = {
              name: table.name,
              type: table.type === 'BASE TABLE' ? 'table' : 'view',
              engine: table.engine,
              rowCount: table.row_count || 0,
              dataLength: table.data_length || 0,
              indexLength: table.index_length || 0,
              autoIncrement: table.auto_increment,
              createdAt: table.created_at,
              updatedAt: table.updated_at,
              comment: table.comment,
              columns: []
            };

            // Get columns for this table
            const [columns] = await connection.query(`
              SELECT 
                COLUMN_NAME as name,
                DATA_TYPE as data_type,
                COLUMN_TYPE as column_type,
                IS_NULLABLE as is_nullable,
                COLUMN_DEFAULT as default_value,
                COLUMN_KEY as key_type,
                EXTRA as extra,
                COLUMN_COMMENT as comment,
                ORDINAL_POSITION as position,
                CHARACTER_MAXIMUM_LENGTH as max_length,
                NUMERIC_PRECISION as precision,
                NUMERIC_SCALE as scale
              FROM information_schema.COLUMNS 
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
              ORDER BY ORDINAL_POSITION
            `, [db.name, table.name]);

            tableInfo.columns = columns.map(col => ({
              name: col.name,
              type: col.data_type,
              fullType: col.column_type,
              nullable: col.is_nullable === 'YES',
              defaultValue: col.default_value,
              isPrimaryKey: col.key_type === 'PRI',
              isUnique: col.key_type === 'UNI',
              isAutoIncrement: col.extra.includes('auto_increment'),
              comment: col.comment,
              position: col.position,
              maxLength: col.max_length,
              precision: col.precision,
              scale: col.scale
            }));

            if (table.type === 'BASE TABLE') {
              schema.tables.push(tableInfo);
            } else {
              schema.views.push(tableInfo);
            }
          }

          // Get indexes for this database
          const [indexes] = await connection.query(`
            SELECT 
              TABLE_NAME as table_name,
              INDEX_NAME as name,
              COLUMN_NAME as column_name,
              NON_UNIQUE as non_unique,
              INDEX_TYPE as type,
              SEQ_IN_INDEX as sequence
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = ? AND INDEX_NAME != 'PRIMARY'
            ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
          `, [db.name]);

          // Group indexes by name
          const indexGroups = {};
          indexes.forEach(idx => {
            if (!indexGroups[idx.name]) {
              indexGroups[idx.name] = {
                name: idx.name,
                tableName: idx.table_name,
                type: idx.type,
                unique: idx.non_unique === 0,
                columns: []
              };
            }
            indexGroups[idx.name].columns.push(idx.column_name);
          });

          schema.indexes = Object.values(indexGroups);

          // Get triggers for this database
          const [triggers] = await connection.query(`
            SELECT 
              TRIGGER_NAME as name,
              EVENT_MANIPULATION as event,
              EVENT_OBJECT_TABLE as table_name,
              ACTION_TIMING as timing,
              ACTION_STATEMENT as statement
            FROM information_schema.TRIGGERS 
            WHERE TRIGGER_SCHEMA = ?
            ORDER BY TRIGGER_NAME
          `, [db.name]);

          schema.triggers = triggers.map(trigger => ({
            name: trigger.name,
            event: trigger.event,
            tableName: trigger.table_name,
            timing: trigger.timing,
            statement: trigger.statement
          }));

          // Get stored procedures for this database
          const [procedures] = await connection.query(`
            SELECT 
              ROUTINE_NAME as name,
              ROUTINE_TYPE as type,
              DATA_TYPE as return_type,
              ROUTINE_DEFINITION as definition,
              CREATED as created_at,
              LAST_ALTERED as modified_at
            FROM information_schema.ROUTINES 
            WHERE ROUTINE_SCHEMA = ?
            ORDER BY ROUTINE_NAME
          `, [db.name]);

          procedures.forEach(proc => {
            const procInfo = {
              name: proc.name,
              returnType: proc.return_type,
              definition: proc.definition,
              createdAt: proc.created_at,
              modifiedAt: proc.modified_at
            };

            if (proc.type === 'PROCEDURE') {
              schema.procedures.push(procInfo);
            } else {
              schema.functions.push(procInfo);
            }
          });

          schemas.push(schema);
        }

        const result = {
          schemas,
          metadata: {
            totalSchemas: schemas.length,
            totalTables: schemas.reduce((sum, s) => sum + s.tables.length, 0),
            totalViews: schemas.reduce((sum, s) => sum + s.views.length, 0),
            totalIndexes: schemas.reduce((sum, s) => sum + s.indexes.length, 0),
            discoveryTime: Date.now() - startTime
          }
        };

        logger.info(`Discovered ${result.metadata.totalSchemas} MySQL schemas with ${result.metadata.totalTables} tables`);
        this.emit('schemasDiscovered', result);
        
        return result;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('MySQL schema discovery failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * MySQL에서 데이터 읽기
   */
  async readData(schema, options = {}) {
    const {
      limit = 1000,
      offset = 0,
      filters = {},
      sort = {},
      select = [],
      joins = [],
      groupBy = [],
      having = {}
    } = options;

    try {
      logger.debug(`Reading data from MySQL table: ${schema.name}`);

      if (!this.pool) {
        throw new Error('MySQL connection not established');
      }

      const connection = await this.pool.getConnection();
      
      try {
        // Build SELECT clause
        const selectClause = select.length > 0 ? select.join(', ') : '*';
        
        // Build FROM clause with joins
        let fromClause = mysql.escapeId(schema.name);
        if (joins.length > 0) {
          joins.forEach(join => {
            const { type = 'INNER', table, on } = join;
            fromClause += ` ${type} JOIN ${mysql.escapeId(table)} ON ${on}`;
          });
        }

        // Build WHERE clause
        const whereConditions = [];
        const params = [];
        
        Object.entries(filters).forEach(([field, value]) => {
          if (value === null || value === undefined) {
            whereConditions.push(`${mysql.escapeId(field)} IS NULL`);
          } else if (typeof value === 'object') {
            // Handle complex filters
            if (value.$eq !== undefined) {
              whereConditions.push(`${mysql.escapeId(field)} = ?`);
              params.push(value.$eq);
            } else if (value.$ne !== undefined) {
              whereConditions.push(`${mysql.escapeId(field)} != ?`);
              params.push(value.$ne);
            } else if (value.$gt !== undefined) {
              whereConditions.push(`${mysql.escapeId(field)} > ?`);
              params.push(value.$gt);
            } else if (value.$gte !== undefined) {
              whereConditions.push(`${mysql.escapeId(field)} >= ?`);
              params.push(value.$gte);
            } else if (value.$lt !== undefined) {
              whereConditions.push(`${mysql.escapeId(field)} < ?`);
              params.push(value.$lt);
            } else if (value.$lte !== undefined) {
              whereConditions.push(`${mysql.escapeId(field)} <= ?`);
              params.push(value.$lte);
            } else if (value.$like !== undefined) {
              whereConditions.push(`${mysql.escapeId(field)} LIKE ?`);
              params.push(value.$like);
            } else if (value.$in !== undefined && Array.isArray(value.$in)) {
              whereConditions.push(`${mysql.escapeId(field)} IN (${value.$in.map(() => '?').join(', ')})`);
              params.push(...value.$in);
            } else if (value.$nin !== undefined && Array.isArray(value.$nin)) {
              whereConditions.push(`${mysql.escapeId(field)} NOT IN (${value.$nin.map(() => '?').join(', ')})`);
              params.push(...value.$nin);
            } else if (value.$between !== undefined && Array.isArray(value.$between) && value.$between.length === 2) {
              whereConditions.push(`${mysql.escapeId(field)} BETWEEN ? AND ?`);
              params.push(value.$between[0], value.$between[1]);
            } else if (value.$json !== undefined) {
              // JSON field queries
              whereConditions.push(`JSON_EXTRACT(${mysql.escapeId(field)}, ?) = ?`);
              params.push(value.$json.path, value.$json.value);
            }
          } else {
            whereConditions.push(`${mysql.escapeId(field)} = ?`);
            params.push(value);
          }
        });

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Build GROUP BY clause
        const groupByClause = groupBy.length > 0 ? `GROUP BY ${groupBy.map(field => mysql.escapeId(field)).join(', ')}` : '';

        // Build HAVING clause
        const havingConditions = [];
        Object.entries(having).forEach(([field, value]) => {
          havingConditions.push(`${mysql.escapeId(field)} = ?`);
          params.push(value);
        });
        const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';

        // Build ORDER BY clause
        const orderByParts = [];
        Object.entries(sort).forEach(([field, direction]) => {
          const dir = direction === -1 || direction === 'desc' ? 'DESC' : 'ASC';
          orderByParts.push(`${mysql.escapeId(field)} ${dir}`);
        });
        const orderByClause = orderByParts.length > 0 ? `ORDER BY ${orderByParts.join(', ')}` : '';

        // Build LIMIT clause
        const limitClause = `LIMIT ${offset}, ${limit}`;

        // Construct final query
        const query = `
          SELECT ${selectClause}
          FROM ${fromClause}
          ${whereClause}
          ${groupByClause}
          ${havingClause}
          ${orderByClause}
          ${limitClause}
        `.trim();

        logger.debug('Executing MySQL query:', query);
        logger.debug('Query parameters:', params);

        const [rows] = await connection.query(query, params);

        // Get total count for pagination
        const countQuery = `
          SELECT COUNT(*) as total
          FROM ${fromClause}
          ${whereClause}
          ${groupByClause}
          ${havingClause}
        `.trim();

        const [countResult] = await connection.query(countQuery, params);
        const total = countResult[0].total;

        const result = {
          data: rows,
          metadata: {
            total,
            count: rows.length,
            offset,
            limit,
            hasMore: offset + rows.length < total,
            schema: schema.name
          }
        };

        logger.debug(`Read ${rows.length} rows from MySQL table ${schema.name}`);
        this.emit('dataRead', result);
        
        return result;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('MySQL data read failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * MySQL에 데이터 쓰기
   */
  async writeData(schema, data, options = {}) {
    const {
      mode = 'insert', // insert, update, upsert, replace
      batchSize = 1000,
      transaction = false,
      onDuplicateUpdate = false,
      updateFields = [],
      whereConditions = {}
    } = options;

    try {
      logger.debug(`Writing ${data.length} rows to MySQL table: ${schema.name}`);

      if (!this.pool) {
        throw new Error('MySQL connection not established');
      }

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data must be a non-empty array');
      }

      const connection = await this.pool.getConnection();
      let totalProcessed = 0;

      try {
        if (transaction) {
          await connection.beginTransaction();
        }

        const result = await this.processBatch(data, async (batch, batchNumber) => {
          const batchStartTime = Date.now();
          let batchResult = {};

          if (mode === 'insert') {
            batchResult = await this._performInsert(connection, schema, batch, onDuplicateUpdate, updateFields);
          } else if (mode === 'update') {
            batchResult = await this._performUpdate(connection, schema, batch, whereConditions);
          } else if (mode === 'upsert') {
            batchResult = await this._performUpsert(connection, schema, batch, updateFields);
          } else if (mode === 'replace') {
            batchResult = await this._performReplace(connection, schema, batch);
          } else {
            throw new Error(`Unsupported write mode: ${mode}`);
          }

          totalProcessed += batch.length;

          this.emit('batchProcessed', {
            batch: batchNumber,
            processed: batch.length,
            total: data.length,
            mode,
            duration: Date.now() - batchStartTime
          });

          return batchResult;
        }, batchSize);

        if (transaction) {
          await connection.commit();
        }

        const finalResult = {
          processed: totalProcessed,
          mode,
          schema: schema.name,
          batches: result.length,
          details: result
        };

        logger.info(`Successfully wrote ${totalProcessed} rows to MySQL table ${schema.name}`);
        this.emit('dataWritten', finalResult);
        
        return finalResult;
      } catch (error) {
        if (transaction) {
          await connection.rollback();
        }
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('MySQL data write failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 삽입 작업 수행
   */
  async _performInsert(connection, schema, data, onDuplicateUpdate = false, updateFields = []) {
    if (data.length === 0) return { inserted: 0 };

    const fields = Object.keys(data[0]);
    const placeholders = fields.map(() => '?').join(', ');
    const values = data.map(row => fields.map(field => row[field]));
    const flatValues = values.flat();

    let query = `INSERT INTO ${mysql.escapeId(schema.name)} (${fields.map(f => mysql.escapeId(f)).join(', ')}) VALUES `;
    query += data.map(() => `(${placeholders})`).join(', ');

    if (onDuplicateUpdate) {
      const updateClause = updateFields.length > 0 
        ? updateFields.map(field => `${mysql.escapeId(field)} = VALUES(${mysql.escapeId(field)})`).join(', ')
        : fields.map(field => `${mysql.escapeId(field)} = VALUES(${mysql.escapeId(field)})`).join(', ');
      query += ` ON DUPLICATE KEY UPDATE ${updateClause}`;
    }

    const [result] = await connection.query(query, flatValues);
    return { inserted: result.affectedRows, insertId: result.insertId };
  }

  /**
   * 업데이트 작업 수행
   */
  async _performUpdate(connection, schema, data, whereConditions = {}) {
    let totalUpdated = 0;

    for (const row of data) {
      const setFields = Object.keys(row);
      const setClause = setFields.map(field => `${mysql.escapeId(field)} = ?`).join(', ');
      const setValues = setFields.map(field => row[field]);

      const whereClause = [];
      const whereValues = [];
      
      Object.entries(whereConditions).forEach(([field, value]) => {
        whereClause.push(`${mysql.escapeId(field)} = ?`);
        whereValues.push(value);
      });

      if (whereClause.length === 0) {
        throw new Error('Update operation requires WHERE conditions');
      }

      const query = `UPDATE ${mysql.escapeId(schema.name)} SET ${setClause} WHERE ${whereClause.join(' AND ')}`;
      const [result] = await connection.query(query, [...setValues, ...whereValues]);
      totalUpdated += result.affectedRows;
    }

    return { updated: totalUpdated };
  }

  /**
   * Upsert 작업 수행 (INSERT ... ON DUPLICATE KEY UPDATE)
   */
  async _performUpsert(connection, schema, data, updateFields = []) {
    return this._performInsert(connection, schema, data, true, updateFields);
  }

  /**
   * Replace 작업 수행
   */
  async _performReplace(connection, schema, data) {
    if (data.length === 0) return { replaced: 0 };

    const fields = Object.keys(data[0]);
    const placeholders = fields.map(() => '?').join(', ');
    const values = data.map(row => fields.map(field => row[field]));
    const flatValues = values.flat();

    let query = `REPLACE INTO ${mysql.escapeId(schema.name)} (${fields.map(f => mysql.escapeId(f)).join(', ')}) VALUES `;
    query += data.map(() => `(${placeholders})`).join(', ');

    const [result] = await connection.query(query, flatValues);
    return { replaced: result.affectedRows };
  }

  /**
   * 커스텀 쿼리 실행
   */
  async executeQuery(query, params = []) {
    try {
      logger.debug('Executing MySQL custom query:', query);

      if (!this.pool) {
        throw new Error('MySQL connection not established');
      }

      const connection = await this.pool.getConnection();
      
      try {
        const [rows, fields] = await connection.query(query, params);
        
        const result = {
          rows: rows,
          fields: fields,
          rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows,
          metadata: {
            query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
            executionTime: Date.now()
          }
        };

        logger.debug(`MySQL query executed successfully, returned ${result.rowCount} rows`);
        this.emit('queryExecuted', result);
        
        return result;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('MySQL query execution failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 시스템 메타데이터 조회
   */
  async getSystemMetadata() {
    try {
      logger.debug('Getting MySQL system metadata');

      if (!this.pool) {
        throw new Error('MySQL connection not established');
      }

      const connection = await this.pool.getConnection();
      
      try {
        // Get server version and configuration
        const [versionResult] = await connection.query('SELECT VERSION() as version');
        const [variables] = await connection.query(`
          SHOW VARIABLES WHERE Variable_name IN (
            'version', 'version_comment', 'version_compile_machine', 'version_compile_os',
            'character_set_server', 'collation_server', 'default_storage_engine',
            'innodb_version', 'max_connections', 'max_allowed_packet', 'sql_mode'
          )
        `);

        // Get database sizes
        const [dbSizes] = await connection.query(`
          SELECT 
            table_schema as database_name,
            ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
          GROUP BY table_schema
        `);

        // Get connection pool status
        const poolStatus = {
          connectionLimit: this.pool.config.connectionLimit,
          acquireTimeout: this.pool.config.acquireTimeout,
          timeout: this.pool.config.timeout
        };

        const metadata = {
          version: versionResult[0].version,
          serverVariables: variables.reduce((acc, row) => {
            acc[row.Variable_name] = row.Value;
            return acc;
          }, {}),
          databases: dbSizes.map(db => ({
            name: db.database_name,
            sizeMB: db.size_mb
          })),
          connectionPool: poolStatus,
          capabilities: this.getCapabilities(),
          supportedOperations: this.getSupportedOperations(),
          adapterInfo: this.adapterInfo
        };

        logger.debug('MySQL system metadata retrieved successfully');
        this.emit('metadataRetrieved', metadata);
        
        return metadata;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('MySQL system metadata retrieval failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 리소스 정리
   */
  async cleanup() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      await super.cleanup();
    } catch (error) {
      logger.error('MySQL cleanup failed:', error);
      throw error;
    }
  }
}

module.exports = MySQLAdapter;