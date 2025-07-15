const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemAdapter = sequelize.define('SystemAdapter', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: { msg: '어댑터 이름은 필수입니다.' },
      len: { args: [1, 100], msg: '어댑터 이름은 1-100자 사이여야 합니다.' }
    },
    comment: '어댑터 고유 식별자 (예: postgresql-adapter, mysql-adapter)'
  },
  displayName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: '표시 이름은 필수입니다.' }
    },
    comment: '사용자에게 표시되는 이름 (예: PostgreSQL Adapter)'
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: '어댑터 타입은 필수입니다.' }
    },
    comment: '어댑터 타입 (시스템 타입과 매칭)'
  },
  category: {
    type: DataTypes.ENUM('database', 'file', 'stream', 'api', 'cloud'),
    allowNull: false,
    comment: '어댑터 카테고리'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '어댑터 설명'
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '1.0.0',
    validate: {
      is: /^\d+\.\d+\.\d+$/
    },
    comment: '어댑터 버전 (semantic versioning)'
  },
  capabilities: {
    type: DataTypes.JSON,
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
    comment: '어댑터 기능 목록',
    validate: {
      isValidCapabilities(value) {
        const requiredKeys = [
          'supportsSchemaDiscovery',
          'supportsBatchOperations',
          'supportsStreaming',
          'supportsTransactions'
        ];
        
        const missingKeys = requiredKeys.filter(key => !(key in value));
        if (missingKeys.length > 0) {
          throw new Error(`누락된 필수 기능: ${missingKeys.join(', ')}`);
        }
      }
    }
  },
  configSchema: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
    comment: '어댑터 설정 스키마 (JSON Schema 형식)',
    validate: {
      isValidJsonSchema(value) {
        // Basic JSON Schema validation
        if (value.$schema && typeof value.$schema !== 'string') {
          throw new Error('$schema는 문자열이어야 합니다.');
        }
        if (value.type && !['object', 'array', 'string', 'number', 'boolean', 'null'].includes(value.type)) {
          throw new Error('유효하지 않은 type 값입니다.');
        }
        if (value.required && !Array.isArray(value.required)) {
          throw new Error('required는 배열이어야 합니다.');
        }
      }
    }
  },
  defaultConfig: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: '기본 설정 값'
  },
  supportedOperations: {
    type: DataTypes.JSON,
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
    type: DataTypes.JSON,
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
    type: DataTypes.JSON,
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
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: '어댑터 활성화 여부'
  },
  isBuiltIn: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '시스템 내장 어댑터 여부'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '추가 메타데이터'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'system_adapters',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['name']
    },
    {
      fields: ['type']
    },
    {
      fields: ['category']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['isBuiltIn']
    }
  ],
  hooks: {
    beforeValidate: (adapter) => {
      // Ensure name is lowercase and kebab-case
      if (adapter.name) {
        adapter.name = adapter.name.toLowerCase().replace(/\s+/g, '-');
      }
    },
    beforeCreate: (adapter) => {
      // Set default config schema if not provided
      if (!adapter.configSchema || Object.keys(adapter.configSchema).length === 0) {
        adapter.configSchema = {
          type: 'object',
          properties: {},
          required: []
        };
      }
    }
  }
});

// 연관 관계 정의
SystemAdapter.associate = (models) => {
  SystemAdapter.belongsTo(models.User, {
    foreignKey: 'createdBy',
    as: 'creator'
  });
  
  SystemAdapter.belongsTo(models.User, {
    foreignKey: 'updatedBy',
    as: 'updater'
  });
  
  // SystemAdapter는 여러 System 인스턴스에서 사용될 수 있음
  SystemAdapter.hasMany(models.System, {
    foreignKey: 'adapterId',
    as: 'systems'
  });
};

// 인스턴스 메서드

/**
 * 어댑터가 특정 기능을 지원하는지 확인
 */
SystemAdapter.prototype.hasCapability = function(capability) {
  return this.capabilities && this.capabilities[capability] === true;
};

/**
 * 어댑터가 특정 작업을 지원하는지 확인
 */
SystemAdapter.prototype.supportsOperation = function(operation) {
  return this.supportedOperations && this.supportedOperations[operation] === true;
};

/**
 * 설정 유효성 검증
 */
SystemAdapter.prototype.validateConfig = function(config) {
  if (!this.configSchema || Object.keys(this.configSchema).length === 0) {
    return { valid: true };
  }
  
  // Simple validation based on required fields
  const errors = [];
  if (this.configSchema.required && Array.isArray(this.configSchema.required)) {
    this.configSchema.required.forEach(field => {
      if (!(field in config)) {
        errors.push(`필수 필드 누락: ${field}`);
      }
    });
  }
  
  // Type validation for properties
  if (this.configSchema.properties) {
    Object.keys(config).forEach(key => {
      if (this.configSchema.properties[key]) {
        const expectedType = this.configSchema.properties[key].type;
        const actualType = Array.isArray(config[key]) ? 'array' : typeof config[key];
        
        if (expectedType && expectedType !== actualType) {
          errors.push(`${key} 필드 타입 오류: ${expectedType} 예상, ${actualType} 제공됨`);
        }
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    ...(errors.length > 0 && { errors })
  };
};

/**
 * 기본 설정과 제공된 설정을 병합
 */
SystemAdapter.prototype.mergeWithDefaults = function(config) {
  return {
    ...this.defaultConfig,
    ...config
  };
};

// 클래스 메서드

/**
 * 카테고리별 어댑터 목록 조회
 */
SystemAdapter.getAdaptersByCategory = async function(category) {
  return await this.findAll({
    where: { 
      category,
      isActive: true 
    },
    order: [['displayName', 'ASC']]
  });
};

/**
 * 시스템 타입에 해당하는 어댑터 조회
 */
SystemAdapter.getAdapterByType = async function(type) {
  return await this.findOne({
    where: { 
      type,
      isActive: true 
    }
  });
};

/**
 * 내장 어댑터 목록 조회
 */
SystemAdapter.getBuiltInAdapters = async function() {
  return await this.findAll({
    where: { 
      isBuiltIn: true,
      isActive: true 
    },
    order: [['category', 'ASC'], ['displayName', 'ASC']]
  });
};

/**
 * 어댑터 카테고리 목록
 */
SystemAdapter.getCategories = function() {
  return [
    { value: 'database', label: '데이터베이스', icon: 'database' },
    { value: 'file', label: '파일 시스템', icon: 'folder' },
    { value: 'stream', label: '스트리밍', icon: 'stream' },
    { value: 'api', label: 'API', icon: 'api' },
    { value: 'cloud', label: '클라우드 스토리지', icon: 'cloud' }
  ];
};

module.exports = SystemAdapter;