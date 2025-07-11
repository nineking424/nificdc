const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mapping = sequelize.define('Mapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: '맵핑 이름은 필수입니다.' },
      len: { args: [1, 100], msg: '맵핑 이름은 1-100자 사이여야 합니다.' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  sourceSystemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Systems',
      key: 'id'
    }
  },
  targetSystemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Systems',
      key: 'id'
    }
  },
  sourceSchemaId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'DataSchemas',
      key: 'id'
    }
  },
  targetSchemaId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'DataSchemas',
      key: 'id'
    }
  },
  mappingType: {
    type: DataTypes.ENUM('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'),
    allowNull: false,
    defaultValue: 'one_to_one'
  },
  mappingRules: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: '컬럼 매핑 규칙 배열'
  },
  transformationScript: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JavaScript 변환 스크립트'
  },
  transformationConfig: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: '변환 설정 (함수 라이브러리, 변수 등)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: { args: [1], msg: '버전은 1 이상이어야 합니다.' }
    }
  },
  parentMappingId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Mappings',
      key: 'id'
    },
    comment: '부모 맵핑 ID (버전 관리용)'
  },
  validationRules: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '데이터 검증 규칙'
  },
  executionStats: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: '실행 통계 (처리 시간, 에러율 등)'
  },
  lastExecutedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastExecutionStatus: {
    type: DataTypes.ENUM('success', 'failed', 'partial'),
    allowNull: true
  },
  lastExecutionError: {
    type: DataTypes.TEXT,
    allowNull: true
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
  tableName: 'mappings',
  timestamps: true,
  indexes: [
    {
      fields: ['sourceSystemId']
    },
    {
      fields: ['targetSystemId']
    },
    {
      fields: ['sourceSchemaId']
    },
    {
      fields: ['targetSchemaId']
    },
    {
      fields: ['mappingType']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['version']
    },
    {
      fields: ['parentMappingId']
    },
    {
      fields: ['createdBy']
    }
  ],
  hooks: {
    beforeCreate: (mapping) => {
      // 매핑 규칙 기본 검증
      if (!mapping.mappingRules || mapping.mappingRules.length === 0) {
        throw new Error('매핑 규칙은 최소 하나 이상이어야 합니다.');
      }
      
      // 변환 스크립트 기본 검증
      if (mapping.transformationScript) {
        const scriptValidation = mapping.validateTransformationScript();
        if (!scriptValidation.valid) {
          throw new Error(`변환 스크립트 오류: ${scriptValidation.errors.join(', ')}`);
        }
      }
    },
    beforeUpdate: (mapping) => {
      if (mapping.changed('transformationScript') && mapping.transformationScript) {
        const scriptValidation = mapping.validateTransformationScript();
        if (!scriptValidation.valid) {
          throw new Error(`변환 스크립트 오류: ${scriptValidation.errors.join(', ')}`);
        }
      }
    }
  }
});

// 연관 관계 정의
Mapping.associate = (models) => {
  Mapping.belongsTo(models.System, {
    foreignKey: 'sourceSystemId',
    as: 'sourceSystem'
  });
  
  Mapping.belongsTo(models.System, {
    foreignKey: 'targetSystemId',
    as: 'targetSystem'
  });
  
  Mapping.belongsTo(models.DataSchema, {
    foreignKey: 'sourceSchemaId',
    as: 'sourceSchema'
  });
  
  Mapping.belongsTo(models.DataSchema, {
    foreignKey: 'targetSchemaId',
    as: 'targetSchema'
  });
  
  Mapping.belongsTo(models.User, {
    foreignKey: 'createdBy',
    as: 'creator'
  });
  
  Mapping.belongsTo(models.User, {
    foreignKey: 'updatedBy',
    as: 'updater'
  });
  
  // 자기 참조 관계 (버전 관리)
  Mapping.belongsTo(models.Mapping, {
    foreignKey: 'parentMappingId',
    as: 'parentMapping'
  });
  
  Mapping.hasMany(models.Mapping, {
    foreignKey: 'parentMappingId',
    as: 'childMappings'
  });
  
  // 작업과의 관계
  Mapping.hasMany(models.Job, {
    foreignKey: 'mappingId',
    as: 'jobs'
  });
};

// 인스턴스 메서드
Mapping.prototype.validateMappingRules = function() {
  const errors = [];
  
  if (!this.mappingRules || this.mappingRules.length === 0) {
    errors.push('매핑 규칙이 정의되지 않았습니다.');
    return { valid: false, errors };
  }
  
  this.mappingRules.forEach((rule, index) => {
    // 필수 필드 검증
    if (!rule.sourceField) {
      errors.push(`규칙 ${index + 1}: 소스 필드가 정의되지 않았습니다.`);
    }
    
    if (!rule.targetField) {
      errors.push(`규칙 ${index + 1}: 타겟 필드가 정의되지 않았습니다.`);
    }
    
    // 매핑 타입 검증
    const validMappingTypes = ['direct', 'transform', 'concat', 'split', 'lookup', 'formula'];
    if (!rule.mappingType || !validMappingTypes.includes(rule.mappingType)) {
      errors.push(`규칙 ${index + 1}: 유효하지 않은 매핑 타입입니다.`);
    }
    
    // 변환 함수 검증
    if (rule.mappingType === 'transform' && !rule.transformFunction) {
      errors.push(`규칙 ${index + 1}: 변환 함수가 정의되지 않았습니다.`);
    }
    
    // 조건부 매핑 검증
    if (rule.condition && !rule.condition.field) {
      errors.push(`규칙 ${index + 1}: 조건부 매핑의 조건 필드가 정의되지 않았습니다.`);
    }
  });
  
  return { valid: errors.length === 0, errors };
};

Mapping.prototype.validateTransformationScript = function() {
  const errors = [];
  
  if (!this.transformationScript) {
    return { valid: true, errors };
  }
  
  try {
    // 기본 구문 검사
    new Function(this.transformationScript);
    
    // 위험한 코드 패턴 검사
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /process\./,
      /global\./,
      /__dirname/,
      /__filename/,
      /fs\./,
      /child_process/,
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout/,
      /setInterval/
    ];
    
    dangerousPatterns.forEach(pattern => {
      if (pattern.test(this.transformationScript)) {
        errors.push(`보안상 위험한 코드 패턴이 감지되었습니다: ${pattern.source}`);
      }
    });
    
  } catch (syntaxError) {
    errors.push(`구문 오류: ${syntaxError.message}`);
  }
  
  return { valid: errors.length === 0, errors };
};

Mapping.prototype.getMappingRule = function(sourceField) {
  return this.mappingRules.find(rule => rule.sourceField === sourceField);
};

Mapping.prototype.addMappingRule = function(rule) {
  if (!this.mappingRules) {
    this.mappingRules = [];
  }
  
  // 중복 규칙 확인
  const existingRule = this.getMappingRule(rule.sourceField);
  if (existingRule) {
    throw new Error(`소스 필드 '${rule.sourceField}'에 대한 매핑 규칙이 이미 존재합니다.`);
  }
  
  this.mappingRules.push(rule);
};

Mapping.prototype.removeMappingRule = function(sourceField) {
  if (!this.mappingRules) return;
  
  this.mappingRules = this.mappingRules.filter(rule => rule.sourceField !== sourceField);
};

Mapping.prototype.updateMappingRule = function(sourceField, updates) {
  const ruleIndex = this.mappingRules.findIndex(rule => rule.sourceField === sourceField);
  if (ruleIndex !== -1) {
    this.mappingRules[ruleIndex] = { ...this.mappingRules[ruleIndex], ...updates };
  }
};

Mapping.prototype.getTargetFields = function() {
  if (!this.mappingRules) return [];
  
  return this.mappingRules.map(rule => rule.targetField).filter(Boolean);
};

Mapping.prototype.getSourceFields = function() {
  if (!this.mappingRules) return [];
  
  return this.mappingRules.map(rule => rule.sourceField).filter(Boolean);
};

Mapping.prototype.getMappingStatistics = function() {
  const rules = this.mappingRules || [];
  
  return {
    totalRules: rules.length,
    mappingTypes: rules.reduce((acc, rule) => {
      acc[rule.mappingType] = (acc[rule.mappingType] || 0) + 1;
      return acc;
    }, {}),
    hasTransformation: !!this.transformationScript,
    hasValidation: !!(this.validationRules && this.validationRules.length > 0),
    complexity: this.calculateComplexity()
  };
};

Mapping.prototype.calculateComplexity = function() {
  let complexity = 0;
  
  // 기본 복잡도
  complexity += (this.mappingRules || []).length;
  
  // 변환 스크립트 복잡도
  if (this.transformationScript) {
    complexity += Math.min(this.transformationScript.length / 100, 10);
  }
  
  // 매핑 타입별 복잡도
  (this.mappingRules || []).forEach(rule => {
    switch (rule.mappingType) {
      case 'direct':
        complexity += 1;
        break;
      case 'transform':
      case 'formula':
        complexity += 3;
        break;
      case 'concat':
      case 'split':
        complexity += 2;
        break;
      case 'lookup':
        complexity += 4;
        break;
      default:
        complexity += 1;
    }
  });
  
  return Math.min(complexity, 100); // 최대 100으로 제한
};

// 클래스 메서드
Mapping.findLatestVersion = async function(parentMappingId) {
  return await this.findOne({
    where: { parentMappingId },
    order: [['version', 'DESC']]
  });
};

Mapping.findAllVersions = async function(parentMappingId) {
  return await this.findAll({
    where: { parentMappingId },
    order: [['version', 'DESC']]
  });
};

Mapping.createNewVersion = async function(parentMappingId, mappingData, userId) {
  const latestVersion = await this.findLatestVersion(parentMappingId);
  const newVersion = latestVersion ? latestVersion.version + 1 : 1;
  
  return await this.create({
    ...mappingData,
    version: newVersion,
    parentMappingId,
    createdBy: userId
  });
};

Mapping.getMappingTypes = function() {
  return [
    { value: 'one_to_one', label: '1:1 매핑', description: '하나의 소스가 하나의 타겟으로' },
    { value: 'one_to_many', label: '1:N 매핑', description: '하나의 소스가 여러 타겟으로' },
    { value: 'many_to_one', label: 'N:1 매핑', description: '여러 소스가 하나의 타겟으로' },
    { value: 'many_to_many', label: 'N:N 매핑', description: '여러 소스가 여러 타겟으로' }
  ];
};

Mapping.getRuleMappingTypes = function() {
  return [
    { value: 'direct', label: '직접 매핑', description: '필드 값을 그대로 복사' },
    { value: 'transform', label: '변환 매핑', description: '함수를 통한 값 변환' },
    { value: 'concat', label: '연결 매핑', description: '여러 필드를 연결' },
    { value: 'split', label: '분할 매핑', description: '하나의 필드를 여러 필드로 분할' },
    { value: 'lookup', label: '조회 매핑', description: '외부 데이터 조회' },
    { value: 'formula', label: '수식 매핑', description: '수식을 통한 계산' }
  ];
};

module.exports = Mapping;