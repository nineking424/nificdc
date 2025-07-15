const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../src/utils/logger');

/**
 * Dead Letter Queue
 * Stores failed records for later analysis and manual recovery
 */
class DeadLetterQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      storageType: options.storageType || 'memory', // memory, file, database
      maxSize: options.maxSize || 10000,
      retentionPeriod: options.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
      filePath: options.filePath || './dead-letter-queue',
      flushInterval: options.flushInterval || 60000, // 1 minute
      enableCompression: options.enableCompression || false
    };
    
    // Storage
    this.queue = [];
    this.metadata = new Map();
    
    // Statistics
    this.stats = {
      totalEnqueued: 0,
      totalDequeued: 0,
      totalExpired: 0,
      totalReprocessed: 0,
      currentSize: 0
    };
    
    // Initialize storage
    this.initializeStorage();
    
    // Start background tasks
    this.startBackgroundTasks();
  }

  /**
   * Initialize storage based on type
   */
  async initializeStorage() {
    switch (this.options.storageType) {
      case 'file':
        await this.initializeFileStorage();
        break;
      case 'database':
        // TODO: Implement database storage
        logger.info('Database storage for DLQ not yet implemented');
        break;
      case 'memory':
      default:
        logger.info('Using in-memory storage for Dead Letter Queue');
    }
  }

  /**
   * Initialize file-based storage
   */
  async initializeFileStorage() {
    try {
      await fs.mkdir(this.options.filePath, { recursive: true });
      
      // Load existing entries if any
      const files = await fs.readdir(this.options.filePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(
              path.join(this.options.filePath, file),
              'utf8'
            );
            const entry = JSON.parse(content);
            this.queue.push(entry);
            this.metadata.set(entry.id, {
              filename: file,
              timestamp: entry.timestamp
            });
          } catch (error) {
            logger.error('Failed to load DLQ entry:', { file, error });
          }
        }
      }
      
      this.stats.currentSize = this.queue.length;
      logger.info(`Loaded ${this.queue.length} entries from file storage`);
    } catch (error) {
      logger.error('Failed to initialize file storage:', error);
      throw error;
    }
  }

  /**
   * Enqueue a failed record
   */
  async enqueue(record, error, context = {}) {
    const entry = {
      id: this.generateId(),
      record,
      error: {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      },
      context: {
        ...context,
        enqueuedAt: new Date(),
        retryCount: context.retryCount || 0,
        mappingId: context.mappingId,
        executionId: context.executionId
      },
      status: 'pending',
      attempts: []
    };
    
    // Check queue size
    if (this.queue.length >= this.options.maxSize) {
      this.emit('queueFull', { size: this.queue.length });
      
      // Remove oldest entry if at capacity
      const removed = this.queue.shift();
      if (removed) {
        await this.removeFromStorage(removed.id);
        this.emit('entryRemoved', { entry: removed, reason: 'capacity' });
      }
    }
    
    // Add to queue
    this.queue.push(entry);
    this.metadata.set(entry.id, {
      timestamp: entry.context.enqueuedAt
    });
    
    // Persist to storage
    await this.persistEntry(entry);
    
    // Update stats
    this.stats.totalEnqueued++;
    this.stats.currentSize = this.queue.length;
    
    // Emit event
    this.emit('entryEnqueued', { entry });
    
    return entry.id;
  }

  /**
   * Dequeue entries for reprocessing
   */
  async dequeue(options = {}) {
    const {
      limit = 10,
      filter = null,
      markAsProcessing = true
    } = options;
    
    const entries = [];
    const now = new Date();
    
    for (const entry of this.queue) {
      if (entries.length >= limit) break;
      
      // Skip if already processing
      if (entry.status === 'processing') continue;
      
      // Apply filter if provided
      if (filter && !filter(entry)) continue;
      
      // Check if entry is not in cooldown
      if (entry.lastAttempt) {
        const cooldown = this.calculateCooldown(entry.attempts.length);
        const nextAttemptTime = new Date(entry.lastAttempt.getTime() + cooldown);
        if (now < nextAttemptTime) continue;
      }
      
      entries.push(entry);
      
      if (markAsProcessing) {
        entry.status = 'processing';
        entry.lastAttempt = now;
      }
    }
    
    // Update stats
    this.stats.totalDequeued += entries.length;
    
    // Emit event
    if (entries.length > 0) {
      this.emit('entriesDequeued', { entries, count: entries.length });
    }
    
    return entries;
  }

  /**
   * Mark entry as successfully reprocessed
   */
  async markAsResolved(entryId, result = null) {
    const entry = this.findEntry(entryId);
    if (!entry) {
      throw new Error(`Entry ${entryId} not found in queue`);
    }
    
    entry.status = 'resolved';
    entry.resolvedAt = new Date();
    entry.result = result;
    
    // Remove from queue
    this.queue = this.queue.filter(e => e.id !== entryId);
    await this.removeFromStorage(entryId);
    
    // Update stats
    this.stats.totalReprocessed++;
    this.stats.currentSize = this.queue.length;
    
    // Emit event
    this.emit('entryResolved', { entry });
    
    return entry;
  }

  /**
   * Mark entry as failed reprocessing attempt
   */
  async markAsFailed(entryId, error, shouldRetry = true) {
    const entry = this.findEntry(entryId);
    if (!entry) {
      throw new Error(`Entry ${entryId} not found in queue`);
    }
    
    // Add attempt record
    entry.attempts.push({
      timestamp: new Date(),
      error: {
        message: error.message,
        code: error.code
      }
    });
    
    if (shouldRetry) {
      entry.status = 'pending';
    } else {
      entry.status = 'failed';
      entry.failedAt = new Date();
    }
    
    // Update storage
    await this.persistEntry(entry);
    
    // Emit event
    this.emit('entryFailed', { entry, error, shouldRetry });
    
    return entry;
  }

  /**
   * Get entry by ID
   */
  getEntry(entryId) {
    return this.findEntry(entryId);
  }

  /**
   * Get queue statistics
   */
  getStatistics() {
    const statusCounts = this.queue.reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {});
    
    const contextCounts = this.queue.reduce((acc, entry) => {
      const mappingId = entry.context.mappingId || 'unknown';
      acc[mappingId] = (acc[mappingId] || 0) + 1;
      return acc;
    }, {});
    
    return {
      ...this.stats,
      statusCounts,
      contextCounts,
      oldestEntry: this.queue[0]?.context.enqueuedAt,
      newestEntry: this.queue[this.queue.length - 1]?.context.enqueuedAt
    };
  }

  /**
   * Search entries
   */
  async search(criteria = {}) {
    const {
      status,
      mappingId,
      startDate,
      endDate,
      errorPattern,
      limit = 100
    } = criteria;
    
    let results = [...this.queue];
    
    // Filter by status
    if (status) {
      results = results.filter(entry => entry.status === status);
    }
    
    // Filter by mapping ID
    if (mappingId) {
      results = results.filter(entry => entry.context.mappingId === mappingId);
    }
    
    // Filter by date range
    if (startDate || endDate) {
      results = results.filter(entry => {
        const entryDate = new Date(entry.context.enqueuedAt);
        if (startDate && entryDate < new Date(startDate)) return false;
        if (endDate && entryDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    // Filter by error pattern
    if (errorPattern) {
      const pattern = new RegExp(errorPattern, 'i');
      results = results.filter(entry => 
        pattern.test(entry.error.message) || pattern.test(entry.error.code)
      );
    }
    
    // Limit results
    results = results.slice(0, limit);
    
    return results;
  }

  /**
   * Bulk operations
   */
  async bulkResolve(entryIds) {
    const results = {
      resolved: [],
      notFound: []
    };
    
    for (const entryId of entryIds) {
      try {
        const entry = await this.markAsResolved(entryId);
        results.resolved.push(entry);
      } catch (error) {
        results.notFound.push(entryId);
      }
    }
    
    return results;
  }

  /**
   * Clear expired entries
   */
  async clearExpired() {
    const now = new Date();
    const expired = [];
    
    this.queue = this.queue.filter(entry => {
      const age = now - new Date(entry.context.enqueuedAt);
      if (age > this.options.retentionPeriod) {
        expired.push(entry);
        return false;
      }
      return true;
    });
    
    // Remove from storage
    for (const entry of expired) {
      await this.removeFromStorage(entry.id);
    }
    
    // Update stats
    this.stats.totalExpired += expired.length;
    this.stats.currentSize = this.queue.length;
    
    if (expired.length > 0) {
      this.emit('entriesExpired', { entries: expired, count: expired.length });
      logger.info(`Cleared ${expired.length} expired entries from DLQ`);
    }
    
    return expired.length;
  }

  /**
   * Export queue to file
   */
  async exportToFile(filepath) {
    const data = {
      exportedAt: new Date(),
      options: this.options,
      statistics: this.getStatistics(),
      entries: this.queue
    };
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    
    this.emit('exported', { filepath, entryCount: this.queue.length });
    
    return {
      filepath,
      entryCount: this.queue.length,
      fileSize: (await fs.stat(filepath)).size
    };
  }

  /**
   * Private helper methods
   */
  
  findEntry(entryId) {
    return this.queue.find(entry => entry.id === entryId);
  }

  generateId() {
    return `dlq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  calculateCooldown(attemptCount) {
    // Exponential backoff: 1min, 5min, 15min, 30min, 1hr, ...
    const baseDelay = 60000; // 1 minute
    const maxDelay = 3600000; // 1 hour
    return Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
  }

  async persistEntry(entry) {
    if (this.options.storageType === 'file') {
      const filename = `${entry.id}.json`;
      const filepath = path.join(this.options.filePath, filename);
      
      await fs.writeFile(filepath, JSON.stringify(entry, null, 2));
      
      this.metadata.set(entry.id, {
        ...this.metadata.get(entry.id),
        filename
      });
    }
  }

  async removeFromStorage(entryId) {
    if (this.options.storageType === 'file') {
      const meta = this.metadata.get(entryId);
      if (meta && meta.filename) {
        const filepath = path.join(this.options.filePath, meta.filename);
        try {
          await fs.unlink(filepath);
        } catch (error) {
          logger.error('Failed to remove DLQ file:', { filepath, error });
        }
      }
    }
    
    this.metadata.delete(entryId);
  }

  /**
   * Start background tasks
   */
  startBackgroundTasks() {
    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.clearExpired().catch(error => {
        logger.error('Failed to clear expired DLQ entries:', error);
      });
    }, this.options.flushInterval);
    
    // Periodic stats logging
    this.statsInterval = setInterval(() => {
      const stats = this.getStatistics();
      logger.info('Dead Letter Queue statistics:', stats);
    }, 300000); // Every 5 minutes
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    logger.info('Dead Letter Queue shutdown complete');
  }
}

module.exports = DeadLetterQueue;