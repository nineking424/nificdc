'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create system_adapters table
    await queryInterface.createTable('system_adapters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: '어댑터 고유 식별자 (예: postgresql-adapter, mysql-adapter)'
      },
      displayName: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: '사용자에게 표시되는 이름 (예: PostgreSQL Adapter)'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: '어댑터 타입 (시스템 타입과 매칭)'
      },
      category: {
        type: Sequelize.ENUM('database', 'file', 'stream', 'api', 'cloud'),
        allowNull: false,
        comment: '어댑터 카테고리'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '어댑터 설명'
      },
      version: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '1.0.0',
        comment: '어댑터 버전 (semantic versioning)'
      },
      capabilities: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {
          supportsSchemaDiscovery: false,
          supportsBatchOperations: false,
          supportsStreaming: false,
          supportsTransactions: false,
          supportsPartitioning: false,
          supportsChangeDataCapture: false,
          supportsIncrementalSync: false,
          supportsCustomQuery: false
        },
        comment: '어댑터 기능 목록'
      },
      configSchema: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {},
        comment: '어댑터 설정 스키마 (JSON Schema 형식)'
      },
      defaultConfig: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
        comment: '기본 설정 값'
      },
      supportedOperations: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {
          read: true,
          write: true,
          update: false,
          delete: false,
          upsert: false,
          truncate: false,
          createSchema: false,
          dropSchema: false
        },
        comment: '지원하는 작업 목록'
      },
      connectionLimits: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {
          maxConnections: 10,
          connectionTimeout: 30000,
          queryTimeout: 300000,
          maxRetries: 3,
          retryDelay: 1000
        },
        comment: '연결 제한 설정'
      },
      performanceHints: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {
          recommendedBatchSize: 1000,
          maxBatchSize: 10000,
          recommendedFetchSize: 5000,
          supportsParallelQueries: false,
          recommendedParallelism: 1
        },
        comment: '성능 최적화 힌트'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: '어댑터 활성화 여부'
      },
      isBuiltIn: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: '시스템 내장 어댑터 여부'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '추가 메타데이터'
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes
    await queryInterface.addIndex('system_adapters', ['name'], {
      unique: true,
      name: 'idx_system_adapters_name'
    });
    
    await queryInterface.addIndex('system_adapters', ['type'], {
      name: 'idx_system_adapters_type'
    });
    
    await queryInterface.addIndex('system_adapters', ['category'], {
      name: 'idx_system_adapters_category'
    });
    
    await queryInterface.addIndex('system_adapters', ['isActive'], {
      name: 'idx_system_adapters_is_active'
    });
    
    await queryInterface.addIndex('system_adapters', ['isBuiltIn'], {
      name: 'idx_system_adapters_is_built_in'
    });

    // Add adapterId column to systems table
    await queryInterface.addColumn('systems', 'adapterId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'system_adapters',
        key: 'id'
      },
      comment: '사용하는 시스템 어댑터 ID',
      after: 'updatedBy'
    });

    // Add index for adapterId in systems table
    await queryInterface.addIndex('systems', ['adapterId'], {
      name: 'idx_systems_adapter_id'
    });

    // Insert built-in adapters
    const builtInAdapters = [
      // Database adapters
      {
        id: queryInterface.sequelize.literal('gen_random_uuid()'),
        name: 'postgresql-adapter',
        displayName: 'PostgreSQL Adapter',
        type: 'postgresql',
        category: 'database',
        description: 'PostgreSQL 데이터베이스 연결 어댑터',
        version: '1.0.0',
        capabilities: JSON.stringify({
          supportsSchemaDiscovery: true,
          supportsBatchOperations: true,
          supportsStreaming: true,
          supportsTransactions: true,
          supportsPartitioning: true,
          supportsChangeDataCapture: false,
          supportsIncrementalSync: true,
          supportsCustomQuery: true
        }),
        configSchema: JSON.stringify({
          type: 'object',
          properties: {
            host: { type: 'string', description: '호스트 주소' },
            port: { type: 'number', description: '포트 번호', default: 5432 },
            database: { type: 'string', description: '데이터베이스 이름' },
            username: { type: 'string', description: '사용자명' },
            password: { type: 'string', description: '비밀번호', format: 'password' },
            ssl: { type: 'boolean', description: 'SSL 사용 여부', default: false },
            schema: { type: 'string', description: '스키마 이름', default: 'public' }
          },
          required: ['host', 'database', 'username', 'password']
        }),
        supportedOperations: JSON.stringify({
          read: true,
          write: true,
          update: true,
          delete: true,
          upsert: true,
          truncate: true,
          createSchema: true,
          dropSchema: true
        }),
        isActive: true,
        isBuiltIn: true,
        createdBy: queryInterface.sequelize.literal("(SELECT id FROM users WHERE username = 'admin' LIMIT 1)"),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: queryInterface.sequelize.literal('gen_random_uuid()'),
        name: 'mysql-adapter',
        displayName: 'MySQL Adapter',
        type: 'mysql',
        category: 'database',
        description: 'MySQL 데이터베이스 연결 어댑터',
        version: '1.0.0',
        capabilities: JSON.stringify({
          supportsSchemaDiscovery: true,
          supportsBatchOperations: true,
          supportsStreaming: true,
          supportsTransactions: true,
          supportsPartitioning: true,
          supportsChangeDataCapture: true,
          supportsIncrementalSync: true,
          supportsCustomQuery: true
        }),
        configSchema: JSON.stringify({
          type: 'object',
          properties: {
            host: { type: 'string', description: '호스트 주소' },
            port: { type: 'number', description: '포트 번호', default: 3306 },
            database: { type: 'string', description: '데이터베이스 이름' },
            username: { type: 'string', description: '사용자명' },
            password: { type: 'string', description: '비밀번호', format: 'password' },
            ssl: { type: 'boolean', description: 'SSL 사용 여부', default: false }
          },
          required: ['host', 'database', 'username', 'password']
        }),
        supportedOperations: JSON.stringify({
          read: true,
          write: true,
          update: true,
          delete: true,
          upsert: true,
          truncate: true,
          createSchema: true,
          dropSchema: true
        }),
        isActive: true,
        isBuiltIn: true,
        createdBy: queryInterface.sequelize.literal("(SELECT id FROM users WHERE username = 'admin' LIMIT 1)"),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // File system adapters
      {
        id: queryInterface.sequelize.literal('gen_random_uuid()'),
        name: 'local-fs-adapter',
        displayName: 'Local File System Adapter',
        type: 'local_fs',
        category: 'file',
        description: '로컬 파일 시스템 접근 어댑터',
        version: '1.0.0',
        capabilities: JSON.stringify({
          supportsSchemaDiscovery: false,
          supportsBatchOperations: true,
          supportsStreaming: true,
          supportsTransactions: false,
          supportsPartitioning: false,
          supportsChangeDataCapture: false,
          supportsIncrementalSync: false,
          supportsCustomQuery: false
        }),
        configSchema: JSON.stringify({
          type: 'object',
          properties: {
            basePath: { type: 'string', description: '기본 경로' },
            filePattern: { type: 'string', description: '파일 패턴 (glob)', default: '*.*' },
            recursive: { type: 'boolean', description: '하위 디렉토리 포함', default: false },
            encoding: { type: 'string', description: '파일 인코딩', default: 'utf-8' }
          },
          required: ['basePath']
        }),
        supportedOperations: JSON.stringify({
          read: true,
          write: true,
          update: false,
          delete: true,
          upsert: false,
          truncate: false,
          createSchema: false,
          dropSchema: false
        }),
        isActive: true,
        isBuiltIn: true,
        createdBy: queryInterface.sequelize.literal("(SELECT id FROM users WHERE username = 'admin' LIMIT 1)"),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('system_adapters', builtInAdapters);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove adapterId column from systems table
    await queryInterface.removeColumn('systems', 'adapterId');
    
    // Remove indexes
    await queryInterface.removeIndex('system_adapters', 'idx_system_adapters_name');
    await queryInterface.removeIndex('system_adapters', 'idx_system_adapters_type');
    await queryInterface.removeIndex('system_adapters', 'idx_system_adapters_category');
    await queryInterface.removeIndex('system_adapters', 'idx_system_adapters_is_active');
    await queryInterface.removeIndex('system_adapters', 'idx_system_adapters_is_built_in');
    
    // Drop table
    await queryInterface.dropTable('system_adapters');
  }
};