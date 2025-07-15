const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { UNIVERSAL_TYPES, SCHEMA_FORMATS } = require('../constants/schemaTypes');

const DataSchema = sequelize.define('DataSchema', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: '스키마 이름은 필수입니다.' },
      len: { args: [1, 100], msg: '스키마 이름은 1-100자 사이여야 합니다.' }
    }
  },
  systemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Systems',
      key: 'id'
    }
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: { args: [1], msg: '버전은 1 이상이어야 합니다.' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  schemaType: {
    type: DataTypes.ENUM('table', 'collection', 'file', 'api', 'topic'),
    allowNull: false,
    defaultValue: 'table'
  },
  // Universal Schema 지원을 위한 새로운 필드들
  schemaFormat: {
    type: DataTypes.ENUM(...Object.values(SCHEMA_FORMATS)),
    allowNull: false,
    defaultValue: SCHEMA_FORMATS.RELATIONAL,
    comment: '스키마 형식 (relational, document, key-value, etc.)'
  },
  universalType: {
    type: DataTypes.ENUM(...Object.values(UNIVERSAL_TYPES)),
    allowNull: true,
    comment: '범용 데이터 타입 (컬럼별로 정의됨)'
  },
  columns: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: '컬럼 정의 배열'
  },
  indexes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '인덱스 정의 배열'
  },
  constraints: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '제약조건 정의 배열'
  },
  relationships: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '관계 정의 배열'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  isDiscovered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '자동 탐색으로 생성된 스키마인지 여부'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '추가 메타데이터 (테이블 크기, 레코드 수 등)'
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '마지막 동기화 일시'
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
  },
  // 스키마 변경 이력
  changeLog: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '스키마 변경 이력'
  }
}, {
  tableName: 'data_schemas',
  timestamps: true,
  indexes: [
    {
      fields: ['systemId']
    },
    {
      fields: ['name']
    },
    {
      fields: ['version']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['createdBy']
    },
    {
      unique: true,
      fields: ['systemId', 'name', 'version']
    }
  ],
  hooks: {
    beforeCreate: (schema) => {
      // 변경 로그 초기화
      if (!schema.changeLog) {
        schema.changeLog = [];
      }
      
      // 스키마 유효성 검증
      if (schema.columns && schema.columns.length > 0) {
        schema.columns.forEach((column, index) => {
          if (!column.name || !column.dataType) {
            throw new Error(`컬럼 ${index + 1}: 이름과 데이터 타입은 필수입니다.`);
          }
          
          // Universal type 자동 설정 (신규 컬럼의 경우)
          if (!column.universalType && column.dataType) {
            const { mapToUniversalType } = require('../constants/schemaTypes');
            // 기본적으로 MySQL 타입으로 가정, 추후 시스템 타입에 따라 동적으로 결정
            column.universalType = mapToUniversalType('mysql', column.dataType);
          }
        });
      }
    },
    beforeUpdate: (schema) => {
      // 변경 로그 추가
      if (schema.changed()) {
        const changes = [];
        const changedFields = schema.changed();
        
        changedFields.forEach(field => {
          changes.push({
            field,
            oldValue: schema._previousDataValues[field],
            newValue: schema[field],
            timestamp: new Date()
          });
        });
        
        if (changes.length > 0) {
          const currentLog = schema.changeLog || [];
          schema.changeLog = [...currentLog, ...changes];
        }
      }
    }
  }
});

// 연관 관계 정의
DataSchema.associate = (models) => {
  DataSchema.belongsTo(models.System, {
    foreignKey: 'systemId',
    as: 'system'
  });
  
  DataSchema.belongsTo(models.User, {
    foreignKey: 'createdBy',
    as: 'creator'
  });
  
  DataSchema.belongsTo(models.User, {
    foreignKey: 'updatedBy',
    as: 'updater'
  });
  
  // 스키마는 여러 매핑의 소스나 타겟이 될 수 있음
  DataSchema.hasMany(models.Mapping, {
    foreignKey: 'sourceSchemaId',
    as: 'sourceMappings'
  });
  
  DataSchema.hasMany(models.Mapping, {
    foreignKey: 'targetSchemaId',
    as: 'targetMappings'
  });
};

// 인스턴스 메서드
DataSchema.prototype.getColumnByName = function(columnName) {
  return this.columns.find(col => col.name === columnName);
};

DataSchema.prototype.addColumn = function(columnDefinition) {
  this.columns = [...this.columns, columnDefinition];
};

DataSchema.prototype.removeColumn = function(columnName) {
  this.columns = this.columns.filter(col => col.name !== columnName);
};

DataSchema.prototype.updateColumn = function(columnName, updates) {
  const index = this.columns.findIndex(col => col.name === columnName);
  if (index !== -1) {
    this.columns[index] = { ...this.columns[index], ...updates };
  }
};

DataSchema.prototype.getPrimaryKeyColumns = function() {
  return this.columns.filter(col => col.primaryKey);
};

DataSchema.prototype.getRequiredColumns = function() {
  return this.columns.filter(col => !col.nullable);
};

DataSchema.prototype.validateSchema = function() {
  const errors = [];
  
  // 컬럼 이름 중복 검사
  const columnNames = this.columns.map(col => col.name);
  const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`중복된 컬럼명: ${duplicates.join(', ')}`);
  }
  
  // 기본키 검사
  const primaryKeys = this.getPrimaryKeyColumns();
  if (primaryKeys.length === 0) {
    errors.push('기본키가 정의되지 않았습니다.');
  }
  
  // 컬럼 정의 검사
  this.columns.forEach((column, index) => {
    if (!column.name || typeof column.name !== 'string') {
      errors.push(`컬럼 ${index + 1}: 컬럼명이 유효하지 않습니다.`);
    }
    
    if (!column.dataType) {
      errors.push(`컬럼 ${index + 1}: 데이터 타입이 정의되지 않았습니다.`);
    }
    
    // 예약어 검사
    const reservedWords = ['select', 'insert', 'update', 'delete', 'from', 'where', 'order', 'by', 'group'];
    if (reservedWords.includes(column.name.toLowerCase())) {
      errors.push(`컬럼 ${index + 1}: '${column.name}'은 예약어입니다.`);
    }
  });
  
  return errors;
};

DataSchema.prototype.compareWith = function(otherSchema) {
  const changes = {
    added: [],
    removed: [],
    modified: []
  };
  
  const thisColumns = this.columns || [];
  const otherColumns = otherSchema.columns || [];
  
  // 추가된 컬럼 찾기
  otherColumns.forEach(otherCol => {
    if (!thisColumns.find(col => col.name === otherCol.name)) {
      changes.added.push(otherCol);
    }
  });
  
  // 삭제된 컬럼 찾기
  thisColumns.forEach(thisCol => {
    if (!otherColumns.find(col => col.name === thisCol.name)) {
      changes.removed.push(thisCol);
    }
  });
  
  // 수정된 컬럼 찾기
  thisColumns.forEach(thisCol => {
    const otherCol = otherColumns.find(col => col.name === thisCol.name);
    if (otherCol) {
      const differences = [];
      
      if (thisCol.dataType !== otherCol.dataType) {
        differences.push({ field: 'dataType', from: thisCol.dataType, to: otherCol.dataType });
      }
      
      if (thisCol.nullable !== otherCol.nullable) {
        differences.push({ field: 'nullable', from: thisCol.nullable, to: otherCol.nullable });
      }
      
      if (thisCol.primaryKey !== otherCol.primaryKey) {
        differences.push({ field: 'primaryKey', from: thisCol.primaryKey, to: otherCol.primaryKey });
      }
      
      if (differences.length > 0) {
        changes.modified.push({
          column: thisCol.name,
          differences
        });
      }
    }
  });
  
  return changes;
};

// 클래스 메서드
DataSchema.findLatestVersion = async function(systemId, name) {
  return await this.findOne({
    where: { systemId, name },
    order: [['version', 'DESC']]
  });
};

DataSchema.findAllVersions = async function(systemId, name) {
  return await this.findAll({
    where: { systemId, name },
    order: [['version', 'DESC']]
  });
};

DataSchema.createNewVersion = async function(systemId, name, schemaData, userId) {
  const latestVersion = await this.findLatestVersion(systemId, name);
  const newVersion = latestVersion ? latestVersion.version + 1 : 1;
  
  return await this.create({
    ...schemaData,
    systemId,
    name,
    version: newVersion,
    createdBy: userId
  });
};

DataSchema.getDataTypes = function() {
  return [
    // 문자열 타입
    { value: 'VARCHAR', label: 'VARCHAR', category: 'string' },
    { value: 'CHAR', label: 'CHAR', category: 'string' },
    { value: 'TEXT', label: 'TEXT', category: 'string' },
    { value: 'LONGTEXT', label: 'LONGTEXT', category: 'string' },
    
    // 숫자 타입
    { value: 'INTEGER', label: 'INTEGER', category: 'number' },
    { value: 'BIGINT', label: 'BIGINT', category: 'number' },
    { value: 'DECIMAL', label: 'DECIMAL', category: 'number' },
    { value: 'FLOAT', label: 'FLOAT', category: 'number' },
    { value: 'DOUBLE', label: 'DOUBLE', category: 'number' },
    
    // 날짜/시간 타입
    { value: 'DATE', label: 'DATE', category: 'date' },
    { value: 'TIME', label: 'TIME', category: 'date' },
    { value: 'DATETIME', label: 'DATETIME', category: 'date' },
    { value: 'TIMESTAMP', label: 'TIMESTAMP', category: 'date' },
    
    // 불린 타입
    { value: 'BOOLEAN', label: 'BOOLEAN', category: 'boolean' },
    
    // 바이너리 타입
    { value: 'BLOB', label: 'BLOB', category: 'binary' },
    { value: 'BINARY', label: 'BINARY', category: 'binary' },
    
    // JSON 타입
    { value: 'JSON', label: 'JSON', category: 'json' },
    { value: 'JSONB', label: 'JSONB', category: 'json' },
    
    // 배열 타입
    { value: 'ARRAY', label: 'ARRAY', category: 'array' }
  ];
};

// Universal Schema 관련 새로운 메서드들
DataSchema.prototype.getColumnWithUniversalType = function(columnName) {
  const column = this.columns.find(col => col.name === columnName);
  if (column && !column.universalType) {
    const { mapToUniversalType } = require('../constants/schemaTypes');
    column.universalType = mapToUniversalType('mysql', column.dataType);
  }
  return column;
};

DataSchema.prototype.getCompatibleColumns = function(targetUniversalType) {
  const { isTypeCompatible } = require('../constants/schemaTypes');
  return this.columns.filter(col => {
    const colUniversalType = col.universalType || mapToUniversalType('mysql', col.dataType);
    return isTypeCompatible(colUniversalType, targetUniversalType);
  });
};

DataSchema.prototype.transformToUniversalSchema = function() {
  const { mapToUniversalType } = require('../constants/schemaTypes');
  const universalColumns = this.columns.map(col => ({
    ...col,
    universalType: col.universalType || mapToUniversalType('mysql', col.dataType),
    originalType: col.dataType
  }));
  
  return {
    ...this.toJSON(),
    columns: universalColumns
  };
};

DataSchema.getUniversalTypes = function() {
  const { UNIVERSAL_TYPES } = require('../constants/schemaTypes');
  return Object.entries(UNIVERSAL_TYPES).map(([key, value]) => ({
    value,
    label: key,
    category: getTypeCategory(value)
  }));
};

DataSchema.getSchemaFormats = function() {
  const { SCHEMA_FORMATS } = require('../constants/schemaTypes');
  return Object.entries(SCHEMA_FORMATS).map(([key, value]) => ({
    value,
    label: key.replace('_', ' ').toLowerCase()
  }));
};

// Helper function for categorizing universal types
function getTypeCategory(universalType) {
  const { UNIVERSAL_TYPES } = require('../constants/schemaTypes');
  const categories = {
    [UNIVERSAL_TYPES.STRING]: 'text',
    [UNIVERSAL_TYPES.TEXT]: 'text',
    [UNIVERSAL_TYPES.INTEGER]: 'numeric',
    [UNIVERSAL_TYPES.LONG]: 'numeric',
    [UNIVERSAL_TYPES.FLOAT]: 'numeric',
    [UNIVERSAL_TYPES.DOUBLE]: 'numeric',
    [UNIVERSAL_TYPES.DECIMAL]: 'numeric',
    [UNIVERSAL_TYPES.BOOLEAN]: 'boolean',
    [UNIVERSAL_TYPES.DATE]: 'datetime',
    [UNIVERSAL_TYPES.TIME]: 'datetime',
    [UNIVERSAL_TYPES.DATETIME]: 'datetime',
    [UNIVERSAL_TYPES.TIMESTAMP]: 'datetime',
    [UNIVERSAL_TYPES.BINARY]: 'binary',
    [UNIVERSAL_TYPES.ARRAY]: 'complex',
    [UNIVERSAL_TYPES.OBJECT]: 'complex',
    [UNIVERSAL_TYPES.MAP]: 'complex',
    [UNIVERSAL_TYPES.JSON]: 'complex',
    [UNIVERSAL_TYPES.XML]: 'complex'
  };
  return categories[universalType] || 'other';
}

module.exports = DataSchema;