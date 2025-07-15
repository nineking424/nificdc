const logger = require('../../../src/utils/logger');

/**
 * Error Types for Mapping Engine
 */
const ErrorType = {
  // Validation Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  FORMAT_ERROR: 'FORMAT_ERROR',
  
  // Transformation Errors
  TRANSFORMATION_ERROR: 'TRANSFORMATION_ERROR',
  FUNCTION_NOT_FOUND: 'FUNCTION_NOT_FOUND',
  TRANSFORMATION_TIMEOUT: 'TRANSFORMATION_TIMEOUT',
  INVALID_EXPRESSION: 'INVALID_EXPRESSION',
  
  // Data Errors
  DATA_QUALITY_ERROR: 'DATA_QUALITY_ERROR',
  DATA_INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',
  DUPLICATE_KEY_ERROR: 'DUPLICATE_KEY_ERROR',
  
  // System Errors
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Business Logic Errors
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Error Severity Levels
 */
const ErrorSeverity = {
  CRITICAL: 'CRITICAL',  // System failure, immediate attention required
  HIGH: 'HIGH',          // Major issue, processing cannot continue
  MEDIUM: 'MEDIUM',      // Significant issue, partial processing possible
  LOW: 'LOW',            // Minor issue, can be logged and continued
  WARNING: 'WARNING'     // Potential issue, no immediate action required
};

/**
 * Recovery Strategy Types
 */
const RecoveryStrategy = {
  RETRY: 'RETRY',                    // Retry the operation
  RETRY_WITH_BACKOFF: 'RETRY_WITH_BACKOFF', // Retry with exponential backoff
  SKIP: 'SKIP',                      // Skip the problematic record
  SKIP_AND_LOG: 'SKIP_AND_LOG',     // Skip and log to dead letter queue
  FALLBACK: 'FALLBACK',              // Use fallback value or operation
  ROLLBACK: 'ROLLBACK',              // Rollback the entire operation
  CIRCUIT_BREAK: 'CIRCUIT_BREAK',    // Stop processing to prevent cascading failures
  MANUAL_INTERVENTION: 'MANUAL_INTERVENTION', // Require human intervention
  NONE: 'NONE'                       // No recovery possible
};

/**
 * Error Classifier
 * Classifies errors and determines appropriate recovery strategies
 */
class ErrorClassifier {
  constructor(options = {}) {
    this.options = options;
    this.customClassifiers = options.customClassifiers || [];
    this.severityThresholds = {
      criticalErrorRate: options.criticalErrorRate || 0.5,
      highErrorRate: options.highErrorRate || 0.3,
      mediumErrorRate: options.mediumErrorRate || 0.1
    };
    
    // Error patterns for classification
    this.errorPatterns = this.initializeErrorPatterns();
  }

  /**
   * Initialize error patterns for classification
   */
  initializeErrorPatterns() {
    return [
      // Validation patterns
      {
        pattern: /validation|validate|invalid.*schema|schema.*invalid/i,
        type: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.MEDIUM,
        defaultStrategy: RecoveryStrategy.SKIP_AND_LOG
      },
      {
        pattern: /required.*field|field.*required|missing.*required/i,
        type: ErrorType.REQUIRED_FIELD_MISSING,
        severity: ErrorSeverity.HIGH,
        defaultStrategy: RecoveryStrategy.SKIP_AND_LOG
      },
      {
        pattern: /type.*mismatch|expected.*type|invalid.*type/i,
        type: ErrorType.TYPE_MISMATCH,
        severity: ErrorSeverity.MEDIUM,
        defaultStrategy: RecoveryStrategy.SKIP
      },
      
      // Transformation patterns
      {
        pattern: /\btransform\b|\btransformation.*failed\b|function.*not.*found/i,
        type: ErrorType.TRANSFORMATION_ERROR,
        severity: ErrorSeverity.HIGH,
        defaultStrategy: RecoveryStrategy.RETRY
      },
      {
        pattern: /timeout|timed.*out|execution.*timeout/i,
        type: ErrorType.TIMEOUT_ERROR,
        severity: ErrorSeverity.HIGH,
        defaultStrategy: RecoveryStrategy.RETRY_WITH_BACKOFF
      },
      
      // Data patterns
      {
        pattern: /duplicate.*key|unique.*constraint|already.*exists/i,
        type: ErrorType.DUPLICATE_KEY_ERROR,
        severity: ErrorSeverity.MEDIUM,
        defaultStrategy: RecoveryStrategy.SKIP
      },
      {
        pattern: /data.*quality|quality.*check.*failed/i,
        type: ErrorType.DATA_QUALITY_ERROR,
        severity: ErrorSeverity.MEDIUM,
        defaultStrategy: RecoveryStrategy.SKIP_AND_LOG
      },
      
      // System patterns
      {
        pattern: /out.*of.*memory|memory.*exhausted|heap.*limit/i,
        type: ErrorType.MEMORY_ERROR,
        severity: ErrorSeverity.CRITICAL,
        defaultStrategy: RecoveryStrategy.CIRCUIT_BREAK
      },
      {
        pattern: /network|connection.*refused|ECONNREFUSED|ETIMEDOUT/i,
        type: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.HIGH,
        defaultStrategy: RecoveryStrategy.RETRY_WITH_BACKOFF
      },
      
      // Business patterns
      {
        pattern: /business.*rule|rule.*violation|constraint.*violation/i,
        type: ErrorType.BUSINESS_RULE_VIOLATION,
        severity: ErrorSeverity.HIGH,
        defaultStrategy: RecoveryStrategy.SKIP_AND_LOG
      }
    ];
  }

  /**
   * Classify an error
   * @param {Error} error - The error to classify
   * @param {Object} context - Additional context
   * @returns {Object} - Classification result
   */
  classify(error, context = {}) {
    // Check custom classifiers first
    for (const classifier of this.customClassifiers) {
      const result = classifier(error, context);
      if (result) {
        return this.enrichClassification(result, error, context);
      }
    }
    
    // Pattern-based classification
    const errorMessage = error.message || error.toString();
    const errorStack = error.stack || '';
    
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(errorMessage) || pattern.pattern.test(errorStack)) {
        return this.enrichClassification({
          type: pattern.type,
          severity: pattern.severity,
          recoveryStrategy: pattern.defaultStrategy
        }, error, context);
      }
    }
    
    // Check error code
    if (error.code) {
      const codeClassification = this.classifyByCode(error.code);
      if (codeClassification) {
        return this.enrichClassification(codeClassification, error, context);
      }
    }
    
    // Default classification
    return this.enrichClassification({
      type: ErrorType.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.SKIP_AND_LOG
    }, error, context);
  }

  /**
   * Classify by error code
   */
  classifyByCode(code) {
    const codeMap = {
      'VALIDATION_ERROR': {
        type: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RecoveryStrategy.SKIP_AND_LOG
      },
      'ECONNREFUSED': {
        type: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.RETRY_WITH_BACKOFF
      },
      'ETIMEDOUT': {
        type: ErrorType.TIMEOUT_ERROR,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.RETRY_WITH_BACKOFF
      },
      'ENOMEM': {
        type: ErrorType.MEMORY_ERROR,
        severity: ErrorSeverity.CRITICAL,
        recoveryStrategy: RecoveryStrategy.CIRCUIT_BREAK
      }
    };
    
    return codeMap[code];
  }

  /**
   * Enrich classification with additional information
   */
  enrichClassification(classification, error, context) {
    return {
      ...classification,
      error: {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      },
      context: {
        ...context,
        timestamp: new Date(),
        classifiedBy: 'ErrorClassifier'
      },
      metadata: {
        isRetryable: this.isRetryable(classification.type),
        isRecoverable: this.isRecoverable(classification.type),
        requiresManualIntervention: classification.recoveryStrategy === RecoveryStrategy.MANUAL_INTERVENTION,
        affectsDataIntegrity: this.affectsDataIntegrity(classification.type)
      }
    };
  }

  /**
   * Determine if error type is retryable
   */
  isRetryable(errorType) {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.TRANSFORMATION_ERROR,
      ErrorType.SYSTEM_ERROR
    ];
    
    return retryableTypes.includes(errorType);
  }

  /**
   * Determine if error type is recoverable
   */
  isRecoverable(errorType) {
    const nonRecoverableTypes = [
      ErrorType.MEMORY_ERROR,
      ErrorType.DATA_INTEGRITY_ERROR,
      ErrorType.UNKNOWN_ERROR
    ];
    
    return !nonRecoverableTypes.includes(errorType);
  }

  /**
   * Determine if error affects data integrity
   */
  affectsDataIntegrity(errorType) {
    const integrityTypes = [
      ErrorType.DATA_INTEGRITY_ERROR,
      ErrorType.DUPLICATE_KEY_ERROR,
      ErrorType.CONSTRAINT_VIOLATION
    ];
    
    return integrityTypes.includes(errorType);
  }

  /**
   * Analyze error patterns over time
   */
  analyzeErrorTrend(errors) {
    const errorCounts = {};
    const severityCounts = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.WARNING]: 0
    };
    
    errors.forEach(classification => {
      // Count by type
      errorCounts[classification.type] = (errorCounts[classification.type] || 0) + 1;
      
      // Count by severity
      severityCounts[classification.severity]++;
    });
    
    const totalErrors = errors.length;
    const errorRate = totalErrors > 0 ? {
      critical: severityCounts[ErrorSeverity.CRITICAL] / totalErrors,
      high: severityCounts[ErrorSeverity.HIGH] / totalErrors,
      medium: severityCounts[ErrorSeverity.MEDIUM] / totalErrors,
      low: severityCounts[ErrorSeverity.LOW] / totalErrors,
      warning: severityCounts[ErrorSeverity.WARNING] / totalErrors
    } : {};
    
    return {
      totalErrors,
      errorCounts,
      severityCounts,
      errorRate,
      recommendation: this.getRecommendation(errorRate)
    };
  }

  /**
   * Get recommendation based on error rates
   */
  getRecommendation(errorRate) {
    if (errorRate.critical >= this.severityThresholds.criticalErrorRate) {
      return {
        action: RecoveryStrategy.CIRCUIT_BREAK,
        message: 'Critical error rate too high. Circuit breaker should be activated.'
      };
    }
    
    if (errorRate.high >= this.severityThresholds.highErrorRate) {
      return {
        action: RecoveryStrategy.RETRY_WITH_BACKOFF,
        message: 'High error rate detected. Implement backoff strategy.'
      };
    }
    
    if (errorRate.medium >= this.severityThresholds.mediumErrorRate) {
      return {
        action: RecoveryStrategy.SKIP_AND_LOG,
        message: 'Moderate error rate. Consider logging errors for analysis.'
      };
    }
    
    return {
      action: RecoveryStrategy.NONE,
      message: 'Error rate within acceptable limits.'
    };
  }
}

module.exports = {
  ErrorClassifier,
  ErrorType,
  ErrorSeverity,
  RecoveryStrategy
};