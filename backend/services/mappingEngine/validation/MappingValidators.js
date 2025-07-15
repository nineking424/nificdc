const {
  BaseValidator,
  ValidationResult,
  BusinessRuleValidator,
  CustomValidator
} = require('./ValidationFramework');
const logger = require('../../../src/utils/logger');

/**
 * Field Mapping Validator
 * Validates field mapping rules
 */
class FieldMappingValidator extends BaseValidator {
  constructor(options = {}) {
    super('FieldMappingValidator', options);
    this.sourceSchema = options.sourceSchema;
    this.targetSchema = options.targetSchema;
    this.strictMode = options.strictMode || false;
    this.allowUnmappedFields = options.allowUnmappedFields !== false;
  }

  async performValidation(mappingRules, context) {
    const result = new ValidationResult();
    
    if (!Array.isArray(mappingRules)) {
      result.addError('mappingRules', 'Mapping rules must be an array');
      return result;
    }

    // Validate each mapping rule
    const targetFieldsMap = new Map();
    const sourceFieldsUsed = new Set();

    for (let i = 0; i < mappingRules.length; i++) {
      const rule = mappingRules[i];
      const ruleResult = await this.validateMappingRule(rule, i, context);
      result.merge(ruleResult);

      // Track field usage
      if (rule.sourceField) {
        sourceFieldsUsed.add(rule.sourceField);
      } else if (rule.sourceFields) {
        rule.sourceFields.forEach(field => sourceFieldsUsed.add(field));
      }

      // Check for duplicate target fields
      if (rule.targetField) {
        if (targetFieldsMap.has(rule.targetField)) {
          result.addWarning(
            `rule[${i}]`,
            `Target field '${rule.targetField}' is mapped multiple times`,
            { previousRule: targetFieldsMap.get(rule.targetField) }
          );
        }
        targetFieldsMap.set(rule.targetField, i);
      }
    }

    // Check schema coverage
    if (this.sourceSchema && this.targetSchema) {
      this.validateSchemaCoverage(sourceFieldsUsed, targetFieldsMap, result);
    }

    return result;
  }

  async validateMappingRule(rule, index, context) {
    const result = new ValidationResult();
    const rulePath = `rule[${index}]`;

    // Required fields
    if (!rule.type) {
      result.addError(rulePath, 'Rule type is required');
    }

    if (!rule.targetField) {
      result.addError(rulePath, 'Target field is required');
    }

    // Validate by rule type
    switch (rule.type) {
      case 'direct':
        this.validateDirectMapping(rule, rulePath, result);
        break;
      case 'transform':
        this.validateTransformMapping(rule, rulePath, result);
        break;
      case 'concat':
        this.validateConcatMapping(rule, rulePath, result);
        break;
      case 'split':
        this.validateSplitMapping(rule, rulePath, result);
        break;
      case 'lookup':
        this.validateLookupMapping(rule, rulePath, result);
        break;
      case 'formula':
        this.validateFormulaMapping(rule, rulePath, result);
        break;
      case 'conditional':
        this.validateConditionalMapping(rule, rulePath, result);
        break;
      default:
        result.addError(rulePath, `Unknown mapping type: ${rule.type}`);
    }

    // Validate source field existence
    if (rule.sourceField && this.sourceSchema) {
      if (!this.fieldExistsInSchema(rule.sourceField, this.sourceSchema)) {
        result.addError(
          `${rulePath}.sourceField`,
          `Source field '${rule.sourceField}' does not exist in schema`
        );
      }
    }

    // Validate target field format
    if (rule.targetField && this.targetSchema) {
      if (!this.isValidFieldPath(rule.targetField, this.targetSchema)) {
        result.addError(
          `${rulePath}.targetField`,
          `Invalid target field path: ${rule.targetField}`
        );
      }
    }

    return result;
  }

  validateDirectMapping(rule, path, result) {
    if (!rule.sourceField) {
      result.addError(path, 'Source field is required for direct mapping');
    }
  }

  validateTransformMapping(rule, path, result) {
    if (!rule.sourceField) {
      result.addError(path, 'Source field is required for transform mapping');
    }
    if (!rule.transformType) {
      result.addError(path, 'Transform type is required for transform mapping');
    }
  }

  validateConcatMapping(rule, path, result) {
    if (!rule.sourceFields || !Array.isArray(rule.sourceFields)) {
      result.addError(path, 'Source fields array is required for concat mapping');
    } else if (rule.sourceFields.length < 2) {
      result.addWarning(path, 'Concat mapping should have at least 2 source fields');
    }
  }

  validateSplitMapping(rule, path, result) {
    if (!rule.sourceField) {
      result.addError(path, 'Source field is required for split mapping');
    }
    if (!rule.separator) {
      result.addWarning(path, 'No separator specified for split mapping, will use default');
    }
  }

  validateLookupMapping(rule, path, result) {
    if (!rule.sourceField) {
      result.addError(path, 'Source field is required for lookup mapping');
    }
    if (!rule.lookupTable && !rule.lookupService) {
      result.addError(path, 'Lookup table or service is required for lookup mapping');
    }
  }

  validateFormulaMapping(rule, path, result) {
    if (!rule.formula) {
      result.addError(path, 'Formula is required for formula mapping');
    } else {
      // Validate formula syntax
      try {
        this.validateFormulaSyntax(rule.formula);
      } catch (error) {
        result.addError(path, `Invalid formula syntax: ${error.message}`);
      }
    }
  }

  validateConditionalMapping(rule, path, result) {
    if (!rule.condition) {
      result.addError(path, 'Condition is required for conditional mapping');
    }
    if (!rule.mappings || typeof rule.mappings !== 'object') {
      result.addError(path, 'Mappings object is required for conditional mapping');
    }
  }

  validateSchemaCoverage(sourceFieldsUsed, targetFieldsMap, result) {
    // Check for unmapped required target fields
    if (this.targetSchema.required) {
      for (const requiredField of this.targetSchema.required) {
        if (!targetFieldsMap.has(requiredField)) {
          result.addError(
            'coverage',
            `Required target field '${requiredField}' is not mapped`
          );
        }
      }
    }

    // Check for unused source fields
    if (!this.allowUnmappedFields && this.sourceSchema.properties) {
      const allSourceFields = Object.keys(this.sourceSchema.properties);
      const unusedFields = allSourceFields.filter(field => !sourceFieldsUsed.has(field));
      
      if (unusedFields.length > 0) {
        result.addWarning(
          'coverage',
          `Source fields not used in mapping: ${unusedFields.join(', ')}`
        );
      }
    }
  }

  fieldExistsInSchema(fieldPath, schema) {
    const parts = fieldPath.split('.');
    let current = schema.properties;

    for (const part of parts) {
      if (!current || !current[part]) {
        return false;
      }
      current = current[part].properties;
    }

    return true;
  }

  isValidFieldPath(fieldPath, schema) {
    // Basic validation - can be extended
    return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(fieldPath);
  }

  validateFormulaSyntax(formula) {
    // Basic formula syntax validation
    // This is a simplified version - in practice, you'd use a proper expression parser
    const allowedChars = /^[a-zA-Z0-9_\s\+\-\*\/\(\)\.\,\[\]]+$/;
    if (!allowedChars.test(formula)) {
      throw new Error('Formula contains invalid characters');
    }

    // Check balanced parentheses
    let parenCount = 0;
    for (const char of formula) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        throw new Error('Unbalanced parentheses');
      }
    }
    if (parenCount !== 0) {
      throw new Error('Unbalanced parentheses');
    }
  }
}

/**
 * Data Quality Validator
 * Validates data quality metrics
 */
class DataQualityValidator extends BaseValidator {
  constructor(qualityRules, options = {}) {
    super('DataQualityValidator', options);
    this.qualityRules = qualityRules;
    this.threshold = options.threshold || 0.8;
  }

  async performValidation(data, context) {
    const result = new ValidationResult();
    const qualityMetrics = {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      uniqueness: 0,
      timeliness: 0
    };

    // Calculate quality metrics
    if (Array.isArray(data)) {
      const recordResults = await this.validateRecords(data, context);
      this.calculateAggregateMetrics(recordResults, qualityMetrics);
    } else {
      const recordResult = await this.validateRecord(data, 0, context);
      this.updateMetricsFromRecord(recordResult, qualityMetrics);
    }

    // Check overall quality
    const overallQuality = this.calculateOverallQuality(qualityMetrics);
    
    if (overallQuality < this.threshold) {
      result.addError(
        'quality',
        `Data quality score ${overallQuality.toFixed(2)} is below threshold ${this.threshold}`,
        { metrics: qualityMetrics }
      );
    }

    // Add quality metrics to result
    result.metadata.qualityMetrics = qualityMetrics;
    result.metadata.qualityScore = overallQuality;

    return result;
  }

  async validateRecords(records, context) {
    const results = [];
    
    for (let i = 0; i < records.length; i++) {
      const result = await this.validateRecord(records[i], i, context);
      results.push(result);
    }

    return results;
  }

  async validateRecord(record, index, context) {
    const metrics = {
      completeness: 1,
      accuracy: 1,
      consistency: 1,
      uniqueness: 1,
      timeliness: 1,
      issues: []
    };

    for (const rule of this.qualityRules) {
      const ruleResult = await this.applyQualityRule(record, rule, index, context);
      
      if (!ruleResult.passed) {
        // Reduce the dimension score by the rule's weight
        metrics[rule.dimension] = Math.max(0, metrics[rule.dimension] - rule.weight);
        metrics.issues.push({
          dimension: rule.dimension,
          rule: rule.name,
          message: ruleResult.message
        });
      }
    }

    return metrics;
  }

  async applyQualityRule(record, rule, index, context) {
    try {
      switch (rule.type) {
        case 'completeness':
          return this.checkCompleteness(record, rule);
        case 'format':
          return this.checkFormat(record, rule);
        case 'range':
          return this.checkRange(record, rule);
        case 'consistency':
          return this.checkConsistency(record, rule, context);
        case 'uniqueness':
          return this.checkUniqueness(record, rule, context);
        case 'timeliness':
          return this.checkTimeliness(record, rule);
        case 'custom':
          return rule.validate(record, context);
        default:
          return { passed: true };
      }
    } catch (error) {
      return {
        passed: false,
        message: `Rule evaluation error: ${error.message}`
      };
    }
  }

  checkCompleteness(record, rule) {
    const value = this.getFieldValue(record, rule.field);
    const isComplete = value !== null && value !== undefined && value !== '';
    
    return {
      passed: isComplete,
      message: isComplete ? '' : `Field ${rule.field} is incomplete`
    };
  }

  checkFormat(record, rule) {
    const value = this.getFieldValue(record, rule.field);
    if (value === null || value === undefined) {
      return { passed: true }; // Skip null values
    }

    const regex = new RegExp(rule.pattern);
    const matches = regex.test(String(value));
    
    return {
      passed: matches,
      message: matches ? '' : `Field ${rule.field} does not match expected format`
    };
  }

  checkRange(record, rule) {
    const value = Number(this.getFieldValue(record, rule.field));
    if (isNaN(value)) {
      return { passed: true }; // Skip non-numeric values
    }

    const inRange = value >= rule.min && value <= rule.max;
    
    return {
      passed: inRange,
      message: inRange ? '' : `Field ${rule.field} value ${value} is outside range [${rule.min}, ${rule.max}]`
    };
  }

  checkConsistency(record, rule, context) {
    // This would typically check against other records or external data
    // For now, we'll do a simple field comparison
    if (rule.compareFields) {
      const values = rule.compareFields.map(field => this.getFieldValue(record, field));
      const consistent = values.every(v => v === values[0]);
      
      return {
        passed: consistent,
        message: consistent ? '' : `Fields ${rule.compareFields.join(', ')} have inconsistent values`
      };
    }

    return { passed: true };
  }

  checkUniqueness(record, rule, context) {
    // This would typically check against a database or cache
    // For now, we'll return true
    return { passed: true };
  }

  checkTimeliness(record, rule) {
    const value = this.getFieldValue(record, rule.field);
    if (!value) {
      return { passed: true };
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return {
        passed: false,
        message: `Field ${rule.field} is not a valid date`
      };
    }

    const now = new Date();
    const ageInDays = (now - date) / (1000 * 60 * 60 * 24);
    const timely = ageInDays <= rule.maxAgeInDays;

    return {
      passed: timely,
      message: timely ? '' : `Field ${rule.field} data is older than ${rule.maxAgeInDays} days`
    };
  }

  calculateAggregateMetrics(recordResults, metrics) {
    const dimensions = ['completeness', 'accuracy', 'consistency', 'uniqueness', 'timeliness'];
    
    for (const dimension of dimensions) {
      const values = recordResults.map(r => r[dimension]);
      metrics[dimension] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }
  }

  updateMetricsFromRecord(recordResult, metrics) {
    Object.assign(metrics, {
      completeness: recordResult.completeness,
      accuracy: recordResult.accuracy,
      consistency: recordResult.consistency,
      uniqueness: recordResult.uniqueness,
      timeliness: recordResult.timeliness
    });
  }

  calculateOverallQuality(metrics) {
    const weights = {
      completeness: 0.3,
      accuracy: 0.25,
      consistency: 0.2,
      uniqueness: 0.15,
      timeliness: 0.1
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [dimension, weight] of Object.entries(weights)) {
      if (metrics[dimension] !== undefined) {
        weightedSum += metrics[dimension] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  getFieldValue(record, fieldPath) {
    return fieldPath.split('.').reduce((current, part) => current?.[part], record);
  }
}

/**
 * Transformation Validator
 * Validates transformation functions and their outputs
 */
class TransformationValidator extends BaseValidator {
  constructor(options = {}) {
    super('TransformationValidator', options);
    this.transformLibrary = options.transformLibrary || {};
    this.validateOutput = options.validateOutput !== false;
    this.maxExecutionTime = options.maxExecutionTime || 5000; // 5 seconds
  }

  async performValidation(transformation, context) {
    const result = new ValidationResult();

    // Validate transformation structure
    if (!transformation.type) {
      result.addError('type', 'Transformation type is required');
    }

    // Validate by transformation type
    switch (transformation.type) {
      case 'function':
        await this.validateFunctionTransform(transformation, result, context);
        break;
      case 'script':
        await this.validateScriptTransform(transformation, result, context);
        break;
      case 'template':
        await this.validateTemplateTransform(transformation, result, context);
        break;
      case 'lookup':
        await this.validateLookupTransform(transformation, result, context);
        break;
      default:
        result.addError('type', `Unknown transformation type: ${transformation.type}`);
    }

    return result;
  }

  async validateFunctionTransform(transform, result, context) {
    if (!transform.function) {
      result.addError('function', 'Function name is required');
      return;
    }

    // Check if function exists in library
    if (!this.transformLibrary[transform.function]) {
      result.addError('function', `Transform function '${transform.function}' not found in library`);
      return;
    }

    // Validate function with sample data if provided
    if (context.sampleData && this.validateOutput) {
      try {
        const startTime = Date.now();
        const fn = this.transformLibrary[transform.function];
        const output = await Promise.race([
          fn(context.sampleData, transform.options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Execution timeout')), this.maxExecutionTime)
          )
        ]);

        const executionTime = Date.now() - startTime;
        
        if (executionTime > this.maxExecutionTime * 0.8) {
          result.addWarning(
            'performance',
            `Transform function execution time (${executionTime}ms) is close to timeout`
          );
        }

        // Validate output
        if (transform.outputSchema) {
          const outputValidation = await this.validateOutput(output, transform.outputSchema);
          if (!outputValidation.valid) {
            result.addError('output', 'Transform output does not match expected schema', {
              errors: outputValidation.errors
            });
          }
        }

      } catch (error) {
        result.addError('execution', `Transform function failed: ${error.message}`);
      }
    }
  }

  async validateScriptTransform(transform, result, context) {
    if (!transform.script) {
      result.addError('script', 'Script content is required');
      return;
    }

    // Basic script validation
    try {
      // Check for dangerous patterns
      const dangerousPatterns = [
        /require\s*\(/,
        /import\s+/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\./,
        /child_process/,
        /fs\./,
        /__dirname/,
        /__filename/
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(transform.script)) {
          result.addError('security', `Script contains potentially dangerous pattern: ${pattern}`);
        }
      }

    } catch (error) {
      result.addError('script', `Script validation failed: ${error.message}`);
    }
  }

  async validateTemplateTransform(transform, result, context) {
    if (!transform.template) {
      result.addError('template', 'Template is required');
      return;
    }

    // Validate template syntax
    try {
      // Check for balanced brackets
      const openBrackets = (transform.template.match(/{{/g) || []).length;
      const closeBrackets = (transform.template.match(/}}/g) || []).length;
      
      if (openBrackets !== closeBrackets) {
        result.addError('template', 'Template has unbalanced brackets');
      }

      // Check for valid variable references
      const variablePattern = /{{(\s*[a-zA-Z_][a-zA-Z0-9_\.]*\s*)}}/g;
      const invalidVariables = transform.template.match(/{{[^}]+}}/g)?.filter(
        match => !variablePattern.test(match)
      );

      if (invalidVariables && invalidVariables.length > 0) {
        result.addError('template', `Invalid template variables: ${invalidVariables.join(', ')}`);
      }

    } catch (error) {
      result.addError('template', `Template validation failed: ${error.message}`);
    }
  }

  async validateLookupTransform(transform, result, context) {
    if (!transform.lookupKey) {
      result.addError('lookupKey', 'Lookup key is required');
    }

    if (!transform.lookupTable && !transform.lookupService) {
      result.addError('lookup', 'Either lookupTable or lookupService is required');
    }

    if (transform.lookupTable && !transform.lookupField) {
      result.addError('lookupField', 'Lookup field is required when using lookupTable');
    }
  }

  async validateOutput(output, schema) {
    // This would use the SchemaValidator from the ValidationFramework
    // For now, return a simple validation
    return { valid: true, errors: [] };
  }
}

/**
 * Conditional Logic Validator
 * Validates conditional expressions and logic
 */
class ConditionalLogicValidator extends BaseValidator {
  constructor(options = {}) {
    super('ConditionalLogicValidator', options);
    this.allowedOperators = options.allowedOperators || [
      '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin',
      '$and', '$or', '$not', '$exists', '$regex'
    ];
  }

  async performValidation(condition, context) {
    const result = new ValidationResult();
    
    if (!condition) {
      result.addError('condition', 'Condition is required');
      return result;
    }

    // Validate condition structure
    this.validateConditionStructure(condition, '', result);

    // Validate referenced fields if schema is provided
    if (context.schema) {
      this.validateReferencedFields(condition, context.schema, result);
    }

    return result;
  }

  validateConditionStructure(condition, path, result) {
    if (typeof condition === 'boolean' || typeof condition === 'function') {
      return; // Valid condition
    }

    if (typeof condition !== 'object' || condition === null) {
      result.addError(path, 'Condition must be an object, boolean, or function');
      return;
    }

    for (const [key, value] of Object.entries(condition)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (key.startsWith('$')) {
        // Operator
        if (!this.allowedOperators.includes(key)) {
          result.addError(currentPath, `Unknown operator: ${key}`);
        }

        // Validate operator usage
        switch (key) {
          case '$and':
          case '$or':
            if (!Array.isArray(value)) {
              result.addError(currentPath, `${key} operator requires an array`);
            } else {
              value.forEach((item, index) => {
                this.validateConditionStructure(item, `${currentPath}[${index}]`, result);
              });
            }
            break;
          case '$not':
            this.validateConditionStructure(value, currentPath, result);
            break;
          case '$in':
          case '$nin':
            if (!Array.isArray(value)) {
              result.addError(currentPath, `${key} operator requires an array`);
            }
            break;
          case '$regex':
            if (typeof value !== 'string') {
              result.addError(currentPath, '$regex operator requires a string pattern');
            }
            break;
        }
      } else {
        // Field condition
        if (typeof value === 'object' && value !== null) {
          this.validateConditionStructure(value, currentPath, result);
        }
      }
    }
  }

  validateReferencedFields(condition, schema, result) {
    const referencedFields = this.extractReferencedFields(condition);
    
    for (const field of referencedFields) {
      if (!this.fieldExistsInSchema(field, schema)) {
        result.addWarning('field', `Referenced field '${field}' not found in schema`);
      }
    }
  }

  extractReferencedFields(condition, fields = new Set()) {
    if (typeof condition !== 'object' || condition === null) {
      return fields;
    }

    for (const [key, value] of Object.entries(condition)) {
      if (!key.startsWith('$')) {
        fields.add(key);
      }

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => this.extractReferencedFields(item, fields));
        } else {
          this.extractReferencedFields(value, fields);
        }
      }
    }

    return fields;
  }

  fieldExistsInSchema(fieldPath, schema) {
    const parts = fieldPath.split('.');
    let current = schema.properties;

    for (const part of parts) {
      if (!current || !current[part]) {
        return false;
      }
      if (current[part].properties) {
        current = current[part].properties;
      }
    }

    return true;
  }
}

/**
 * Create default validation rules for mappings
 */
function createDefaultMappingValidationRules() {
  return [
    {
      name: 'requiredFields',
      dimension: 'completeness',
      type: 'completeness',
      weight: 0.3,
      fields: ['id', 'name', 'type', 'sourceSchema', 'targetSchema', 'rules']
    },
    {
      name: 'validMappingType',
      dimension: 'accuracy',
      type: 'custom',
      weight: 0.2,
      validate: (mapping) => {
        const validTypes = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'];
        return {
          passed: validTypes.includes(mapping.type),
          message: `Invalid mapping type: ${mapping.type}`
        };
      }
    },
    {
      name: 'schemaConsistency',
      dimension: 'consistency',
      type: 'custom',
      weight: 0.3,
      validate: (mapping) => {
        if (mapping.sourceSchema && mapping.targetSchema) {
          return {
            passed: mapping.sourceSchema.id !== mapping.targetSchema.id,
            message: 'Source and target schemas should be different'
          };
        }
        return { passed: true };
      }
    }
  ];
}

module.exports = {
  FieldMappingValidator,
  DataQualityValidator,
  TransformationValidator,
  ConditionalLogicValidator,
  createDefaultMappingValidationRules
};