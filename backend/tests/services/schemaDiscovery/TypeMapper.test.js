const { TypeMapper, UNIVERSAL_TYPES } = require('../../../services/schemaDiscovery/TypeMapper');

describe('TypeMapper', () => {
  let typeMapper;

  beforeEach(() => {
    typeMapper = new TypeMapper();
  });

  describe('Initialization', () => {
    it('should initialize with proper mappings', () => {
      expect(typeMapper.postgresqlMappings).toBeDefined();
      expect(typeMapper.mysqlMappings).toBeDefined();
      expect(typeMapper.defaultMappings).toBeDefined();
      
      expect(typeMapper.postgresqlMappings.size).toBeGreaterThan(0);
      expect(typeMapper.mysqlMappings.size).toBeGreaterThan(0);
      expect(typeMapper.defaultMappings.size).toBeGreaterThan(0);
    });

    it('should provide universal types constants', () => {
      const universalTypes = typeMapper.getUniversalTypes();
      
      expect(universalTypes).toHaveProperty('INTEGER');
      expect(universalTypes).toHaveProperty('VARCHAR');
      expect(universalTypes).toHaveProperty('TIMESTAMP');
      expect(universalTypes).toHaveProperty('BOOLEAN');
      expect(universalTypes).toHaveProperty('JSON');
    });
  });

  describe('PostgreSQL Type Mapping', () => {
    it('should map PostgreSQL integer types correctly', () => {
      const intResult = typeMapper.mapToUniversalType('integer', 'postgresql');
      expect(intResult.universalType).toBe(UNIVERSAL_TYPES.INTEGER);
      expect(intResult.systemType).toBe('postgresql');
      expect(intResult.mappingSource).toBe('postgresql');
      expect(intResult.confidence).toBe(0.95);

      const bigintResult = typeMapper.mapToUniversalType('bigint', 'postgresql');
      expect(bigintResult.universalType).toBe(UNIVERSAL_TYPES.BIGINT);

      const smallintResult = typeMapper.mapToUniversalType('int2', 'postgresql');
      expect(smallintResult.universalType).toBe(UNIVERSAL_TYPES.SMALLINT);
    });

    it('should map PostgreSQL string types correctly', () => {
      const varcharResult = typeMapper.mapToUniversalType('character varying', 'postgresql');
      expect(varcharResult.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);

      const charResult = typeMapper.mapToUniversalType('character', 'postgresql');
      expect(charResult.universalType).toBe(UNIVERSAL_TYPES.CHAR);

      const textResult = typeMapper.mapToUniversalType('text', 'postgresql');
      expect(textResult.universalType).toBe(UNIVERSAL_TYPES.TEXT);
    });

    it('should map PostgreSQL date/time types correctly', () => {
      const dateResult = typeMapper.mapToUniversalType('date', 'postgresql');
      expect(dateResult.universalType).toBe(UNIVERSAL_TYPES.DATE);

      const timestampResult = typeMapper.mapToUniversalType('timestamp without time zone', 'postgresql');
      expect(timestampResult.universalType).toBe(UNIVERSAL_TYPES.TIMESTAMP);

      const timeResult = typeMapper.mapToUniversalType('time with time zone', 'postgresql');
      expect(timeResult.universalType).toBe(UNIVERSAL_TYPES.TIME);
    });

    it('should map PostgreSQL special types correctly', () => {
      const boolResult = typeMapper.mapToUniversalType('boolean', 'postgresql');
      expect(boolResult.universalType).toBe(UNIVERSAL_TYPES.BOOLEAN);

      const jsonResult = typeMapper.mapToUniversalType('json', 'postgresql');
      expect(jsonResult.universalType).toBe(UNIVERSAL_TYPES.JSON);

      const jsonbResult = typeMapper.mapToUniversalType('jsonb', 'postgresql');
      expect(jsonbResult.universalType).toBe(UNIVERSAL_TYPES.JSONB);

      const uuidResult = typeMapper.mapToUniversalType('uuid', 'postgresql');
      expect(uuidResult.universalType).toBe(UNIVERSAL_TYPES.UUID);
    });

    it('should handle PostgreSQL array types', () => {
      const arrayResult = typeMapper.mapToUniversalType('integer[]', 'postgresql');
      expect(arrayResult.universalType).toBe(UNIVERSAL_TYPES.ARRAY);
    });
  });

  describe('MySQL Type Mapping', () => {
    it('should map MySQL integer types correctly', () => {
      const intResult = typeMapper.mapToUniversalType('int', 'mysql');
      expect(intResult.universalType).toBe(UNIVERSAL_TYPES.INTEGER);
      expect(intResult.systemType).toBe('mysql');
      expect(intResult.mappingSource).toBe('mysql');

      const bigintResult = typeMapper.mapToUniversalType('bigint', 'mysql');
      expect(bigintResult.universalType).toBe(UNIVERSAL_TYPES.BIGINT);

      const tinyintResult = typeMapper.mapToUniversalType('tinyint', 'mysql');
      expect(tinyintResult.universalType).toBe(UNIVERSAL_TYPES.SMALLINT);

      const mediumintResult = typeMapper.mapToUniversalType('mediumint', 'mysql');
      expect(mediumintResult.universalType).toBe(UNIVERSAL_TYPES.INTEGER);
    });

    it('should map MySQL string types correctly', () => {
      const varcharResult = typeMapper.mapToUniversalType('varchar', 'mysql');
      expect(varcharResult.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);

      const textResult = typeMapper.mapToUniversalType('text', 'mysql');
      expect(textResult.universalType).toBe(UNIVERSAL_TYPES.TEXT);

      const longtextResult = typeMapper.mapToUniversalType('longtext', 'mysql');
      expect(longtextResult.universalType).toBe(UNIVERSAL_TYPES.LONGTEXT);
    });

    it('should map MySQL boolean type correctly', () => {
      const boolResult = typeMapper.mapToUniversalType('tinyint(1)', 'mysql');
      expect(boolResult.universalType).toBe(UNIVERSAL_TYPES.BOOLEAN);
    });

    it('should map MySQL date/time types correctly', () => {
      const dateResult = typeMapper.mapToUniversalType('date', 'mysql');
      expect(dateResult.universalType).toBe(UNIVERSAL_TYPES.DATE);

      const datetimeResult = typeMapper.mapToUniversalType('datetime', 'mysql');
      expect(datetimeResult.universalType).toBe(UNIVERSAL_TYPES.DATETIME);

      const timestampResult = typeMapper.mapToUniversalType('timestamp', 'mysql');
      expect(timestampResult.universalType).toBe(UNIVERSAL_TYPES.TIMESTAMP);
    });
  });

  describe('Pattern Matching', () => {
    it('should handle types with parameters', () => {
      const varcharResult = typeMapper.mapToUniversalType('varchar(255)', 'postgresql');
      expect(varcharResult.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);

      const decimalResult = typeMapper.mapToUniversalType('decimal(10,2)', 'mysql');
      expect(decimalResult.universalType).toBe(UNIVERSAL_TYPES.DECIMAL);
    });

    it('should use pattern matching for variations', () => {
      // Test pattern matching with known system types that use patterns
      const varcharResult = typeMapper.mapToUniversalType('varchar(255)', 'postgresql');
      expect(varcharResult.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);

      const bigintResult = typeMapper.mapToUniversalType('bigint(20)', 'mysql');
      expect(bigintResult.universalType).toBe(UNIVERSAL_TYPES.BIGINT);
      
      // Test patterns that should work based on the regex patterns
      const charResult = typeMapper.mapToUniversalType('charlength', 'postgresql');
      expect(charResult.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);
      
      const intResult = typeMapper.mapToUniversalType('integerspecial', 'postgresql');
      expect(intResult.universalType).toBe(UNIVERSAL_TYPES.INTEGER);
    });

    it('should return UNKNOWN for unmappable types', () => {
      const unknownResult = typeMapper.mapToUniversalType('totallycustomtype', 'unknown');
      expect(unknownResult.universalType).toBe(UNIVERSAL_TYPES.UNKNOWN);
      expect(unknownResult.confidence).toBe(0.0);
    });
  });

  describe('Type Metadata Handling', () => {
    it('should preserve type metadata in mapping result', () => {
      const metadata = {
        length: 255,
        precision: 10,
        scale: 2,
        nullable: true,
        defaultValue: 'test'
      };

      const result = typeMapper.mapToUniversalType('varchar', 'postgresql', metadata);
      
      expect(result.metadata.length).toBe(255);
      expect(result.metadata.precision).toBe(10);
      expect(result.metadata.scale).toBe(2);
      expect(result.metadata.nullable).toBe(true);
      expect(result.metadata.defaultValue).toBe('test');
    });

    it('should handle missing or invalid metadata gracefully', () => {
      const result1 = typeMapper.mapToUniversalType('integer', 'postgresql');
      expect(result1.metadata).toBeDefined();

      const result2 = typeMapper.mapToUniversalType('integer', 'postgresql', null);
      expect(result2.metadata).toBeDefined();
    });
  });

  describe('Schema Mapping', () => {
    it('should map complete schema to universal format', () => {
      const nativeSchema = {
        name: 'public',
        tables: [
          {
            name: 'users',
            type: 'table',
            columns: [
              {
                name: 'id',
                dataType: 'integer',
                isNullable: false,
                isPrimaryKey: true
              },
              {
                name: 'email',
                dataType: 'varchar',
                characterMaximumLength: 255,
                isNullable: false
              },
              {
                name: 'created_at',
                dataType: 'timestamp',
                isNullable: true
              }
            ]
          }
        ]
      };

      const universalSchema = typeMapper.mapSchemaToUniversal(nativeSchema, 'postgresql');
      
      expect(universalSchema.name).toBe('public');
      expect(universalSchema.systemType).toBe('postgresql');
      expect(universalSchema.tables).toHaveLength(1);
      expect(universalSchema.metadata.totalTables).toBe(1);
      expect(universalSchema.metadata.totalColumns).toBe(3);

      const table = universalSchema.tables[0];
      expect(table.name).toBe('users');
      expect(table.columns).toHaveLength(3);

      const idColumn = table.columns[0];
      expect(idColumn.name).toBe('id');
      expect(idColumn.universalType).toBe(UNIVERSAL_TYPES.INTEGER);
      expect(idColumn.isPrimaryKey).toBe(true);
      expect(idColumn.nullable).toBe(false);

      const emailColumn = table.columns[1];
      expect(emailColumn.name).toBe('email');
      expect(emailColumn.universalType).toBe(UNIVERSAL_TYPES.VARCHAR);
      expect(emailColumn.length).toBe(255);

      const createdAtColumn = table.columns[2];
      expect(createdAtColumn.name).toBe('created_at');
      expect(createdAtColumn.universalType).toBe(UNIVERSAL_TYPES.TIMESTAMP);
      expect(createdAtColumn.nullable).toBe(true);
    });

    it('should handle invalid schema gracefully', () => {
      expect(() => {
        typeMapper.mapSchemaToUniversal(null, 'postgresql');
      }).toThrow('Invalid schema structure provided');

      expect(() => {
        typeMapper.mapSchemaToUniversal('invalid', 'postgresql');
      }).toThrow('Invalid schema structure provided');
    });
  });

  describe('Mapping Statistics', () => {
    it('should provide PostgreSQL mapping statistics', () => {
      const stats = typeMapper.getMappingStats('postgresql');
      
      expect(stats.systemType).toBe('postgresql');
      expect(stats.supportedTypes).toBeGreaterThan(0);
      expect(stats.universalTypesCovered).toBeGreaterThan(0);
      expect(Array.isArray(stats.mappings)).toBe(true);
      expect(stats.mappings.length).toBeGreaterThan(0);
    });

    it('should provide MySQL mapping statistics', () => {
      const stats = typeMapper.getMappingStats('mysql');
      
      expect(stats.systemType).toBe('mysql');
      expect(stats.supportedTypes).toBeGreaterThan(0);
      expect(stats.universalTypesCovered).toBeGreaterThan(0);
    });

    it('should provide default mapping statistics for unknown systems', () => {
      const stats = typeMapper.getMappingStats('unknown');
      
      expect(stats.systemType).toBe('unknown');
      expect(stats.supportedTypes).toBeGreaterThan(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should assign high confidence to known system mappings', () => {
      const pgResult = typeMapper.mapToUniversalType('integer', 'postgresql');
      expect(pgResult.confidence).toBe(0.95);

      const mysqlResult = typeMapper.mapToUniversalType('varchar', 'mysql');
      expect(mysqlResult.confidence).toBe(0.95);
    });

    it('should assign medium confidence to default mappings', () => {
      const defaultResult = typeMapper.mapToUniversalType('string', 'unknown');
      expect(defaultResult.confidence).toBe(0.7);
    });

    it('should assign zero confidence to unknown types', () => {
      const unknownResult = typeMapper.mapToUniversalType('invalidtype', 'postgresql');
      expect(unknownResult.confidence).toBe(0.0);
    });
  });
});