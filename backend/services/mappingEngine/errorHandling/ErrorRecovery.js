const EventEmitter = require('events');
const logger = require('../../../src/utils/logger');
const { ErrorClassifier, ErrorType, ErrorSeverity, RecoveryStrategy } = require('./ErrorClassifier');
const { RetryManager, CircuitBreaker, RetryPolicy } = require('./RetryManager');
const DeadLetterQueue = require('./DeadLetterQueue');

/**
 * Error Recovery Service
 * Coordinates error handling, retry logic, and recovery strategies
 */
class ErrorRecovery extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableRetry: options.enableRetry !== false,
      enableCircuitBreaker: options.enableCircuitBreaker !== false,
      enableDeadLetterQueue: options.enableDeadLetterQueue !== false,
      maxRetries: options.maxRetries || 3,
      retryPolicy: options.retryPolicy || RetryPolicy.EXPONENTIAL_BACKOFF,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      dlqOptions: options.dlqOptions || {},
      customRecoveryHandlers: options.customRecoveryHandlers || {},
      metricsEnabled: options.metricsEnabled !== false
    };
    
    // Initialize components
    this.errorClassifier = new ErrorClassifier({
      customClassifiers: options.customClassifiers
    });
    
    // Circuit breaker
    if (this.options.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: this.options.circuitBreakerThreshold,
        resetTimeout: options.circuitBreakerResetTimeout || 60000
      });
      
      this.circuitBreaker.on('open', (data) => {
        this.emit('circuitBreakerOpen', data);
      });
    }
    
    // Retry manager
    if (this.options.enableRetry) {
      this.retryManager = new RetryManager({
        maxRetries: this.options.maxRetries,
        policy: this.options.retryPolicy,
        circuitBreaker: this.circuitBreaker
      });
      
      this.retryManager.on('retryExhausted', (data) => {
        this.emit('retryExhausted', data);
      });
    }
    
    // Dead letter queue
    if (this.options.enableDeadLetterQueue) {
      this.dlq = new DeadLetterQueue(this.options.dlqOptions);
      
      this.dlq.on('queueFull', (data) => {
        this.emit('deadLetterQueueFull', data);
      });
    }
    
    // Recovery handlers
    this.recoveryHandlers = this.initializeRecoveryHandlers();
    
    // Metrics
    this.metrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      retriedErrors: 0,
      dlqEntries: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recoveryStrategies: {}
    };
  }

  /**
   * Initialize recovery handlers for different strategies
   */
  initializeRecoveryHandlers() {
    const handlers = {
      [RecoveryStrategy.RETRY]: this.handleRetry.bind(this),
      [RecoveryStrategy.RETRY_WITH_BACKOFF]: this.handleRetryWithBackoff.bind(this),
      [RecoveryStrategy.SKIP]: this.handleSkip.bind(this),
      [RecoveryStrategy.SKIP_AND_LOG]: this.handleSkipAndLog.bind(this),
      [RecoveryStrategy.FALLBACK]: this.handleFallback.bind(this),
      [RecoveryStrategy.ROLLBACK]: this.handleRollback.bind(this),
      [RecoveryStrategy.CIRCUIT_BREAK]: this.handleCircuitBreak.bind(this),
      [RecoveryStrategy.MANUAL_INTERVENTION]: this.handleManualIntervention.bind(this),
      [RecoveryStrategy.NONE]: this.handleNoRecovery.bind(this)
    };
    
    // Merge with custom handlers
    return { ...handlers, ...this.options.customRecoveryHandlers };
  }

  /**
   * Handle an error with recovery
   */
  async handleError(error, context = {}) {
    try {
      // Update metrics
      this.metrics.totalErrors++;
      
      // Classify the error
      const classification = this.errorClassifier.classify(error, context);
      
      // Update classification metrics
      this.updateClassificationMetrics(classification);
      
      // Log the classified error
      this.logClassifiedError(classification);
      
      // Emit error classified event
      this.emit('errorClassified', classification);
      
      // Get recovery handler
      const handler = this.recoveryHandlers[classification.recoveryStrategy];
      if (!handler) {
        throw new Error(`No handler found for recovery strategy: ${classification.recoveryStrategy}`);
      }
      
      // Execute recovery
      const recoveryResult = await handler(error, classification, context);
      
      // Handle recovery result
      if (recoveryResult.success) {
        this.metrics.recoveredErrors++;
        this.emit('errorRecovered', {
          classification,
          result: recoveryResult
        });
      } else {
        this.metrics.failedRecoveries++;
        this.emit('recoveryFailed', {
          classification,
          result: recoveryResult
        });
        
        // Add to DLQ if enabled and recovery failed
        if (this.options.enableDeadLetterQueue && recoveryResult.addToDLQ !== false) {
          await this.addToDeadLetterQueue(error, classification, context);
        }
      }
      
      return recoveryResult;
      
    } catch (recoveryError) {
      logger.error('Error recovery failed:', recoveryError);
      this.emit('recoveryError', { originalError: error, recoveryError });
      
      return {
        success: false,
        error: recoveryError,
        strategy: 'ERROR_IN_RECOVERY'
      };
    }
  }

  /**
   * Recovery handler implementations
   */
  
  async handleRetry(error, classification, context) {
    if (!this.options.enableRetry || !this.retryManager) {
      return { success: false, strategy: RecoveryStrategy.RETRY, reason: 'Retry disabled' };
    }
    
    try {
      const result = await this.retryManager.execute(
        async () => {
          if (context.retryFunction) {
            return await context.retryFunction();
          }
          throw new Error('No retry function provided');
        },
        {
          maxRetries: context.maxRetries || this.options.maxRetries,
          policy: RetryPolicy.FIXED_DELAY
        }
      );
      
      this.metrics.retriedErrors++;
      
      return {
        success: true,
        strategy: RecoveryStrategy.RETRY,
        result
      };
    } catch (retryError) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        error: retryError
      };
    }
  }

  async handleRetryWithBackoff(error, classification, context) {
    if (!this.options.enableRetry || !this.retryManager) {
      return { 
        success: false, 
        strategy: RecoveryStrategy.RETRY_WITH_BACKOFF, 
        reason: 'Retry disabled' 
      };
    }
    
    try {
      const result = await this.retryManager.execute(
        async () => {
          if (context.retryFunction) {
            return await context.retryFunction();
          }
          throw new Error('No retry function provided');
        },
        {
          maxRetries: context.maxRetries || this.options.maxRetries,
          policy: RetryPolicy.EXPONENTIAL_BACKOFF
        }
      );
      
      this.metrics.retriedErrors++;
      
      return {
        success: true,
        strategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
        result
      };
    } catch (retryError) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
        error: retryError
      };
    }
  }

  async handleSkip(error, classification, context) {
    logger.warn('Skipping error:', {
      error: error.message,
      classification: classification.type,
      context
    });
    
    return {
      success: true,
      strategy: RecoveryStrategy.SKIP,
      skipped: true
    };
  }

  async handleSkipAndLog(error, classification, context) {
    logger.error('Skipping and logging error:', {
      error: error.message,
      stack: error.stack,
      classification,
      context
    });
    
    // Add to DLQ for later analysis
    if (this.options.enableDeadLetterQueue) {
      await this.addToDeadLetterQueue(error, classification, context);
    }
    
    return {
      success: true,
      strategy: RecoveryStrategy.SKIP_AND_LOG,
      skipped: true,
      logged: true
    };
  }

  async handleFallback(error, classification, context) {
    if (!context.fallbackValue && !context.fallbackFunction) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        reason: 'No fallback value or function provided'
      };
    }
    
    try {
      let fallbackResult;
      
      if (context.fallbackFunction) {
        fallbackResult = await context.fallbackFunction(error, classification);
      } else {
        fallbackResult = context.fallbackValue;
      }
      
      return {
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        result: fallbackResult,
        usedFallback: true
      };
    } catch (fallbackError) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        error: fallbackError
      };
    }
  }

  async handleRollback(error, classification, context) {
    if (!context.rollbackFunction) {
      return {
        success: false,
        strategy: RecoveryStrategy.ROLLBACK,
        reason: 'No rollback function provided'
      };
    }
    
    try {
      await context.rollbackFunction(error, classification);
      
      return {
        success: true,
        strategy: RecoveryStrategy.ROLLBACK,
        rolledBack: true
      };
    } catch (rollbackError) {
      logger.error('Rollback failed:', rollbackError);
      
      return {
        success: false,
        strategy: RecoveryStrategy.ROLLBACK,
        error: rollbackError
      };
    }
  }

  async handleCircuitBreak(error, classification, context) {
    if (!this.options.enableCircuitBreaker) {
      return {
        success: false,
        strategy: RecoveryStrategy.CIRCUIT_BREAK,
        reason: 'Circuit breaker disabled'
      };
    }
    
    // Circuit breaker is automatically handled by retry manager
    logger.error('Circuit breaker activated:', {
      error: error.message,
      classification: classification.type
    });
    
    return {
      success: false,
      strategy: RecoveryStrategy.CIRCUIT_BREAK,
      circuitBreakerOpen: true,
      addToDLQ: false // Don't add to DLQ for circuit breaker
    };
  }

  async handleManualIntervention(error, classification, context) {
    logger.error('Manual intervention required:', {
      error: error.message,
      classification,
      context
    });
    
    // Add to DLQ for manual processing
    if (this.options.enableDeadLetterQueue) {
      await this.addToDeadLetterQueue(error, classification, {
        ...context,
        requiresManualIntervention: true
      });
    }
    
    // Emit alert for manual intervention
    this.emit('manualInterventionRequired', {
      error,
      classification,
      context
    });
    
    return {
      success: false,
      strategy: RecoveryStrategy.MANUAL_INTERVENTION,
      requiresManualIntervention: true
    };
  }

  async handleNoRecovery(error, classification, context) {
    logger.error('No recovery possible:', {
      error: error.message,
      classification: classification.type
    });
    
    return {
      success: false,
      strategy: RecoveryStrategy.NONE,
      noRecoveryPossible: true
    };
  }

  /**
   * Add error to dead letter queue
   */
  async addToDeadLetterQueue(error, classification, context) {
    if (!this.dlq) return;
    
    try {
      const entryId = await this.dlq.enqueue(
        context.record || context.data || {},
        error,
        {
          ...context,
          classification,
          timestamp: new Date()
        }
      );
      
      this.metrics.dlqEntries++;
      
      logger.info('Added to dead letter queue:', { entryId });
      
      return entryId;
    } catch (dlqError) {
      logger.error('Failed to add to dead letter queue:', dlqError);
    }
  }

  /**
   * Process dead letter queue entries
   */
  async processDLQEntries(options = {}) {
    if (!this.dlq) {
      throw new Error('Dead letter queue not enabled');
    }
    
    const entries = await this.dlq.dequeue(options);
    const results = {
      processed: 0,
      resolved: 0,
      failed: 0,
      details: []
    };
    
    for (const entry of entries) {
      try {
        results.processed++;
        
        // Attempt to reprocess
        if (entry.context.retryFunction) {
          const result = await entry.context.retryFunction(entry.record);
          await this.dlq.markAsResolved(entry.id, result);
          results.resolved++;
          results.details.push({
            entryId: entry.id,
            status: 'resolved',
            result
          });
        } else {
          await this.dlq.markAsFailed(entry.id, new Error('No retry function available'), false);
          results.failed++;
          results.details.push({
            entryId: entry.id,
            status: 'failed',
            reason: 'No retry function'
          });
        }
      } catch (error) {
        await this.dlq.markAsFailed(entry.id, error, true);
        results.failed++;
        results.details.push({
          entryId: entry.id,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    this.emit('dlqProcessed', results);
    
    return results;
  }

  /**
   * Update classification metrics
   */
  updateClassificationMetrics(classification) {
    // By type
    this.metrics.errorsByType[classification.type] = 
      (this.metrics.errorsByType[classification.type] || 0) + 1;
    
    // By severity
    this.metrics.errorsBySeverity[classification.severity] = 
      (this.metrics.errorsBySeverity[classification.severity] || 0) + 1;
    
    // By recovery strategy
    this.metrics.recoveryStrategies[classification.recoveryStrategy] = 
      (this.metrics.recoveryStrategies[classification.recoveryStrategy] || 0) + 1;
  }

  /**
   * Log classified error with appropriate level
   */
  logClassifiedError(classification) {
    const logData = {
      type: classification.type,
      severity: classification.severity,
      strategy: classification.recoveryStrategy,
      error: classification.error.message,
      metadata: classification.metadata
    };
    
    switch (classification.severity) {
      case ErrorSeverity.CRITICAL:
        logger.fatal('Critical error classified:', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('High severity error classified:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity error classified:', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Low severity error classified:', logData);
        break;
      case ErrorSeverity.WARNING:
        logger.debug('Warning classified:', logData);
        break;
    }
  }

  /**
   * Get recovery metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      dlqStats: this.dlq ? this.dlq.getStatistics() : null,
      retryStats: this.retryManager ? this.retryManager.getStats() : null,
      circuitBreakerState: this.circuitBreaker ? this.circuitBreaker.getState() : null,
      successRate: this.metrics.totalErrors > 0 
        ? (this.metrics.recoveredErrors / this.metrics.totalErrors) * 100 
        : 0
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      retriedErrors: 0,
      dlqEntries: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recoveryStrategies: {}
    };
    
    if (this.retryManager) {
      this.retryManager.resetStats();
    }
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.dlq) {
      await this.dlq.shutdown();
    }
    
    logger.info('Error recovery service shutdown complete');
  }
}

module.exports = ErrorRecovery;