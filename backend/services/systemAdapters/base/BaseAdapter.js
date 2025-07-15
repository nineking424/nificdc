const EventEmitter = require('events');
const logger = require('../../../src/utils/logger');
const { performance } = require('perf_hooks');

/**
 * Base System Adapter Abstract Class
 * 모든 시스템 어댑터가 상속받을 기본 추상 클래스
 */
class BaseSystemAdapter extends EventEmitter {
  constructor(config = {}, adapterInfo = {}) {
    super();
    
    this.config = config;
    this.adapterInfo = adapterInfo;
    this.isConnected = false;
    this.connectionPool = null;
    this.metrics = {
      connectTime: null,
      lastActivity: null,
      operationCount: 0,
      errorCount: 0
    };
    
    // Validate configuration on instantiation
    this.validateConfig();
    
    // Set up error handling
    this.on('error', (error) => {
      this.metrics.errorCount++;
      logger.error(`Adapter error [${this.adapterInfo.name}]:`, error);
    });
  }

  /**
   * Abstract Methods - Must be implemented by subclasses
   */
  
  /**
   * Establish connection to the system
   * @abstract
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error(`${this.constructor.name} must implement connect() method`);
  }

  /**
   * Close connection to the system
   * @abstract
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error(`${this.constructor.name} must implement disconnect() method`);
  }

  /**
   * Test connection to the system
   * @abstract
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    throw new Error(`${this.constructor.name} must implement testConnection() method`);
  }

  /**
   * Discover schemas in the system
   * @abstract
   * @param {Object} options - Discovery options
   * @returns {Promise<Array>} Array of discovered schemas
   */
  async discoverSchemas(options = {}) {
    throw new Error(`${this.constructor.name} must implement discoverSchemas() method`);
  }

  /**
   * Read data from the system
   * @abstract
   * @param {Object} schema - Schema definition
   * @param {Object} options - Read options (limit, offset, filters, etc.)
   * @returns {Promise<Object>} Data result with metadata
   */
  async readData(schema, options = {}) {
    throw new Error(`${this.constructor.name} must implement readData() method`);
  }

  /**
   * Write data to the system
   * @abstract
   * @param {Object} schema - Schema definition
   * @param {Array} data - Data to write
   * @param {Object} options - Write options (mode, batchSize, etc.)
   * @returns {Promise<Object>} Write result with metadata
   */
  async writeData(schema, data, options = {}) {
    throw new Error(`${this.constructor.name} must implement writeData() method`);
  }

  /**
   * Execute a custom query/operation
   * @abstract
   * @param {string} query - Query or operation to execute
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async executeQuery(query, params = {}) {
    throw new Error(`${this.constructor.name} must implement executeQuery() method`);
  }

  /**
   * Get system-specific metadata
   * @abstract
   * @returns {Promise<Object>} System metadata
   */
  async getSystemMetadata() {
    throw new Error(`${this.constructor.name} must implement getSystemMetadata() method`);
  }

  /**
   * Common Methods - Can be overridden if needed
   */

  /**
   * Validate adapter configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.adapterInfo || !this.adapterInfo.configSchema) {
      logger.warn('No config schema defined for adapter validation');
      return;
    }

    const schema = this.adapterInfo.configSchema;
    const errors = [];

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach(field => {
        if (!(field in this.config)) {
          errors.push(`Missing required field: ${field}`);
        }
      });
    }

    // Validate field types
    if (schema.properties) {
      Object.keys(this.config).forEach(key => {
        if (schema.properties[key]) {
          const expectedType = schema.properties[key].type;
          const actualType = Array.isArray(this.config[key]) ? 'array' : typeof this.config[key];
          
          if (expectedType && expectedType !== actualType) {
            errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${actualType}`);
          }
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Get adapter capabilities
   * @returns {Object} Capabilities object
   */
  getCapabilities() {
    // Return default capabilities, can be overridden by subclasses
    return this.adapterInfo?.capabilities || {
      supportsSchemaDiscovery: false,
      supportsBatchOperations: false,
      supportsStreaming: false,
      supportsTransactions: false,
      supportsPartitioning: false,
      supportsChangeDataCapture: false,
      supportsIncrementalSync: false,
      supportsCustomQuery: false
    };
  }

  /**
   * Get supported operations
   * @returns {Object} Supported operations object
   */
  getSupportedOperations() {
    return this.adapterInfo?.supportedOperations || {
      read: false,
      write: false,
      update: false,
      delete: false,
      upsert: false,
      truncate: false,
      createSchema: false,
      dropSchema: false
    };
  }

  /**
   * Check if a specific capability is supported
   * @param {string} capability - Capability name
   * @returns {boolean}
   */
  hasCapability(capability) {
    const capabilities = this.getCapabilities();
    return capabilities[capability] === true;
  }

  /**
   * Check if a specific operation is supported
   * @param {string} operation - Operation name
   * @returns {boolean}
   */
  supportsOperation(operation) {
    const operations = this.getSupportedOperations();
    return operations[operation] === true;
  }

  /**
   * Helper method to measure operation performance
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Async operation to measure
   * @returns {Promise<*>} Operation result
   */
  async measurePerformance(operationName, operation) {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      this.emit('performance', {
        operation: operationName,
        duration,
        timestamp: new Date(),
        success: true
      });
      
      this.metrics.lastActivity = new Date();
      this.metrics.operationCount++;
      
      logger.debug(`${operationName} completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.emit('performance', {
        operation: operationName,
        duration,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Batch process data with configurable batch size
   * @param {Array} items - Items to process
   * @param {Function} processor - Async function to process each batch
   * @param {number} batchSize - Size of each batch
   * @returns {Promise<Array>} Array of batch results
   */
  async processBatch(items, processor, batchSize = 1000) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(items.length / batchSize);
      
      logger.debug(`Processing batch ${batchNumber}/${totalBatches}`);
      
      try {
        const batchResult = await processor(batch, batchNumber);
        results.push(batchResult);
        
        this.emit('batchProgress', {
          current: batchNumber,
          total: totalBatches,
          processed: Math.min(i + batchSize, items.length),
          totalItems: items.length
        });
      } catch (error) {
        logger.error(`Error processing batch ${batchNumber}:`, error);
        
        this.emit('batchError', {
          batch: batchNumber,
          error: error.message,
          items: batch
        });
        
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Retry an operation with exponential backoff
   * @param {Function} operation - Async operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise<*>} Operation result
   */
  async retryOperation(operation, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        logger.warn(`Operation failed, retrying in ${delay}ms...`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Transform data according to a schema mapping
   * @param {Array|Object} data - Source data
   * @param {Object} mapping - Field mapping definition
   * @returns {Array|Object} Transformed data
   */
  transformData(data, mapping) {
    const isArray = Array.isArray(data);
    const items = isArray ? data : [data];
    
    const transformed = items.map(item => {
      const result = {};
      
      Object.entries(mapping).forEach(([targetField, sourceField]) => {
        if (typeof sourceField === 'string') {
          // Simple field mapping
          result[targetField] = this.getNestedValue(item, sourceField);
        } else if (typeof sourceField === 'function') {
          // Custom transformation function
          result[targetField] = sourceField(item);
        } else if (typeof sourceField === 'object' && sourceField.field) {
          // Complex mapping with transformation
          const value = this.getNestedValue(item, sourceField.field);
          result[targetField] = sourceField.transform ? sourceField.transform(value) : value;
        }
      });
      
      return result;
    });
    
    return isArray ? transformed : transformed[0];
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Source object
   * @param {string} path - Dot notation path
   * @returns {*} Value at path
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }

  /**
   * Set nested value in object using dot notation
   * @param {Object} obj - Target object
   * @param {string} path - Dot notation path
   * @param {*} value - Value to set
   */
  setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((current, part) => {
      if (!current[part]) current[part] = {};
      return current[part];
    }, obj);
    target[last] = value;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.isConnected) {
      await this.disconnect();
    }
    this.removeAllListeners();
  }

  /**
   * Get adapter metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.metrics.connectTime ? Date.now() - this.metrics.connectTime : 0,
      isConnected: this.isConnected
    };
  }
}

module.exports = BaseSystemAdapter;