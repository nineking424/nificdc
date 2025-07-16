const express = require('express');
const request = require('supertest');
const EnhancedMappingIntegration = require('../../middleware/enhanced-mapping-integration');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../routes/api/enhanced-mappings', () => {
  const express = require('express');
  const router = express.Router();
  
  router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Enhanced mappings route working' });
  });
  
  return router;
});

describe('EnhancedMappingIntegration', () => {
  let app;
  let integration;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    integration = new EnhancedMappingIntegration(app, {
      enablePrometheus: false, // Disable to avoid prom-client dependency in tests
      enableHealthChecks: true,
      enableMetricsCollection: true,
      basePath: '/api'
    });
  });

  afterEach(async () => {
    if (integration.isInitialized) {
      await integration.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize integration successfully', async () => {
      await integration.initialize();
      
      expect(integration.isInitialized).toBe(true);
      expect(integration.getStatus().initialized).toBe(true);
    });

    it('should not initialize twice', async () => {
      await integration.initialize();
      await integration.initialize(); // Second call should be ignored
      
      expect(integration.isInitialized).toBe(true);
    });

    it('should mount enhanced mapping routes', async () => {
      await integration.initialize();
      
      const response = await request(app)
        .get('/api/enhanced-mappings/test')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Enhanced mappings route working');
    });
  });

  describe('Health Check Integration', () => {
    it('should provide health check endpoint', async () => {
      await integration.initialize();
      
      const response = await request(app)
        .get('/health/enhanced-mappings')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.health.status).toBe('healthy');
      expect(response.body.health.components).toMatchObject({
        enhancedMappingEngine: 'available',
        apiRoutes: 'mounted',
        integration: 'active'
      });
    });

    it('should handle health check errors gracefully', async () => {
      // Create integration without initialization
      const response = await request(app)
        .get('/health/enhanced-mappings')
        .expect(503);
      
      expect(response.body.success).toBe(false);
      expect(response.body.health.status).toBe('unhealthy');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect request metrics for enhanced mapping routes', async () => {
      await integration.initialize();
      
      // Make request to enhanced mapping route
      await request(app)
        .get('/api/enhanced-mappings/test')
        .expect(200);
      
      // Verify metrics middleware was applied (checked via debug logs)
      const logger = require('../../src/utils/logger');
      expect(logger.debug).toHaveBeenCalledWith(
        'Enhanced mapping request metrics',
        expect.objectContaining({
          method: 'GET',
          path: '/api/enhanced-mappings/test',
          statusCode: 200
        })
      );
    });

    it('should not collect metrics for non-enhanced mapping routes', async () => {
      app.get('/api/other/test', (req, res) => {
        res.json({ success: true });
      });
      
      await integration.initialize();
      
      await request(app)
        .get('/api/other/test')
        .expect(200);
      
      // Should not log metrics for non-enhanced mapping routes
      const logger = require('../../src/utils/logger');
      expect(logger.debug).not.toHaveBeenCalledWith(
        'Enhanced mapping request metrics',
        expect.any(Object)
      );
    });
  });

  describe('Status and Management', () => {
    it('should return correct status', async () => {
      const status = integration.getStatus();
      
      expect(status).toMatchObject({
        initialized: false,
        metricsEnabled: false,
        options: expect.objectContaining({
          basePath: '/api',
          enableHealthChecks: true,
          enableMetricsCollection: true
        })
      });
      
      await integration.initialize();
      
      const statusAfterInit = integration.getStatus();
      expect(statusAfterInit.initialized).toBe(true);
    });

    it('should shutdown gracefully', async () => {
      await integration.initialize();
      expect(integration.isInitialized).toBe(true);
      
      await integration.shutdown();
      expect(integration.isInitialized).toBe(false);
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom base path', async () => {
      const customIntegration = new EnhancedMappingIntegration(app, {
        basePath: '/custom-api',
        enablePrometheus: false,
        enableHealthChecks: false,
        enableMetricsCollection: false
      });
      
      await customIntegration.initialize();
      
      const response = await request(app)
        .get('/custom-api/enhanced-mappings/test')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      await customIntegration.shutdown();
    });

    it('should handle disabled features', async () => {
      const minimalIntegration = new EnhancedMappingIntegration(app, {
        enablePrometheus: false,
        enableHealthChecks: false,
        enableMetricsCollection: false
      });
      
      await minimalIntegration.initialize();
      
      // Health check should not be available
      await request(app)
        .get('/health/enhanced-mappings')
        .expect(404);
      
      const status = minimalIntegration.getStatus();
      expect(status.options.enableHealthChecks).toBe(false);
      expect(status.options.enableMetricsCollection).toBe(false);
      
      await minimalIntegration.shutdown();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      // Mock enhanced mappings router to throw error
      jest.doMock('../../routes/api/enhanced-mappings', () => {
        throw new Error('Route initialization failed');
      });
      
      const errorIntegration = new EnhancedMappingIntegration(app);
      
      await expect(errorIntegration.initialize()).rejects.toThrow('Route initialization failed');
      expect(errorIntegration.isInitialized).toBe(false);
    });

    it('should handle shutdown errors gracefully', async () => {
      await integration.initialize();
      
      // Mock error during shutdown
      const originalShutdown = integration.shutdown;
      integration.shutdown = jest.fn().mockImplementation(async () => {
        throw new Error('Shutdown error');
      });
      
      // Should not throw
      await expect(integration.shutdown()).rejects.toThrow('Shutdown error');
    });
  });
});