const { RetryManager, CircuitBreaker, RetryPolicy } = require('../../../../services/mappingEngine/errorHandling/RetryManager');

describe('RetryManager', () => {
  let retryManager;

  beforeEach(() => {
    jest.useFakeTimers();
    retryManager = new RetryManager({
      maxRetries: 3,
      initialDelay: 10,
      maxDelay: 1000,
      factor: 2,
      jitter: false
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('should execute function successfully on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryManager.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(retryManager.stats.successfulAttempts).toBe(1);
      expect(retryManager.stats.totalRetries).toBe(0);
    });

    it('should retry on failure and succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(fn);
      
      // Fast-forward through delays
      await jest.runAllTimersAsync();
      
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(retryManager.stats.totalRetries).toBe(2);
      expect(retryManager.stats.retrySuccesses).toBe(1);
    });

    it('should throw error after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      const promise = retryManager.execute(fn);
      
      // Fast-forward through all retry delays
      await jest.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(retryManager.stats.retryFailures).toBe(1);
    });

    it('should respect timeout option', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const fn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 200))
      );

      await expect(
        retryManager.execute(fn, { timeout: 100 })
      ).rejects.toThrow('Operation timed out');
      
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should check if error is retryable', async () => {
      const nonRetryableError = new Error('Invalid input');
      const fn = jest.fn().mockRejectedValue(nonRetryableError);

      await expect(
        retryManager.execute(fn, {
          retryableErrors: ['network', 'timeout']
        })
      ).rejects.toThrow('Invalid input');

      expect(fn).toHaveBeenCalledTimes(1); // No retry
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(fn, { onRetry });
      
      // Fast-forward through delays
      await jest.runAllTimersAsync();
      
      await promise;

      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failure' }),
        1
      );
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff delay', () => {
      const config = {
        policy: RetryPolicy.EXPONENTIAL_BACKOFF,
        initialDelay: 100,
        factor: 2,
        maxDelay: 1000,
        jitter: false
      };

      expect(retryManager.calculateDelay(0, config)).toBe(100);
      expect(retryManager.calculateDelay(1, config)).toBe(200);
      expect(retryManager.calculateDelay(2, config)).toBe(400);
      expect(retryManager.calculateDelay(3, config)).toBe(800);
      expect(retryManager.calculateDelay(4, config)).toBe(1000); // Max delay
    });

    it('should calculate linear backoff delay', () => {
      const config = {
        policy: RetryPolicy.LINEAR_BACKOFF,
        initialDelay: 100,
        maxDelay: 1000,
        jitter: false
      };

      expect(retryManager.calculateDelay(0, config)).toBe(100);
      expect(retryManager.calculateDelay(1, config)).toBe(200);
      expect(retryManager.calculateDelay(2, config)).toBe(300);
    });

    it('should use fixed delay', () => {
      const config = {
        policy: RetryPolicy.FIXED_DELAY,
        initialDelay: 100,
        jitter: false
      };

      expect(retryManager.calculateDelay(0, config)).toBe(100);
      expect(retryManager.calculateDelay(5, config)).toBe(100);
    });

    it('should add jitter when enabled', () => {
      const config = {
        policy: RetryPolicy.FIXED_DELAY,
        initialDelay: 100,
        jitter: true
      };

      const delay = retryManager.calculateDelay(0, config);
      expect(delay).toBeGreaterThanOrEqual(90); // -10%
      expect(delay).toBeLessThanOrEqual(110); // +10%
    });
  });

  describe('wrap', () => {
    it('should create a wrapped function with retry', async () => {
      const originalFn = jest.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue('success');

      const wrappedFn = retryManager.wrap(originalFn);
      const promise = wrappedFn('arg1', 'arg2');
      
      // Fast-forward through delays
      await jest.runAllTimersAsync();
      
      const result = await promise;

      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const fn1 = jest.fn().mockResolvedValue('success');
      const fn2 = jest.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue('success');

      await retryManager.execute(fn1);
      
      const promise2 = retryManager.execute(fn2);
      await jest.runAllTimersAsync();
      await promise2;

      const stats = retryManager.getStats();
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulAttempts).toBe(2);
      expect(stats.totalRetries).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
      expect(stats.retrySuccessRate).toBe(100);
    });
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker;
  let clock;

  beforeEach(() => {
    jest.useFakeTimers();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      minimumRequests: 5
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('canExecute', () => {
    it('should allow execution when closed', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.state).toBe('CLOSED');
    });

    it('should open after failure threshold', () => {
      // Need minimum requests first
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordSuccess();
      }

      // Record failures
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should transition to half-open after timeout', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.state).toBe('OPEN');

      // Wait for reset timeout
      jest.advanceTimersByTime(1001);

      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.state).toBe('HALF_OPEN');
    });

    it('should close from half-open on success', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Move to half-open
      jest.advanceTimersByTime(1001);
      circuitBreaker.canExecute();
      expect(circuitBreaker.state).toBe('HALF_OPEN');

      // Record success
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.state).toBe('CLOSED');
    });

    it('should reopen from half-open on failure', () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      // Move to half-open
      jest.advanceTimersByTime(1001);
      circuitBreaker.canExecute();
      expect(circuitBreaker.state).toBe('HALF_OPEN');

      // Record failure
      circuitBreaker.recordFailure();
      expect(circuitBreaker.state).toBe('OPEN');
    });
  });

  describe('getState', () => {
    it('should return circuit state information', () => {
      circuitBreaker.recordSuccess();
      circuitBreaker.recordFailure();
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.requests).toBe(2);
      expect(state.successes).toBe(1);
      expect(state.failures).toBe(1);
      expect(state.failureRate).toBe(50);
    });
  });
});