const EventEmitter = require('events');
const logger = require('../../../src/utils/logger');
const { performance } = require('perf_hooks');

/**
 * Validation Result
 * Represents the result of a validation operation
 */
class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
    this.metadata = {};
    this.timestamp = new Date();
  }

  /**
   * Add error to result
   * @param {string} field - Field name
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  addError(field, message, details = {}) {
    this.valid = false;
    this.errors.push({
      field,
      message,
      details,
      severity: 'error',
      timestamp: new Date()
    });
  }

  /**
   * Add warning to result
   * @param {string} field - Field name
   * @param {string} message - Warning message
   * @param {Object} details - Additional details
   */
  addWarning(field, message, details = {}) {
    this.warnings.push({
      field,
      message,
      details,
      severity: 'warning',
      timestamp: new Date()
    });
  }

  /**
   * Add suggestion to result
   * @param {string} field - Field name
   * @param {string} message - Suggestion message
   * @param {Object} details - Additional details
   */
  addSuggestion(field, message, details = {}) {
    this.suggestions.push({
      field,
      message,
      details,
      severity: 'info',
      timestamp: new Date()
    });
  }

  /**
   * Merge another validation result
   * @param {ValidationResult} other - Other validation result
   */
  merge(other) {
    if (!other.valid) {
      this.valid = false;
    }
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
    this.suggestions.push(...other.suggestions);
    Object.assign(this.metadata, other.metadata);
  }

  /**
   * Get summary of validation result
   * @returns {Object} - Summary
   */
  getSummary() {
    return {
      valid: this.valid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      suggestionCount: this.suggestions.length,
      timestamp: this.timestamp,
      duration: Date.now() - this.timestamp.getTime()
    };
  }

  /**
   * Convert to plain object
   * @returns {Object} - Plain object representation
   */
  toObject() {
    return {
      valid: this.valid,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions,
      metadata: this.metadata,
      summary: this.getSummary()
    };
  }
}

/**
 * Base Validator Class
 * Abstract base class for all validators
 */
class BaseValidator {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.enabled = options.enabled !== false;
    this.stopOnError = options.stopOnError || false;
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      errorCount: 0,
      lastExecutionTime: null
    };
  }

  /**
   * Validate data
   * @param {*} data - Data to validate
   * @param {Object} context - Validation context
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async validate(data, context = {}) {
    if (!this.enabled) {
      return new ValidationResult();
    }

    const startTime = performance.now();
    
    try {
      const result = await this.performValidation(data, context);
      
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, result.valid);
      
      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, false);
      
      const result = new ValidationResult();
      result.addError('_validator', `Validator ${this.name} failed: ${error.message}`, { error });
      return result;
    }
  }

  /**
   * Perform actual validation (to be implemented by subclasses)
   * @param {*} data - Data to validate
   * @param {Object} context - Validation context
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async performValidation(data, context) {
    throw new Error(`${this.constructor.name} must implement performValidation() method`);
  }

  /**
   * Update metrics
   * @param {number} executionTime - Execution time
   * @param {boolean} success - Success flag
   */
  updateMetrics(executionTime, success) {
    this.metrics.executionCount++;
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.lastExecutionTime = executionTime;
    
    if (!success) {
      this.metrics.errorCount++;
    }
  }

  /**
   * Get metrics
   * @returns {Object} - Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageExecutionTime: this.metrics.executionCount > 0 
        ? this.metrics.totalExecutionTime / this.metrics.executionCount 
        : 0,
      errorRate: this.metrics.executionCount > 0
        ? (this.metrics.errorCount / this.metrics.executionCount) * 100
        : 0
    };
  }
}

/**
 * Schema Validator
 * Validates data against a JSON schema
 */
class SchemaValidator extends BaseValidator {
  constructor(schema, options = {}) {
    super('SchemaValidator', options);
    this.schema = schema;
    this.strictMode = options.strictMode || false;
    this.coerceTypes = options.coerceTypes || false;
  }

  async performValidation(data, context) {
    const result = new ValidationResult();
    
    if (!this.schema) {
      result.addWarning('_schema', 'No schema defined for validation');
      return result;
    }

    // Validate data against schema
    const validation = this.validateAgainstSchema(data, this.schema, '', result);
    
    // Add metadata
    result.metadata.schemaType = this.schema.type;
    result.metadata.strictMode = this.strictMode;
    
    return result;
  }

  validateAgainstSchema(data, schema, path, result) {
    // Type validation
    if (schema.type) {
      const actualType = this.getDataType(data);
      const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
      
      if (!expectedTypes.includes(actualType)) {
        if (this.coerceTypes) {
          const coercedData = this.coerceType(data, expectedTypes[0]);
          if (coercedData !== null) {
            data = coercedData;
          } else {
            result.addError(path || 'root', `Expected type ${expectedTypes.join(' or ')}, got ${actualType}`);
            return;
          }
        } else {
          result.addError(path || 'root', `Expected type ${expectedTypes.join(' or ')}, got ${actualType}`);
          return;
        }
      }
    }

    // Null validation
    if (data === null || data === undefined) {
      if (schema.required || (schema.nullable === false && data === null)) {
        result.addError(path || 'root', 'Value is required');
      }
      return;
    }

    // String validation
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        result.addError(path, `String length ${data.length} is less than minimum ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        result.addError(path, `String length ${data.length} exceeds maximum ${schema.maxLength}`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        result.addError(path, `String does not match pattern ${schema.pattern}`);
      }
      if (schema.enum && !schema.enum.includes(data)) {
        result.addError(path, `Value must be one of: ${schema.enum.join(', ')}`);
      }
      if (schema.format) {
        this.validateFormat(data, schema.format, path, result);
      }
    }

    // Number validation
    if ((schema.type === 'number' || schema.type === 'integer') && typeof data === 'number') {
      if (schema.type === 'integer' && !Number.isInteger(data)) {
        result.addError(path, 'Value must be an integer');
      }
      if (schema.minimum !== undefined && data < schema.minimum) {
        result.addError(path, `Value ${data} is less than minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        result.addError(path, `Value ${data} exceeds maximum ${schema.maximum}`);
      }
      if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
        result.addError(path, `Value ${data} must be greater than ${schema.exclusiveMinimum}`);
      }
      if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
        result.addError(path, `Value ${data} must be less than ${schema.exclusiveMaximum}`);
      }
      if (schema.multipleOf !== undefined && data % schema.multipleOf !== 0) {
        result.addError(path, `Value ${data} must be a multiple of ${schema.multipleOf}`);
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        result.addError(path, `Array length ${data.length} is less than minimum ${schema.minItems}`);
      }
      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        result.addError(path, `Array length ${data.length} exceeds maximum ${schema.maxItems}`);
      }
      if (schema.uniqueItems && !this.hasUniqueItems(data)) {
        result.addError(path, 'Array items must be unique');
      }
      if (schema.items) {
        data.forEach((item, index) => {
          this.validateAgainstSchema(item, schema.items, `${path}[${index}]`, result);
        });
      }
    }

    // Object validation
    if (schema.type === 'object' && typeof data === 'object' && !Array.isArray(data)) {
      // Check required properties
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in data)) {
            result.addError(`${path}.${requiredProp}`, 'Property is required');
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (prop in data) {
            this.validateAgainstSchema(data[prop], propSchema, `${path}.${prop}`, result);
          }
        }
      }

      // Check additional properties
      if (this.strictMode && schema.additionalProperties === false) {
        const definedProps = Object.keys(schema.properties || {});
        const extraProps = Object.keys(data).filter(prop => !definedProps.includes(prop));
        if (extraProps.length > 0) {
          result.addError(path, `Additional properties not allowed: ${extraProps.join(', ')}`);
        }
      }

      // Validate property count
      if (schema.minProperties !== undefined && Object.keys(data).length < schema.minProperties) {
        result.addError(path, `Object has fewer than ${schema.minProperties} properties`);
      }
      if (schema.maxProperties !== undefined && Object.keys(data).length > schema.maxProperties) {
        result.addError(path, `Object has more than ${schema.maxProperties} properties`);
      }
    }

    // Custom validation
    if (schema.validate && typeof schema.validate === 'function') {
      const customResult = schema.validate(data, path);
      if (customResult && !customResult.valid) {
        result.addError(path, customResult.message || 'Custom validation failed', customResult.details);
      }
    }
  }

  validateFormat(value, format, path, result) {
    const formats = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
      date: /^\d{4}-\d{2}-\d{2}$/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      time: /^\d{2}:\d{2}:\d{2}$/,
      ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
      ipv6: /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    };

    if (formats[format] && !formats[format].test(value)) {
      result.addError(path, `Value does not match format: ${format}`);
    }
  }

  getDataType(data) {
    if (data === null) return 'null';
    if (Array.isArray(data)) return 'array';
    return typeof data;
  }

  coerceType(data, targetType) {
    try {
      switch (targetType) {
        case 'string':
          return String(data);
        case 'number':
          const num = Number(data);
          return isNaN(num) ? null : num;
        case 'integer':
          const int = parseInt(data, 10);
          return isNaN(int) ? null : int;
        case 'boolean':
          if (typeof data === 'string') {
            return data.toLowerCase() === 'true';
          }
          return Boolean(data);
        case 'array':
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              return Array.isArray(parsed) ? parsed : [data];
            } catch {
              return [data];
            }
          }
          return Array.isArray(data) ? data : [data];
        case 'object':
          if (typeof data === 'string') {
            try {
              return JSON.parse(data);
            } catch {
              return null;
            }
          }
          return typeof data === 'object' ? data : null;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  hasUniqueItems(array) {
    const seen = new Set();
    for (const item of array) {
      const key = JSON.stringify(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
    }
    return true;
  }
}

/**
 * Type Validator
 * Validates data types
 */
class TypeValidator extends BaseValidator {
  constructor(expectedType, options = {}) {
    super('TypeValidator', options);
    this.expectedType = expectedType;
    this.allowNull = options.allowNull || false;
    this.allowUndefined = options.allowUndefined || false;
  }

  async performValidation(data, context) {
    const result = new ValidationResult();
    
    if (data === null && this.allowNull) {
      return result;
    }
    
    if (data === undefined && this.allowUndefined) {
      return result;
    }

    const actualType = this.getType(data);
    const expectedTypes = Array.isArray(this.expectedType) ? this.expectedType : [this.expectedType];

    if (!expectedTypes.includes(actualType)) {
      result.addError('type', `Expected type ${expectedTypes.join(' or ')}, got ${actualType}`);
    }

    return result;
  }

  getType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regexp';
    return typeof value;
  }
}

/**
 * Business Rule Validator
 * Validates data against business rules
 */
class BusinessRuleValidator extends BaseValidator {
  constructor(rules, options = {}) {
    super('BusinessRuleValidator', options);
    this.rules = Array.isArray(rules) ? rules : [rules];
  }

  async performValidation(data, context) {
    const result = new ValidationResult();

    for (const rule of this.rules) {
      if (!rule.enabled !== false) {
        const ruleResult = await this.validateRule(data, rule, context);
        result.merge(ruleResult);
        
        if (!ruleResult.valid && this.stopOnError) {
          break;
        }
      }
    }

    return result;
  }

  async validateRule(data, rule, context) {
    const result = new ValidationResult();

    try {
      // Evaluate condition if present
      if (rule.condition) {
        const conditionMet = await this.evaluateCondition(data, rule.condition, context);
        if (!conditionMet) {
          return result; // Skip rule if condition not met
        }
      }

      // Execute validation function
      if (rule.validate) {
        const isValid = await this.executeValidation(data, rule.validate, context);
        
        if (!isValid) {
          const severity = rule.severity || 'error';
          const field = rule.field || '_rule';
          const message = rule.message || `Business rule validation failed: ${rule.name}`;
          
          switch (severity) {
            case 'error':
              result.addError(field, message, { rule: rule.name });
              break;
            case 'warning':
              result.addWarning(field, message, { rule: rule.name });
              break;
            case 'info':
              result.addSuggestion(field, message, { rule: rule.name });
              break;
          }
        }
      }

      // Execute custom validator
      if (rule.customValidator) {
        const customResult = await rule.customValidator(data, context);
        if (customResult && typeof customResult === 'object') {
          result.merge(customResult);
        } else if (!customResult) {
          result.addError(rule.field || '_rule', rule.message || 'Custom validation failed');
        }
      }

    } catch (error) {
      result.addError('_rule', `Rule validation error: ${error.message}`, { 
        rule: rule.name, 
        error: error.message 
      });
    }

    return result;
  }

  async evaluateCondition(data, condition, context) {
    if (typeof condition === 'function') {
      return condition(data, context);
    }

    if (typeof condition === 'object') {
      return this.evaluateObjectCondition(data, condition, context);
    }

    return Boolean(condition);
  }

  evaluateObjectCondition(data, condition, context) {
    // Handle logical operators
    if (condition.$and) {
      return condition.$and.every(cond => this.evaluateCondition(data, cond, context));
    }
    
    if (condition.$or) {
      return condition.$or.some(cond => this.evaluateCondition(data, cond, context));
    }
    
    if (condition.$not) {
      return !this.evaluateCondition(data, condition.$not, context);
    }

    // Handle field comparisons
    for (const [field, comparison] of Object.entries(condition)) {
      const fieldValue = this.getFieldValue(data, field);
      
      if (!this.evaluateComparison(fieldValue, comparison)) {
        return false;
      }
    }

    return true;
  }

  evaluateComparison(value, comparison) {
    if (typeof comparison === 'object') {
      for (const [operator, expected] of Object.entries(comparison)) {
        switch (operator) {
          case '$eq':
            if (value !== expected) return false;
            break;
          case '$ne':
            if (value === expected) return false;
            break;
          case '$gt':
            if (!(value > expected)) return false;
            break;
          case '$gte':
            if (!(value >= expected)) return false;
            break;
          case '$lt':
            if (!(value < expected)) return false;
            break;
          case '$lte':
            if (!(value <= expected)) return false;
            break;
          case '$in':
            if (!expected.includes(value)) return false;
            break;
          case '$nin':
            if (expected.includes(value)) return false;
            break;
          case '$regex':
            if (!new RegExp(expected).test(value)) return false;
            break;
          case '$exists':
            if ((value !== null && value !== undefined) !== expected) return false;
            break;
        }
      }
      return true;
    }

    return value === comparison;
  }

  async executeValidation(data, validate, context) {
    if (typeof validate === 'function') {
      return validate(data, context);
    }

    if (typeof validate === 'string') {
      // Execute named validator
      const validator = this.getNamedValidator(validate);
      if (validator) {
        return validator(data, context);
      }
    }

    return true;
  }

  getNamedValidator(name) {
    // This could be extended to look up validators from a registry
    const validators = {
      required: (value) => value !== null && value !== undefined && value !== '',
      email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      phone: (value) => /^\+?[\d\s-()]+$/.test(value),
      url: (value) => /^https?:\/\/[^\s]+$/.test(value),
      positive: (value) => Number(value) > 0,
      nonNegative: (value) => Number(value) >= 0
    };

    return validators[name];
  }

  getFieldValue(data, path) {
    return path.split('.').reduce((current, part) => current?.[part], data);
  }
}

/**
 * Custom Validator
 * Allows custom validation logic
 */
class CustomValidator extends BaseValidator {
  constructor(validateFn, options = {}) {
    super(options.name || 'CustomValidator', options);
    this.validateFn = validateFn;
  }

  async performValidation(data, context) {
    const result = new ValidationResult();

    try {
      const validationResult = await this.validateFn(data, context);
      
      if (validationResult instanceof ValidationResult) {
        return validationResult;
      }

      if (typeof validationResult === 'boolean' && !validationResult) {
        result.addError('_custom', this.options.message || 'Custom validation failed');
      }

      if (typeof validationResult === 'object' && validationResult) {
        if (validationResult.valid === false) {
          result.valid = false;
        }
        if (validationResult.errors) {
          validationResult.errors.forEach(error => {
            result.addError(error.field || '_custom', error.message, error.details);
          });
        }
        if (validationResult.warnings) {
          validationResult.warnings.forEach(warning => {
            result.addWarning(warning.field || '_custom', warning.message, warning.details);
          });
        }
      }

    } catch (error) {
      result.addError('_custom', `Custom validation error: ${error.message}`, { error });
    }

    return result;
  }
}

/**
 * Composite Validator
 * Combines multiple validators
 */
class CompositeValidator extends BaseValidator {
  constructor(validators, options = {}) {
    super('CompositeValidator', options);
    this.validators = validators;
    this.mode = options.mode || 'all'; // 'all', 'any', 'sequential'
  }

  async performValidation(data, context) {
    switch (this.mode) {
      case 'all':
        return this.validateAll(data, context);
      case 'any':
        return this.validateAny(data, context);
      case 'sequential':
        return this.validateSequential(data, context);
      default:
        throw new Error(`Unknown validation mode: ${this.mode}`);
    }
  }

  async validateAll(data, context) {
    const results = await Promise.all(
      this.validators.map(validator => validator.validate(data, context))
    );

    const combinedResult = new ValidationResult();
    results.forEach(result => combinedResult.merge(result));

    return combinedResult;
  }

  async validateAny(data, context) {
    const results = await Promise.all(
      this.validators.map(validator => validator.validate(data, context))
    );

    const validResults = results.filter(r => r.valid);
    
    if (validResults.length > 0) {
      return validResults[0];
    }

    const combinedResult = new ValidationResult();
    results.forEach(result => combinedResult.merge(result));

    return combinedResult;
  }

  async validateSequential(data, context) {
    const combinedResult = new ValidationResult();

    for (const validator of this.validators) {
      const result = await validator.validate(data, context);
      combinedResult.merge(result);

      if (!result.valid && this.stopOnError) {
        break;
      }
    }

    return combinedResult;
  }
}

/**
 * Validation Framework
 * Main entry point for data validation
 */
class ValidationFramework extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.validators = new Map();
    this.schemas = new Map();
    this.rules = new Map();
    this.cache = new Map();
    this.cacheSize = options.cacheSize || 1000;
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Register a validator
   * @param {string} name - Validator name
   * @param {BaseValidator} validator - Validator instance
   */
  registerValidator(name, validator) {
    this.validators.set(name, validator);
    logger.info(`Registered validator: ${name}`);
  }

  /**
   * Register a schema
   * @param {string} name - Schema name
   * @param {Object} schema - Schema definition
   */
  registerSchema(name, schema) {
    this.schemas.set(name, schema);
    logger.info(`Registered schema: ${name}`);
  }

  /**
   * Register business rules
   * @param {string} name - Rule set name
   * @param {Array} rules - Business rules
   */
  registerRules(name, rules) {
    this.rules.set(name, rules);
    logger.info(`Registered rule set: ${name}`);
  }

  /**
   * Create schema validator
   * @param {Object|string} schema - Schema or schema name
   * @param {Object} options - Validator options
   * @returns {SchemaValidator} - Schema validator
   */
  createSchemaValidator(schema, options = {}) {
    if (typeof schema === 'string') {
      schema = this.schemas.get(schema);
      if (!schema) {
        throw new Error(`Schema not found: ${schema}`);
      }
    }
    return new SchemaValidator(schema, options);
  }

  /**
   * Create business rule validator
   * @param {Array|string} rules - Rules or rule set name
   * @param {Object} options - Validator options
   * @returns {BusinessRuleValidator} - Business rule validator
   */
  createRuleValidator(rules, options = {}) {
    if (typeof rules === 'string') {
      rules = this.rules.get(rules);
      if (!rules) {
        throw new Error(`Rule set not found: ${rules}`);
      }
    }
    return new BusinessRuleValidator(rules, options);
  }

  /**
   * Validate data
   * @param {*} data - Data to validate
   * @param {Object} options - Validation options
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async validate(data, options = {}) {
    const startTime = performance.now();
    
    try {
      // Check cache
      const cacheKey = this.getCacheKey(data, options);
      if (options.useCache !== false && this.cache.has(cacheKey)) {
        this.metrics.cacheHits++;
        logger.debug('Validation cache hit');
        return this.cache.get(cacheKey);
      }
      this.metrics.cacheMisses++;

      // Create validators
      const validators = [];

      if (options.schema) {
        validators.push(this.createSchemaValidator(options.schema, options.schemaOptions));
      }

      if (options.type) {
        validators.push(new TypeValidator(options.type, options.typeOptions));
      }

      if (options.rules) {
        validators.push(this.createRuleValidator(options.rules, options.ruleOptions));
      }

      if (options.custom) {
        validators.push(new CustomValidator(options.custom, options.customOptions));
      }

      if (options.validators) {
        for (const validatorName of options.validators) {
          const validator = this.validators.get(validatorName);
          if (validator) {
            validators.push(validator);
          } else {
            logger.warn(`Validator not found: ${validatorName}`);
          }
        }
      }

      // Execute validation
      let result;
      if (validators.length === 0) {
        result = new ValidationResult();
      } else if (validators.length === 1) {
        result = await validators[0].validate(data, options.context);
      } else {
        const compositeValidator = new CompositeValidator(validators, {
          mode: options.validationMode || 'all',
          stopOnError: options.stopOnError
        });
        result = await compositeValidator.validate(data, options.context);
      }

      // Update metrics
      const executionTime = performance.now() - startTime;
      this.updateMetrics(result.valid, executionTime);

      // Emit events
      this.emit('validationComplete', {
        valid: result.valid,
        executionTime,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });

      // Cache result
      if (options.useCache !== false) {
        this.cacheResult(cacheKey, result);
      }

      return result;

    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateMetrics(false, executionTime);
      
      this.emit('validationError', {
        error: error.message,
        executionTime
      });
      
      throw error;
    }
  }

  /**
   * Validate batch of data
   * @param {Array} dataArray - Array of data to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Array>} - Array of validation results
   */
  async validateBatch(dataArray, options = {}) {
    const results = [];
    
    for (let i = 0; i < dataArray.length; i++) {
      try {
        const result = await this.validate(dataArray[i], {
          ...options,
          context: {
            ...options.context,
            batchIndex: i,
            batchSize: dataArray.length
          }
        });
        results.push({ index: i, result });
      } catch (error) {
        results.push({ 
          index: i, 
          result: null, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Get cache key
   * @param {*} data - Data
   * @param {Object} options - Options
   * @returns {string} - Cache key
   */
  getCacheKey(data, options) {
    const dataHash = this.hashObject(data);
    const optionsHash = this.hashObject({
      schema: options.schema,
      type: options.type,
      rules: options.rules,
      validators: options.validators
    });
    return `${dataHash}_${optionsHash}`;
  }

  /**
   * Hash object
   * @param {*} obj - Object to hash
   * @returns {string} - Hash
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache result
   * @param {string} key - Cache key
   * @param {ValidationResult} result - Result to cache
   */
  cacheResult(key, result) {
    this.cache.set(key, result);
    
    // Cleanup cache if too large
    if (this.cache.size > this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Update metrics
   * @param {boolean} success - Success flag
   * @param {number} executionTime - Execution time
   */
  updateMetrics(success, executionTime) {
    this.metrics.totalValidations++;
    if (success) {
      this.metrics.successfulValidations++;
    } else {
      this.metrics.failedValidations++;
    }
  }

  /**
   * Get metrics
   * @returns {Object} - Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalValidations > 0
        ? (this.metrics.successfulValidations / this.metrics.totalValidations) * 100
        : 0,
      cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
        : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Validation cache cleared');
  }
}

module.exports = {
  ValidationFramework,
  ValidationResult,
  BaseValidator,
  SchemaValidator,
  TypeValidator,
  BusinessRuleValidator,
  CustomValidator,
  CompositeValidator
};