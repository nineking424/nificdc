const { Pool } = require('pg'); // PostgreSQL
const mysql = require('mysql2/promise'); // MySQL
const oracledb = require('oracledb'); // Oracle
const sqlite3 = require('sqlite3'); // SQLite
const { MongoClient } = require('mongodb'); // MongoDB
const redis = require('redis'); // Redis
const ftp = require('basic-ftp'); // FTP
const { Client } = require('ssh2-sftp-client'); // SFTP
const axios = require('axios'); // API testing
const logger = require('../utils/logger');

/**
 * 연결 테스트 서비스
 * 실제 데이터베이스 및 시스템 연결 테스트를 수행
 */
class ConnectionTestService {
  /**
   * 시스템 타입에 따른 연결 테스트 수행
   */
  async testConnection(systemType, connectionInfo) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (systemType) {
        case 'postgresql':
          result = await this.testPostgreSQL(connectionInfo);
          break;
        case 'mysql':
          result = await this.testMySQL(connectionInfo);
          break;
        case 'oracle':
          result = await this.testOracle(connectionInfo);
          break;
        case 'sqlite':
          result = await this.testSQLite(connectionInfo);
          break;
        case 'mongodb':
          result = await this.testMongoDB(connectionInfo);
          break;
        case 'redis':
          result = await this.testRedis(connectionInfo);
          break;
        case 'sftp':
          result = await this.testSFTP(connectionInfo);
          break;
        case 'ftp':
          result = await this.testFTP(connectionInfo);
          break;
        case 'api':
        case 'api_rest':
          result = await this.testAPI(connectionInfo);
          break;
        default:
          result = {
            success: false,
            message: `Connection test not implemented for ${systemType}`,
            details: 'Please implement connection test for this system type'
          };
      }
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      return {
        ...result,
        latency,
        timestamp: new Date(),
        testDuration: latency
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      logger.error(`Connection test failed for ${systemType}:`, error);
      
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message,
        latency,
        timestamp: new Date(),
        testDuration: latency
      };
    }
  }

  /**
   * PostgreSQL 연결 테스트
   */
  async testPostgreSQL(connInfo) {
    const config = {
      host: connInfo.host,
      port: connInfo.port || 5432,
      database: connInfo.database || 'postgres',
      user: connInfo.username,
      password: connInfo.password,
      ssl: connInfo.ssl || false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 5000
    };

    const pool = new Pool(config);
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT version()');
      const version = result.rows[0].version;
      
      client.release();
      await pool.end();
      
      return {
        success: true,
        message: 'PostgreSQL connection successful',
        details: {
          host: connInfo.host,
          port: config.port,
          database: config.database,
          ssl: config.ssl,
          version: version.split(' ')[0] + ' ' + version.split(' ')[1]
        }
      };
    } catch (error) {
      await pool.end();
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }

  /**
   * MySQL 연결 테스트
   */
  async testMySQL(connInfo) {
    const config = {
      host: connInfo.host,
      port: connInfo.port || 3306,
      database: connInfo.database,
      user: connInfo.username,
      password: connInfo.password,
      ssl: connInfo.ssl || false,
      connectTimeout: 10000,
      acquireTimeout: 10000
    };

    let connection;
    
    try {
      connection = await mysql.createConnection(config);
      const [rows] = await connection.execute('SELECT VERSION() as version');
      
      await connection.end();
      
      return {
        success: true,
        message: 'MySQL connection successful',
        details: {
          host: connInfo.host,
          port: config.port,
          database: config.database,
          ssl: config.ssl,
          version: rows[0].version
        }
      };
    } catch (error) {
      if (connection) {
        await connection.end();
      }
      throw new Error(`MySQL connection failed: ${error.message}`);
    }
  }

  /**
   * Oracle 연결 테스트
   */
  async testOracle(connInfo) {
    const config = {
      user: connInfo.username,
      password: connInfo.password,
      connectString: `${connInfo.host}:${connInfo.port || 1521}/${connInfo.database || connInfo.serviceName}`,
      connectionTimeout: 10
    };

    let connection;
    
    try {
      connection = await oracledb.getConnection(config);
      const result = await connection.execute('SELECT * FROM v$version WHERE banner LIKE \'Oracle%\'');
      
      await connection.close();
      
      return {
        success: true,
        message: 'Oracle connection successful',
        details: {
          host: connInfo.host,
          port: connInfo.port || 1521,
          serviceName: connInfo.database || connInfo.serviceName,
          version: result.rows[0] ? result.rows[0][0] : 'Oracle Database'
        }
      };
    } catch (error) {
      if (connection) {
        await connection.close();
      }
      throw new Error(`Oracle connection failed: ${error.message}`);
    }
  }

  /**
   * SQLite 연결 테스트
   */
  async testSQLite(connInfo) {
    return new Promise((resolve, reject) => {
      const dbPath = connInfo.database || connInfo.path || ':memory:';
      
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(new Error(`SQLite connection failed: ${err.message}`));
          return;
        }
        
        db.get('SELECT sqlite_version() as version', (err, row) => {
          db.close();
          
          if (err) {
            reject(new Error(`SQLite query failed: ${err.message}`));
            return;
          }
          
          resolve({
            success: true,
            message: 'SQLite connection successful',
            details: {
              database: dbPath,
              version: row.version
            }
          });
        });
      });
    });
  }

  /**
   * MongoDB 연결 테스트
   */
  async testMongoDB(connInfo) {
    const uri = `mongodb://${connInfo.username ? connInfo.username + ':' + connInfo.password + '@' : ''}${connInfo.host}:${connInfo.port || 27017}/${connInfo.database || 'test'}`;
    
    const client = new MongoClient(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });
    
    try {
      await client.connect();
      const adminDb = client.db().admin();
      const buildInfo = await adminDb.buildInfo();
      
      await client.close();
      
      return {
        success: true,
        message: 'MongoDB connection successful',
        details: {
          host: connInfo.host,
          port: connInfo.port || 27017,
          database: connInfo.database || 'test',
          version: buildInfo.version
        }
      };
    } catch (error) {
      await client.close();
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  /**
   * Redis 연결 테스트
   */
  async testRedis(connInfo) {
    const client = redis.createClient({
      host: connInfo.host,
      port: connInfo.port || 6379,
      password: connInfo.password,
      connectTimeout: 10000
    });
    
    try {
      await client.connect();
      const info = await client.info('server');
      const version = info.split('\n').find(line => line.startsWith('redis_version:'))?.split(':')[1]?.trim();
      
      await client.quit();
      
      return {
        success: true,
        message: 'Redis connection successful',
        details: {
          host: connInfo.host,
          port: connInfo.port || 6379,
          version: version || 'Unknown'
        }
      };
    } catch (error) {
      if (client.isOpen) {
        await client.quit();
      }
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  /**
   * SFTP 연결 테스트
   */
  async testSFTP(connInfo) {
    const sftp = new Client();
    
    try {
      await sftp.connect({
        host: connInfo.host,
        port: connInfo.port || 22,
        username: connInfo.username,
        password: connInfo.password,
        readyTimeout: 10000
      });
      
      const list = await sftp.list(connInfo.rootPath || '/');
      await sftp.end();
      
      return {
        success: true,
        message: 'SFTP connection successful',
        details: {
          host: connInfo.host,
          port: connInfo.port || 22,
          rootPath: connInfo.rootPath || '/',
          filesCount: list.length
        }
      };
    } catch (error) {
      await sftp.end();
      throw new Error(`SFTP connection failed: ${error.message}`);
    }
  }

  /**
   * FTP 연결 테스트
   */
  async testFTP(connInfo) {
    const client = new ftp.Client(10000); // 10초 타임아웃
    
    try {
      await client.access({
        host: connInfo.host,
        port: connInfo.port || 21,
        user: connInfo.username,
        password: connInfo.password,
        secure: connInfo.ssl || false
      });
      
      const list = await client.list(connInfo.rootPath || '/');
      client.close();
      
      return {
        success: true,
        message: 'FTP connection successful',
        details: {
          host: connInfo.host,
          port: connInfo.port || 21,
          rootPath: connInfo.rootPath || '/',
          filesCount: list.length,
          secure: connInfo.ssl || false
        }
      };
    } catch (error) {
      client.close();
      throw new Error(`FTP connection failed: ${error.message}`);
    }
  }

  /**
   * API 연결 테스트
   */
  async testAPI(connInfo) {
    const url = connInfo.endpoint || `http://${connInfo.host}:${connInfo.port || 80}`;
    const method = connInfo.method || 'GET';
    const headers = connInfo.headers || {};
    
    try {
      const response = await axios({
        method,
        url,
        headers,
        timeout: 10000,
        validateStatus: (status) => status < 500 // 500 미만은 성공으로 간주
      });
      
      return {
        success: true,
        message: 'API connection successful',
        details: {
          url,
          method,
          status: response.status,
          statusText: response.statusText,
          headers: Object.keys(response.headers).length
        }
      };
    } catch (error) {
      if (error.response) {
        // 서버가 응답했지만 오류 상태
        return {
          success: false,
          message: `API returned error status: ${error.response.status}`,
          details: {
            url,
            method,
            status: error.response.status,
            statusText: error.response.statusText
          }
        };
      } else {
        // 네트워크 오류 또는 타임아웃
        throw new Error(`API connection failed: ${error.message}`);
      }
    }
  }
}

module.exports = new ConnectionTestService();