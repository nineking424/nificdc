const EventEmitter = require('events');
const logger = require('../../../src/utils/logger');

/**
 * Retry Policies
 */
const RetryPolicy = {
  EXPONENTIAL_BACKOFF: 'EXPONENTIAL_BACKOFF',
  LINEAR_BACKOFF: 'LINEAR_BACKOFF',
  FIXED_DELAY: 'FIXED_DELAY',
  FIBONACCI_BACKOFF: 'FIBONACCI_BACKOFF',
  CUSTOM: 'CUSTOM'
};

/**
 * Retry Manager
 * Handles retry logic with various backoff strategies
 */
class RetryManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.defaultOptions = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      factor: options.factor || 2,
      policy: options.policy || RetryPolicy.EXPONENTIAL_BACKOFF,
      jitter: options.jitter !== false, // Add randomness to prevent thundering herd
      retryableErrors: options.retryableErrors || null,
      onRetry: options.onRetry || null,
      timeout: options.timeout || null
    };
    
    // Circuit breaker integration
    this.circuitBreaker = options.circuitBreaker || null;
    
    // Retry statistics
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalRetries: 0,
      retrySuccesses: 0,
      retryFailures: 0
    };
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options
   * @returns {Promise<*>} - Function result
   */
  async execute(fn, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    let lastError;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Check circuit breaker if available
        if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
          throw new Error('Circuit breaker is open');
        }
        
        this.stats.totalAttempts++;
        
        // Execute with timeout if specified
        const result = config.timeout
          ? await this.executeWithTimeout(fn, config.timeout, attempt)
          : await fn(attempt);
        
        this.stats.successfulAttempts++;
        
        if (attempt > 0) {
          this.stats.retrySuccesses++;
          this.emit('retrySuccess', {
            attempt,
            totalAttempts: attempt + 1
          });
        }
        
        // Report success to circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordSuccess();
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.stats.failedAttempts++;
        
        // Report failure to circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordFailure();
        }
        
        // Check if error is retryable
        if (!this.isRetryable(error, config.retryableErrors)) {
          throw error;
        }
        
        // Check if we've exhausted retries
        if (attempt === config.maxRetries) {
          this.stats.retryFailures++;
          this.emit('retryExhausted', {
            attempts: attempt + 1,
            lastError: error
          });
          throw this.wrapError(error, attempt + 1);
        }
        
        // Calculate delay
        const delay = this.calculateDelay(attempt, config);
        
        // Emit retry event
        this.emit('retry', {
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          delay,
          error: error.message
        });
        
        // Call onRetry callback if provided
        if (config.onRetry) {
          await config.onRetry(error, attempt + 1);
        }
        
        this.stats.totalRetries++;
        
        // Wait before retry
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeout, attempt) {
    return Promise.race([
      fn(attempt),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error, retryableErrors) {
    if (!retryableErrors) {
      // Default retryable conditions
      const retryableMessages = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN',
        'timeout',
        'network'
      ];
      
      return retryableMessages.some(msg => 
        error.message.includes(msg) || error.code === msg
      );
    }
    
    if (typeof retryableErrors === 'function') {
      return retryableErrors(error);
    }
    
    if (Array.isArray(retryableErrors)) {
      return retryableErrors.some(retryableError => {
        if (typeof retryableError === 'string') {
          return error.message.includes(retryableError) || error.code === retryableError;
        }
        if (retryableError instanceof RegExp) {
          return retryableError.test(error.message);
        }
        return false;
      });
    }
    
    return false;
  }

  /**
   * Calculate delay based on retry policy
   */
  calculateDelay(attempt, config) {
    let baseDelay;
    
    switch (config.policy) {
      case RetryPolicy.EXPONENTIAL_BACKOFF:
        baseDelay = Math.min(
          config.initialDelay * Math.pow(config.factor, attempt),
          config.maxDelay
        );
        break;
        
      case RetryPolicy.LINEAR_BACKOFF:
        baseDelay = Math.min(
          config.initialDelay * (attempt + 1),
          config.maxDelay
        );
        break;
        
      case RetryPolicy.FIXED_DELAY:
        baseDelay = config.initialDelay;
        break;
        
      case RetryPolicy.FIBONACCI_BACKOFF:
        baseDelay = Math.min(
          this.fibonacci(attempt + 1) * config.initialDelay,
          config.maxDelay
        );
        break;
        
      case RetryPolicy.CUSTOM:
        if (typeof config.customDelay === 'function') {
          baseDelay = config.customDelay(attempt);
        } else {
          baseDelay = config.initialDelay;
        }
        break;
        
      default:
        baseDelay = config.initialDelay;
    }
    
    // Add jitter if enabled
    if (config.jitter) {
      const jitterValue = baseDelay * 0.2 * Math.random(); // Up to 20% jitter
      baseDelay = baseDelay + jitterValue - (baseDelay * 0.1); // ±10% range
    }
    
    return Math.round(baseDelay);
  }

  /**
   * Calculate fibonacci number
   */
  fibonacci(n) {
    if (n <= 1) return n;
    let prev = 0, curr = 1;
    for (let i = 2; i <= n; i++) {
      [prev, curr] = [curr, prev + curr];
    }
    return curr;
  }

  /**
   * Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrap error with retry information
   */
  wrapError(originalError, attempts) {
    const error = new Error(`Operation failed after ${attempts} attempts: ${originalError.message}`);
    error.name = 'RetryError';
    error.code = 'RETRY_EXHAUSTED';
    error.originalError = originalError;
    error.attempts = attempts;
    return error;
  }

  /**
   * Get retry statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalAttempts > 0
        ? (this.stats.successfulAttempts / this.stats.totalAttempts) * 100
        : 0,
      retryRate: this.stats.totalAttempts > 0
        ? (this.stats.totalRetries / this.stats.totalAttempts) * 100
        : 0,
      retrySuccessRate: this.stats.totalRetries > 0
        ? (this.stats.retrySuccesses / this.stats.totalRetries) * 100
        : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalRetries: 0,
      retrySuccesses: 0,
      retryFailures: 0
    };
  }

  /**
   * Create a retry wrapper for a function
   */
  wrap(fn, options = {}) {
    return async (...args) => {
      return this.execute(() => fn(...args), options);
    };
  }
}

/**
 * Circuit Breaker
 * Prevents cascading failures by stopping operations when error threshold is reached
 */
class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 10000, // 10 seconds
      minimumRequests: options.minimumRequests || 10,
      disableMonitoring: options.disableMonitoring || false
    };
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.monitoringInterval = null;
    
    // Start monitoring
    if (!this.options.disableMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Check if operation can be executed
   */
  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.emit('stateChange', { from: 'OPEN', to: 'HALF_OPEN' });
        return true;
      }
      return false;
    }
    
    // HALF_OPEN state
    return true;
  }

  /**
   * Record successful operation
   */
  recordSuccess() {
    this.requests++;
    this.successes++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      this.emit('stateChange', { from: 'HALF_OPEN', to: 'CLOSED' });
    }
  }

  /**
   * Record failed operation
   */
  recordFailure() {
    this.requests++;
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.open();
    } else if (this.state === 'CLOSED' && this.shouldOpen()) {
      this.open();
    }
  }

  /**
   * Check if circuit should open
   */
  shouldOpen() {
    return this.requests >= this.options.minimumRequests &&
           this.failures >= this.options.failureThreshold;
  }

  /**
   * Open the circuit
   */
  open() {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.options.resetTimeout;
    this.emit('stateChange', { 
      from: this.state, 
      to: 'OPEN',
      nextAttemptTime: new Date(this.nextAttemptTime)
    });
    this.emit('open', {
      failures: this.failures,
      requests: this.requests
    });
  }

  /**
   * Start monitoring period
   */
  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.resetCounters();
    }, this.options.monitoringPeriod);
  }

  /**
   * Reset counters
   */
  resetCounters() {
    if (this.state === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      this.requests = 0;
    }
  }

  /**
   * Get circuit state
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      failureRate: this.requests > 0 ? (this.failures / this.requests) * 100 : 0,
      nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime) : null
    };
  }

  /**
   * Force circuit to close
   */
  close() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttemptTime = null;
    this.emit('stateChange', { from: this.state, to: 'CLOSED' });
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

module.exports = {
  RetryManager,
  CircuitBreaker,
  RetryPolicy
};