/**
 * Data Validation Framework Module
 * 
 * Comprehensive validation framework for the enhanced mapping engine
 * providing schema validation, business rules, data quality checks,
 * and custom validation capabilities.
 * 
 * Features:
 * - Schema-based validation with JSON Schema support
 * - Business rule validation with conditional logic
 * - Data quality assessment and metrics
 * - Transformation validation
 * - Custom validation functions
 * - Validation presets for common scenarios
 * - Performance optimization with caching
 * 
 * Usage:
 * ```javascript
 * const { ValidationFramework, createValidationConfig } = require('./validation');
 * 
 * const framework = new ValidationFramework();
 * const config = createValidationConfig('strict', {
 *   schema: userSchema,
 *   rules: 'userValidation'
 * });
 * 
 * const result = await framework.validate(userData, config);
 * ```
 */

// Core framework
const {
  ValidationFramework,
  ValidationResult,
  BaseValidator,
  SchemaValidator,
  TypeValidator,
  BusinessRuleValidator,
  CustomValidator,
  CompositeValidator
} = require('./ValidationFramework');

// Specialized validators
const {
  FieldMappingValidator,
  DataQualityValidator,
  TransformationValidator,
  ConditionalLogicValidator,
  createDefaultMappingValidationRules
} = require('./MappingValidators');

// Presets and utilities
const {
  DataTypeSchemas,
  EntitySchemas,
  ValidationRules,
  ValidationPresets,
  ValidationPatterns,
  createValidationConfig,
  createEntityValidator,
  createDataQualityValidator
} = require('./ValidationPresets');

/**
 * Create a pre-configured validation framework
 */
function createValidationFramework(options = {}) {
  const framework = new ValidationFramework(options);
  
  // Register default schemas
  if (options.registerDefaults !== false) {
    // Register data type schemas
    for (const [name, schema] of Object.entries(DataTypeSchemas)) {
      framework.registerSchema(`type:${name}`, schema);
    }
    
    // Register entity schemas
    for (const [name, schema] of Object.entries(EntitySchemas)) {
      framework.registerSchema(`entity:${name}`, schema);
    }
    
    // Register validation rules
    for (const [category, rules] of Object.entries(ValidationRules)) {
      for (const [name, ruleSet] of Object.entries(rules)) {
        framework.registerRules(`${category}:${name}`, ruleSet);
      }
    }
  }
  
  // Register specialized validators
  if (options.registerValidators !== false) {
    framework.registerValidator('fieldMapping', new FieldMappingValidator());
    framework.registerValidator('dataQuality', new DataQualityValidator(
      createDefaultMappingValidationRules()
    ));
    framework.registerValidator('transformation', new TransformationValidator());
    framework.registerValidator('conditionalLogic', new ConditionalLogicValidator());
  }
  
  return framework;
}

/**
 * Validate mapping configuration
 */
async function validateMapping(mapping, options = {}) {
  const framework = createValidationFramework();
  
  // Create validators
  const validators = [];
  
  // Field mapping validation
  if (mapping.rules) {
    validators.push(new FieldMappingValidator({
      sourceSchema: mapping.sourceSchema,
      targetSchema: mapping.targetSchema,
      strictMode: options.strictMode
    }));
  }
  
  // Data quality validation
  if (options.validateQuality) {
    validators.push(new DataQualityValidator(
      options.qualityRules || createDefaultMappingValidationRules(),
      { threshold: options.qualityThreshold || 0.8 }
    ));
  }
  
  // Transformation validation
  if (mapping.transformations) {
    validators.push(new TransformationValidator({
      transformLibrary: options.transformLibrary,
      validateOutput: options.validateOutput
    }));
  }
  
  // Conditional logic validation
  if (mapping.conditions) {
    validators.push(new ConditionalLogicValidator());
  }
  
  // Execute validation
  const composite = new CompositeValidator(validators, {
    mode: options.validationMode || 'all',
    stopOnError: options.stopOnError
  });
  
  return composite.validate(mapping, { schema: mapping.schema });
}

/**
 * Validate data against mapping rules
 */
async function validateData(data, mapping, options = {}) {
  const framework = createValidationFramework();
  
  const config = createValidationConfig(options.preset || 'strict', {
    schema: mapping.targetSchema,
    rules: options.rules,
    custom: options.customValidator,
    ...options
  });
  
  return framework.validate(data, config);
}

/**
 * Create a validation pipeline
 */
function createValidationPipeline(stages) {
  const validators = stages.map(stage => {
    if (stage instanceof BaseValidator) {
      return stage;
    }
    
    switch (stage.type) {
      case 'schema':
        return new SchemaValidator(stage.schema, stage.options);
      case 'type':
        return new TypeValidator(stage.expectedType, stage.options);
      case 'rules':
        return new BusinessRuleValidator(stage.rules, stage.options);
      case 'custom':
        return new CustomValidator(stage.validate, stage.options);
      case 'fieldMapping':
        return new FieldMappingValidator(stage.options);
      case 'dataQuality':
        return new DataQualityValidator(stage.rules, stage.options);
      case 'transformation':
        return new TransformationValidator(stage.options);
      case 'conditionalLogic':
        return new ConditionalLogicValidator(stage.options);
      default:
        throw new Error(`Unknown validator type: ${stage.type}`);
    }
  });
  
  return new CompositeValidator(validators, {
    mode: 'sequential',
    stopOnError: true
  });
}

/**
 * Common validation helpers
 */
const ValidationHelpers = {
  /**
   * Check if value is empty
   */
  isEmpty(value) {
    return value === null || 
           value === undefined || 
           value === '' ||
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  },
  
  /**
   * Check if value matches pattern
   */
  matchesPattern(value, pattern) {
    if (typeof pattern === 'string') {
      pattern = new RegExp(pattern);
    }
    return pattern.test(String(value));
  },
  
  /**
   * Check if value is in range
   */
  isInRange(value, min, max) {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
  },
  
  /**
   * Check if value is valid date
   */
  isValidDate(value) {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },
  
  /**
   * Sanitize string value
   */
  sanitizeString(value, options = {}) {
    if (typeof value !== 'string') return value;
    
    let sanitized = value;
    
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }
    
    if (options.lowercase) {
      sanitized = sanitized.toLowerCase();
    } else if (options.uppercase) {
      sanitized = sanitized.toUpperCase();
    }
    
    if (options.removeSpaces) {
      sanitized = sanitized.replace(/\s+/g, '');
    }
    
    if (options.alphanumeric) {
      sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
    }
    
    return sanitized;
  }
};

/**
 * Export validation error class
 */
class ValidationError extends Error {
  constructor(message, result) {
    super(message);
    this.name = 'ValidationError';
    this.result = result;
    this.errors = result?.errors || [];
    this.warnings = result?.warnings || [];
  }
}

module.exports = {
  // Core framework
  ValidationFramework,
  ValidationResult,
  BaseValidator,
  SchemaValidator,
  TypeValidator,
  BusinessRuleValidator,
  CustomValidator,
  CompositeValidator,
  
  // Specialized validators
  FieldMappingValidator,
  DataQualityValidator,
  TransformationValidator,
  ConditionalLogicValidator,
  
  // Presets and schemas
  DataTypeSchemas,
  EntitySchemas,
  ValidationRules,
  ValidationPresets,
  ValidationPatterns,
  
  // Factory functions
  createValidationFramework,
  createValidationConfig,
  createEntityValidator,
  createDataQualityValidator,
  createDefaultMappingValidationRules,
  createValidationPipeline,
  
  // High-level validation functions
  validateMapping,
  validateData,
  
  // Utilities
  ValidationHelpers,
  ValidationError
};