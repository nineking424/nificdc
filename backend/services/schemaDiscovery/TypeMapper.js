const logger = require('../../src/utils/logger');

/**
 * Universal Type Mapping Constants
 * 각 데이터베이스 시스템의 네이티브 타입을 Universal Type으로 매핑
 */
const UNIVERSAL_TYPES = {
  // Numeric types
  INTEGER: 'integer',
  BIGINT: 'bigint',
  SMALLINT: 'smallint',
  DECIMAL: 'decimal',
  NUMERIC: 'numeric',
  FLOAT: 'float',
  DOUBLE: 'double',
  REAL: 'real',
  
  // String types
  VARCHAR: 'varchar',
  CHAR: 'char',
  TEXT: 'text',
  LONGTEXT: 'longtext',
  
  // Date/Time types
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime',
  TIMESTAMP: 'timestamp',
  
  // Boolean type
  BOOLEAN: 'boolean',
  
  // Binary types
  BINARY: 'binary',
  VARBINARY: 'varbinary',
  BLOB: 'blob',
  
  // JSON type
  JSON: 'json',
  JSONB: 'jsonb',
  
  // Array type
  ARRAY: 'array',
  
  // UUID type
  UUID: 'uuid',
  
  // Unknown/Other
  UNKNOWN: 'unknown'
};

/**
 * Type Mapper Class
 * 다양한 시스템의 데이터 타입을 Universal Schema 형식으로 변환
 */
class TypeMapper {
  constructor() {
    // PostgreSQL type mappings
    this.postgresqlMappings = new Map([
      // Integer types
      ['integer', UNIVERSAL_TYPES.INTEGER],
      ['int4', UNIVERSAL_TYPES.INTEGER],
      ['int', UNIVERSAL_TYPES.INTEGER],
      ['bigint', UNIVERSAL_TYPES.BIGINT],
      ['int8', UNIVERSAL_TYPES.BIGINT],
      ['smallint', UNIVERSAL_TYPES.SMALLINT],
      ['int2', UNIVERSAL_TYPES.SMALLINT],
      
      // Decimal types
      ['decimal', UNIVERSAL_TYPES.DECIMAL],
      ['numeric', UNIVERSAL_TYPES.NUMERIC],
      ['real', UNIVERSAL_TYPES.REAL],
      ['float4', UNIVERSAL_TYPES.REAL],
      ['double precision', UNIVERSAL_TYPES.DOUBLE],
      ['float8', UNIVERSAL_TYPES.DOUBLE],
      
      // String types
      ['character varying', UNIVERSAL_TYPES.VARCHAR],
      ['varchar', UNIVERSAL_TYPES.VARCHAR],
      ['character', UNIVERSAL_TYPES.CHAR],
      ['char', UNIVERSAL_TYPES.CHAR],
      ['text', UNIVERSAL_TYPES.TEXT],
      
      // Date/Time types
      ['date', UNIVERSAL_TYPES.DATE],
      ['time', UNIVERSAL_TYPES.TIME],
      ['time without time zone', UNIVERSAL_TYPES.TIME],
      ['time with time zone', UNIVERSAL_TYPES.TIME],
      ['timestamp', UNIVERSAL_TYPES.TIMESTAMP],
      ['timestamp without time zone', UNIVERSAL_TYPES.TIMESTAMP],
      ['timestamp with time zone', UNIVERSAL_TYPES.TIMESTAMP],
      
      // Boolean type
      ['boolean', UNIVERSAL_TYPES.BOOLEAN],
      ['bool', UNIVERSAL_TYPES.BOOLEAN],
      
      // Binary types
      ['bytea', UNIVERSAL_TYPES.BINARY],
      
      // JSON types
      ['json', UNIVERSAL_TYPES.JSON],
      ['jsonb', UNIVERSAL_TYPES.JSONB],
      
      // Array types
      ['ARRAY', UNIVERSAL_TYPES.ARRAY],
      
      // UUID type
      ['uuid', UNIVERSAL_TYPES.UUID]
    ]);

    // MySQL type mappings
    this.mysqlMappings = new Map([
      // Integer types
      ['int', UNIVERSAL_TYPES.INTEGER],
      ['integer', UNIVERSAL_TYPES.INTEGER],
      ['bigint', UNIVERSAL_TYPES.BIGINT],
      ['smallint', UNIVERSAL_TYPES.SMALLINT],
      ['tinyint', UNIVERSAL_TYPES.SMALLINT],
      ['mediumint', UNIVERSAL_TYPES.INTEGER],
      
      // Decimal types
      ['decimal', UNIVERSAL_TYPES.DECIMAL],
      ['numeric', UNIVERSAL_TYPES.NUMERIC],
      ['float', UNIVERSAL_TYPES.FLOAT],
      ['double', UNIVERSAL_TYPES.DOUBLE],
      ['real', UNIVERSAL_TYPES.REAL],
      
      // String types
      ['varchar', UNIVERSAL_TYPES.VARCHAR],
      ['char', UNIVERSAL_TYPES.CHAR],
      ['text', UNIVERSAL_TYPES.TEXT],
      ['longtext', UNIVERSAL_TYPES.LONGTEXT],
      ['mediumtext', UNIVERSAL_TYPES.TEXT],
      ['tinytext', UNIVERSAL_TYPES.TEXT],
      
      // Date/Time types
      ['date', UNIVERSAL_TYPES.DATE],
      ['time', UNIVERSAL_TYPES.TIME],
      ['datetime', UNIVERSAL_TYPES.DATETIME],
      ['timestamp', UNIVERSAL_TYPES.TIMESTAMP],
      ['year', UNIVERSAL_TYPES.SMALLINT],
      
      // Boolean type (MySQL uses TINYINT(1))
      ['tinyint(1)', UNIVERSAL_TYPES.BOOLEAN],
      
      // Binary types
      ['binary', UNIVERSAL_TYPES.BINARY],
      ['varbinary', UNIVERSAL_TYPES.VARBINARY],
      ['blob', UNIVERSAL_TYPES.BLOB],
      ['longblob', UNIVERSAL_TYPES.BLOB],
      ['mediumblob', UNIVERSAL_TYPES.BLOB],
      ['tinyblob', UNIVERSAL_TYPES.BLOB],
      
      // JSON type (MySQL 5.7+)
      ['json', UNIVERSAL_TYPES.JSON],
      
      // Enum and Set (mapped to VARCHAR for universality)
      ['enum', UNIVERSAL_TYPES.VARCHAR],
      ['set', UNIVERSAL_TYPES.VARCHAR]
    ]);

    // Default type mappings for unknown systems
    this.defaultMappings = new Map([
      ['string', UNIVERSAL_TYPES.VARCHAR],
      ['number', UNIVERSAL_TYPES.NUMERIC],
      ['boolean', UNIVERSAL_TYPES.BOOLEAN],
      ['date', UNIVERSAL_TYPES.TIMESTAMP],
      ['object', UNIVERSAL_TYPES.JSON],
      ['array', UNIVERSAL_TYPES.ARRAY]
    ]);

    logger.debug('TypeMapper initialized', {
      postgresqlMappings: this.postgresqlMappings.size,
      mysqlMappings: this.mysqlMappings.size,
      defaultMappings: this.defaultMappings.size
    });
  }

  /**
   * Map a native type to Universal Type
   * @param {string} nativeType - Native type from source system
   * @param {string} systemType - Type of source system (postgresql, mysql, etc.)
   * @param {Object} typeMetadata - Additional type metadata (length, precision, etc.)
   * @returns {Object} Universal type mapping result
   */
  mapToUniversalType(nativeType, systemType, typeMetadata = {}) {
    if (!nativeType || typeof nativeType !== 'string') {
      return this.createTypeMappingResult(UNIVERSAL_TYPES.UNKNOWN, nativeType, systemType, typeMetadata);
    }

    const normalizedType = nativeType.toLowerCase().trim();
    let universalType = UNIVERSAL_TYPES.UNKNOWN;
    let mappingSource = 'unknown';

    // Select appropriate mapping based on system type
    let mappings;
    switch (systemType?.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        mappings = this.postgresqlMappings;
        mappingSource = 'postgresql';
        break;
      case 'mysql':
      case 'mariadb':
        mappings = this.mysqlMappings;
        mappingSource = 'mysql';
        break;
      default:
        mappings = this.defaultMappings;
        mappingSource = 'default';
        break;
    }

    // Try exact match first
    if (mappings.has(normalizedType)) {
      universalType = mappings.get(normalizedType);
    } else {
      // Try pattern matching for types with parameters
      universalType = this.findBestMatch(normalizedType, mappings, systemType);
    }

    return this.createTypeMappingResult(universalType, nativeType, systemType, typeMetadata, mappingSource);
  }

  /**
   * Find best matching type using pattern matching
   * @param {string} normalizedType - Normalized native type
   * @param {Map} mappings - Type mappings to search
   * @param {string} systemType - System type for specific logic
   * @returns {string} Best matching universal type
   */
  findBestMatch(normalizedType, mappings, systemType) {
    // Handle array types (PostgreSQL) first
    if (normalizedType.endsWith('[]')) {
      return UNIVERSAL_TYPES.ARRAY;
    }
    
    // Handle types with length/precision parameters
    // e.g., "varchar(255)", "decimal(10,2)", "tinyint(1)"
    
    // Extract base type without parameters
    const baseTypeMatch = normalizedType.match(/^([a-zA-Z_]+)/);
    if (baseTypeMatch) {
      const baseType = baseTypeMatch[1];
      
      // Check if base type exists in mappings
      if (mappings.has(baseType)) {
        return mappings.get(baseType);
      }
    }

    // Handle special cases for specific systems
    if (systemType?.toLowerCase() === 'mysql') {
      // MySQL TINYINT(1) is typically used as BOOLEAN
      if (normalizedType.includes('tinyint') && normalizedType.includes('(1)')) {
        return UNIVERSAL_TYPES.BOOLEAN;
      }
    }


    // Try partial matching for common patterns
    const patterns = [
      { pattern: /^(var)?char/, type: UNIVERSAL_TYPES.VARCHAR },
      { pattern: /^text/, type: UNIVERSAL_TYPES.TEXT },
      { pattern: /^(big)?int/, type: UNIVERSAL_TYPES.INTEGER },
      { pattern: /^decimal|numeric/, type: UNIVERSAL_TYPES.DECIMAL },
      { pattern: /^float|double|real/, type: UNIVERSAL_TYPES.FLOAT },
      { pattern: /^bool/, type: UNIVERSAL_TYPES.BOOLEAN },
      { pattern: /^timestamp|datetime/, type: UNIVERSAL_TYPES.TIMESTAMP },
      { pattern: /^date/, type: UNIVERSAL_TYPES.DATE },
      { pattern: /^time/, type: UNIVERSAL_TYPES.TIME },
      { pattern: /^json/, type: UNIVERSAL_TYPES.JSON },
      { pattern: /^blob|binary/, type: UNIVERSAL_TYPES.BINARY }
    ];

    for (const { pattern, type } of patterns) {
      if (pattern.test(normalizedType)) {
        return type;
      }
    }

    return UNIVERSAL_TYPES.UNKNOWN;
  }

  /**
   * Create a standardized type mapping result
   * @param {string} universalType - Mapped universal type
   * @param {string} nativeType - Original native type
   * @param {string} systemType - Source system type
   * @param {Object} typeMetadata - Type metadata
   * @param {string} mappingSource - Source of the mapping
   * @returns {Object} Type mapping result
   */
  createTypeMappingResult(universalType, nativeType, systemType, typeMetadata = {}, mappingSource = 'unknown') {
    // Ensure typeMetadata is an object
    const metadata = typeMetadata || {};
    
    return {
      universalType,
      nativeType,
      systemType,
      mappingSource,
      metadata: {
        length: metadata.length,
        precision: metadata.precision,
        scale: metadata.scale,
        nullable: metadata.nullable,
        defaultValue: metadata.defaultValue,
        ...metadata
      },
      confidence: this.calculateMappingConfidence(universalType, nativeType, mappingSource)
    };
  }

  /**
   * Calculate confidence score for type mapping
   * @param {string} universalType - Mapped universal type
   * @param {string} nativeType - Original native type
   * @param {string} mappingSource - Source of the mapping
   * @returns {number} Confidence score (0-1)
   */
  calculateMappingConfidence(universalType, nativeType, mappingSource) {
    if (universalType === UNIVERSAL_TYPES.UNKNOWN) {
      return 0.0;
    }

    switch (mappingSource) {
      case 'postgresql':
      case 'mysql':
        return 0.95; // High confidence for known system mappings
      case 'default':
        return 0.7;  // Medium confidence for default mappings
      default:
        return 0.5;  // Low confidence for pattern-based mappings
    }
  }

  /**
   * Map a complete schema structure to Universal Schema format
   * @param {Object} schema - Native schema structure
   * @param {string} systemType - Source system type
   * @returns {Object} Universal schema structure
   */
  mapSchemaToUniversal(schema, systemType) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid schema structure provided');
    }

    const universalSchema = {
      name: schema.name || schema.schemaName,
      systemType,
      tables: [],
      metadata: {
        mappedAt: new Date(),
        originalSystemType: systemType,
        totalTables: 0,
        totalColumns: 0
      }
    };

    // Map tables
    if (schema.tables && Array.isArray(schema.tables)) {
      universalSchema.tables = schema.tables.map(table => this.mapTableToUniversal(table, systemType));
      universalSchema.metadata.totalTables = universalSchema.tables.length;
      universalSchema.metadata.totalColumns = universalSchema.tables.reduce(
        (sum, table) => sum + (table.columns?.length || 0), 0
      );
    }

    return universalSchema;
  }

  /**
   * Map a table structure to Universal format
   * @param {Object} table - Native table structure
   * @param {string} systemType - Source system type
   * @returns {Object} Universal table structure
   */
  mapTableToUniversal(table, systemType) {
    const universalTable = {
      name: table.name || table.tableName,
      type: table.type || 'table', // table, view, etc.
      columns: [],
      indexes: table.indexes || [],
      constraints: table.constraints || [],
      metadata: {
        rowCount: table.rowCount,
        size: table.size,
        lastModified: table.lastModified
      }
    };

    // Map columns
    if (table.columns && Array.isArray(table.columns)) {
      universalTable.columns = table.columns.map(column => this.mapColumnToUniversal(column, systemType));
    }

    return universalTable;
  }

  /**
   * Map a column structure to Universal format
   * @param {Object} column - Native column structure
   * @param {string} systemType - Source system type
   * @returns {Object} Universal column structure
   */
  mapColumnToUniversal(column, systemType) {
    const typeMapping = this.mapToUniversalType(column.dataType || column.type, systemType, {
      length: column.characterMaximumLength || column.length,
      precision: column.numericPrecision || column.precision,
      scale: column.numericScale || column.scale,
      nullable: column.isNullable !== false,
      defaultValue: column.columnDefault || column.defaultValue
    });

    return {
      name: column.name || column.columnName,
      universalType: typeMapping.universalType,
      nativeType: typeMapping.nativeType,
      nullable: typeMapping.metadata.nullable,
      defaultValue: typeMapping.metadata.defaultValue,
      length: typeMapping.metadata.length,
      precision: typeMapping.metadata.precision,
      scale: typeMapping.metadata.scale,
      isPrimaryKey: column.isPrimaryKey || false,
      isForeignKey: column.isForeignKey || false,
      isUnique: column.isUnique || false,
      ordinalPosition: column.ordinalPosition || column.position,
      comment: column.comment || column.description,
      typeMapping: {
        confidence: typeMapping.confidence,
        mappingSource: typeMapping.mappingSource,
        originalMetadata: typeMapping.metadata
      }
    };
  }

  /**
   * Get supported universal types
   * @returns {Object} Universal types constants
   */
  getUniversalTypes() {
    return { ...UNIVERSAL_TYPES };
  }

  /**
   * Get mapping statistics for a system type
   * @param {string} systemType - System type to get stats for
   * @returns {Object} Mapping statistics
   */
  getMappingStats(systemType) {
    let mappings;
    switch (systemType?.toLowerCase()) {
      case 'postgresql':
        mappings = this.postgresqlMappings;
        break;
      case 'mysql':
        mappings = this.mysqlMappings;
        break;
      default:
        mappings = this.defaultMappings;
        break;
    }

    return {
      systemType,
      supportedTypes: mappings.size,
      universalTypesCovered: new Set(mappings.values()).size,
      mappings: Array.from(mappings.entries()).map(([native, universal]) => ({
        native,
        universal
      }))
    };
  }
}

module.exports = { TypeMapper, UNIVERSAL_TYPES };