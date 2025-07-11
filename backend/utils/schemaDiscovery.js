const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');
const oracledb = require('oracledb');
const sql = require('mssql');
const sqlite3 = require('sqlite3');
const { MongoClient } = require('mongodb');

class SchemaDiscovery {
  /**
   * 시스템 타입에 따라 스키마 탐색을 수행합니다.
   * @param {Object} system - 시스템 정보
   * @param {Object} connectionInfo - 연결 정보
   * @returns {Promise<Object>} - 탐색된 스키마 정보
   */
  static async discoverSchema(system, connectionInfo) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (system.type) {
        case 'mysql':
          result = await this.discoverMySQLSchema(connectionInfo);
          break;
        case 'postgresql':
          result = await this.discoverPostgreSQLSchema(connectionInfo);
          break;
        case 'oracle':
          result = await this.discoverOracleSchema(connectionInfo);
          break;
        case 'mssql':
          result = await this.discoverMSSQLSchema(connectionInfo);
          break;
        case 'sqlite':
          result = await this.discoverSQLiteSchema(connectionInfo);
          break;
        case 'mongodb':
          result = await this.discoverMongoDBSchema(connectionInfo);
          break;
        default:
          throw new Error(`스키마 탐색이 지원되지 않는 시스템 타입: ${system.type}`);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      return {
        success: true,
        systemType: system.type,
        processingTime,
        discoveredAt: new Date().toISOString(),
        schemas: result.schemas,
        summary: {
          totalSchemas: result.schemas.length,
          totalTables: result.schemas.reduce((sum, schema) => sum + (schema.tables?.length || 0), 0),
          totalColumns: result.schemas.reduce((sum, schema) => 
            sum + schema.tables?.reduce((tableSum, table) => 
              tableSum + (table.columns?.length || 0), 0) || 0, 0)
        }
      };
    } catch (error) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      return {
        success: false,
        systemType: system.type,
        processingTime,
        discoveredAt: new Date().toISOString(),
        error: {
          message: error.message,
          code: error.code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
    }
  }

  /**
   * MySQL 스키마 탐색
   */
  static async discoverMySQLSchema(connectionInfo) {
    const config = {
      host: connectionInfo.host,
      port: connectionInfo.port || 3306,
      user: connectionInfo.username,
      password: connectionInfo.password,
      database: connectionInfo.database,
      ssl: connectionInfo.ssl || false
    };

    const connection = await mysql.createConnection(config);
    
    try {
      // 데이터베이스 목록 조회
      const [databases] = await connection.execute(
        "SELECT SCHEMA_NAME as name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')"
      );

      const schemas = [];

      for (const database of databases) {
        // 테이블 목록 조회
        const [tables] = await connection.execute(
          "SELECT TABLE_NAME as name, TABLE_TYPE as type, TABLE_COMMENT as comment FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",
          [database.name]
        );

        const tablesWithColumns = [];

        for (const table of tables) {
          // 컬럼 정보 조회
          const [columns] = await connection.execute(`
            SELECT 
              COLUMN_NAME as name,
              DATA_TYPE as dataType,
              IS_NULLABLE as nullable,
              COLUMN_DEFAULT as defaultValue,
              COLUMN_COMMENT as comment,
              CHARACTER_MAXIMUM_LENGTH as maxLength,
              NUMERIC_PRECISION as precision,
              NUMERIC_SCALE as scale,
              EXTRA as extra
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
          `, [database.name, table.name]);

          // 인덱스 정보 조회
          const [indexes] = await connection.execute(`
            SELECT 
              INDEX_NAME as name,
              COLUMN_NAME as columnName,
              NON_UNIQUE as nonUnique,
              INDEX_TYPE as type
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          `, [database.name, table.name]);

          // 외래키 정보 조회
          const [foreignKeys] = await connection.execute(`
            SELECT 
              CONSTRAINT_NAME as name,
              COLUMN_NAME as columnName,
              REFERENCED_TABLE_NAME as referencedTable,
              REFERENCED_COLUMN_NAME as referencedColumn
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
          `, [database.name, table.name]);

          tablesWithColumns.push({
            name: table.name,
            type: table.type,
            comment: table.comment,
            columns: columns.map(col => ({
              name: col.name,
              dataType: this.mapMySQLDataType(col.dataType),
              nullable: col.nullable === 'YES',
              primaryKey: col.extra?.includes('auto_increment') || false,
              defaultValue: col.defaultValue,
              comment: col.comment,
              maxLength: col.maxLength,
              precision: col.precision,
              scale: col.scale,
              autoIncrement: col.extra?.includes('auto_increment') || false
            })),
            indexes: this.groupIndexes(indexes),
            foreignKeys: foreignKeys.map(fk => ({
              name: fk.name,
              columnName: fk.columnName,
              referencedTable: fk.referencedTable,
              referencedColumn: fk.referencedColumn
            }))
          });
        }

        schemas.push({
          name: database.name,
          type: 'database',
          tables: tablesWithColumns
        });
      }

      return { schemas };
    } finally {
      await connection.end();
    }
  }

  /**
   * PostgreSQL 스키마 탐색
   */
  static async discoverPostgreSQLSchema(connectionInfo) {
    const config = {
      host: connectionInfo.host,
      port: connectionInfo.port || 5432,
      user: connectionInfo.username,
      password: connectionInfo.password,
      database: connectionInfo.database,
      ssl: connectionInfo.ssl || false
    };

    const client = new PgClient(config);
    
    try {
      await client.connect();

      // 스키마 목록 조회
      const schemaResult = await client.query(`
        SELECT schema_name as name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      `);

      const schemas = [];

      for (const schema of schemaResult.rows) {
        // 테이블 목록 조회
        const tableResult = await client.query(`
          SELECT 
            table_name as name,
            table_type as type
          FROM information_schema.tables 
          WHERE table_schema = $1
        `, [schema.name]);

        const tablesWithColumns = [];

        for (const table of tableResult.rows) {
          // 컬럼 정보 조회
          const columnResult = await client.query(`
            SELECT 
              column_name as name,
              data_type as dataType,
              is_nullable as nullable,
              column_default as defaultValue,
              character_maximum_length as maxLength,
              numeric_precision as precision,
              numeric_scale as scale
            FROM information_schema.columns 
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
          `, [schema.name, table.name]);

          // 기본키 정보 조회
          const primaryKeyResult = await client.query(`
            SELECT column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
          `, [schema.name, table.name]);

          const primaryKeyColumns = primaryKeyResult.rows.map(row => row.column_name);

          // 인덱스 정보 조회
          const indexResult = await client.query(`
            SELECT 
              indexname as name,
              indexdef as definition
            FROM pg_indexes 
            WHERE schemaname = $1 AND tablename = $2
          `, [schema.name, table.name]);

          // 외래키 정보 조회
          const foreignKeyResult = await client.query(`
            SELECT 
              tc.constraint_name as name,
              kcu.column_name as columnName,
              ccu.table_name as referencedTable,
              ccu.column_name as referencedColumn
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu 
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
          `, [schema.name, table.name]);

          tablesWithColumns.push({
            name: table.name,
            type: table.type,
            columns: columnResult.rows.map(col => ({
              name: col.name,
              dataType: this.mapPostgreSQLDataType(col.datatype),
              nullable: col.nullable === 'YES',
              primaryKey: primaryKeyColumns.includes(col.name),
              defaultValue: col.defaultvalue,
              maxLength: col.maxlength,
              precision: col.precision,
              scale: col.scale
            })),
            indexes: indexResult.rows.map(idx => ({
              name: idx.name,
              definition: idx.definition
            })),
            foreignKeys: foreignKeyResult.rows.map(fk => ({
              name: fk.name,
              columnName: fk.columnname,
              referencedTable: fk.referencedtable,
              referencedColumn: fk.referencedcolumn
            }))
          });
        }

        schemas.push({
          name: schema.name,
          type: 'schema',
          tables: tablesWithColumns
        });
      }

      return { schemas };
    } finally {
      await client.end();
    }
  }

  /**
   * MongoDB 스키마 탐색
   */
  static async discoverMongoDBSchema(connectionInfo) {
    const uri = this.buildMongoDBURI(connectionInfo);
    const client = new MongoClient(uri, {
      connectTimeoutMS: connectionInfo.timeout || 30000
    });

    try {
      await client.connect();
      const db = client.db(connectionInfo.database);

      // 컬렉션 목록 조회
      const collections = await db.listCollections().toArray();
      
      const schemas = [];
      const tablesWithColumns = [];

      for (const collection of collections) {
        // 샘플 도큐먼트를 통한 스키마 추론
        const sampleDocuments = await db.collection(collection.name)
          .find({})
          .limit(100)
          .toArray();

        const schema = this.inferMongoDBSchema(sampleDocuments);

        tablesWithColumns.push({
          name: collection.name,
          type: 'collection',
          documentCount: await db.collection(collection.name).countDocuments(),
          columns: schema.fields,
          indexes: await this.getMongoDBIndexes(db, collection.name)
        });
      }

      schemas.push({
        name: connectionInfo.database,
        type: 'database',
        tables: tablesWithColumns
      });

      return { schemas };
    } finally {
      await client.close();
    }
  }

  /**
   * SQLite 스키마 탐색
   */
  static async discoverSQLiteSchema(connectionInfo) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(connectionInfo.path, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // 테이블 목록 조회
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
          if (err) {
            reject(err);
            return;
          }

          const tablesWithColumns = [];
          let completed = 0;

          if (tables.length === 0) {
            resolve({ schemas: [{ name: 'main', type: 'database', tables: [] }] });
            return;
          }

          tables.forEach(table => {
            // 컬럼 정보 조회
            db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
              if (err) {
                reject(err);
                return;
              }

              tablesWithColumns.push({
                name: table.name,
                type: 'table',
                columns: columns.map(col => ({
                  name: col.name,
                  dataType: this.mapSQLiteDataType(col.type),
                  nullable: col.notnull === 0,
                  primaryKey: col.pk === 1,
                  defaultValue: col.dflt_value
                }))
              });

              completed++;
              if (completed === tables.length) {
                resolve({
                  schemas: [{
                    name: 'main',
                    type: 'database',
                    tables: tablesWithColumns
                  }]
                });
              }
            });
          });
        });
      });
    });
  }

  /**
   * MongoDB URI 생성
   */
  static buildMongoDBURI(connectionInfo) {
    let uri = 'mongodb://';
    
    if (connectionInfo.username && connectionInfo.password) {
      uri += `${connectionInfo.username}:${connectionInfo.password}@`;
    }
    
    uri += `${connectionInfo.host}:${connectionInfo.port || 27017}/${connectionInfo.database}`;
    
    const options = [];
    if (connectionInfo.authSource) {
      options.push(`authSource=${connectionInfo.authSource}`);
    }
    if (connectionInfo.ssl) {
      options.push('ssl=true');
    }
    
    if (options.length > 0) {
      uri += `?${options.join('&')}`;
    }
    
    return uri;
  }

  /**
   * MongoDB 스키마 추론
   */
  static inferMongoDBSchema(documents) {
    const fieldTypes = {};
    
    documents.forEach(doc => {
      this.analyzeDocument(doc, fieldTypes, '');
    });

    const fields = Object.entries(fieldTypes).map(([fieldName, typeInfo]) => ({
      name: fieldName,
      dataType: this.getMostCommonType(typeInfo.types),
      nullable: typeInfo.nullable,
      examples: typeInfo.examples.slice(0, 3)
    }));

    return { fields };
  }

  /**
   * MongoDB 도큐먼트 분석
   */
  static analyzeDocument(obj, fieldTypes, prefix) {
    Object.entries(obj).forEach(([key, value]) => {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      
      if (!fieldTypes[fieldName]) {
        fieldTypes[fieldName] = {
          types: {},
          nullable: false,
          examples: []
        };
      }

      const type = this.getMongoDBFieldType(value);
      fieldTypes[fieldName].types[type] = (fieldTypes[fieldName].types[type] || 0) + 1;
      
      if (value === null || value === undefined) {
        fieldTypes[fieldName].nullable = true;
      }

      if (fieldTypes[fieldName].examples.length < 3 && value !== null && value !== undefined) {
        fieldTypes[fieldName].examples.push(value);
      }

      // 중첩 객체 분석
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.analyzeDocument(value, fieldTypes, fieldName);
      }
    });
  }

  /**
   * MongoDB 인덱스 정보 조회
   */
  static async getMongoDBIndexes(db, collectionName) {
    try {
      const indexes = await db.collection(collectionName).indexes();
      return indexes.map(index => ({
        name: index.name,
        keys: index.key,
        unique: index.unique || false,
        sparse: index.sparse || false
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * 인덱스 그룹화
   */
  static groupIndexes(indexes) {
    const grouped = {};
    
    indexes.forEach(index => {
      if (!grouped[index.name]) {
        grouped[index.name] = {
          name: index.name,
          columns: [],
          unique: index.nonUnique === 0,
          type: index.type
        };
      }
      grouped[index.name].columns.push(index.columnName);
    });

    return Object.values(grouped);
  }

  /**
   * 데이터 타입 매핑
   */
  static mapMySQLDataType(type) {
    const typeMap = {
      'int': 'INTEGER',
      'bigint': 'BIGINT',
      'varchar': 'VARCHAR',
      'char': 'CHAR',
      'text': 'TEXT',
      'longtext': 'LONGTEXT',
      'decimal': 'DECIMAL',
      'float': 'FLOAT',
      'double': 'DOUBLE',
      'date': 'DATE',
      'datetime': 'DATETIME',
      'timestamp': 'TIMESTAMP',
      'time': 'TIME',
      'tinyint': 'BOOLEAN',
      'blob': 'BLOB',
      'json': 'JSON'
    };
    
    return typeMap[type.toLowerCase()] || type.toUpperCase();
  }

  static mapPostgreSQLDataType(type) {
    const typeMap = {
      'integer': 'INTEGER',
      'bigint': 'BIGINT',
      'character varying': 'VARCHAR',
      'character': 'CHAR',
      'text': 'TEXT',
      'numeric': 'DECIMAL',
      'real': 'FLOAT',
      'double precision': 'DOUBLE',
      'date': 'DATE',
      'timestamp without time zone': 'TIMESTAMP',
      'timestamp with time zone': 'TIMESTAMP',
      'time without time zone': 'TIME',
      'boolean': 'BOOLEAN',
      'bytea': 'BLOB',
      'json': 'JSON',
      'jsonb': 'JSONB',
      'uuid': 'VARCHAR'
    };
    
    return typeMap[type.toLowerCase()] || type.toUpperCase();
  }

  static mapSQLiteDataType(type) {
    const typeMap = {
      'integer': 'INTEGER',
      'text': 'TEXT',
      'real': 'FLOAT',
      'blob': 'BLOB',
      'numeric': 'DECIMAL'
    };
    
    return typeMap[type.toLowerCase()] || 'TEXT';
  }

  static getMongoDBFieldType(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'double';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  static getMostCommonType(types) {
    return Object.entries(types)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
  }
}

module.exports = SchemaDiscovery;