# Mapping Management Blueprint
## Universal Schema Mapping System for Multi-System Data Integration

### 1. Executive Summary

The Mapping Management system is a core component of NiFiCDC that enables users to define, manage, and execute schema mappings between heterogeneous data systems. It provides a unified interface for creating data transformation rules between any combination of supported systems (databases, file systems, message queues, cloud storage) while handling only structured data with predefined schemas.

### 2. System Architecture Overview

#### 2.1 Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web UI Layer                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │  Mapping    │  │   Schema     │  │ Transformation │        │
│  │  Designer   │  │   Viewer     │  │   Preview      │        │
│  └─────────────┘  └──────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │  Mapping    │  │   Schema     │  │ Transformation │        │
│  │    CRUD     │  │  Discovery   │  │   Validation   │        │
│  └─────────────┘  └──────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     Core Mapping Engine                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │   Schema    │  │Transformation│  │   Mapping      │        │
│  │  Registry   │  │    Engine    │  │   Executor     │        │
│  └─────────────┘  └──────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    System Connectors                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │Oracle│ │MySQL │ │Kafka │ │ FTP  │ │  S3  │ │ File │       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2 Key Design Principles

1. **System Agnostic**: Core mapping logic independent of specific system types
2. **Pluggable Architecture**: New system types can be added without core changes
3. **Schema First**: All operations based on discovered or defined schemas
4. **Transformation Pipeline**: Composable transformation functions
5. **Visual Design**: Intuitive drag-and-drop interface for non-technical users

### 3. Data Models

#### 3.1 Universal Schema Model

```typescript
interface UniversalSchema {
  id: string;
  systemId: string;
  schemaType: 'table' | 'document' | 'stream' | 'file';
  name: string;
  namespace?: string;  // database, topic, bucket, directory
  fields: SchemaField[];
  metadata: {
    discoveredAt: Date;
    lastModified: Date;
    sizeEstimate?: number;
    recordCount?: number;
    custom: Record<string, any>;
  };
}

interface SchemaField {
  name: string;
  type: DataType;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: any;
  description?: string;
  metadata?: {
    length?: number;
    precision?: number;
    scale?: number;
    enumValues?: string[];
    format?: string;  // for dates, regex patterns
    encoding?: string;  // for files
  };
  children?: SchemaField[];  // for nested structures
}

enum DataType {
  // Primitive Types
  STRING = 'string',
  INTEGER = 'integer',
  LONG = 'long',
  FLOAT = 'float',
  DOUBLE = 'double',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  TIMESTAMP = 'timestamp',
  BINARY = 'binary',
  
  // Complex Types
  ARRAY = 'array',
  OBJECT = 'object',
  MAP = 'map',
  
  // Special Types
  UUID = 'uuid',
  JSON = 'json',
  XML = 'xml',
  ENUM = 'enum'
}
```

#### 3.2 Mapping Definition Model

```typescript
interface MappingDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  sourceSystem: {
    systemId: string;
    schemaId: string;
  };
  targetSystem: {
    systemId: string;
    schemaId: string;
  };
  fieldMappings: FieldMapping[];
  transformations: GlobalTransformation[];
  validations: ValidationRule[];
  options: MappingOptions;
  metadata: {
    createdBy: string;
    createdAt: Date;
    modifiedBy: string;
    modifiedAt: Date;
    tags: string[];
    category?: string;
  };
}

interface FieldMapping {
  id: string;
  sourceField: FieldReference | FieldReference[];  // array for composite mappings
  targetField: FieldReference;
  transformations: Transformation[];
  condition?: MappingCondition;
  defaultValue?: any;
  nullHandling: 'preserve' | 'default' | 'skip' | 'error';
}

interface FieldReference {
  path: string;  // dot notation: "address.city" or array: "items[0].price"
  type: DataType;
  required: boolean;
}

interface Transformation {
  id: string;
  type: TransformationType;
  parameters: Record<string, any>;
  order: number;
}

enum TransformationType {
  // Type Conversions
  CAST = 'cast',
  PARSE = 'parse',
  FORMAT = 'format',
  
  // String Operations
  UPPERCASE = 'uppercase',
  LOWERCASE = 'lowercase',
  TRIM = 'trim',
  SUBSTRING = 'substring',
  REPLACE = 'replace',
  REGEX_EXTRACT = 'regex_extract',
  SPLIT = 'split',
  CONCAT = 'concat',
  
  // Numeric Operations
  ADD = 'add',
  SUBTRACT = 'subtract',
  MULTIPLY = 'multiply',
  DIVIDE = 'divide',
  ROUND = 'round',
  CEILING = 'ceiling',
  FLOOR = 'floor',
  ABS = 'abs',
  
  // Date/Time Operations
  DATE_FORMAT = 'date_format',
  DATE_ADD = 'date_add',
  DATE_DIFF = 'date_diff',
  TIMEZONE_CONVERT = 'timezone_convert',
  
  // Logical Operations
  IF_THEN_ELSE = 'if_then_else',
  SWITCH = 'switch',
  COALESCE = 'coalesce',
  
  // Advanced Operations
  LOOKUP = 'lookup',
  SCRIPT = 'script',  // custom JavaScript/Python
  HASH = 'hash',
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
  
  // Array/Object Operations
  MAP = 'map',
  FILTER = 'filter',
  REDUCE = 'reduce',
  FLATTEN = 'flatten',
  GROUP_BY = 'group_by',
  PIVOT = 'pivot',
  UNPIVOT = 'unpivot'
}

interface MappingOptions {
  mode: 'overwrite' | 'append' | 'upsert' | 'merge';
  batchSize?: number;
  errorHandling: 'stop' | 'skip' | 'log';
  enableValidation: boolean;
  enablePreview: boolean;
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
  };
}
```

#### 3.3 System Adapter Interface

```typescript
interface SystemAdapter {
  id: string;
  type: SystemType;
  
  // Schema Operations
  discoverSchemas(connection: SystemConnection): Promise<UniversalSchema[]>;
  getSchema(connection: SystemConnection, schemaRef: string): Promise<UniversalSchema>;
  validateSchema(schema: UniversalSchema): Promise<ValidationResult>;
  
  // Data Operations
  readSample(connection: SystemConnection, schema: UniversalSchema, limit: number): Promise<any[]>;
  
  // Metadata Operations
  getCapabilities(): AdapterCapabilities;
  getSupportedTypes(): DataType[];
  getTypeMapping(): Map<DataType, string>;  // Universal type to native type
}

interface AdapterCapabilities {
  supportsSchemaDiscovery: boolean;
  supportsBatchOperations: boolean;
  supportsTransactions: boolean;
  supportsUpsert: boolean;
  supportsPartitioning: boolean;
  supportsStreaming: boolean;
  maxBatchSize?: number;
  supportedCompressions?: string[];
  supportedEncodings?: string[];
}
```

### 4. User Interface Design

#### 4.1 Mapping Designer Interface

```
┌─────────────────────────────────────────────────────────────────┐
│ Mapping Designer: Customer Data Migration                    ≡ X │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐     ┌─────────────┐     ┌────────────────┐ │
│ │ Source System   │     │ Field       │     │ Target System  │ │
│ │                 │     │ Mappings    │     │                │ │
│ │ PostgreSQL      │     │             │     │ MongoDB        │ │
│ │ customers table │     │  ┌─────┐   │     │ customers col. │ │
│ │                 │     │  │Map  │   │     │                │ │
│ │ ▼ Fields        │     │  │Rules│   │     │ ▼ Fields       │ │
│ │ • id (integer)──┼─────┼─→│     │───┼─────┼→• _id (string) │ │
│ │ • first_name────┼─────┼─→│     │───┼─────┼→• name {       │ │
│ │ • last_name─────┼─────┼─→│     │───┼─────┼→  • first      │ │
│ │ • email─────────┼─────┼─→│     │───┼─────┼→  • last }     │ │
│ │ • created_at────┼─────┼─→│     │───┼─────┼→• email        │ │
│ │ • phone─────────┼─────┼─→│     │───┼─────┼→• createdAt    │ │
│ │ • address {     │     │  │     │   │     │ • contact {    │ │
│ │   • street──────┼─────┼─→│     │───┼─────┼→  • phone      │ │
│ │   • city────────┼─────┼─→│     │───┼─────┼→  • address }  │ │
│ │   • zip }       │     │  └─────┘   │     │                │ │
│ └─────────────────┘     └─────────────┘     └────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Transformation Details: id → _id                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│ │ │ 1. CAST     │→│ 2. PREFIX   │→│ 3. FORMAT   │            │ │
│ │ │ to: string  │ │ prefix: USR_│ │ pad: 8      │            │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘            │ │
│ │ Preview: 123 → "USR_00000123"                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ [Test Mapping] [Save as Template] [Validate] [Save] [Cancel]    │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2 Mapping List Interface

```
┌─────────────────────────────────────────────────────────────────┐
│ Mapping Management                                               │
├─────────────────────────────────────────────────────────────────┤
│ [+ New Mapping] [Import] [Export]           Search: [_________] │
│                                                                  │
│ ┌──────┬────────────┬──────────┬──────────┬─────────┬────────┐ │
│ │Status│ Name       │ Source   │ Target   │Modified │Actions │ │
│ ├──────┼────────────┼──────────┼──────────┼─────────┼────────┤ │
│ │ ✓    │Customer    │PostgreSQL│MongoDB   │2 hrs ago│[▶][✎][⌫]│ │
│ │      │Migration   │customers │customers │         │        │ │
│ ├──────┼────────────┼──────────┼──────────┼─────────┼────────┤ │
│ │ ✓    │Order Sync  │MySQL     │Kafka     │1 day ago│[▶][✎][⌫]│ │
│ │      │            │orders    │order-topic│        │        │ │
│ ├──────┼────────────┼──────────┼──────────┼─────────┼────────┤ │
│ │ ⚠    │File Import │CSV File  │Oracle    │3 days   │[▶][✎][⌫]│ │
│ │      │            │products  │products  │         │        │ │
│ └──────┴────────────┴──────────┴──────────┴─────────┴────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 5. API Specifications

#### 5.1 RESTful API Endpoints

```yaml
# Mapping CRUD Operations
POST   /api/mappings                 # Create new mapping
GET    /api/mappings                 # List all mappings
GET    /api/mappings/{id}            # Get mapping details
PUT    /api/mappings/{id}            # Update mapping
DELETE /api/mappings/{id}            # Delete mapping
POST   /api/mappings/{id}/duplicate  # Duplicate mapping
POST   /api/mappings/{id}/version    # Create new version

# Schema Operations
GET    /api/systems/{systemId}/schemas              # Discover schemas
GET    /api/systems/{systemId}/schemas/{schemaId}   # Get schema details
POST   /api/schemas/compare                         # Compare two schemas
GET    /api/schemas/{id}/sample                     # Get sample data

# Transformation Operations
GET    /api/transformations                         # List available transformations
POST   /api/transformations/validate                # Validate transformation
POST   /api/transformations/preview                 # Preview transformation result

# Mapping Execution
POST   /api/mappings/{id}/validate                  # Validate mapping
POST   /api/mappings/{id}/preview                   # Preview mapping results
POST   /api/mappings/{id}/test                      # Test with sample data
GET    /api/mappings/{id}/history                   # Get execution history

# Template Operations
GET    /api/mapping-templates                       # List templates
POST   /api/mapping-templates                       # Create template
GET    /api/mapping-templates/{id}                  # Get template
POST   /api/mappings/from-template/{templateId}     # Create from template
```

#### 5.2 WebSocket API for Real-time Updates

```javascript
// Schema discovery progress
ws.on('schema.discovery.progress', (data) => {
  // { systemId, progress: 0-100, current: 'table_name' }
});

// Mapping validation progress
ws.on('mapping.validation.progress', (data) => {
  // { mappingId, progress: 0-100, errors: [], warnings: [] }
});

// Preview data updates
ws.on('mapping.preview.data', (data) => {
  // { mappingId, sample: [...], page: 1, total: 100 }
});
```

### 6. Implementation Components

#### 6.1 Backend Services

```typescript
// Core Services
class MappingService {
  createMapping(definition: MappingDefinition): Promise<Mapping>;
  updateMapping(id: string, updates: Partial<MappingDefinition>): Promise<Mapping>;
  deleteMapping(id: string): Promise<void>;
  validateMapping(mapping: Mapping): Promise<ValidationResult>;
  executeMapping(id: string, options: ExecutionOptions): Promise<ExecutionResult>;
}

class SchemaService {
  discoverSchemas(systemId: string): Promise<UniversalSchema[]>;
  refreshSchema(systemId: string, schemaId: string): Promise<UniversalSchema>;
  compareSchemas(source: UniversalSchema, target: UniversalSchema): Promise<SchemaComparison>;
  suggestMappings(source: UniversalSchema, target: UniversalSchema): Promise<FieldMapping[]>;
}

class TransformationService {
  getAvailableTransformations(sourceType: DataType, targetType: DataType): Transformation[];
  validateTransformation(transformation: Transformation, sampleData: any): ValidationResult;
  executeTransformation(transformation: Transformation, data: any): any;
  composeTransformations(transformations: Transformation[]): CompositeTransformation;
}

class ValidationService {
  validateFieldMapping(mapping: FieldMapping, sourceSchema: SchemaField, targetSchema: SchemaField): ValidationResult;
  validateDataType(value: any, targetType: DataType): boolean;
  validateConstraints(value: any, constraints: FieldConstraints): ValidationResult;
}
```

#### 6.2 Frontend Components (Vue.js)

```vue
<!-- Main Components -->
<MappingDesigner>
  <SourceSchemaPanel />
  <MappingCanvas>
    <MappingLine v-for="mapping in fieldMappings" />
    <TransformationNode v-for="transform in activeTransforms" />
  </MappingCanvas>
  <TargetSchemaPanel />
  <TransformationEditor v-if="selectedMapping" />
</MappingDesigner>

<MappingList>
  <MappingCard v-for="mapping in mappings" />
  <PaginationControls />
</MappingList>

<SchemaViewer>
  <SchemaTree :schema="schema" />
  <SampleDataTable :data="sampleData" />
</SchemaViewer>

<TransformationBuilder>
  <TransformationStep v-for="step in pipeline" />
  <TransformationPreview :result="previewResult" />
</TransformationBuilder>
```

### 7. Data Flow Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Source    │     │   Mapping   │     │   Target    │
│   System    │     │   Engine    │     │   System    │
├─────────────┤     ├─────────────┤     ├─────────────┤
│             │     │             │     │             │
│  Extract    │────▶│ Transform   │────▶│    Load     │
│             │     │             │     │             │
├─────────────┤     ├─────────────┤     ├─────────────┤
│             │     │ • Type Conv │     │             │
│ • Schema    │     │ • Field Map │     │ • Schema    │
│ • Data Read │     │ • Validate  │     │ • Data Write│
│ • Batch     │     │ • Error Han │     │ • Commit    │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 8. Security Considerations

1. **Access Control**
   - Role-based access to mappings (viewer, editor, admin)
   - System-level permissions for schema discovery
   - Field-level access control for sensitive data

2. **Data Protection**
   - Encryption of mapping definitions at rest
   - Secure transformation execution sandbox
   - Audit logging of all mapping operations
   - PII detection and masking options

3. **Validation & Safety**
   - Input validation for all transformations
   - SQL injection prevention in dynamic queries
   - Resource limits for transformation execution
   - Rollback capabilities for failed mappings

### 9. Performance Requirements

1. **Schema Discovery**
   - < 5 seconds for databases with < 100 tables
   - Incremental discovery for large schemas
   - Caching of discovered schemas

2. **Mapping Design**
   - Real-time validation feedback (< 100ms)
   - Instant transformation preview (< 500ms)
   - Support for mappings with > 1000 fields

3. **Execution Performance**
   - Streaming support for large datasets
   - Parallel processing for independent mappings
   - Batch optimization for bulk operations

### 10. Error Handling Strategy

```typescript
enum MappingErrorType {
  SCHEMA_MISMATCH = 'schema_mismatch',
  TYPE_CONVERSION = 'type_conversion',
  VALIDATION_FAILED = 'validation_failed',
  TRANSFORMATION_ERROR = 'transformation_error',
  CONNECTION_ERROR = 'connection_error',
  PERMISSION_DENIED = 'permission_denied'
}

interface MappingError {
  type: MappingErrorType;
  field?: string;
  message: string;
  details?: any;
  suggestion?: string;
  recoverable: boolean;
}

class ErrorHandler {
  handleError(error: MappingError, context: MappingContext): ErrorResolution;
  suggestFix(error: MappingError): TransformationSuggestion[];
  logError(error: MappingError, context: MappingContext): void;
}
```

### 11. Extensibility Framework

#### 11.1 Custom Transformation Plugin Interface

```typescript
interface TransformationPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Metadata
  supportedTypes: DataType[];
  parameters: ParameterDefinition[];
  
  // Implementation
  validate(input: any, parameters: any): ValidationResult;
  transform(input: any, parameters: any): any;
  preview(input: any, parameters: any): PreviewResult;
}

// Example: Custom Date Parser Plugin
class CustomDateParserPlugin implements TransformationPlugin {
  id = 'custom-date-parser';
  name = 'Custom Date Parser';
  supportedTypes = [DataType.STRING];
  
  transform(input: string, parameters: { format: string }): Date {
    // Custom parsing logic
    return parseCustomDate(input, parameters.format);
  }
}
```

#### 11.2 System Adapter Plugin Framework

```typescript
interface SystemAdapterPlugin {
  id: string;
  type: string;
  name: string;
  icon: string;
  
  // Connection
  validateConnection(config: any): Promise<boolean>;
  testConnection(config: any): Promise<ConnectionTestResult>;
  
  // Schema Operations
  discoverSchemas(connection: any): Promise<UniversalSchema[]>;
  
  // Type Mapping
  mapToUniversalType(nativeType: string): DataType;
  mapFromUniversalType(universalType: DataType): string;
}
```

### 12. Monitoring and Analytics

```typescript
interface MappingMetrics {
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  recordsProcessed: number;
  errorsEncountered: MappingError[];
  lastExecution: Date;
  performanceTrend: TrendData[];
}

interface MappingAnalytics {
  getMappingMetrics(mappingId: string): MappingMetrics;
  getSystemUsage(systemId: string): SystemUsageMetrics;
  getTransformationStats(): TransformationStatistics;
  getErrorPatterns(): ErrorPattern[];
}
```

### 13. Testing Strategy

1. **Unit Tests**
   - Individual transformation functions
   - Schema compatibility checks
   - Validation rules

2. **Integration Tests**
   - End-to-end mapping execution
   - System adapter functionality
   - Error handling flows

3. **Performance Tests**
   - Large schema discovery
   - Complex transformation chains
   - Concurrent mapping execution

4. **User Acceptance Tests**
   - Mapping designer usability
   - Preview functionality
   - Error message clarity

### 14. Migration and Versioning

```typescript
interface MappingVersion {
  version: number;
  createdAt: Date;
  createdBy: string;
  changes: VersionChange[];
  compatible: boolean;
}

class MappingMigration {
  migrateMapping(mapping: MappingDefinition, fromVersion: number, toVersion: number): MappingDefinition;
  checkCompatibility(mapping: MappingDefinition, targetSchema: UniversalSchema): CompatibilityResult;
  generateMigrationPlan(oldMapping: MappingDefinition, newSchema: UniversalSchema): MigrationPlan;
}
```

### 15. Future Enhancements

1. **AI-Powered Mapping Suggestions**
   - Machine learning for automatic field matching
   - Pattern recognition for common transformations
   - Anomaly detection in mappings

2. **Advanced Features**
   - Conditional mapping based on data values
   - Multi-source to single-target mappings
   - Mapping composition and inheritance
   - Real-time streaming transformations

3. **Collaboration Features**
   - Mapping comments and annotations
   - Change tracking and approval workflow
   - Team templates and best practices

### 16. Success Criteria

1. **Functional Requirements**
   - ✓ Support all specified system types
   - ✓ CRUD operations via web interface
   - ✓ Visual mapping designer
   - ✓ Transformation preview
   - ✓ Validation and error handling

2. **Non-Functional Requirements**
   - ✓ Response time < 2 seconds for UI operations
   - ✓ Support 1000+ concurrent mappings
   - ✓ 99.9% uptime for mapping service
   - ✓ Horizontally scalable architecture

3. **User Experience**
   - ✓ Intuitive drag-and-drop interface
   - ✓ Clear error messages and suggestions
   - ✓ Comprehensive documentation
   - ✓ Responsive design for various screens

---

This blueprint provides a comprehensive foundation for implementing the Mapping Management feature with support for any type of system while maintaining flexibility, performance, and user-friendliness.