const logger = require('../src/utils/logger');

/**
 * Enhanced Mapping Integration Middleware
 * Connects enhanced mapping API routes with the main application
 */
class EnhancedMappingIntegration {
  constructor(app, options = {}) {
    this.app = app;
    this.options = {
      enablePrometheus: options.enablePrometheus !== false,
      enableHealthChecks: options.enableHealthChecks !== false,
      enableMetricsCollection: options.enableMetricsCollection !== false,
      basePath: options.basePath || '/api',
      ...options
    };
    this.metricsCollector = null;
    this.isInitialized = false;
  }

  /**
   * Initialize enhanced mapping integration
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Import enhanced mapping routes
      const enhancedMappingsRouter = require('../routes/api/enhanced-mappings');
      
      // Mount enhanced mapping routes
      this.app.use(`${this.options.basePath}/enhanced-mappings`, enhancedMappingsRouter);
      
      // Setup metrics collection if enabled
      if (this.options.enableMetricsCollection) {
        this.setupMetricsCollection();
      }

      // Setup health check integration if enabled
      if (this.options.enableHealthChecks) {
        this.setupHealthCheckIntegration();
      }

      // Setup Prometheus metrics if enabled
      if (this.options.enablePrometheus) {
        this.setupPrometheusMetrics();
      }

      this.isInitialized = true;
      logger.info('Enhanced Mapping Integration initialized successfully', {
        basePath: this.options.basePath,
        enableMetrics: this.options.enableMetricsCollection,
        enableHealthChecks: this.options.enableHealthChecks,
        enablePrometheus: this.options.enablePrometheus
      });

    } catch (error) {
      logger.error('Failed to initialize Enhanced Mapping Integration:', error);
      throw error;
    }
  }

  /**
   * Setup metrics collection middleware
   */
  setupMetricsCollection() {
    // Middleware to collect request metrics for enhanced mappings
    const metricsMiddleware = (req, res, next) => {
      if (req.path.startsWith(`${this.options.basePath}/enhanced-mappings`)) {
        const startTime = Date.now();
        
        // Override res.json to capture response metrics
        const originalJson = res.json;
        res.json = function(data) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Log request metrics
          logger.debug('Enhanced mapping request metrics', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            success: data?.success
          });

          return originalJson.call(this, data);
        };
      }
      next();
    };

    this.app.use(metricsMiddleware);
    logger.info('Enhanced mapping metrics collection enabled');
  }

  /**
   * Setup health check integration
   */
  setupHealthCheckIntegration() {
    // Add enhanced mapping health to main application health check
    this.app.get('/health/enhanced-mappings', async (req, res) => {
      try {
        // Check if enhanced mapping engine is available
        const enhancedEngine = require('../routes/api/enhanced-mappings');
        
        const health = {
          status: 'healthy',
          timestamp: new Date(),
          components: {
            enhancedMappingEngine: 'available',
            apiRoutes: 'mounted',
            integration: 'active'
          }
        };

        res.json({
          success: true,
          health
        });
      } catch (error) {
        logger.error('Enhanced mapping health check failed:', error);
        res.status(503).json({
          success: false,
          health: {
            status: 'unhealthy',
            timestamp: new Date(),
            error: error.message
          }
        });
      }
    });

    logger.info('Enhanced mapping health check integration enabled');
  }

  /**
   * Setup Prometheus metrics (if prometheus-client is available)
   */
  setupPrometheusMetrics() {
    try {
      const client = require('prom-client');
      
      // Create metrics for enhanced mappings
      const httpRequestDuration = new client.Histogram({
        name: 'enhanced_mapping_http_request_duration_seconds',
        help: 'Duration of HTTP requests for enhanced mappings',
        labelNames: ['method', 'route', 'status_code', 'operation_type'],
        buckets: [0.1, 0.5, 1, 2, 5, 10]
      });

      const httpRequestTotal = new client.Counter({
        name: 'enhanced_mapping_http_requests_total',
        help: 'Total number of HTTP requests for enhanced mappings',
        labelNames: ['method', 'route', 'status_code', 'operation_type']
      });

      const activeMappingExecutions = new client.Gauge({
        name: 'enhanced_mapping_active_executions',
        help: 'Number of currently active mapping executions'
      });

      // Middleware to collect Prometheus metrics
      const prometheusMiddleware = (req, res, next) => {
        if (req.path.startsWith(`${this.options.basePath}/enhanced-mappings`)) {
          const startTime = Date.now();
          
          const originalEnd = res.end;
          res.end = function(...args) {
            const duration = (Date.now() - startTime) / 1000;
            const operationType = getOperationType(req.path, req.method);
            
            httpRequestDuration
              .labels(req.method, req.path, res.statusCode, operationType)
              .observe(duration);
            
            httpRequestTotal
              .labels(req.method, req.path, res.statusCode, operationType)
              .inc();

            return originalEnd.apply(this, args);
          };
        }
        next();
      };

      this.app.use(prometheusMiddleware);
      
      // Store metrics for external access
      this.metricsCollector = {
        httpRequestDuration,
        httpRequestTotal,
        activeMappingExecutions
      };

      logger.info('Enhanced mapping Prometheus metrics enabled');
    } catch (error) {
      logger.warn('Prometheus client not available, skipping metrics setup:', error.message);
    }
  }

  /**
   * Get integration status and metrics
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      options: this.options,
      metricsEnabled: !!this.metricsCollector,
      timestamp: new Date()
    };
  }

  /**
   * Shutdown integration (cleanup)
   */
  async shutdown() {
    try {
      if (this.metricsCollector) {
        // Clear Prometheus metrics if available
        Object.values(this.metricsCollector).forEach(metric => {
          if (metric && typeof metric.clear === 'function') {
            metric.clear();
          }
        });
      }

      this.isInitialized = false;
      logger.info('Enhanced Mapping Integration shutdown complete');
    } catch (error) {
      logger.error('Error during Enhanced Mapping Integration shutdown:', error);
    }
  }
}

/**
 * Helper function to determine operation type from request path and method
 */
function getOperationType(path, method) {
  if (path.includes('/execute-batch')) return 'batch_execution';
  if (path.includes('/execute')) return 'single_execution';
  if (path.includes('/stream')) return 'stream_processing';
  if (path.includes('/validate')) return 'validation';
  if (path.includes('/metrics')) return 'metrics';
  if (path.includes('/health')) return 'health_check';
  if (path.includes('/connections/pools')) return 'connection_management';
  
  switch (method) {
    case 'GET': return 'read';
    case 'POST': return 'create';
    case 'PUT': return 'update';
    case 'DELETE': return 'delete';
    default: return 'unknown';
  }
}

module.exports = EnhancedMappingIntegration;