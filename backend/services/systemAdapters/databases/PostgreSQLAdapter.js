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
   * 데이터베이스 스키마 탐색
   */
  async discoverSchemas(options = {}) {
    if (!this.hasCapability('supportsSchemaDiscovery')) {
      throw new Error('Schema discovery is not supported');
    }

    const {
      schemaName = null,
      includeViews = true,
      includeFunctions = false,
      includeSequences = false,
      includeIndexes = false,
      includeConstraints = false,
      tablePattern = null,
      limit = 1000
    } = options;

    const client = await this.pool.connect();
    try {
      const schemas = {};
      
      // Get all schemas or filter by specific schema
      const schemaFilter = schemaName ? 
        `AND n.nspname = $1` : 
        `AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')`;
      
      const schemaParams = schemaName ? [schemaName] : [];
      
      // Discover tables
      const tablesResult = await client.query(`
        SELECT 
          n.nspname as schema_name,
          c.relname as table_name,
          c.relkind as table_type,
          obj_description(c.oid) as table_comment,
          c.reltuples::bigint as estimated_rows,
          pg_size_pretty(pg_total_relation_size(c.oid)) as table_size,
          pg_total_relation_size(c.oid) as table_size_bytes,
          u.usename as owner
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_user u ON u.usesysid = c.relowner
        WHERE c.relkind IN ('r', 'p') ${schemaFilter}
        ${tablePattern ? `AND c.relname LIKE $${schemaParams.length + 1}` : ''}
        ORDER BY n.nspname, c.relname
        LIMIT $${schemaParams.length + (tablePattern ? 2 : 1)}
      `, [...schemaParams, ...(tablePattern ? [tablePattern] : []), limit]);

      // Discover views if requested
      let viewsResult = { rows: [] };
      if (includeViews) {
        viewsResult = await client.query(`
          SELECT 
            n.nspname as schema_name,
            c.relname as view_name,
            obj_description(c.oid) as view_comment,
            u.usename as owner,
            pg_get_viewdef(c.oid) as view_definition
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_user u ON u.usesysid = c.relowner
          WHERE c.relkind IN ('v', 'm') ${schemaFilter}
          ${tablePattern ? `AND c.relname LIKE $${schemaParams.length + 1}` : ''}
          ORDER BY n.nspname, c.relname
          LIMIT $${schemaParams.length + (tablePattern ? 2 : 1)}
        `, [...schemaParams, ...(tablePattern ? [tablePattern] : []), limit]);
      }

      // Process tables and views
      for (const row of [...tablesResult.rows, ...viewsResult.rows]) {
        const schemaName = row.schema_name;
        const tableName = row.table_name || row.view_name;
        const isView = !!row.view_name;
        
        if (!schemas[schemaName]) {
          schemas[schemaName] = {
            name: schemaName,
            type: 'schema',
            tables: [],
            views: [],
            functions: [],
            sequences: [],
            metadata: {}
          };
        }

        // Get column information
        const columnsResult = await client.query(`
          SELECT 
            a.attname as column_name,
            a.attnum as ordinal_position,
            pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
            a.attnotnull as is_not_null,
            a.atthasdef as has_default,
            pg_get_expr(ad.adbin, ad.adrelid) as default_value,
            col_description(a.attrelid, a.attnum) as column_comment,
            a.atttypmod as type_modifier,
            t.typname as base_type,
            t.typtype as type_category,
            CASE 
              WHEN a.attlen = -1 THEN null
              ELSE a.attlen
            END as max_length,
            CASE 
              WHEN t.typname = 'numeric' THEN 
                CASE 
                  WHEN a.atttypmod = -1 THEN null
                  ELSE ((a.atttypmod - 4) >> 16) & 65535
                END
              ELSE null
            END as numeric_precision,
            CASE 
              WHEN t.typname = 'numeric' THEN 
                CASE 
                  WHEN a.atttypmod = -1 THEN null
                  ELSE (a.atttypmod - 4) & 65535
                END
              ELSE null
            END as numeric_scale
          FROM pg_attribute a
          JOIN pg_type t ON a.atttypid = t.oid
          LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
          WHERE a.attrelid = (
            SELECT c.oid 
            FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = $1 AND c.relname = $2
          )
          AND a.attnum > 0 
          AND NOT a.attisdropped
          ORDER BY a.attnum
        `, [schemaName, tableName]);

        // Get primary key information
        const pkResult = await client.query(`
          SELECT 
            a.attname as column_name,
            i.indisprimary as is_primary
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = (
            SELECT c.oid 
            FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = $1 AND c.relname = $2
          )
          AND i.indisprimary = true
          ORDER BY a.attnum
        `, [schemaName, tableName]);

        // Get foreign key information
        const fkResult = await client.query(`
          SELECT 
            a.attname as column_name,
            cl.relname as foreign_table,
            ns.nspname as foreign_schema,
            af.attname as foreign_column,
            con.conname as constraint_name,
            con.confdeltype as on_delete,
            con.confupdtype as on_update
          FROM pg_constraint con
          JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
          JOIN pg_class cl ON cl.oid = con.confrelid
          JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
          WHERE con.conrelid = (
            SELECT c.oid 
            FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = $1 AND c.relname = $2
          )
          AND con.contype = 'f'
          ORDER BY a.attnum
        `, [schemaName, tableName]);

        // Get index information if requested
        let indexResult = { rows: [] };
        if (includeIndexes) {
          indexResult = await client.query(`
            SELECT 
              i.relname as index_name,
              a.attname as column_name,
              ix.indisunique as is_unique,
              ix.indisprimary as is_primary,
              am.amname as index_type,
              pg_get_indexdef(ix.indexrelid) as index_definition
            FROM pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
            JOIN pg_am am ON am.oid = i.relam
            WHERE n.nspname = $1 AND t.relname = $2
            AND NOT ix.indisprimary
            ORDER BY i.relname, a.attnum
          `, [schemaName, tableName]);
        }

        // Build primary key list
        const primaryKeys = pkResult.rows.map(row => row.column_name);
        
        // Build foreign key map
        const foreignKeys = {};
        fkResult.rows.forEach(row => {
          if (!foreignKeys[row.column_name]) {
            foreignKeys[row.column_name] = [];
          }
          foreignKeys[row.column_name].push({
            constraintName: row.constraint_name,
            referencedSchema: row.foreign_schema,
            referencedTable: row.foreign_table,
            referencedColumn: row.foreign_column,
            onDelete: row.on_delete,
            onUpdate: row.on_update
          });
        });

        // Build index map
        const indexes = {};
        indexResult.rows.forEach(row => {
          if (!indexes[row.index_name]) {
            indexes[row.index_name] = {
              name: row.index_name,
              type: row.index_type,
              isUnique: row.is_unique,
              columns: [],
              definition: row.index_definition
            };
          }
          indexes[row.index_name].columns.push(row.column_name);
        });

        // Build columns array
        const columns = columnsResult.rows.map(col => ({
          name: col.column_name,
          ordinalPosition: col.ordinal_position,
          dataType: col.data_type,
          baseType: col.base_type,
          typeCategory: col.type_category,
          maxLength: col.max_length,
          numericPrecision: col.numeric_precision,
          numericScale: col.numeric_scale,
          isNullable: !col.is_not_null,
          hasDefault: col.has_default,
          defaultValue: col.default_value,
          comment: col.column_comment,
          isPrimaryKey: primaryKeys.includes(col.column_name),
          foreignKeys: foreignKeys[col.column_name] || [],
          // Map to universal type
          universalType: this._mapPostgreSQLTypeToUniversal(col.base_type),
          originalType: col.data_type
        }));

        const tableInfo = {
          name: tableName,
          type: isView ? 'view' : (row.table_type === 'p' ? 'partitioned_table' : 'table'),
          schema: schemaName,
          columns,
          primaryKeys,
          foreignKeys: Object.values(foreignKeys).flat(),
          indexes: Object.values(indexes),
          comment: row.table_comment || row.view_comment,
          owner: row.owner,
          metadata: {
            estimatedRows: row.estimated_rows,
            tableSize: row.table_size,
            tableSizeBytes: row.table_size_bytes,
            ...(isView && { viewDefinition: row.view_definition })
          }
        };

        if (isView) {
          schemas[schemaName].views.push(tableInfo);
        } else {
          schemas[schemaName].tables.push(tableInfo);
        }
      }

      // Get functions if requested
      if (includeFunctions) {
        const functionsResult = await client.query(`
          SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_result(p.oid) as return_type,
            pg_get_function_arguments(p.oid) as arguments,
            obj_description(p.oid) as comment,
            l.lanname as language,
            CASE p.provolatile
              WHEN 'i' THEN 'IMMUTABLE'
              WHEN 's' THEN 'STABLE'
              WHEN 'v' THEN 'VOLATILE'
            END as volatility
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          LEFT JOIN pg_language l ON l.oid = p.prolang
          WHERE n.nspname = ANY($1)
          AND p.prokind = 'f'
          ORDER BY n.nspname, p.proname
          LIMIT $2
        `, [Object.keys(schemas), limit]);

        functionsResult.rows.forEach(row => {
          if (schemas[row.schema_name]) {
            schemas[row.schema_name].functions.push({
              name: row.function_name,
              type: 'function',
              returnType: row.return_type,
              arguments: row.arguments,
              language: row.language,
              volatility: row.volatility,
              comment: row.comment
            });
          }
        });
      }

      // Get sequences if requested
      if (includeSequences) {
        const sequencesResult = await client.query(`
          SELECT 
            n.nspname as schema_name,
            c.relname as sequence_name,
            obj_description(c.oid) as comment,
            u.usename as owner
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_user u ON u.usesysid = c.relowner
          WHERE c.relkind = 'S'
          AND n.nspname = ANY($1)
          ORDER BY n.nspname, c.relname
          LIMIT $2
        `, [Object.keys(schemas), limit]);

        sequencesResult.rows.forEach(row => {
          if (schemas[row.schema_name]) {
            schemas[row.schema_name].sequences.push({
              name: row.sequence_name,
              type: 'sequence',
              comment: row.comment,
              owner: row.owner
            });
          }
        });
      }

      // Add schema-level metadata
      const schemaMetadataResult = await client.query(`
        SELECT 
          n.nspname as schema_name,
          u.usename as owner,
          obj_description(n.oid) as comment
        FROM pg_namespace n
        LEFT JOIN pg_user u ON u.usesysid = n.nspowner
        WHERE n.nspname = ANY($1)
        ORDER BY n.nspname
      `, [Object.keys(schemas)]);

      schemaMetadataResult.rows.forEach(row => {
        if (schemas[row.schema_name]) {
          schemas[row.schema_name].metadata = {
            owner: row.owner,
            comment: row.comment,
            tableCount: schemas[row.schema_name].tables.length,
            viewCount: schemas[row.schema_name].views.length,
            functionCount: schemas[row.schema_name].functions.length,
            sequenceCount: schemas[row.schema_name].sequences.length
          };
        }
      });

      return Object.values(schemas);
    } finally {
      client.release();
    }
  }

  /**
   * 데이터 읽기
   */
  async readData(schema, options = {}) {
    if (!this.supportsOperation('read')) {
      throw new Error('Read operation is not supported');
    }

    const {
      limit = 1000,
      offset = 0,
      orderBy = null,
      orderDirection = 'ASC',
      filters = {},
      columns = null,
      distinctOn = null,
      groupBy = null,
      having = null,
      join = null
    } = options;

    const client = await this.pool.connect();
    try {
      // Build SELECT clause
      let selectClause = '*';
      if (columns && Array.isArray(columns)) {
        selectClause = columns.map(col => `"${col}"`).join(', ');
      }

      // Handle DISTINCT ON
      if (distinctOn) {
        if (Array.isArray(distinctOn)) {
          selectClause = `DISTINCT ON (${distinctOn.map(col => `"${col}"`).join(', ')}) ${selectClause}`;
        } else {
          selectClause = `DISTINCT ON ("${distinctOn}") ${selectClause}`;
        }
      }

      // Build FROM clause
      let fromClause = `"${schema.schema}"."${schema.name}"`;
      
      // Handle JOINs
      if (join && Array.isArray(join)) {
        join.forEach(joinSpec => {
          const { type = 'INNER', table, on, schema: joinSchema } = joinSpec;
          const joinTable = joinSchema ? `"${joinSchema}"."${table}"` : `"${table}"`;
          fromClause += ` ${type.toUpperCase()} JOIN ${joinTable} ON ${on}`;
        });
      }

      // Build WHERE clause
      let whereClause = '';
      const queryParams = [];
      let paramIndex = 1;

      if (filters && Object.keys(filters).length > 0) {
        const conditions = [];
        
        for (const [column, condition] of Object.entries(filters)) {
          if (condition === null || condition === undefined) {
            conditions.push(`"${column}" IS NULL`);
          } else if (typeof condition === 'object' && condition !== null) {
            // Handle complex conditions
            if (condition.eq !== undefined) {
              conditions.push(`"${column}" = $${paramIndex}`);
              queryParams.push(condition.eq);
              paramIndex++;
            } else if (condition.ne !== undefined) {
              conditions.push(`"${column}" != $${paramIndex}`);
              queryParams.push(condition.ne);
              paramIndex++;
            } else if (condition.gt !== undefined) {
              conditions.push(`"${column}" > $${paramIndex}`);
              queryParams.push(condition.gt);
              paramIndex++;
            } else if (condition.gte !== undefined) {
              conditions.push(`"${column}" >= $${paramIndex}`);
              queryParams.push(condition.gte);
              paramIndex++;
            } else if (condition.lt !== undefined) {
              conditions.push(`"${column}" < $${paramIndex}`);
              queryParams.push(condition.lt);
              paramIndex++;
            } else if (condition.lte !== undefined) {
              conditions.push(`"${column}" <= $${paramIndex}`);
              queryParams.push(condition.lte);
              paramIndex++;
            } else if (condition.like !== undefined) {
              conditions.push(`"${column}" LIKE $${paramIndex}`);
              queryParams.push(condition.like);
              paramIndex++;
            } else if (condition.ilike !== undefined) {
              conditions.push(`"${column}" ILIKE $${paramIndex}`);
              queryParams.push(condition.ilike);
              paramIndex++;
            } else if (condition.in !== undefined && Array.isArray(condition.in)) {
              const placeholders = condition.in.map(() => `$${paramIndex++}`).join(', ');
              conditions.push(`"${column}" IN (${placeholders})`);
              queryParams.push(...condition.in);
            } else if (condition.between !== undefined && Array.isArray(condition.between) && condition.between.length === 2) {
              conditions.push(`"${column}" BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
              queryParams.push(condition.between[0], condition.between[1]);
              paramIndex += 2;
            } else if (condition.regex !== undefined) {
              conditions.push(`"${column}" ~ $${paramIndex}`);
              queryParams.push(condition.regex);
              paramIndex++;
            } else if (condition.jsonContains !== undefined) {
              conditions.push(`"${column}" @> $${paramIndex}`);
              queryParams.push(JSON.stringify(condition.jsonContains));
              paramIndex++;
            } else if (condition.jsonPath !== undefined) {
              conditions.push(`"${column}" #> $${paramIndex} IS NOT NULL`);
              queryParams.push(`{${condition.jsonPath}}`);
              paramIndex++;
            }
          } else {
            // Simple equality
            conditions.push(`"${column}" = $${paramIndex}`);
            queryParams.push(condition);
            paramIndex++;
          }
        }
        
        if (conditions.length > 0) {
          whereClause = `WHERE ${conditions.join(' AND ')}`;
        }
      }

      // Build GROUP BY clause
      let groupByClause = '';
      if (groupBy) {
        if (Array.isArray(groupBy)) {
          groupByClause = `GROUP BY ${groupBy.map(col => `"${col}"`).join(', ')}`;
        } else {
          groupByClause = `GROUP BY "${groupBy}"`;
        }
      }

      // Build HAVING clause
      let havingClause = '';
      if (having) {
        havingClause = `HAVING ${having}`;
      }

      // Build ORDER BY clause
      let orderByClause = '';
      if (orderBy) {
        if (Array.isArray(orderBy)) {
          orderByClause = `ORDER BY ${orderBy.map(col => `"${col}" ${orderDirection}`).join(', ')}`;
        } else {
          orderByClause = `ORDER BY "${orderBy}" ${orderDirection}`;
        }
      }

      // Build LIMIT and OFFSET
      let limitClause = '';
      if (limit > 0) {
        limitClause = `LIMIT $${paramIndex}`;
        queryParams.push(limit);
        paramIndex++;
      }

      let offsetClause = '';
      if (offset > 0) {
        offsetClause = `OFFSET $${paramIndex}`;
        queryParams.push(offset);
        paramIndex++;
      }

      // Construct final query
      const query = [
        `SELECT ${selectClause}`,
        `FROM ${fromClause}`,
        whereClause,
        groupByClause,
        havingClause,
        orderByClause,
        limitClause,
        offsetClause
      ].filter(clause => clause).join(' ');

      // Execute query with performance tracking
      const result = await this.measurePerformance('readData', async () => {
        const startTime = Date.now();
        const queryResult = await client.query(query, queryParams);
        const duration = Date.now() - startTime;

        this.emit('dataRead', {
          schema: schema.name,
          rowCount: queryResult.rowCount,
          duration,
          query: query.substring(0, 200) + (query.length > 200 ? '...' : '')
        });

        return queryResult;
      });

      // Get total count if requested
      let totalCount = null;
      if (options.includeTotalCount) {
        const countQuery = `SELECT COUNT(*) as total FROM ${fromClause} ${whereClause}`;
        const countResult = await client.query(countQuery, queryParams.slice(0, -2)); // Remove limit/offset params
        totalCount = parseInt(countResult.rows[0].total);
      }

      return {
        data: result.rows,
        rowCount: result.rowCount,
        totalCount,
        metadata: {
          schema: schema.name,
          table: schema.name,
          columns: result.fields.map(field => ({
            name: field.name,
            dataTypeID: field.dataTypeID,
            dataTypeName: this._getDataTypeName(field.dataTypeID)
          })),
          query: {
            sql: query,
            parameters: queryParams,
            executionTime: Date.now() - performance.now()
          },
          pagination: {
            limit,
            offset,
            hasMore: result.rowCount === limit
          }
        }
      };
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to read data: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * 데이터 쓰기
   */
  async writeData(schema, data, options = {}) {
    if (!this.supportsOperation('write')) {
      throw new Error('Write operation is not supported');
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array');
    }

    const {
      mode = 'insert', // insert, update, upsert, replace
      batchSize = 1000,
      conflictColumns = null, // for upsert
      updateColumns = null, // for upsert/update
      whereConditions = null, // for update
      returning = null, // columns to return
      onConflict = 'error', // error, ignore, update
      validateSchema = true,
      transaction = true
    } = options;

    // Validate schema if requested
    if (validateSchema && schema.columns) {
      const schemaColumns = schema.columns.map(col => col.name.toLowerCase());
      const dataColumns = Object.keys(data[0]).map(col => col.toLowerCase());
      const missingColumns = dataColumns.filter(col => !schemaColumns.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Unknown columns in data: ${missingColumns.join(', ')}`);
      }
    }

    let client;
    let shouldCommit = false;
    
    try {
      client = await this.pool.connect();
      
      // Start transaction if requested
      if (transaction) {
        await client.query('BEGIN');
        shouldCommit = true;
      }

      const results = [];
      
      // Process data in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchResult = await this._processBatch(client, schema, batch, {
          mode,
          conflictColumns,
          updateColumns,
          whereConditions,
          returning,
          onConflict
        });
        
        results.push(...batchResult);
        
        this.emit('batchProgress', {
          current: Math.floor(i / batchSize) + 1,
          total: Math.ceil(data.length / batchSize),
          processed: Math.min(i + batchSize, data.length),
          totalItems: data.length
        });
      }

      // Commit transaction if we started one
      if (shouldCommit) {
        await client.query('COMMIT');
        shouldCommit = false;
      }

      this.emit('dataWritten', {
        schema: schema.name,
        rowCount: results.length,
        mode,
        batchCount: Math.ceil(data.length / batchSize)
      });

      return {
        written: results.length,
        data: returning ? results : null,
        metadata: {
          schema: schema.name,
          table: schema.name,
          mode,
          batchSize,
          batchCount: Math.ceil(data.length / batchSize),
          totalProcessed: data.length
        }
      };
    } catch (error) {
      // Rollback transaction if we started one
      if (shouldCommit && client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          this.emit('error', rollbackError);
        }
      }
      
      this.emit('error', error);
      throw new Error(`Failed to write data: ${error.message}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Process a batch of data for writing
   */
  async _processBatch(client, schema, batch, options) {
    const { mode, conflictColumns, updateColumns, whereConditions, returning, onConflict } = options;
    
    if (batch.length === 0) {
      return [];
    }

    const tableName = `"${schema.schema}"."${schema.name}"`;
    const columns = Object.keys(batch[0]);
    const quotedColumns = columns.map(col => `"${col}"`);
    
    let query = '';
    let queryParams = [];
    let paramIndex = 1;
    
    switch (mode) {
      case 'insert':
        query = this._buildInsertQuery(tableName, quotedColumns, batch, returning, onConflict);
        queryParams = this._buildInsertParams(batch);
        break;
        
      case 'update':
        if (!whereConditions) {
          throw new Error('WHERE conditions are required for update mode');
        }
        query = this._buildUpdateQuery(tableName, quotedColumns, batch[0], whereConditions, returning);
        queryParams = this._buildUpdateParams(batch, whereConditions);
        break;
        
      case 'upsert':
        if (!conflictColumns) {
          throw new Error('Conflict columns are required for upsert mode');
        }
        query = this._buildUpsertQuery(tableName, quotedColumns, batch, conflictColumns, updateColumns, returning);
        queryParams = this._buildInsertParams(batch);
        break;
        
      case 'replace':
        // Delete existing and insert new
        const deleteQuery = this._buildDeleteQuery(tableName, batch, conflictColumns);
        const deleteParams = this._buildDeleteParams(batch, conflictColumns);
        await client.query(deleteQuery, deleteParams);
        
        query = this._buildInsertQuery(tableName, quotedColumns, batch, returning, 'error');
        queryParams = this._buildInsertParams(batch);
        break;
        
      default:
        throw new Error(`Unsupported write mode: ${mode}`);
    }

    const result = await client.query(query, queryParams);
    return result.rows || [];
  }

  /**
   * Build INSERT query
   */
  _buildInsertQuery(tableName, columns, batch, returning, onConflict) {
    const valuesClause = batch.map((_, index) => {
      const rowParams = columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`);
      return `(${rowParams.join(', ')})`;
    }).join(', ');

    let query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valuesClause}`;
    
    if (onConflict === 'ignore') {
      query += ' ON CONFLICT DO NOTHING';
    }
    
    if (returning && Array.isArray(returning)) {
      query += ` RETURNING ${returning.map(col => `"${col}"`).join(', ')}`;
    } else if (returning === true) {
      query += ' RETURNING *';
    }
    
    return query;
  }

  /**
   * Build UPDATE query
   */
  _buildUpdateQuery(tableName, columns, sampleRow, whereConditions, returning) {
    const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    const whereClause = this._buildWhereClause(whereConditions, columns.length + 1);
    
    let query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
    
    if (returning && Array.isArray(returning)) {
      query += ` RETURNING ${returning.map(col => `"${col}"`).join(', ')}`;
    } else if (returning === true) {
      query += ' RETURNING *';
    }
    
    return query;
  }

  /**
   * Build UPSERT query (INSERT ... ON CONFLICT ... DO UPDATE)
   */
  _buildUpsertQuery(tableName, columns, batch, conflictColumns, updateColumns, returning) {
    const valuesClause = batch.map((_, index) => {
      const rowParams = columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`);
      return `(${rowParams.join(', ')})`;
    }).join(', ');

    const conflictClause = conflictColumns.map(col => `"${col}"`).join(', ');
    const updateClause = (updateColumns || columns.filter(col => !conflictColumns.includes(col.replace(/"/g, ''))))
      .map(col => `${col} = EXCLUDED.${col}`).join(', ');

    let query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valuesClause} ` +
                `ON CONFLICT (${conflictClause}) DO UPDATE SET ${updateClause}`;
    
    if (returning && Array.isArray(returning)) {
      query += ` RETURNING ${returning.map(col => `"${col}"`).join(', ')}`;
    } else if (returning === true) {
      query += ' RETURNING *';
    }
    
    return query;
  }

  /**
   * Build DELETE query for replace mode
   */
  _buildDeleteQuery(tableName, batch, conflictColumns) {
    if (!conflictColumns || conflictColumns.length === 0) {
      throw new Error('Conflict columns are required for replace mode');
    }

    const whereConditions = batch.map((row, index) => {
      const conditions = conflictColumns.map((col, colIndex) => {
        const paramIndex = index * conflictColumns.length + colIndex + 1;
        return `"${col}" = $${paramIndex}`;
      });
      return `(${conditions.join(' AND ')})`;
    }).join(' OR ');

    return `DELETE FROM ${tableName} WHERE ${whereConditions}`;
  }

  /**
   * Build WHERE clause for queries
   */
  _buildWhereClause(whereConditions, startParamIndex) {
    if (typeof whereConditions === 'string') {
      return whereConditions;
    }
    
    if (typeof whereConditions === 'object') {
      const conditions = [];
      let paramIndex = startParamIndex;
      
      for (const [column, value] of Object.entries(whereConditions)) {
        conditions.push(`"${column}" = $${paramIndex}`);
        paramIndex++;
      }
      
      return conditions.join(' AND ');
    }
    
    throw new Error('Invalid WHERE conditions format');
  }

  /**
   * Build parameters for INSERT queries
   */
  _buildInsertParams(batch) {
    const params = [];
    const columns = Object.keys(batch[0]);
    
    for (const row of batch) {
      for (const column of columns) {
        params.push(row[column]);
      }
    }
    
    return params;
  }

  /**
   * Build parameters for UPDATE queries
   */
  _buildUpdateParams(batch, whereConditions) {
    const params = [];
    const columns = Object.keys(batch[0]);
    
    // Add SET clause parameters
    for (const row of batch) {
      for (const column of columns) {
        params.push(row[column]);
      }
    }
    
    // Add WHERE clause parameters
    if (typeof whereConditions === 'object') {
      for (const value of Object.values(whereConditions)) {
        params.push(value);
      }
    }
    
    return params;
  }

  /**
   * Build parameters for DELETE queries (replace mode)
   */
  _buildDeleteParams(batch, conflictColumns) {
    const params = [];
    
    for (const row of batch) {
      for (const column of conflictColumns) {
        params.push(row[column]);
      }
    }
    
    return params;
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
   * Helper: PostgreSQL 데이터 타입을 Universal 타입으로 매핑
   */
  _mapPostgreSQLTypeToUniversal(pgType) {
    // Import universal types
    const { UNIVERSAL_TYPES } = require('../../../constants/schemaTypes');
    
    const typeMap = {
      // String types
      'text': UNIVERSAL_TYPES.STRING,
      'varchar': UNIVERSAL_TYPES.STRING,
      'char': UNIVERSAL_TYPES.STRING,
      'bpchar': UNIVERSAL_TYPES.STRING,
      'name': UNIVERSAL_TYPES.STRING,
      'uuid': UNIVERSAL_TYPES.STRING,
      
      // Integer types
      'int2': UNIVERSAL_TYPES.INTEGER,
      'int4': UNIVERSAL_TYPES.INTEGER,
      'int8': UNIVERSAL_TYPES.LONG,
      'smallint': UNIVERSAL_TYPES.INTEGER,
      'integer': UNIVERSAL_TYPES.INTEGER,
      'bigint': UNIVERSAL_TYPES.LONG,
      'serial': UNIVERSAL_TYPES.INTEGER,
      'bigserial': UNIVERSAL_TYPES.LONG,
      
      // Floating point types
      'float4': UNIVERSAL_TYPES.FLOAT,
      'float8': UNIVERSAL_TYPES.DOUBLE,
      'real': UNIVERSAL_TYPES.FLOAT,
      'double': UNIVERSAL_TYPES.DOUBLE,
      'numeric': UNIVERSAL_TYPES.DECIMAL,
      'decimal': UNIVERSAL_TYPES.DECIMAL,
      'money': UNIVERSAL_TYPES.DECIMAL,
      
      // Boolean type
      'bool': UNIVERSAL_TYPES.BOOLEAN,
      'boolean': UNIVERSAL_TYPES.BOOLEAN,
      
      // Date/Time types
      'date': UNIVERSAL_TYPES.DATE,
      'time': UNIVERSAL_TYPES.TIME,
      'timetz': UNIVERSAL_TYPES.TIME,
      'timestamp': UNIVERSAL_TYPES.DATETIME,
      'timestamptz': UNIVERSAL_TYPES.TIMESTAMP,
      'interval': UNIVERSAL_TYPES.STRING, // No direct universal equivalent
      
      // Binary types
      'bytea': UNIVERSAL_TYPES.BINARY,
      
      // JSON types
      'json': UNIVERSAL_TYPES.JSON,
      'jsonb': UNIVERSAL_TYPES.JSON,
      
      // Array types (generic)
      '_text': UNIVERSAL_TYPES.ARRAY,
      '_int4': UNIVERSAL_TYPES.ARRAY,
      '_int8': UNIVERSAL_TYPES.ARRAY,
      '_float4': UNIVERSAL_TYPES.ARRAY,
      '_float8': UNIVERSAL_TYPES.ARRAY,
      '_bool': UNIVERSAL_TYPES.ARRAY,
      
      // Geometric types (as string for now)
      'point': UNIVERSAL_TYPES.STRING,
      'line': UNIVERSAL_TYPES.STRING,
      'lseg': UNIVERSAL_TYPES.STRING,
      'box': UNIVERSAL_TYPES.STRING,
      'path': UNIVERSAL_TYPES.STRING,
      'polygon': UNIVERSAL_TYPES.STRING,
      'circle': UNIVERSAL_TYPES.STRING,
      
      // Network types
      'inet': UNIVERSAL_TYPES.STRING,
      'cidr': UNIVERSAL_TYPES.STRING,
      'macaddr': UNIVERSAL_TYPES.STRING,
      'macaddr8': UNIVERSAL_TYPES.STRING,
      
      // Text search types
      'tsvector': UNIVERSAL_TYPES.STRING,
      'tsquery': UNIVERSAL_TYPES.STRING,
      
      // XML type
      'xml': UNIVERSAL_TYPES.XML,
      
      // Range types
      'int4range': UNIVERSAL_TYPES.STRING,
      'int8range': UNIVERSAL_TYPES.STRING,
      'numrange': UNIVERSAL_TYPES.STRING,
      'tsrange': UNIVERSAL_TYPES.STRING,
      'tstzrange': UNIVERSAL_TYPES.STRING,
      'daterange': UNIVERSAL_TYPES.STRING
    };
    
    return typeMap[pgType] || UNIVERSAL_TYPES.STRING;
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