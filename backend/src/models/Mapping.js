const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Mapping = sequelize.define('Mapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  sourceSchemaId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'data_schemas',
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'source_schema_id'
  },
  targetSchemaId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'data_schemas',
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'target_schema_id'
  },
  mappingRules: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'mapping_rules',
    validate: {
      notEmpty: true
    }
  },
  transformationScript: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'transformation_script'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deleted_at'
  }
}, {
  tableName: 'mappings',
  timestamps: true,
  paranoid: true,
  underscored: true,
  validate: {
    differentSchemas() {
      if (this.sourceSchemaId === this.targetSchemaId) {
        throw new Error('Source and target schemas must be different');
      }
    }
  },
  indexes: [
    {
      fields: ['source_schema_id']
    },
    {
      fields: ['target_schema_id']
    }
  ]
});

// 모델 연관관계 정의
Mapping.associate = (models) => {
  Mapping.belongsTo(models.DataSchema, {
    foreignKey: 'sourceSchemaId',
    as: 'sourceSchema',
    onDelete: 'CASCADE'
  });
  
  Mapping.belongsTo(models.DataSchema, {
    foreignKey: 'targetSchemaId',
    as: 'targetSchema',
    onDelete: 'CASCADE'
  });
  
  Mapping.hasMany(models.Job, {
    foreignKey: 'mappingId',
    as: 'jobs',
    onDelete: 'CASCADE'
  });
};

// 인스턴스 메서드
Mapping.prototype.getFieldMappings = function() {
  const rules = this.mappingRules;
  if (rules && rules.fields) {
    return rules.fields;
  }
  return [];
};

Mapping.prototype.getTransformations = function() {
  const rules = this.mappingRules;
  if (rules && rules.transformations) {
    return rules.transformations;
  }
  return [];
};

Mapping.prototype.getFilters = function() {
  const rules = this.mappingRules;
  if (rules && rules.filters) {
    return rules.filters;
  }
  return [];
};

Mapping.prototype.validateMapping = async function() {
  const sourceSchema = await this.getSourceSchema();
  const targetSchema = await this.getTargetSchema();
  
  if (!sourceSchema || !targetSchema) {
    throw new Error('Source and target schemas must exist');
  }
  
  const sourceColumns = sourceSchema.getColumnNames();
  const targetColumns = targetSchema.getColumnNames();
  const fieldMappings = this.getFieldMappings();
  
  const errors = [];
  
  // 필드 매핑 유효성 검사
  fieldMappings.forEach(mapping => {
    if (!sourceColumns.includes(mapping.source)) {
      errors.push(`Source field '${mapping.source}' not found in source schema`);
    }
    if (!targetColumns.includes(mapping.target)) {
      errors.push(`Target field '${mapping.target}' not found in target schema`);
    }
  });
  
  // 필수 필드 검사
  const mappedTargetFields = fieldMappings.map(m => m.target);
  const targetRequiredFields = targetSchema.getColumns()
    .filter(col => col.nullable === false || col.required === true)
    .map(col => col.name);
  
  targetRequiredFields.forEach(field => {
    if (!mappedTargetFields.includes(field)) {
      errors.push(`Required target field '${field}' is not mapped`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: []
  };
};

Mapping.prototype.generateTransformationScript = function() {
  const fieldMappings = this.getFieldMappings();
  const transformations = this.getTransformations();
  const filters = this.getFilters();
  
  let script = 'SELECT\n';
  
  // 필드 매핑 생성
  const selectFields = fieldMappings.map(mapping => {
    let field = mapping.source;
    
    // 변환 함수 적용
    if (mapping.transform) {
      switch (mapping.transform) {
        case 'uppercase':
          field = `UPPER(${field})`;
          break;
        case 'lowercase':
          field = `LOWER(${field})`;
          break;
        case 'trim':
          field = `TRIM(${field})`;
          break;
        case 'cast_to_int':
          field = `CAST(${field} AS INTEGER)`;
          break;
        case 'cast_to_string':
          field = `CAST(${field} AS VARCHAR)`;
          break;
      }
    }
    
    return `  ${field} AS ${mapping.target}`;
  });
  
  script += selectFields.join(',\n');
  script += '\nFROM source_table';
  
  // 필터 조건 추가
  if (filters.length > 0) {
    script += '\nWHERE ';
    const conditions = filters.map(filter => {
      return `${filter.field} ${filter.operator} ${filter.value}`;
    });
    script += conditions.join(' AND ');
  }
  
  return script;
};

// 정적 메서드
Mapping.findBySchema = function(schemaId, isSource = true) {
  const field = isSource ? 'sourceSchemaId' : 'targetSchemaId';
  return this.findAll({
    where: {
      [field]: schemaId
    },
    include: [
      { model: sequelize.models.DataSchema, as: 'sourceSchema' },
      { model: sequelize.models.DataSchema, as: 'targetSchema' }
    ]
  });
};

Mapping.findWithSchemas = function(options = {}) {
  return this.findAll({
    ...options,
    include: [
      { 
        model: sequelize.models.DataSchema, 
        as: 'sourceSchema',
        include: [{ model: sequelize.models.System, as: 'system' }]
      },
      { 
        model: sequelize.models.DataSchema, 
        as: 'targetSchema',
        include: [{ model: sequelize.models.System, as: 'system' }]
      }
    ]
  });
};

Mapping.createFromTemplate = async function(templateData) {
  const { name, sourceSchemaId, targetSchemaId, description } = templateData;
  
  // 기본 매핑 규칙 생성
  const sourceSchema = await sequelize.models.DataSchema.findByPk(sourceSchemaId);
  const targetSchema = await sequelize.models.DataSchema.findByPk(targetSchemaId);
  
  if (!sourceSchema || !targetSchema) {
    throw new Error('Source and target schemas must exist');
  }
  
  const sourceColumns = sourceSchema.getColumnNames();
  const targetColumns = targetSchema.getColumnNames();
  
  // 이름이 같은 필드끼리 자동 매핑
  const autoMappings = sourceColumns
    .filter(col => targetColumns.includes(col))
    .map(col => ({
      source: col,
      target: col,
      transform: null
    }));
  
  const mappingRules = {
    fields: autoMappings,
    transformations: [],
    filters: []
  };
  
  return this.create({
    name,
    sourceSchemaId,
    targetSchemaId,
    mappingRules,
    description
  });
};

module.exports = Mapping;