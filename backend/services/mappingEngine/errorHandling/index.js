/**
 * Error Handling Module for Enhanced Mapping Engine
 * Exports all error handling components
 */

const { ErrorClassifier, ErrorType, ErrorSeverity, RecoveryStrategy } = require('./ErrorClassifier');
const { RetryManager, CircuitBreaker, RetryPolicy } = require('./RetryManager');
const DeadLetterQueue = require('./DeadLetterQueue');
const ErrorRecovery = require('./ErrorRecovery');
const { RollbackManager, RollbackActionType } = require('./RollbackManager');

module.exports = {
  // Main error recovery service
  ErrorRecovery,
  
  // Error classification
  ErrorClassifier,
  ErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  
  // Retry management
  RetryManager,
  CircuitBreaker,
  RetryPolicy,
  
  // Dead letter queue
  DeadLetterQueue,
  
  // Rollback management
  RollbackManager,
  RollbackActionType
};