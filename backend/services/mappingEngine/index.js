/**
 * Enhanced Mapping Engine Module
 * 
 * This module provides a comprehensive data transformation and mapping engine
 * with support for complex pipelines, validation, and execution strategies.
 * 
 * Features:
 * - Transformation pipeline architecture with pluggable stages
 * - Built-in preprocessing, transformation, validation, and postprocessing stages
 * - Multiple execution strategies (batch, stream, parallel, sequential)
 * - Comprehensive error handling and recovery mechanisms
 * - Performance optimization with caching and metrics
 * - Extensible design for custom transformations and validators
 * 
 * Usage:
 * ```javascript
 * const { EnhancedMappingEngine } = require('./services/mappingEngine');
 * 
 * const engine = new EnhancedMappingEngine({
 *   enableCache: true,
 *   enableMetrics: true,
 *   maxConcurrency: 10
 * });
 * 
 * const result = await engine.executeMapping(mapping, sourceData, {
 *   executionMode: 'batch',
 *   batchSize: 1000,
 *   progressCallback: (progress) => console.log(progress)
 * });
 * ```
 */

const { EnhancedMappingEngine, MappingValidationError } = require('./EnhancedMappingEngine');
const { TransformationPipeline, PipelineBuilder, PipelineStage, PipelineContext, STAGE_TYPES } = require('./TransformationPipeline');
const {
  DataValidationStage,
  DataSanitizationStage,
  FieldMappingStage,
  DataAggregationStage,
  DataQualityCheckStage,
  DataEnrichmentStage
} = require('./stages');

/**
 * Create a new enhanced mapping engine instance
 * @param {Object} options - Engine configuration options
 * @returns {EnhancedMappingEngine} - Engine instance
 */
function createMappingEngine(options = {}) {
  return new EnhancedMappingEngine(options);
}

/**
 * Create a new pipeline builder
 * @returns {PipelineBuilder} - Pipeline builder instance
 */
function createPipelineBuilder() {
  return new PipelineBuilder();
}

/**
 * Create a transformation pipeline with predefined stages
 * @param {Object} config - Pipeline configuration
 * @returns {TransformationPipeline} - Pipeline instance
 */
function createStandardPipeline(config = {}) {
  const builder = new PipelineBuilder();
  
  // Add default stages
  builder
    .preprocessing(new DataValidationStage('validation', {
      schema: config.sourceSchema,
      rules: config.validationRules || []
    }))
    .preprocessing(new DataSanitizationStage('sanitization', {
      sanitizers: config.sanitizers || [],
      normalizers: config.normalizers || []
    }))
    .transformation(new FieldMappingStage('fieldMapping', {
      mappingRules: config.mappingRules || [],
      defaultValues: config.defaultValues || {}
    }))
    .validation(new DataQualityCheckStage('qualityCheck', {
      qualityRules: config.qualityRules || [],
      threshold: config.qualityThreshold || 0.8
    }))
    .postprocessing(new DataEnrichmentStage('enrichment', {
      enrichmentRules: config.enrichmentRules || []
    }));
  
  return builder.build();
}

/**
 * Utility function to validate mapping configuration
 * @param {Object} mapping - Mapping configuration
 * @returns {Object} - Validation result
 */
function validateMappingConfiguration(mapping) {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!mapping.id) {
    errors.push('Mapping ID is required');
  }
  
  if (!mapping.rules || !Array.isArray(mapping.rules)) {
    errors.push('Mapping rules are required and must be an array');
  }
  
  if (!mapping.sourceSchema) {
    warnings.push('Source schema is not defined');
  }
  
  if (!mapping.targetSchema) {
    warnings.push('Target schema is not defined');
  }
  
  // Validate rules
  if (mapping.rules) {
    for (let i = 0; i < mapping.rules.length; i++) {
      const rule = mapping.rules[i];
      
      if (!rule.type) {
        errors.push(`Rule ${i}: type is required`);
      }
      
      if (!rule.targetField) {
        errors.push(`Rule ${i}: targetField is required`);
      }
      
      if (rule.type === 'direct' && !rule.sourceField) {
        errors.push(`Rule ${i}: sourceField is required for direct mapping`);
      }
      
      if (rule.type === 'transform' && !rule.transformType) {
        errors.push(`Rule ${i}: transformType is required for transform mapping`);
      }
      
      if (rule.type === 'concat' && (!rule.sourceFields || !Array.isArray(rule.sourceFields))) {
        errors.push(`Rule ${i}: sourceFields array is required for concat mapping`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Utility function to create a mapping rule
 * @param {Object} ruleConfig - Rule configuration
 * @returns {Object} - Mapping rule
 */
function createMappingRule(ruleConfig) {
  const rule = {
    name: ruleConfig.name || `rule_${Date.now()}`,
    type: ruleConfig.type,
    targetField: ruleConfig.targetField,
    description: ruleConfig.description || '',
    enabled: ruleConfig.enabled !== false,
    ...ruleConfig
  };
  
  // Validate rule
  const validation = validateMappingRule(rule);
  if (!validation.valid) {
    throw new MappingValidationError(
      `Invalid mapping rule: ${validation.errors.join(', ')}`,
      validation
    );
  }
  
  return rule;
}

/**
 * Validate a single mapping rule
 * @param {Object} rule - Mapping rule
 * @returns {Object} - Validation result
 */
function validateMappingRule(rule) {
  const errors = [];
  
  const validTypes = ['direct', 'transform', 'concat', 'split', 'lookup', 'formula'];
  
  if (!rule.type) {
    errors.push('Rule type is required');
  } else if (!validTypes.includes(rule.type)) {
    errors.push(`Invalid rule type: ${rule.type}. Must be one of: ${validTypes.join(', ')}`);
  }
  
  if (!rule.targetField) {
    errors.push('Target field is required');
  }
  
  switch (rule.type) {
    case 'direct':
      if (!rule.sourceField) {
        errors.push('Source field is required for direct mapping');
      }
      break;
    case 'transform':
      if (!rule.sourceField) {
        errors.push('Source field is required for transform mapping');
      }
      if (!rule.transformType) {
        errors.push('Transform type is required for transform mapping');
      }
      break;
    case 'concat':
      if (!rule.sourceFields || !Array.isArray(rule.sourceFields)) {
        errors.push('Source fields array is required for concat mapping');
      }
      break;
    case 'split':
      if (!rule.sourceField) {
        errors.push('Source field is required for split mapping');
      }
      break;
    case 'lookup':
      if (!rule.sourceField) {
        errors.push('Source field is required for lookup mapping');
      }
      if (!rule.lookupTable) {
        errors.push('Lookup table is required for lookup mapping');
      }
      break;
    case 'formula':
      if (!rule.formula) {
        errors.push('Formula is required for formula mapping');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Performance profiler for mapping operations
 */
class MappingProfiler {
  constructor() {
    this.profiles = new Map();
  }
  
  startProfile(id) {
    this.profiles.set(id, {
      startTime: process.hrtime.bigint(),
      memoryStart: process.memoryUsage()
    });
  }
  
  endProfile(id) {
    const profile = this.profiles.get(id);
    if (!profile) return null;
    
    const endTime = process.hrtime.bigint();
    const memoryEnd = process.memoryUsage();
    
    const result = {
      duration: Number(endTime - profile.startTime) / 1000000, // Convert to milliseconds
      memoryUsage: {
        heapUsed: memoryEnd.heapUsed - profile.memoryStart.heapUsed,
        heapTotal: memoryEnd.heapTotal - profile.memoryStart.heapTotal,
        external: memoryEnd.external - profile.memoryStart.external,
        rss: memoryEnd.rss - profile.memoryStart.rss
      }
    };
    
    this.profiles.delete(id);
    return result;
  }
  
  getAllProfiles() {
    return Array.from(this.profiles.entries()).map(([id, profile]) => ({
      id,
      running: true,
      duration: Number(process.hrtime.bigint() - profile.startTime) / 1000000
    }));
  }
}

/**
 * Mapping execution statistics collector
 */
class MappingStatistics {
  constructor() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalRecordsProcessed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      averageRecordsPerSecond: 0,
      errorsByType: new Map(),
      executionsByMapping: new Map()
    };
  }
  
  recordExecution(mappingId, recordCount, executionTime, success, error = null) {
    this.stats.totalExecutions++;
    this.stats.totalRecordsProcessed += recordCount;
    this.stats.totalExecutionTime += executionTime;
    
    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
      
      if (error) {
        const errorType = error.constructor.name;
        this.stats.errorsByType.set(errorType, (this.stats.errorsByType.get(errorType) || 0) + 1);
      }
    }
    
    // Update mapping-specific stats
    if (!this.stats.executionsByMapping.has(mappingId)) {
      this.stats.executionsByMapping.set(mappingId, {
        executions: 0,
        recordsProcessed: 0,
        executionTime: 0,
        successCount: 0,
        errorCount: 0
      });
    }
    
    const mappingStats = this.stats.executionsByMapping.get(mappingId);
    mappingStats.executions++;
    mappingStats.recordsProcessed += recordCount;
    mappingStats.executionTime += executionTime;
    
    if (success) {
      mappingStats.successCount++;
    } else {
      mappingStats.errorCount++;
    }
    
    // Update calculated fields
    this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalExecutions;
    this.stats.averageRecordsPerSecond = this.stats.totalRecordsProcessed / (this.stats.totalExecutionTime / 1000);
  }
  
  getStats() {
    return {
      ...this.stats,
      errorsByType: Object.fromEntries(this.stats.errorsByType),
      executionsByMapping: Object.fromEntries(this.stats.executionsByMapping),
      successRate: this.stats.totalExecutions > 0 
        ? (this.stats.successfulExecutions / this.stats.totalExecutions) * 100 
        : 0
    };
  }
  
  reset() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalRecordsProcessed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      averageRecordsPerSecond: 0,
      errorsByType: new Map(),
      executionsByMapping: new Map()
    };
  }
}

// Create singleton instances
const globalProfiler = new MappingProfiler();
const globalStatistics = new MappingStatistics();

module.exports = {
  // Main classes
  EnhancedMappingEngine,
  TransformationPipeline,
  PipelineBuilder,
  PipelineStage,
  PipelineContext,
  
  // Stage implementations
  DataValidationStage,
  DataSanitizationStage,
  FieldMappingStage,
  DataAggregationStage,
  DataQualityCheckStage,
  DataEnrichmentStage,
  
  // Utility classes
  MappingProfiler,
  MappingStatistics,
  
  // Factory functions
  createMappingEngine,
  createPipelineBuilder,
  createStandardPipeline,
  createMappingRule,
  
  // Validation functions
  validateMappingConfiguration,
  validateMappingRule,
  
  // Errors
  MappingValidationError,
  
  // Constants
  STAGE_TYPES,
  
  // Singletons
  profiler: globalProfiler,
  statistics: globalStatistics
};