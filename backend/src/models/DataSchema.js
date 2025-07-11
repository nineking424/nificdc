const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const DataSchema = sequelize.define('DataSchema', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  systemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'systems',
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'system_id'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  schemaDefinition: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'schema_definition',
    validate: {
      notEmpty: true
    }
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
  tableName: 'data_schemas',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['system_id', 'name', 'version']
    },
    {
      fields: ['system_id']
    },
    {
      fields: ['name']
    },
    {
      fields: ['version']
    }
  ]
});

// 모델 연관관계 정의
DataSchema.associate = (models) => {
  DataSchema.belongsTo(models.System, {
    foreignKey: 'systemId',
    as: 'system',
    onDelete: 'CASCADE'
  });
  
  DataSchema.hasMany(models.Mapping, {
    foreignKey: 'sourceSchemaId',
    as: 'sourceMappings',
    onDelete: 'CASCADE'
  });
  
  DataSchema.hasMany(models.Mapping, {
    foreignKey: 'targetSchemaId',
    as: 'targetMappings',
    onDelete: 'CASCADE'
  });
};

// 인스턴스 메서드
DataSchema.prototype.getColumns = function() {
  const definition = this.schemaDefinition;
  if (definition && definition.columns) {
    return definition.columns;
  }
  return [];
};

DataSchema.prototype.getColumnNames = function() {
  return this.getColumns().map(col => col.name);
};

DataSchema.prototype.validateSchema = function() {
  const definition = this.schemaDefinition;
  
  if (!definition || typeof definition !== 'object') {
    throw new Error('Schema definition must be an object');
  }
  
  if (!definition.columns || !Array.isArray(definition.columns)) {
    throw new Error('Schema definition must have columns array');
  }
  
  if (definition.columns.length === 0) {
    throw new Error('Schema must have at least one column');
  }
  
  // 컬럼 이름 중복 검사
  const columnNames = definition.columns.map(col => col.name);
  const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate column names: ${duplicates.join(', ')}`);
  }
  
  // 각 컬럼 유효성 검사
  definition.columns.forEach(col => {
    if (!col.name || typeof col.name !== 'string') {
      throw new Error('Each column must have a valid name');
    }
    if (!col.type || typeof col.type !== 'string') {
      throw new Error(`Column ${col.name} must have a valid type`);
    }
  });
  
  return true;
};

// 정적 메서드
DataSchema.findBySystem = function(systemId) {
  return this.findAll({
    where: {
      systemId: systemId
    },
    order: [['name', 'ASC'], ['version', 'DESC']]
  });
};

DataSchema.findLatestVersion = function(systemId, schemaName) {
  return this.findOne({
    where: {
      systemId: systemId,
      name: schemaName
    },
    order: [['version', 'DESC']]
  });
};

DataSchema.createNextVersion = async function(systemId, schemaName, schemaDefinition, description) {
  const latest = await this.findLatestVersion(systemId, schemaName);
  const nextVersion = latest ? latest.version + 1 : 1;
  
  return this.create({
    systemId,
    name: schemaName,
    version: nextVersion,
    schemaDefinition,
    description
  });
};

DataSchema.compareSchemas = function(schema1, schema2) {
  const cols1 = schema1.getColumns();
  const cols2 = schema2.getColumns();
  
  const added = cols2.filter(col2 => !cols1.find(col1 => col1.name === col2.name));
  const removed = cols1.filter(col1 => !cols2.find(col2 => col2.name === col1.name));
  const modified = cols2.filter(col2 => {
    const col1 = cols1.find(col1 => col1.name === col2.name);
    return col1 && JSON.stringify(col1) !== JSON.stringify(col2);
  });
  
  return {
    added,
    removed,
    modified,
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0
  };
};

module.exports = DataSchema;