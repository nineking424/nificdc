const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');
const oracledb = require('oracledb');
const sql = require('mssql');
const sqlite3 = require('sqlite3');
const { MongoClient } = require('mongodb');
const redis = require('redis');
const ftp = require('basic-ftp');
const { Client: SFTPClient } = require('ssh2-sftp-client');
const AWS = require('aws-sdk');
const { BlobServiceClient } = require('@azure/storage-blob');
const axios = require('axios');
const { Kafka } = require('kafkajs');
const fs = require('fs').promises;
const path = require('path');

class ConnectionTester {
  /**
   * 시스템 타입에 따라 연결 테스트를 수행합니다.
   * @param {string} type - 시스템 타입
   * @param {Object} connectionInfo - 연결 정보
   * @returns {Promise<Object>} - 테스트 결과
   */
  static async testConnection(type, connectionInfo) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (type) {
        case 'mysql':
          result = await this.testMySQLConnection(connectionInfo);
          break;
        case 'postgresql':
          result = await this.testPostgreSQLConnection(connectionInfo);
          break;
        case 'oracle':
          result = await this.testOracleConnection(connectionInfo);
          break;
        case 'mssql':
          result = await this.testMSSQLConnection(connectionInfo);
          break;
        case 'sqlite':
          result = await this.testSQLiteConnection(connectionInfo);
          break;
        case 'mongodb':
          result = await this.testMongoDBConnection(connectionInfo);
          break;
        case 'redis':
          result = await this.testRedisConnection(connectionInfo);
          break;
        case 'ftp':
          result = await this.testFTPConnection(connectionInfo);
          break;
        case 'sftp':
          result = await this.testSFTPConnection(connectionInfo);
          break;
        case 'local_fs':
          result = await this.testLocalFSConnection(connectionInfo);
          break;
        case 'aws_s3':
          result = await this.testAWSS3Connection(connectionInfo);
          break;
        case 'azure_blob':
          result = await this.testAzureBlobConnection(connectionInfo);
          break;
        case 'api_rest':
          result = await this.testRESTAPIConnection(connectionInfo);
          break;
        case 'kafka':
          result = await this.testKafkaConnection(connectionInfo);
          break;
        default:
          throw new Error(`지원되지 않는 시스템 타입: ${type}`);
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      return {
        success: true,
        message: '연결 성공',
        responseTime,
        details: result,
        testedAt: new Date().toISOString()
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      return {
        success: false,
        message: error.message,
        responseTime,
        error: {
          code: error.code,
          sqlState: error.sqlState,
          errno: error.errno,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        testedAt: new Date().toISOString()
      };
    }
  }

  /**
   * MySQL 연결 테스트
   */
  static async testMySQLConnection(connectionInfo) {
    const config = {
      host: connectionInfo.host,
      port: connectionInfo.port || 3306,
      user: connectionInfo.username,
      password: connectionInfo.password,
      database: connectionInfo.database,
      ssl: connectionInfo.ssl || false,
      connectTimeout: connectionInfo.timeout || 30000,
      acquireTimeout: connectionInfo.timeout || 30000
    };

    const connection = await mysql.createConnection(config);
    
    try {
      const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as database');
      return {
        version: rows[0].version,
        database: rows[0].database,
        serverInfo: 'MySQL 서버 연결 성공'
      };
    } finally {
      await connection.end();
    }
  }

  /**
   * PostgreSQL 연결 테스트
   */
  static async testPostgreSQLConnection(connectionInfo) {
    const config = {
      host: connectionInfo.host,
      port: connectionInfo.port || 5432,
      user: connectionInfo.username,
      password: connectionInfo.password,
      database: connectionInfo.database,
      ssl: connectionInfo.ssl || false,
      connectionTimeoutMillis: connectionInfo.timeout || 30000,
      query_timeout: connectionInfo.timeout || 30000
    };

    const client = new PgClient(config);
    
    try {
      await client.connect();
      const result = await client.query('SELECT version(), current_database()');
      return {
        version: result.rows[0].version,
        database: result.rows[0].current_database,
        serverInfo: 'PostgreSQL 서버 연결 성공'
      };
    } finally {
      await client.end();
    }
  }

  /**
   * Oracle 연결 테스트
   */
  static async testOracleConnection(connectionInfo) {
    const config = {
      user: connectionInfo.username,
      password: connectionInfo.password,
      connectString: `${connectionInfo.host}:${connectionInfo.port || 1521}/${connectionInfo.serviceName}`,
      connectionTimeout: (connectionInfo.timeout || 30000) / 1000
    };

    const connection = await oracledb.getConnection(config);
    
    try {
      const result = await connection.execute('SELECT * FROM v$version WHERE banner LIKE \'Oracle%\'');
      return {
        version: result.rows[0] ? result.rows[0][0] : 'Oracle Database',
        serverInfo: 'Oracle 서버 연결 성공'
      };
    } finally {
      await connection.close();
    }
  }

  /**
   * SQL Server 연결 테스트
   */
  static async testMSSQLConnection(connectionInfo) {
    const config = {
      server: connectionInfo.host,
      port: connectionInfo.port || 1433,
      user: connectionInfo.username,
      password: connectionInfo.password,
      database: connectionInfo.database,
      options: {
        encrypt: connectionInfo.encrypt || false,
        trustServerCertificate: connectionInfo.trustServerCertificate || false
      },
      connectionTimeout: connectionInfo.timeout || 30000,
      requestTimeout: connectionInfo.timeout || 30000
    };

    const pool = await sql.connect(config);
    
    try {
      const result = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as database');
      return {
        version: result.recordset[0].version,
        database: result.recordset[0].database,
        serverInfo: 'SQL Server 연결 성공'
      };
    } finally {
      await pool.close();
    }
  }

  /**
   * SQLite 연결 테스트
   */
  static async testSQLiteConnection(connectionInfo) {
    return new Promise((resolve, reject) => {
      // database 필드 또는 path 필드 사용 (frontend에서는 database 필드를 사용)
      const dbPath = connectionInfo.database || connectionInfo.path;
      
      if (!dbPath) {
        reject(new Error('데이터베이스 파일 경로가 필요합니다.'));
        return;
      }
      
      const db = new sqlite3.Database(dbPath, connectionInfo.readonly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
          reject(err);
        } else {
          db.get('SELECT sqlite_version() as version', (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve({
                version: row.version,
                path: dbPath,
                serverInfo: 'SQLite 데이터베이스 연결 성공'
              });
            }
            db.close();
          });
        }
      });
    });
  }

  /**
   * MongoDB 연결 테스트
   */
  static async testMongoDBConnection(connectionInfo) {
    const uri = this.buildMongoDBURI(connectionInfo);
    const client = new MongoClient(uri, {
      connectTimeoutMS: connectionInfo.timeout || 30000,
      serverSelectionTimeoutMS: connectionInfo.timeout || 30000
    });

    try {
      await client.connect();
      const admin = client.db().admin();
      const result = await admin.buildInfo();
      return {
        version: result.version,
        database: connectionInfo.database,
        serverInfo: 'MongoDB 서버 연결 성공'
      };
    } finally {
      await client.close();
    }
  }

  /**
   * Redis 연결 테스트
   */
  static async testRedisConnection(connectionInfo) {
    const client = redis.createClient({
      host: connectionInfo.host,
      port: connectionInfo.port || 6379,
      password: connectionInfo.password,
      db: connectionInfo.database || 0,
      connect_timeout: connectionInfo.timeout || 30000
    });

    try {
      await client.connect();
      const info = await client.info('server');
      const version = info.match(/redis_version:([^\r\n]+)/)[1];
      return {
        version,
        serverInfo: 'Redis 서버 연결 성공'
      };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * FTP 연결 테스트
   */
  static async testFTPConnection(connectionInfo) {
    const client = new ftp.Client(connectionInfo.timeout || 30000);
    
    try {
      await client.access({
        host: connectionInfo.host,
        port: connectionInfo.port || 21,
        user: connectionInfo.username,
        password: connectionInfo.password,
        secure: false
      });
      
      const pwd = await client.pwd();
      return {
        currentDirectory: pwd,
        serverInfo: 'FTP 서버 연결 성공'
      };
    } finally {
      client.close();
    }
  }

  /**
   * SFTP 연결 테스트
   */
  static async testSFTPConnection(connectionInfo) {
    const client = new SFTPClient();
    
    const config = {
      host: connectionInfo.host,
      port: connectionInfo.port || 22,
      username: connectionInfo.username,
      readyTimeout: connectionInfo.timeout || 30000
    };

    if (connectionInfo.privateKey) {
      config.privateKey = connectionInfo.privateKey;
      if (connectionInfo.passphrase) {
        config.passphrase = connectionInfo.passphrase;
      }
    } else {
      config.password = connectionInfo.password;
    }

    try {
      await client.connect(config);
      const pwd = await client.pwd();
      return {
        currentDirectory: pwd,
        serverInfo: 'SFTP 서버 연결 성공'
      };
    } finally {
      await client.end();
    }
  }

  /**
   * 로컬 파일시스템 연결 테스트
   */
  static async testLocalFSConnection(connectionInfo) {
    try {
      const stats = await fs.stat(connectionInfo.path);
      const isDirectory = stats.isDirectory();
      
      // 읽기 권한 테스트
      await fs.access(connectionInfo.path, fs.constants.R_OK);
      
      // 쓰기 권한 테스트 (readonly가 아닌 경우)
      if (!connectionInfo.readonly) {
        await fs.access(connectionInfo.path, fs.constants.W_OK);
      }

      return {
        path: connectionInfo.path,
        isDirectory,
        readonly: connectionInfo.readonly || false,
        serverInfo: '로컬 파일시스템 접근 성공'
      };
    } catch (error) {
      throw new Error(`파일시스템 접근 실패: ${error.message}`);
    }
  }

  /**
   * AWS S3 연결 테스트
   */
  static async testAWSS3Connection(connectionInfo) {
    const s3Config = {
      accessKeyId: connectionInfo.accessKeyId,
      secretAccessKey: connectionInfo.secretAccessKey,
      region: connectionInfo.region
    };

    if (connectionInfo.sessionToken) {
      s3Config.sessionToken = connectionInfo.sessionToken;
    }

    if (connectionInfo.endpoint) {
      s3Config.endpoint = connectionInfo.endpoint;
      s3Config.s3ForcePathStyle = connectionInfo.s3ForcePathStyle || false;
    }

    const s3 = new AWS.S3(s3Config);

    try {
      await s3.headBucket({ Bucket: connectionInfo.bucket }).promise();
      return {
        bucket: connectionInfo.bucket,
        region: connectionInfo.region,
        serverInfo: 'AWS S3 버킷 연결 성공'
      };
    } catch (error) {
      throw new Error(`S3 연결 실패: ${error.message}`);
    }
  }

  /**
   * Azure Blob Storage 연결 테스트
   */
  static async testAzureBlobConnection(connectionInfo) {
    let blobServiceClient;

    if (connectionInfo.connectionString) {
      blobServiceClient = BlobServiceClient.fromConnectionString(connectionInfo.connectionString);
    } else {
      const credential = new AWS.StorageSharedKeyCredential(connectionInfo.accountName, connectionInfo.accountKey);
      blobServiceClient = new BlobServiceClient(`https://${connectionInfo.accountName}.blob.core.windows.net`, credential);
    }

    try {
      const containerClient = blobServiceClient.getContainerClient(connectionInfo.containerName);
      await containerClient.getProperties();
      return {
        containerName: connectionInfo.containerName,
        serverInfo: 'Azure Blob Storage 연결 성공'
      };
    } catch (error) {
      throw new Error(`Azure Blob Storage 연결 실패: ${error.message}`);
    }
  }

  /**
   * REST API 연결 테스트
   */
  static async testRESTAPIConnection(connectionInfo) {
    const config = {
      baseURL: connectionInfo.baseUrl,
      timeout: connectionInfo.timeout || 30000,
      headers: connectionInfo.headers || {}
    };

    // 인증 설정
    if (connectionInfo.authentication) {
      const auth = connectionInfo.authentication;
      switch (auth.type) {
        case 'basic':
          config.auth = {
            username: auth.username,
            password: auth.password
          };
          break;
        case 'bearer':
          config.headers.Authorization = `Bearer ${auth.token}`;
          break;
        case 'apikey':
          config.headers[auth.headerName || 'X-API-Key'] = auth.apiKey;
          break;
      }
    }

    const client = axios.create(config);

    try {
      const response = await client.get('/');
      return {
        baseUrl: connectionInfo.baseUrl,
        status: response.status,
        statusText: response.statusText,
        serverInfo: 'REST API 연결 성공'
      };
    } catch (error) {
      if (error.response) {
        return {
          baseUrl: connectionInfo.baseUrl,
          status: error.response.status,
          statusText: error.response.statusText,
          serverInfo: 'REST API 응답 수신 (엔드포인트가 존재하지 않을 수 있음)'
        };
      } else {
        throw new Error(`REST API 연결 실패: ${error.message}`);
      }
    }
  }

  /**
   * Kafka 연결 테스트
   */
  static async testKafkaConnection(connectionInfo) {
    const kafkaConfig = {
      clientId: connectionInfo.clientId || 'nificdc-connection-test',
      brokers: connectionInfo.brokers,
      connectionTimeout: connectionInfo.timeout || 30000,
      requestTimeout: connectionInfo.timeout || 30000
    };

    if (connectionInfo.ssl) {
      kafkaConfig.ssl = true;
    }

    if (connectionInfo.sasl) {
      kafkaConfig.sasl = connectionInfo.sasl;
    }

    const kafka = new Kafka(kafkaConfig);
    const admin = kafka.admin();

    try {
      await admin.connect();
      const metadata = await admin.fetchTopicMetadata();
      return {
        brokers: connectionInfo.brokers,
        topicCount: metadata.topics.length,
        serverInfo: 'Kafka 클러스터 연결 성공'
      };
    } finally {
      await admin.disconnect();
    }
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
}

module.exports = ConnectionTester;