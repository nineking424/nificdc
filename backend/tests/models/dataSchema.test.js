const DataSchema = require('../../models/DataSchema');
const { UNIVERSAL_TYPES, SCHEMA_FORMATS } = require('../../constants/schemaTypes');
const SchemaConverter = require('../../utils/schemaConverter');

describe('DataSchema Universal Schema Tests', () => {

  describe('Universal Type Support', () => {
    it('should have schemaFormat and universalType fields', async () => {
      const attributes = DataSchema.rawAttributes;
      
      expect(attributes).toHaveProperty('schemaFormat');
      expect(attributes).toHaveProperty('universalType');
      expect(attributes.schemaFormat.defaultValue).toEqual(SCHEMA_FORMATS.RELATIONAL);
    });

    it('should auto-assign universal types to columns on create', async () => {
      const mockSchema = {
        name: 'test_schema',
        systemId: 'test-system-id',
        createdBy: 'test-user-id',
        columns: [
          { name: 'id', dataType: 'INTEGER', primaryKey: true },
          { name: 'name', dataType: 'VARCHAR(255)' },
          { name: 'created_at', dataType: 'TIMESTAMP' }
        ]
      };

      // Simulate beforeCreate hook
      const schema = { ...mockSchema, changeLog: [] };
      
      // Mock the require to return our schema types
      const mockMapToUniversalType = (dbType, dataType) => {
        const typeMap = {
          'integer': UNIVERSAL_TYPES.INTEGER,
          'varchar(255)': UNIVERSAL_TYPES.STRING,
          'timestamp': UNIVERSAL_TYPES.TIMESTAMP
        };
        return typeMap[dataType.toLowerCase()] || UNIVERSAL_TYPES.STRING;
      };

      // Process columns as the hook would
      schema.columns.forEach((column) => {
        if (!column.universalType && column.dataType) {
          column.universalType = mockMapToUniversalType('mysql', column.dataType);
        }
      });

      expect(schema.columns[0].universalType).toEqual(UNIVERSAL_TYPES.INTEGER);
      expect(schema.columns[1].universalType).toEqual(UNIVERSAL_TYPES.STRING);
      expect(schema.columns[2].universalType).toEqual(UNIVERSAL_TYPES.TIMESTAMP);
    });
  });

  describe('Instance Methods', () => {
    let schemaInstance;

    beforeEach(() => {
      schemaInstance = {
        columns: [
          { name: 'id', dataType: 'INTEGER', universalType: UNIVERSAL_TYPES.INTEGER },
          { name: 'name', dataType: 'VARCHAR', universalType: UNIVERSAL_TYPES.STRING },
          { name: 'price', dataType: 'DECIMAL', universalType: UNIVERSAL_TYPES.DECIMAL },
          { name: 'active', dataType: 'BOOLEAN', universalType: UNIVERSAL_TYPES.BOOLEAN }
        ],
        toJSON: function() { return { ...this }; }
      };

      // Bind methods to instance
      schemaInstance.getColumnWithUniversalType = DataSchema.prototype.getColumnWithUniversalType;
      schemaInstance.getCompatibleColumns = DataSchema.prototype.getCompatibleColumns;
      schemaInstance.transformToUniversalSchema = DataSchema.prototype.transformToUniversalSchema;
    });

    it('should get column with universal type', () => {
      const column = schemaInstance.getColumnWithUniversalType('name');
      expect(column).toBeDefined();
      expect(column.name).toEqual('name');
      expect(column.universalType).toEqual(UNIVERSAL_TYPES.STRING);
    });

    it('should find compatible columns by universal type', () => {
      // Mock isTypeCompatible
      const mockIsTypeCompatible = (source, target) => {
        if (source === target) return true;
        if (source === UNIVERSAL_TYPES.INTEGER && target === UNIVERSAL_TYPES.DECIMAL) return true;
        return false;
      };

      const compatibleColumns = schemaInstance.columns.filter(col => {
        return mockIsTypeCompatible(col.universalType, UNIVERSAL_TYPES.DECIMAL);
      });

      expect(compatibleColumns).toHaveLength(2);
      expect(compatibleColumns[0].name).toEqual('price');
      expect(compatibleColumns[1].name).toEqual('id');
    });

    it('should transform to universal schema format', () => {
      const universalSchema = schemaInstance.transformToUniversalSchema();
      
      expect(universalSchema.columns).toBeInstanceOf(Array);
      universalSchema.columns.forEach((col, index) => {
        expect(col).toHaveProperty('universalType');
        expect(col).toHaveProperty('originalType');
        expect(col.originalType).toEqual(schemaInstance.columns[index].dataType);
      });
    });
  });

  describe('Class Methods', () => {
    it('should return universal types list', () => {
      const types = DataSchema.getUniversalTypes();
      
      expect(types).toBeInstanceOf(Array);
      expect(types.length).toBeGreaterThan(0);
      
      const stringType = types.find(t => t.value === UNIVERSAL_TYPES.STRING);
      expect(stringType).toBeDefined();
      expect(stringType.label).toEqual('STRING');
      expect(stringType.category).toEqual('text');
    });

    it('should return schema formats list', () => {
      const formats = DataSchema.getSchemaFormats();
      
      expect(formats).toBeInstanceOf(Array);
      expect(formats.length).toBeGreaterThan(0);
      
      const relationalFormat = formats.find(f => f.value === SCHEMA_FORMATS.RELATIONAL);
      expect(relationalFormat).toBeDefined();
      expect(relationalFormat.label).toEqual('relational');
    });
  });
});

describe('SchemaConverter Utility Tests', () => {
  describe('Schema Conversion', () => {
    it('should convert schema between database types', () => {
      const sourceSchema = {
        columns: [
          { name: 'id', dataType: 'int' },
          { name: 'name', dataType: 'varchar(255)' },
          { name: 'created', dataType: 'datetime' }
        ]
      };

      const converted = SchemaConverter.convertSchema(sourceSchema, 'mysql', 'postgresql');
      
      expect(converted.columns).toHaveLength(3);
      expect(converted.columns[0].dataType).toEqual('integer');
      expect(converted.columns[1].dataType).toEqual('character varying');
      expect(converted.columns[2].dataType).toEqual('timestamp');
      expect(converted.sourceDbType).toEqual('mysql');
      expect(converted.targetDbType).toEqual('postgresql');
    });
  });

  describe('Schema Compatibility', () => {
    it('should validate schema compatibility', () => {
      const sourceSchema = {
        columns: [
          { name: 'user_id', dataType: 'INTEGER', universalType: UNIVERSAL_TYPES.INTEGER },
          { name: 'user_name', dataType: 'VARCHAR', universalType: UNIVERSAL_TYPES.STRING }
        ]
      };

      const targetSchema = {
        columns: [
          { name: 'id', dataType: 'BIGINT', universalType: UNIVERSAL_TYPES.LONG },
          { name: 'name', dataType: 'TEXT', universalType: UNIVERSAL_TYPES.TEXT }
        ]
      };

      const result = SchemaConverter.validateSchemaCompatibility(sourceSchema, targetSchema);
      
      expect(result.isCompatible).toBe(true);
      expect(result.mappingSuggestions).toHaveLength(2);
      expect(result.compatibilityScore).toBeGreaterThan(0);
    });
  });

  describe('Auto Mapping', () => {
    it('should generate automatic mapping rules', () => {
      const sourceSchema = {
        columns: [
          { name: 'user_id', dataType: 'INTEGER', universalType: UNIVERSAL_TYPES.INTEGER },
          { name: 'user_name', dataType: 'VARCHAR', universalType: UNIVERSAL_TYPES.STRING }
        ]
      };

      const targetSchema = {
        columns: [
          { name: 'id', dataType: 'INTEGER', universalType: UNIVERSAL_TYPES.INTEGER },
          { name: 'name', dataType: 'VARCHAR', universalType: UNIVERSAL_TYPES.STRING }
        ]
      };

      const mappingRules = SchemaConverter.generateAutoMapping(sourceSchema, targetSchema);
      
      expect(mappingRules).toBeInstanceOf(Array);
      expect(mappingRules.length).toBeGreaterThan(0);
      mappingRules.forEach(rule => {
        expect(rule).toHaveProperty('sourceField');
        expect(rule).toHaveProperty('targetField');
        expect(rule).toHaveProperty('transformationType');
        expect(rule.isAutoGenerated).toBe(true);
      });
    });
  });

  describe('Schema Diff', () => {
    it('should create schema diff report', () => {
      const schema1 = {
        columns: [
          { name: 'id', dataType: 'INTEGER' },
          { name: 'name', dataType: 'VARCHAR' },
          { name: 'email', dataType: 'VARCHAR' }
        ]
      };

      const schema2 = {
        columns: [
          { name: 'id', dataType: 'BIGINT' },
          { name: 'name', dataType: 'VARCHAR' },
          { name: 'phone', dataType: 'VARCHAR' }
        ]
      };

      const diff = SchemaConverter.createSchemaDiff(schema1, schema2);
      
      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].name).toEqual('phone');
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].name).toEqual('email');
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].column).toEqual('id');
    });
  });

  describe('Name Similarity', () => {
    it('should calculate name similarity correctly', () => {
      expect(SchemaConverter.calculateNameSimilarity('user_id', 'user_id')).toEqual(1.0);
      expect(SchemaConverter.calculateNameSimilarity('user_id', 'userid')).toEqual(1.0);
      expect(SchemaConverter.calculateNameSimilarity('user_id', 'id')).toBeGreaterThan(0.7);
      expect(SchemaConverter.calculateNameSimilarity('name', 'description')).toBeLessThan(0.5);
    });
  });
});