const { PipelineStage, STAGE_TYPES } = require('../TransformationPipeline');
const logger = require('../../../src/utils/logger');

/**
 * Data Validation Stage
 * Validates input data against schema and business rules
 */
class DataValidationStage extends PipelineStage {
  constructor(name = 'dataValidation', options = {}) {
    super(name, STAGE_TYPES.PREPROCESSING, options);
    this.schema = options.schema;
    this.rules = options.rules || [];
    this.strictMode = options.strictMode || false;
  }

  async execute(data, context) {
    logger.debug(`Executing data validation stage: ${this.name}`);
    
    const validationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Schema validation
    if (this.schema) {
      const schemaValidation = await this.validateSchema(data);
      if (!schemaValidation.valid) {
        validationResult.valid = false;
        validationResult.errors.push(...schemaValidation.errors);
      }
    }

    // Business rule validation
    for (const rule of this.rules) {
      const ruleValidation = await this.validateRule(data, rule);
      if (!ruleValidation.valid) {
        if (rule.severity === 'error' || this.strictMode) {
          validationResult.valid = false;
          validationResult.errors.push(...ruleValidation.errors);
        } else {
          validationResult.warnings.push(...ruleValidation.warnings);
        }
      }
    }

    // Add warnings to context
    for (const warning of validationResult.warnings) {
      context.addWarning(warning, this.name);
    }

    // If validation failed, throw error
    if (!validationResult.valid) {
      const error = new Error(`Data validation failed: ${validationResult.errors.join(', ')}`);
      error.code = 'VALIDATION_ERROR';
      error.details = validationResult;
      throw error;
    }

    context.setState('validationResult', validationResult);
    return data;
  }

  async validateSchema(data) {
    // Implement schema validation logic
    return { valid: true, errors: [] };
  }

  async validateRule(data, rule) {
    // Implement business rule validation
    return { valid: true, errors: [], warnings: [] };
  }
}

/**
 * Data Sanitization Stage
 * Cleans and normalizes input data
 */
class DataSanitizationStage extends PipelineStage {
  constructor(name = 'dataSanitization', options = {}) {
    super(name, STAGE_TYPES.PREPROCESSING, options);
    this.sanitizers = options.sanitizers || [];
    this.normalizers = options.normalizers || [];
  }

  async execute(data, context) {
    logger.debug(`Executing data sanitization stage: ${this.name}`);
    
    let processedData = data;

    // Apply sanitizers
    for (const sanitizer of this.sanitizers) {
      processedData = await this.applySanitizer(processedData, sanitizer);
    }

    // Apply normalizers
    for (const normalizer of this.normalizers) {
      processedData = await this.applyNormalizer(processedData, normalizer);
    }

    return processedData;
  }

  async applySanitizer(data, sanitizer) {
    // Implement sanitization logic
    return data;
  }

  async applyNormalizer(data, normalizer) {
    // Implement normalization logic
    return data;
  }
}

/**
 * Field Mapping Stage
 * Maps fields from source to target schema
 */
class FieldMappingStage extends PipelineStage {
  constructor(name = 'fieldMapping', options = {}) {
    super(name, STAGE_TYPES.TRANSFORMATION, options);
    this.mappingRules = options.mappingRules || [];
    this.defaultValues = options.defaultValues || {};
    this.strictMapping = options.strictMapping || false;
  }

  async execute(data, context) {
    logger.debug(`Executing field mapping stage: ${this.name}`);
    
    const mappedData = {};
    const unmappedFields = [];

    // Apply mapping rules
    for (const rule of this.mappingRules) {
      try {
        const mappedValue = await this.applyMappingRule(data, rule);
        this.setNestedValue(mappedData, rule.targetField, mappedValue);
      } catch (error) {
        logger.warn(`Failed to apply mapping rule ${rule.name}:`, error);
        if (this.strictMapping) {
          throw error;
        }
      }
    }

    // Apply default values
    for (const [field, value] of Object.entries(this.defaultValues)) {
      if (this.getNestedValue(mappedData, field) === undefined) {
        this.setNestedValue(mappedData, field, value);
      }
    }

    // Check for unmapped fields
    if (Array.isArray(data)) {
      // Handle array data
      return data.map(item => this.processSingleItem(item, mappedData));
    } else {
      // Handle single object
      return this.processSingleItem(data, mappedData);
    }
  }

  processSingleItem(item, template) {
    const result = { ...template };
    
    // Apply default values first
    for (const [field, value] of Object.entries(this.defaultValues)) {
      this.setNestedValue(result, field, value);
    }
    
    for (const rule of this.mappingRules) {
      try {
        const mappedValue = this.applyMappingRuleSync(item, rule);
        this.setNestedValue(result, rule.targetField, mappedValue);
      } catch (error) {
        logger.warn(`Failed to apply mapping rule ${rule.name}:`, error);
        if (this.strictMapping) {
          throw error;
        }
      }
    }

    return result;
  }

  async applyMappingRule(data, rule) {
    switch (rule.type) {
      case 'direct':
        return this.getNestedValue(data, rule.sourceField);
      case 'transform':
        return this.applyTransformation(data, rule);
      case 'concat':
        return this.applyConcatenation(data, rule);
      case 'split':
        return this.applySplit(data, rule);
      case 'lookup':
        return this.applyLookup(data, rule);
      case 'formula':
        return this.applyFormula(data, rule);
      default:
        throw new Error(`Unknown mapping rule type: ${rule.type}`);
    }
  }

  applyMappingRuleSync(data, rule) {
    // Synchronous version for array processing
    switch (rule.type) {
      case 'direct':
        return this.getNestedValue(data, rule.sourceField);
      case 'transform':
        return this.applyTransformationSync(data, rule);
      case 'concat':
        return this.applyConcatenationSync(data, rule);
      case 'split':
        return this.applySplitSync(data, rule);
      case 'formula':
        return this.applyFormulaSync(data, rule);
      default:
        if (this.strictMapping) {
          throw new Error(`Unknown mapping rule type: ${rule.type}`);
        }
        return this.getNestedValue(data, rule.sourceField);
    }
  }

  async applyTransformation(data, rule) {
    const sourceValue = this.getNestedValue(data, rule.sourceField);
    const transformFunction = this.getTransformFunction(rule.transformType);
    return transformFunction(sourceValue, rule.options);
  }

  applyTransformationSync(data, rule) {
    const sourceValue = this.getNestedValue(data, rule.sourceField);
    const transformFunction = this.getTransformFunction(rule.transformType);
    return transformFunction(sourceValue, rule.options);
  }

  applyConcatenation(data, rule) {
    const values = rule.sourceFields.map(field => 
      this.getNestedValue(data, field) || ''
    );
    return values.join(rule.separator || '');
  }

  applyConcatenationSync(data, rule) {
    return this.applyConcatenation(data, rule);
  }

  applySplit(data, rule) {
    const sourceValue = this.getNestedValue(data, rule.sourceField);
    if (!sourceValue) return [];
    return sourceValue.split(rule.separator || ',');
  }

  applySplitSync(data, rule) {
    return this.applySplit(data, rule);
  }

  async applyLookup(data, rule) {
    const sourceValue = this.getNestedValue(data, rule.sourceField);
    // Implement lookup logic
    return sourceValue;
  }

  applyFormula(data, rule) {
    // Implement formula evaluation
    return this.getNestedValue(data, rule.sourceField);
  }

  applyFormulaSync(data, rule) {
    return this.applyFormula(data, rule);
  }

  getTransformFunction(transformType) {
    const transformLibrary = require('../../../utils/transformLibrary');
    if (transformLibrary[transformType]) {
      return transformLibrary[transformType];
    }
    
    if (this.strictMapping) {
      throw new Error(`Unknown transform type: ${transformType}`);
    }
    
    return (value) => value;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }

  setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((current, part) => {
      if (!current[part]) current[part] = {};
      return current[part];
    }, obj);
    target[last] = value;
  }
}

/**
 * Data Aggregation Stage
 * Aggregates data according to grouping rules
 */
class DataAggregationStage extends PipelineStage {
  constructor(name = 'dataAggregation', options = {}) {
    super(name, STAGE_TYPES.TRANSFORMATION, options);
    this.groupBy = options.groupBy || [];
    this.aggregations = options.aggregations || [];
  }

  async execute(data, context) {
    logger.debug(`Executing data aggregation stage: ${this.name}`);
    
    if (!Array.isArray(data)) {
      return data;
    }

    if (this.groupBy.length === 0) {
      return data;
    }

    const grouped = this.groupData(data);
    const aggregated = this.aggregateGroups(grouped);

    return aggregated;
  }

  groupData(data) {
    const groups = new Map();

    for (const item of data) {
      const key = this.groupBy.map(field => 
        this.getNestedValue(item, field)
      ).join('|');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }

    return groups;
  }

  aggregateGroups(groups) {
    const result = [];

    for (const [key, items] of groups) {
      const aggregated = this.aggregateGroup(items);
      result.push(aggregated);
    }

    return result;
  }

  aggregateGroup(items) {
    const result = {};

    // Copy group by fields
    for (const field of this.groupBy) {
      result[field] = this.getNestedValue(items[0], field);
    }

    // Apply aggregations
    for (const aggregation of this.aggregations) {
      result[aggregation.targetField] = this.applyAggregation(items, aggregation);
    }

    return result;
  }

  applyAggregation(items, aggregation) {
    const values = items.map(item => 
      this.getNestedValue(item, aggregation.sourceField)
    ).filter(value => value !== null && value !== undefined);

    switch (aggregation.type) {
      case 'sum':
        return values.reduce((sum, value) => sum + Number(value), 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
      case 'count':
        return values.length;
      case 'min':
        return Math.min(...values.map(Number));
      case 'max':
        return Math.max(...values.map(Number));
      case 'first':
        return values[0];
      case 'last':
        return values[values.length - 1];
      default:
        return values[0];
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }
}

/**
 * Data Quality Check Stage
 * Validates data quality and completeness
 */
class DataQualityCheckStage extends PipelineStage {
  constructor(name = 'dataQualityCheck', options = {}) {
    super(name, STAGE_TYPES.VALIDATION, options);
    this.qualityRules = options.qualityRules || [];
    this.threshold = options.threshold || 0.8;
  }

  async execute(data, context) {
    logger.debug(`Executing data quality check stage: ${this.name}`);
    
    const qualityReport = {
      totalRecords: Array.isArray(data) ? data.length : 1,
      passedRecords: 0,
      failedRecords: 0,
      qualityScore: 0,
      issues: []
    };

    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const itemQuality = await this.checkItemQuality(data[i], i);
        if (itemQuality.passed) {
          qualityReport.passedRecords++;
        } else {
          qualityReport.failedRecords++;
          qualityReport.issues.push(...itemQuality.issues);
        }
      }
    } else {
      const itemQuality = await this.checkItemQuality(data, 0);
      if (itemQuality.passed) {
        qualityReport.passedRecords = 1;
      } else {
        qualityReport.failedRecords = 1;
        qualityReport.issues.push(...itemQuality.issues);
      }
    }

    qualityReport.qualityScore = qualityReport.passedRecords / qualityReport.totalRecords;

    // Add quality report to context
    context.setState('qualityReport', qualityReport);

    // Check if quality threshold is met
    if (qualityReport.qualityScore < this.threshold) {
      const error = new Error(`Data quality below threshold: ${qualityReport.qualityScore} < ${this.threshold}`);
      error.code = 'QUALITY_THRESHOLD_ERROR';
      error.details = qualityReport;
      throw error;
    }

    return data;
  }

  async checkItemQuality(item, index) {
    const issues = [];
    let passed = true;

    for (const rule of this.qualityRules) {
      const ruleResult = await this.applyQualityRule(item, rule, index);
      if (!ruleResult.passed) {
        passed = false;
        issues.push(...ruleResult.issues);
      }
    }

    return { passed, issues };
  }

  async applyQualityRule(item, rule, index) {
    const issues = [];
    let passed = true;

    switch (rule.type) {
      case 'required':
        if (!this.checkRequired(item, rule)) {
          passed = false;
          issues.push({
            type: 'required',
            field: rule.field,
            message: `Required field ${rule.field} is missing`,
            index
          });
        }
        break;
      case 'format':
        if (!this.checkFormat(item, rule)) {
          passed = false;
          issues.push({
            type: 'format',
            field: rule.field,
            message: `Field ${rule.field} does not match required format`,
            index
          });
        }
        break;
      case 'range':
        if (!this.checkRange(item, rule)) {
          passed = false;
          issues.push({
            type: 'range',
            field: rule.field,
            message: `Field ${rule.field} is outside allowed range`,
            index
          });
        }
        break;
      case 'uniqueness':
        // This would require additional context to check uniqueness
        break;
    }

    return { passed, issues };
  }

  checkRequired(item, rule) {
    const value = this.getNestedValue(item, rule.field);
    return value !== null && value !== undefined && value !== '';
  }

  checkFormat(item, rule) {
    const value = this.getNestedValue(item, rule.field);
    if (value === null || value === undefined) return true;
    
    const regex = new RegExp(rule.pattern);
    return regex.test(value);
  }

  checkRange(item, rule) {
    const value = this.getNestedValue(item, rule.field);
    if (value === null || value === undefined) return true;
    
    const numValue = Number(value);
    return numValue >= rule.min && numValue <= rule.max;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }
}

/**
 * Data Enrichment Stage
 * Enriches data with additional information
 */
class DataEnrichmentStage extends PipelineStage {
  constructor(name = 'dataEnrichment', options = {}) {
    super(name, STAGE_TYPES.POSTPROCESSING, options);
    this.enrichmentRules = options.enrichmentRules || [];
  }

  async execute(data, context) {
    logger.debug(`Executing data enrichment stage: ${this.name}`);
    
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.enrichItem(item, context)));
    } else {
      return this.enrichItem(data, context);
    }
  }

  async enrichItem(item, context) {
    let enrichedItem = { ...item };

    for (const rule of this.enrichmentRules) {
      enrichedItem = await this.applyEnrichmentRule(enrichedItem, rule, context);
    }

    return enrichedItem;
  }

  async applyEnrichmentRule(item, rule, context) {
    switch (rule.type) {
      case 'timestamp':
        return this.addTimestamp(item, rule);
      case 'id':
        return this.addId(item, rule);
      case 'metadata':
        return this.addMetadata(item, rule, context);
      case 'lookup':
        return this.addLookupData(item, rule);
      default:
        return item;
    }
  }

  addTimestamp(item, rule) {
    const timestamp = new Date().toISOString();
    this.setNestedValue(item, rule.targetField, timestamp);
    return item;
  }

  addId(item, rule) {
    const id = this.generateId(rule.options);
    this.setNestedValue(item, rule.targetField, id);
    return item;
  }

  addMetadata(item, rule, context) {
    const metadata = {
      processedAt: new Date().toISOString(),
      contextId: context.id,
      ...rule.metadata
    };
    this.setNestedValue(item, rule.targetField, metadata);
    return item;
  }

  async addLookupData(item, rule) {
    // Implement lookup data enrichment
    return item;
  }

  generateId(options = {}) {
    return `${options.prefix || 'id'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((current, part) => {
      if (!current[part]) current[part] = {};
      return current[part];
    }, obj);
    target[last] = value;
  }
}

module.exports = {
  DataValidationStage,
  DataSanitizationStage,
  FieldMappingStage,
  DataAggregationStage,
  DataQualityCheckStage,
  DataEnrichmentStage
};