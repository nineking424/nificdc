const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MappingRule = sequelize.define('MappingRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  mappingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Mappings',
      key: 'id'
    }
  },
  sourceField: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: '소스 필드는 필수입니다.' }
    }
  },
  targetField: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: '타겟 필드는 필수입니다.' }
    }
  },
  mappingType: {
    type: DataTypes.ENUM('direct', 'transform', 'concat', 'split', 'lookup', 'formula', 'conditional'),
    allowNull: false,
    defaultValue: 'direct'
  },
  transformFunction: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '변환 함수명'
  },
  transformParams: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: '변환 함수 파라미터'
  },
  defaultValue: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '기본값'
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '필수 필드 여부'
  },
  condition: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '조건부 매핑 조건'
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: { args: [1], msg: '우선순위는 1 이상이어야 합니다.' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '규칙 설명'
  },
  sourceFieldType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '소스 필드 데이터 타입'
  },
  targetFieldType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '타겟 필드 데이터 타입'
  },
  validationRules: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '필드별 검증 규칙'
  },
  errorHandling: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      onError: 'skip', // skip, default, fail
      errorMessage: null
    },
    comment: '에러 처리 방식'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
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
  tableName: 'mapping_rules',
  timestamps: true,
  indexes: [
    {
      fields: ['mappingId']
    },
    {
      fields: ['sourceField']
    },
    {
      fields: ['targetField']
    },
    {
      fields: ['mappingType']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['isActive']
    },
    {
      unique: true,
      fields: ['mappingId', 'sourceField'],
      name: 'unique_mapping_source_field'
    }
  ],
  hooks: {
    beforeCreate: (rule) => {
      rule.validateRule();
    },
    beforeUpdate: (rule) => {
      if (rule.changed()) {
        rule.validateRule();
      }
    }
  }
});

// 연관 관계 정의
MappingRule.associate = (models) => {
  MappingRule.belongsTo(models.Mapping, {
    foreignKey: 'mappingId',
    as: 'mapping'
  });

  MappingRule.belongsTo(models.User, {
    foreignKey: 'createdBy',
    as: 'creator'
  });

  MappingRule.belongsTo(models.User, {
    foreignKey: 'updatedBy',
    as: 'updater'
  });
};

// 인스턴스 메서드
MappingRule.prototype.validateRule = function() {
  const errors = [];

  // 매핑 타입별 검증
  switch (this.mappingType) {
    case 'transform':
      if (!this.transformFunction) {
        errors.push('변환 매핑에는 변환 함수가 필요합니다.');
      }
      break;

    case 'concat':
      if (!this.transformParams || !this.transformParams.separator) {
        errors.push('연결 매핑에는 구분자가 필요합니다.');
      }
      break;

    case 'split':
      if (!this.transformParams || !this.transformParams.delimiter) {
        errors.push('분할 매핑에는 구분자가 필요합니다.');
      }
      if (!this.transformParams.index && this.transformParams.index !== 0) {
        errors.push('분할 매핑에는 인덱스가 필요합니다.');
      }
      break;

    case 'lookup':
      if (!this.transformParams || !this.transformParams.lookupTable) {
        errors.push('조회 매핑에는 조회 테이블이 필요합니다.');
      }
      break;

    case 'formula':
      if (!this.transformParams || !this.transformParams.formula) {
        errors.push('수식 매핑에는 수식이 필요합니다.');
      }
      break;

    case 'conditional':
      if (!this.condition || !this.condition.field) {
        errors.push('조건부 매핑에는 조건이 필요합니다.');
      }
      break;
  }

  // 데이터 타입 호환성 검증
  if (this.sourceFieldType && this.targetFieldType) {
    const compatibility = this.checkTypeCompatibility(this.sourceFieldType, this.targetFieldType);
    if (!compatibility.compatible && this.mappingType === 'direct') {
      errors.push(`직접 매핑에서 ${this.sourceFieldType}을 ${this.targetFieldType}로 변환할 수 없습니다.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
};

MappingRule.prototype.checkTypeCompatibility = function(sourceType, targetType) {
  const typeGroups = {
    numeric: ['int', 'integer', 'bigint', 'float', 'double', 'decimal', 'number'],
    string: ['string', 'varchar', 'char', 'text', 'nvarchar'],
    date: ['date', 'datetime', 'timestamp', 'time'],
    boolean: ['boolean', 'bool', 'bit'],
    json: ['json', 'jsonb', 'object']
  };

  const getTypeGroup = (type) => {
    const lowerType = type.toLowerCase();
    for (const [group, types] of Object.entries(typeGroups)) {
      if (types.includes(lowerType)) {
        return group;
      }
    }
    return 'unknown';
  };

  const sourceGroup = getTypeGroup(sourceType);
  const targetGroup = getTypeGroup(targetType);

  // 같은 그룹이면 호환 가능
  if (sourceGroup === targetGroup) {
    return { compatible: true, requiresTransform: false };
  }

  // 특정 변환 가능한 케이스들
  const compatibleTransforms = {
    'numeric': ['string'],
    'string': ['numeric', 'date', 'boolean'],
    'date': ['string'],
    'boolean': ['string', 'numeric'],
    'json': ['string']
  };

  if (compatibleTransforms[sourceGroup] && compatibleTransforms[sourceGroup].includes(targetGroup)) {
    return { compatible: true, requiresTransform: true };
  }

  return { compatible: false, requiresTransform: false };
};

MappingRule.prototype.generateTransformFunction = function() {
  const compatibility = this.checkTypeCompatibility(this.sourceFieldType, this.targetFieldType);
  
  if (!compatibility.compatible) {
    throw new Error(`${this.sourceFieldType}에서 ${this.targetFieldType}로 변환할 수 없습니다.`);
  }

  if (!compatibility.requiresTransform) {
    return null; // 변환 불필요
  }

  const sourceGroup = this.getTypeGroup(this.sourceFieldType);
  const targetGroup = this.getTypeGroup(this.targetFieldType);

  const transformFunctions = {
    'numeric_to_string': 'toString',
    'string_to_numeric': 'toNumber',
    'string_to_date': 'parseDate',
    'date_to_string': 'formatDate',
    'boolean_to_string': 'booleanToString',
    'string_to_boolean': 'parseBoolean',
    'json_to_string': 'jsonToString'
  };

  const transformKey = `${sourceGroup}_to_${targetGroup}`;
  return transformFunctions[transformKey] || null;
};

MappingRule.prototype.getTypeGroup = function(type) {
  const typeGroups = {
    numeric: ['int', 'integer', 'bigint', 'float', 'double', 'decimal', 'number'],
    string: ['string', 'varchar', 'char', 'text', 'nvarchar'],
    date: ['date', 'datetime', 'timestamp', 'time'],
    boolean: ['boolean', 'bool', 'bit'],
    json: ['json', 'jsonb', 'object']
  };

  const lowerType = type.toLowerCase();
  for (const [group, types] of Object.entries(typeGroups)) {
    if (types.includes(lowerType)) {
      return group;
    }
  }
  return 'unknown';
};

MappingRule.prototype.applyRule = function(sourceValue, context = {}) {
  try {
    // null/undefined 값 처리
    if (sourceValue === null || sourceValue === undefined) {
      if (this.defaultValue !== null && this.defaultValue !== undefined) {
        return this.defaultValue;
      }
      if (this.isRequired) {
        throw new Error(`필수 필드 '${this.sourceField}'에 값이 없습니다.`);
      }
      return null;
    }

    // 조건부 매핑 검사
    if (this.condition && !this.evaluateCondition(sourceValue, context)) {
      return this.defaultValue || null;
    }

    // 매핑 타입별 처리
    switch (this.mappingType) {
      case 'direct':
        return this.applyDirectMapping(sourceValue);
      case 'transform':
        return this.applyTransformMapping(sourceValue, context);
      case 'concat':
        return this.applyConcatMapping(sourceValue, context);
      case 'split':
        return this.applySplitMapping(sourceValue);
      case 'lookup':
        return this.applyLookupMapping(sourceValue, context);
      case 'formula':
        return this.applyFormulaMapping(sourceValue, context);
      case 'conditional':
        return this.applyConditionalMapping(sourceValue, context);
      default:
        return sourceValue;
    }
  } catch (error) {
    return this.handleError(error, sourceValue);
  }
};

MappingRule.prototype.applyDirectMapping = function(sourceValue) {
  return sourceValue;
};

MappingRule.prototype.applyTransformMapping = function(sourceValue, context) {
  const { transformFunction, transformParams } = this;
  
  // 미리 정의된 변환 함수 적용
  switch (transformFunction) {
    case 'toString':
      return String(sourceValue);
    case 'toNumber':
      return Number(sourceValue);
    case 'parseDate':
      return new Date(sourceValue);
    case 'formatDate':
      const format = transformParams.format || 'YYYY-MM-DD';
      return this.formatDate(new Date(sourceValue), format);
    case 'toLowerCase':
      return String(sourceValue).toLowerCase();
    case 'toUpperCase':
      return String(sourceValue).toUpperCase();
    case 'trim':
      return String(sourceValue).trim();
    default:
      // 사용자 정의 변환 함수 (추후 구현)
      return sourceValue;
  }
};

MappingRule.prototype.applyConcatMapping = function(sourceValue, context) {
  const { separator = '', fields = [] } = this.transformParams;
  
  if (fields.length === 0) {
    return sourceValue;
  }

  const values = fields.map(field => {
    return context.data && context.data[field] !== undefined ? context.data[field] : '';
  });

  return values.join(separator);
};

MappingRule.prototype.applySplitMapping = function(sourceValue) {
  const { delimiter, index = 0 } = this.transformParams;
  
  if (!delimiter) {
    return sourceValue;
  }

  const parts = String(sourceValue).split(delimiter);
  return parts[index] || '';
};

MappingRule.prototype.applyLookupMapping = function(sourceValue, context) {
  const { lookupTable, keyField, valueField } = this.transformParams;
  
  if (!lookupTable || !keyField || !valueField) {
    return sourceValue;
  }

  // 간단한 조회 로직 (실제로는 데이터베이스 조회)
  const lookupData = context.lookupData && context.lookupData[lookupTable];
  if (!lookupData) {
    return sourceValue;
  }

  const found = lookupData.find(item => item[keyField] === sourceValue);
  return found ? found[valueField] : sourceValue;
};

MappingRule.prototype.applyFormulaMapping = function(sourceValue, context) {
  const { formula } = this.transformParams;
  
  if (!formula) {
    return sourceValue;
  }

  try {
    // 간단한 수식 평가 (실제로는 더 안전한 평가기 사용)
    const evalContext = {
      value: sourceValue,
      ...context.data
    };

    // 기본 수학 함수들
    const mathFunctions = {
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      max: Math.max,
      min: Math.min,
      pow: Math.pow,
      sqrt: Math.sqrt
    };

    // 수식에서 사용할 수 있는 변수와 함수들
    const safeEval = new Function('context', 'math', `
      with(context) {
        with(math) {
          return ${formula};
        }
      }
    `);

    return safeEval(evalContext, mathFunctions);
  } catch (error) {
    throw new Error(`수식 평가 오류: ${error.message}`);
  }
};

MappingRule.prototype.applyConditionalMapping = function(sourceValue, context) {
  const { condition, trueValue, falseValue } = this.transformParams;
  
  if (!condition) {
    return sourceValue;
  }

  const conditionMet = this.evaluateCondition(sourceValue, context);
  return conditionMet ? trueValue : falseValue;
};

MappingRule.prototype.evaluateCondition = function(sourceValue, context) {
  const { field, operator, value } = this.condition;
  
  const compareValue = field === 'self' ? sourceValue : context.data[field];
  
  switch (operator) {
    case '==':
      return compareValue == value;
    case '===':
      return compareValue === value;
    case '!=':
      return compareValue != value;
    case '!==':
      return compareValue !== value;
    case '>':
      return compareValue > value;
    case '>=':
      return compareValue >= value;
    case '<':
      return compareValue < value;
    case '<=':
      return compareValue <= value;
    case 'contains':
      return String(compareValue).includes(String(value));
    case 'startsWith':
      return String(compareValue).startsWith(String(value));
    case 'endsWith':
      return String(compareValue).endsWith(String(value));
    case 'in':
      return Array.isArray(value) && value.includes(compareValue);
    case 'notIn':
      return Array.isArray(value) && !value.includes(compareValue);
    case 'isNull':
      return compareValue === null || compareValue === undefined;
    case 'isNotNull':
      return compareValue !== null && compareValue !== undefined;
    default:
      return false;
  }
};

MappingRule.prototype.handleError = function(error, sourceValue) {
  const { onError, errorMessage } = this.errorHandling;
  
  switch (onError) {
    case 'skip':
      return null;
    case 'default':
      return this.defaultValue || null;
    case 'fail':
      throw new Error(errorMessage || error.message);
    default:
      return sourceValue;
  }
};

MappingRule.prototype.formatDate = function(date, format) {
  if (!date || isNaN(date.getTime())) {
    return '';
  }

  const formatMap = {
    'YYYY': date.getFullYear(),
    'MM': String(date.getMonth() + 1).padStart(2, '0'),
    'DD': String(date.getDate()).padStart(2, '0'),
    'HH': String(date.getHours()).padStart(2, '0'),
    'mm': String(date.getMinutes()).padStart(2, '0'),
    'ss': String(date.getSeconds()).padStart(2, '0')
  };

  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => formatMap[match]);
};

// 클래스 메서드
MappingRule.getMappingTypes = function() {
  return [
    { value: 'direct', label: '직접 매핑', description: '필드 값을 그대로 복사' },
    { value: 'transform', label: '변환 매핑', description: '함수를 통한 값 변환' },
    { value: 'concat', label: '연결 매핑', description: '여러 필드를 연결' },
    { value: 'split', label: '분할 매핑', description: '하나의 필드를 여러 필드로 분할' },
    { value: 'lookup', label: '조회 매핑', description: '외부 데이터 조회' },
    { value: 'formula', label: '수식 매핑', description: '수식을 통한 계산' },
    { value: 'conditional', label: '조건부 매핑', description: '조건에 따른 값 설정' }
  ];
};

MappingRule.getTransformFunctions = function() {
  return [
    { value: 'toString', label: '문자열 변환', description: '값을 문자열로 변환' },
    { value: 'toNumber', label: '숫자 변환', description: '값을 숫자로 변환' },
    { value: 'parseDate', label: '날짜 파싱', description: '문자열을 날짜로 변환' },
    { value: 'formatDate', label: '날짜 포맷', description: '날짜를 지정된 형식으로 변환' },
    { value: 'toLowerCase', label: '소문자 변환', description: '문자열을 소문자로 변환' },
    { value: 'toUpperCase', label: '대문자 변환', description: '문자열을 대문자로 변환' },
    { value: 'trim', label: '공백 제거', description: '문자열 앞뒤 공백 제거' }
  ];
};

MappingRule.getConditionOperators = function() {
  return [
    { value: '==', label: '같음 (==)', description: '값이 같음' },
    { value: '===', label: '정확히 같음 (===)', description: '값과 타입이 모두 같음' },
    { value: '!=', label: '다름 (!=)', description: '값이 다름' },
    { value: '!==', label: '정확히 다름 (!==)', description: '값 또는 타입이 다름' },
    { value: '>', label: '크다 (>)', description: '값이 더 큼' },
    { value: '>=', label: '크거나 같다 (>=)', description: '값이 크거나 같음' },
    { value: '<', label: '작다 (<)', description: '값이 더 작음' },
    { value: '<=', label: '작거나 같다 (<=)', description: '값이 작거나 같음' },
    { value: 'contains', label: '포함', description: '문자열이 포함됨' },
    { value: 'startsWith', label: '시작', description: '문자열로 시작함' },
    { value: 'endsWith', label: '끝남', description: '문자열로 끝남' },
    { value: 'in', label: '포함됨', description: '배열에 포함됨' },
    { value: 'notIn', label: '포함되지 않음', description: '배열에 포함되지 않음' },
    { value: 'isNull', label: '비어있음', description: '값이 null 또는 undefined' },
    { value: 'isNotNull', label: '비어있지 않음', description: '값이 null이나 undefined가 아님' }
  ];
};

module.exports = MappingRule;