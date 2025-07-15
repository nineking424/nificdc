const { ErrorClassifier, ErrorType, ErrorSeverity, RecoveryStrategy } = require('../../../../services/mappingEngine/errorHandling/ErrorClassifier');

describe('ErrorClassifier', () => {
  let classifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe('classify', () => {
    it('should classify validation errors', () => {
      const error = new Error('Validation failed: required field missing');
      const classification = classifier.classify(error);

      expect(classification.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.SKIP_AND_LOG);
    });

    it('should classify network errors', () => {
      const error = new Error('Connection refused: Unable to connect to server');
      error.code = 'ECONNREFUSED';
      const classification = classifier.classify(error);

      expect(classification.type).toBe(ErrorType.NETWORK_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.RETRY_WITH_BACKOFF);
    });

    it('should classify timeout errors', () => {
      const error = new Error('Operation timed out');
      const classification = classifier.classify(error);

      expect(classification.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.RETRY_WITH_BACKOFF);
    });

    it('should classify memory errors', () => {
      const error = new Error('JavaScript heap out of memory');
      const classification = classifier.classify(error);

      expect(classification.type).toBe(ErrorType.MEMORY_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.CIRCUIT_BREAK);
    });

    it('should classify duplicate key errors', () => {
      const error = new Error('Duplicate key violation');
      const classification = classifier.classify(error);

      expect(classification.type).toBe(ErrorType.DUPLICATE_KEY_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.SKIP);
    });

    it('should classify unknown errors', () => {
      const error = new Error('Some random error');
      const classification = classifier.classify(error);

      expect(classification.type).toBe(ErrorType.UNKNOWN_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.SKIP_AND_LOG);
    });

    it('should include error details in classification', () => {
      const error = new Error('Test error');
      error.code = 'TEST_CODE';
      const context = { requestId: '123' };
      
      const classification = classifier.classify(error, context);

      expect(classification.error).toMatchObject({
        message: 'Test error',
        code: 'TEST_CODE',
        name: 'Error'
      });
      expect(classification.context.requestId).toBe('123');
    });

    it('should use custom classifiers when provided', () => {
      const customClassifier = jest.fn((error) => {
        if (error.message.includes('custom')) {
          return {
            type: ErrorType.BUSINESS_RULE_VIOLATION,
            severity: ErrorSeverity.HIGH,
            recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION
          };
        }
        return null;
      });

      classifier = new ErrorClassifier({
        customClassifiers: [customClassifier]
      });

      const error = new Error('custom business error');
      const classification = classifier.classify(error);

      expect(customClassifier).toHaveBeenCalled();
      expect(classification.type).toBe(ErrorType.BUSINESS_RULE_VIOLATION);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable error types', () => {
      expect(classifier.isRetryable(ErrorType.NETWORK_ERROR)).toBe(true);
      expect(classifier.isRetryable(ErrorType.TIMEOUT_ERROR)).toBe(true);
      expect(classifier.isRetryable(ErrorType.TRANSFORMATION_ERROR)).toBe(true);
      expect(classifier.isRetryable(ErrorType.SYSTEM_ERROR)).toBe(true);
    });

    it('should identify non-retryable error types', () => {
      expect(classifier.isRetryable(ErrorType.VALIDATION_ERROR)).toBe(false);
      expect(classifier.isRetryable(ErrorType.DUPLICATE_KEY_ERROR)).toBe(false);
      expect(classifier.isRetryable(ErrorType.BUSINESS_RULE_VIOLATION)).toBe(false);
    });
  });

  describe('analyzeErrorTrend', () => {
    it('should analyze error trends and provide recommendations', () => {
      const errors = [
        { type: ErrorType.NETWORK_ERROR, severity: ErrorSeverity.HIGH },
        { type: ErrorType.NETWORK_ERROR, severity: ErrorSeverity.HIGH },
        { type: ErrorType.TIMEOUT_ERROR, severity: ErrorSeverity.HIGH },
        { type: ErrorType.VALIDATION_ERROR, severity: ErrorSeverity.MEDIUM }
      ];

      const classifiedErrors = errors.map(e => classifier.enrichClassification(e, new Error(), {}));
      const analysis = classifier.analyzeErrorTrend(classifiedErrors);

      expect(analysis.totalErrors).toBe(4);
      expect(analysis.errorCounts[ErrorType.NETWORK_ERROR]).toBe(2);
      expect(analysis.severityCounts[ErrorSeverity.HIGH]).toBe(3);
      expect(analysis.recommendation).toBeDefined();
    });

    it('should recommend circuit breaker for high critical error rate', () => {
      const errors = Array(10).fill({
        type: ErrorType.MEMORY_ERROR,
        severity: ErrorSeverity.CRITICAL
      });

      const classifiedErrors = errors.map(e => classifier.enrichClassification(e, new Error(), {}));
      const analysis = classifier.analyzeErrorTrend(classifiedErrors);

      expect(analysis.recommendation.action).toBe(RecoveryStrategy.CIRCUIT_BREAK);
      expect(analysis.recommendation.message).toContain('Critical error rate too high');
    });
  });

  describe('classifyByCode', () => {
    it('should classify errors by error code', () => {
      const result = classifier.classifyByCode('ECONNREFUSED');
      expect(result.type).toBe(ErrorType.NETWORK_ERROR);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.RETRY_WITH_BACKOFF);
    });

    it('should return undefined for unknown codes', () => {
      const result = classifier.classifyByCode('UNKNOWN_CODE');
      expect(result).toBeUndefined();
    });
  });
});