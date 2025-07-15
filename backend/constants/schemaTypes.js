/**
 * Universal Schema Type Constants
 * 통합 스키마 타입 상수 정의
 */

// Universal data types that can map across different systems
const UNIVERSAL_TYPES = {
  // Text types
  STRING: 'STRING',
  TEXT: 'TEXT',
  
  // Numeric types
  INTEGER: 'INTEGER',
  LONG: 'LONG',
  FLOAT: 'FLOAT',
  DOUBLE: 'DOUBLE',
  DECIMAL: 'DECIMAL',
  
  // Boolean type
  BOOLEAN: 'BOOLEAN',
  
  // Date/Time types
  DATE: 'DATE',
  TIME: 'TIME',
  DATETIME: 'DATETIME',
  TIMESTAMP: 'TIMESTAMP',
  
  // Binary type
  BINARY: 'BINARY',
  
  // Complex types
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
  MAP: 'MAP',
  
  // Document types
  JSON: 'JSON',
  XML: 'XML'
};

// Schema format types
const SCHEMA_FORMATS = {
  RELATIONAL: 'relational',      // Traditional RDBMS
  DOCUMENT: 'document',          // MongoDB, CouchDB
  KEY_VALUE: 'key-value',        // Redis, DynamoDB
  COLUMNAR: 'columnar',          // Cassandra, HBase
  GRAPH: 'graph',               // Neo4j, Amazon Neptune
  TIME_SERIES: 'time-series',    // InfluxDB, TimescaleDB
  MESSAGE: 'message',            // Kafka, RabbitMQ
  FILE: 'file'                   // CSV, JSON, Parquet files
};

// Type mapping from various databases to universal types
const TYPE_MAPPINGS = {
  // PostgreSQL to Universal
  postgresql: {
    'character varying': UNIVERSAL_TYPES.STRING,
    'varchar': UNIVERSAL_TYPES.STRING,
    'character': UNIVERSAL_TYPES.STRING,
    'char': UNIVERSAL_TYPES.STRING,
    'text': UNIVERSAL_TYPES.TEXT,
    'integer': UNIVERSAL_TYPES.INTEGER,
    'bigint': UNIVERSAL_TYPES.LONG,
    'smallint': UNIVERSAL_TYPES.INTEGER,
    'decimal': UNIVERSAL_TYPES.DECIMAL,
    'numeric': UNIVERSAL_TYPES.DECIMAL,
    'real': UNIVERSAL_TYPES.FLOAT,
    'double precision': UNIVERSAL_TYPES.DOUBLE,
    'boolean': UNIVERSAL_TYPES.BOOLEAN,
    'date': UNIVERSAL_TYPES.DATE,
    'time': UNIVERSAL_TYPES.TIME,
    'timestamp': UNIVERSAL_TYPES.TIMESTAMP,
    'timestamp with time zone': UNIVERSAL_TYPES.TIMESTAMP,
    'bytea': UNIVERSAL_TYPES.BINARY,
    'json': UNIVERSAL_TYPES.JSON,
    'jsonb': UNIVERSAL_TYPES.JSON,
    'array': UNIVERSAL_TYPES.ARRAY,
    'uuid': UNIVERSAL_TYPES.STRING
  },
  
  // MySQL to Universal
  mysql: {
    'varchar': UNIVERSAL_TYPES.STRING,
    'char': UNIVERSAL_TYPES.STRING,
    'text': UNIVERSAL_TYPES.TEXT,
    'tinytext': UNIVERSAL_TYPES.TEXT,
    'mediumtext': UNIVERSAL_TYPES.TEXT,
    'longtext': UNIVERSAL_TYPES.TEXT,
    'int': UNIVERSAL_TYPES.INTEGER,
    'integer': UNIVERSAL_TYPES.INTEGER,
    'tinyint': UNIVERSAL_TYPES.INTEGER,
    'smallint': UNIVERSAL_TYPES.INTEGER,
    'mediumint': UNIVERSAL_TYPES.INTEGER,
    'bigint': UNIVERSAL_TYPES.LONG,
    'decimal': UNIVERSAL_TYPES.DECIMAL,
    'numeric': UNIVERSAL_TYPES.DECIMAL,
    'float': UNIVERSAL_TYPES.FLOAT,
    'double': UNIVERSAL_TYPES.DOUBLE,
    'bit': UNIVERSAL_TYPES.BOOLEAN,
    'boolean': UNIVERSAL_TYPES.BOOLEAN,
    'date': UNIVERSAL_TYPES.DATE,
    'time': UNIVERSAL_TYPES.TIME,
    'datetime': UNIVERSAL_TYPES.DATETIME,
    'timestamp': UNIVERSAL_TYPES.TIMESTAMP,
    'year': UNIVERSAL_TYPES.INTEGER,
    'binary': UNIVERSAL_TYPES.BINARY,
    'varbinary': UNIVERSAL_TYPES.BINARY,
    'blob': UNIVERSAL_TYPES.BINARY,
    'tinyblob': UNIVERSAL_TYPES.BINARY,
    'mediumblob': UNIVERSAL_TYPES.BINARY,
    'longblob': UNIVERSAL_TYPES.BINARY,
    'json': UNIVERSAL_TYPES.JSON
  },
  
  // MongoDB to Universal
  mongodb: {
    'string': UNIVERSAL_TYPES.STRING,
    'int': UNIVERSAL_TYPES.INTEGER,
    'long': UNIVERSAL_TYPES.LONG,
    'double': UNIVERSAL_TYPES.DOUBLE,
    'decimal': UNIVERSAL_TYPES.DECIMAL,
    'bool': UNIVERSAL_TYPES.BOOLEAN,
    'date': UNIVERSAL_TYPES.TIMESTAMP,
    'timestamp': UNIVERSAL_TYPES.TIMESTAMP,
    'binData': UNIVERSAL_TYPES.BINARY,
    'object': UNIVERSAL_TYPES.OBJECT,
    'array': UNIVERSAL_TYPES.ARRAY,
    'objectId': UNIVERSAL_TYPES.STRING,
    'null': UNIVERSAL_TYPES.STRING
  },
  
  // Kafka/Avro to Universal
  avro: {
    'string': UNIVERSAL_TYPES.STRING,
    'int': UNIVERSAL_TYPES.INTEGER,
    'long': UNIVERSAL_TYPES.LONG,
    'float': UNIVERSAL_TYPES.FLOAT,
    'double': UNIVERSAL_TYPES.DOUBLE,
    'boolean': UNIVERSAL_TYPES.BOOLEAN,
    'bytes': UNIVERSAL_TYPES.BINARY,
    'record': UNIVERSAL_TYPES.OBJECT,
    'array': UNIVERSAL_TYPES.ARRAY,
    'map': UNIVERSAL_TYPES.MAP
  }
};

// Reverse mapping from universal types to specific databases
const REVERSE_TYPE_MAPPINGS = {
  postgresql: {
    [UNIVERSAL_TYPES.STRING]: 'character varying',
    [UNIVERSAL_TYPES.TEXT]: 'text',
    [UNIVERSAL_TYPES.INTEGER]: 'integer',
    [UNIVERSAL_TYPES.LONG]: 'bigint',
    [UNIVERSAL_TYPES.FLOAT]: 'real',
    [UNIVERSAL_TYPES.DOUBLE]: 'double precision',
    [UNIVERSAL_TYPES.DECIMAL]: 'decimal',
    [UNIVERSAL_TYPES.BOOLEAN]: 'boolean',
    [UNIVERSAL_TYPES.DATE]: 'date',
    [UNIVERSAL_TYPES.TIME]: 'time',
    [UNIVERSAL_TYPES.DATETIME]: 'timestamp',
    [UNIVERSAL_TYPES.TIMESTAMP]: 'timestamp with time zone',
    [UNIVERSAL_TYPES.BINARY]: 'bytea',
    [UNIVERSAL_TYPES.ARRAY]: 'array',
    [UNIVERSAL_TYPES.OBJECT]: 'jsonb',
    [UNIVERSAL_TYPES.MAP]: 'jsonb',
    [UNIVERSAL_TYPES.JSON]: 'jsonb',
    [UNIVERSAL_TYPES.XML]: 'xml'
  },
  
  mysql: {
    [UNIVERSAL_TYPES.STRING]: 'varchar(255)',
    [UNIVERSAL_TYPES.TEXT]: 'text',
    [UNIVERSAL_TYPES.INTEGER]: 'int',
    [UNIVERSAL_TYPES.LONG]: 'bigint',
    [UNIVERSAL_TYPES.FLOAT]: 'float',
    [UNIVERSAL_TYPES.DOUBLE]: 'double',
    [UNIVERSAL_TYPES.DECIMAL]: 'decimal(10,2)',
    [UNIVERSAL_TYPES.BOOLEAN]: 'boolean',
    [UNIVERSAL_TYPES.DATE]: 'date',
    [UNIVERSAL_TYPES.TIME]: 'time',
    [UNIVERSAL_TYPES.DATETIME]: 'datetime',
    [UNIVERSAL_TYPES.TIMESTAMP]: 'timestamp',
    [UNIVERSAL_TYPES.BINARY]: 'blob',
    [UNIVERSAL_TYPES.ARRAY]: 'json',
    [UNIVERSAL_TYPES.OBJECT]: 'json',
    [UNIVERSAL_TYPES.MAP]: 'json',
    [UNIVERSAL_TYPES.JSON]: 'json',
    [UNIVERSAL_TYPES.XML]: 'text'
  }
};

// Helper functions
const mapToUniversalType = (databaseType, sourceType) => {
  const mapping = TYPE_MAPPINGS[databaseType];
  if (!mapping) {
    console.warn(`Unknown database type: ${databaseType}`);
    return UNIVERSAL_TYPES.STRING; // Default fallback
  }
  
  const normalizedType = sourceType.toLowerCase();
  return mapping[normalizedType] || UNIVERSAL_TYPES.STRING;
};

const mapFromUniversalType = (databaseType, universalType) => {
  const mapping = REVERSE_TYPE_MAPPINGS[databaseType];
  if (!mapping) {
    console.warn(`Unknown database type: ${databaseType}`);
    return 'text'; // Default fallback
  }
  
  return mapping[universalType] || 'text';
};

// Type compatibility check
const isTypeCompatible = (sourceUniversalType, targetUniversalType) => {
  // Same type is always compatible
  if (sourceUniversalType === targetUniversalType) return true;
  
  // Define compatibility rules
  const compatibilityRules = {
    [UNIVERSAL_TYPES.STRING]: [UNIVERSAL_TYPES.TEXT],
    [UNIVERSAL_TYPES.TEXT]: [UNIVERSAL_TYPES.STRING],
    [UNIVERSAL_TYPES.INTEGER]: [UNIVERSAL_TYPES.LONG, UNIVERSAL_TYPES.FLOAT, UNIVERSAL_TYPES.DOUBLE, UNIVERSAL_TYPES.DECIMAL],
    [UNIVERSAL_TYPES.LONG]: [UNIVERSAL_TYPES.DECIMAL],
    [UNIVERSAL_TYPES.FLOAT]: [UNIVERSAL_TYPES.DOUBLE, UNIVERSAL_TYPES.DECIMAL],
    [UNIVERSAL_TYPES.DOUBLE]: [UNIVERSAL_TYPES.DECIMAL],
    [UNIVERSAL_TYPES.DATE]: [UNIVERSAL_TYPES.DATETIME, UNIVERSAL_TYPES.TIMESTAMP],
    [UNIVERSAL_TYPES.TIME]: [UNIVERSAL_TYPES.DATETIME, UNIVERSAL_TYPES.TIMESTAMP],
    [UNIVERSAL_TYPES.DATETIME]: [UNIVERSAL_TYPES.TIMESTAMP],
    [UNIVERSAL_TYPES.JSON]: [UNIVERSAL_TYPES.OBJECT, UNIVERSAL_TYPES.MAP, UNIVERSAL_TYPES.TEXT],
    [UNIVERSAL_TYPES.OBJECT]: [UNIVERSAL_TYPES.JSON, UNIVERSAL_TYPES.MAP],
    [UNIVERSAL_TYPES.MAP]: [UNIVERSAL_TYPES.JSON, UNIVERSAL_TYPES.OBJECT]
  };
  
  const compatibleTypes = compatibilityRules[sourceUniversalType] || [];
  return compatibleTypes.includes(targetUniversalType);
};

module.exports = {
  UNIVERSAL_TYPES,
  SCHEMA_FORMATS,
  TYPE_MAPPINGS,
  REVERSE_TYPE_MAPPINGS,
  mapToUniversalType,
  mapFromUniversalType,
  isTypeCompatible
};