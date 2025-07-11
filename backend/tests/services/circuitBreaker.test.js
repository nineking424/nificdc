const { CircuitBreaker, CircuitBreakerManager, STATES } = require('../../src/services/circuitBreaker');

describe('CircuitBreaker', () => {
  let circuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      name: 'test-circuit',
      failureThreshold: 50, // 50% failure rate
      successThreshold: 3,
      timeout: 1000,
      resetTimeout: 100, // Short reset timeout for testing
      volumeThreshold: 5
    });
  });

  afterEach(() => {
    circuitBreaker.destroy();
  });

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.state).toBe(STATES.CLOSED);
    });

    it('should have correct initial configuration', () => {
      expect(circuitBreaker.name).toBe('test-circuit');
      expect(circuitBreaker.failureThreshold).toBe(50);
      expect(circuitBreaker.successThreshold).toBe(3);
      expect(circuitBreaker.timeout).toBe(1000);
    });
  });

  describe('Successful Operations', () => {
    it('should execute successful operation', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.state).toBe(STATES.CLOSED);
    });

    it('should track success statistics', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(mockOperation);
      
      const stats = circuitBreaker.getStats();
      expect(stats.stats.totalSuccesses).toBe(1);
      expect(stats.stats.totalRequests).toBe(1);
      expect(stats.successCount).toBe(1);
    });

    it('should reset failure count on success in CLOSED state', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // Simulate some failures first
      circuitBreaker.failureCount = 2;
      
      await circuitBreaker.execute(mockOperation);
      
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('Failed Operations', () => {
    it('should handle failed operation', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation failed');
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.state).toBe(STATES.CLOSED);
    });

    it('should track failure statistics', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.stats.totalFailures).toBe(1);
      expect(stats.stats.totalRequests).toBe(1);
      expect(stats.failureCount).toBe(1);
    });
  });

  describe('Circuit Tripping', () => {
    it('should trip circuit when failure rate exceeds threshold', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Execute enough requests to meet volume threshold
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.state).toBe(STATES.OPEN);
    });

    it('should reject requests when circuit is OPEN', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // Force circuit to OPEN state
      circuitBreaker.state = STATES.OPEN;
      circuitBreaker.nextAttempt = Date.now() + 10000; // 10 seconds from now
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN');
      
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should emit "open" event when circuit trips', (done) => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      circuitBreaker.on('open', () => {
        expect(circuitBreaker.state).toBe(STATES.OPEN);
        done();
      });
      
      // Execute enough failures to trip circuit
      (async () => {
        for (let i = 0; i < 10; i++) {
          try {
            await circuitBreaker.execute(mockOperation);
          } catch (error) {
            // Expected to fail
          }
        }
      })();
    });
  });

  describe('Circuit Recovery', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // Force circuit to OPEN state
      circuitBreaker.state = STATES.OPEN;
      circuitBreaker.nextAttempt = Date.now() - 1000; // 1 second ago
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe(STATES.CLOSED);
    });

    it('should close circuit after successful operations in HALF_OPEN', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      // Force circuit to HALF_OPEN state
      circuitBreaker.state = STATES.HALF_OPEN;
      circuitBreaker.successCount = 0;
      
      // Execute enough successful operations
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(mockOperation);
      }
      
      expect(circuitBreaker.state).toBe(STATES.CLOSED);
    });

    it('should trip circuit again on failure in HALF_OPEN', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Force circuit to HALF_OPEN state
      circuitBreaker.state = STATES.HALF_OPEN;
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }
      
      expect(circuitBreaker.state).toBe(STATES.OPEN);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout operations that exceed timeout threshold', async () => {
      const mockOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve('success'), 2000));
      });
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation timeout');
      
      const stats = circuitBreaker.getStats();
      expect(stats.stats.totalTimeouts).toBe(1);
    });
  });

  describe('Events', () => {
    it('should emit success event', (done) => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      circuitBreaker.on('success', (data) => {
        expect(data.duration).toBeDefined();
        done();
      });
      
      circuitBreaker.execute(mockOperation);
    });

    it('should emit failure event', (done) => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      circuitBreaker.on('failure', (data) => {
        expect(data.error).toBeDefined();
        done();
      });
      
      circuitBreaker.execute(mockOperation).catch(() => {});
    });

    it('should emit halfOpen event', (done) => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      circuitBreaker.on('halfOpen', () => {
        expect(circuitBreaker.state).toBe(STATES.HALF_OPEN);
        done();
      });
      
      // Force circuit to OPEN state
      circuitBreaker.state = STATES.OPEN;
      circuitBreaker.nextAttempt = Date.now() - 1000;
      
      circuitBreaker.execute(mockOperation);
    });
  });

  describe('Statistics', () => {
    it('should calculate failure rate correctly', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failureOperation = jest.fn().mockRejectedValue(new Error('failure'));
      
      // Execute mix of successful and failed operations
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      
      try {
        await circuitBreaker.execute(failureOperation);
      } catch (error) {
        // Expected to fail
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.failureRate).toBeCloseTo(33.33, 1); // 1 failure out of 3 requests
    });

    it('should track response time metrics', async () => {
      const mockOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve('success'), 50));
      });
      
      await circuitBreaker.execute(mockOperation);
      
      const stats = circuitBreaker.getStats();
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Manual Control', () => {
    it('should allow manual circuit opening', () => {
      circuitBreaker.forceOpen();
      
      expect(circuitBreaker.state).toBe(STATES.OPEN);
    });

    it('should allow manual circuit closing', () => {
      circuitBreaker.state = STATES.OPEN;
      circuitBreaker.forceClose();
      
      expect(circuitBreaker.state).toBe(STATES.CLOSED);
      expect(circuitBreaker.failureCount).toBe(0);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Circuit Breaker Creation', () => {
    it('should create new circuit breaker', () => {
      const breaker = manager.getCircuitBreaker('test-circuit');
      
      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.name).toBe('test-circuit');
    });

    it('should reuse existing circuit breaker', () => {
      const breaker1 = manager.getCircuitBreaker('test-circuit');
      const breaker2 = manager.getCircuitBreaker('test-circuit');
      
      expect(breaker1).toBe(breaker2);
    });

    it('should create circuit breaker with custom options', () => {
      const options = {
        failureThreshold: 75,
        timeout: 5000
      };
      
      const breaker = manager.getCircuitBreaker('test-circuit', options);
      
      expect(breaker.failureThreshold).toBe(75);
      expect(breaker.timeout).toBe(5000);
    });
  });

  describe('Statistics Management', () => {
    it('should get all circuit breaker states', () => {
      const breaker1 = manager.getCircuitBreaker('circuit-1');
      const breaker2 = manager.getCircuitBreaker('circuit-2');
      
      const states = manager.getAllStates();
      
      expect(states).toHaveProperty('circuit-1');
      expect(states).toHaveProperty('circuit-2');
      expect(states['circuit-1'].state).toBe(STATES.CLOSED);
      expect(states['circuit-2'].state).toBe(STATES.CLOSED);
    });

    it('should get all circuit breaker stats', () => {
      const breaker1 = manager.getCircuitBreaker('circuit-1');
      const breaker2 = manager.getCircuitBreaker('circuit-2');
      
      const stats = manager.getAllStats();
      
      expect(stats).toHaveProperty('circuit-1');
      expect(stats).toHaveProperty('circuit-2');
      expect(stats['circuit-1'].stats).toBeDefined();
      expect(stats['circuit-2'].stats).toBeDefined();
    });
  });

  describe('Circuit Breaker Removal', () => {
    it('should remove circuit breaker', () => {
      const breaker = manager.getCircuitBreaker('test-circuit');
      
      manager.removeCircuitBreaker('test-circuit');
      
      const states = manager.getAllStates();
      expect(states).not.toHaveProperty('test-circuit');
    });

    it('should handle removal of non-existent circuit breaker', () => {
      expect(() => manager.removeCircuitBreaker('non-existent')).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should destroy all circuit breakers', () => {
      const breaker1 = manager.getCircuitBreaker('circuit-1');
      const breaker2 = manager.getCircuitBreaker('circuit-2');
      
      manager.destroy();
      
      const states = manager.getAllStates();
      expect(Object.keys(states)).toHaveLength(0);
    });
  });
});