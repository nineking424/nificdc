const DeadLetterQueue = require('../../../../services/mappingEngine/errorHandling/DeadLetterQueue');
const fs = require('fs').promises;
const path = require('path');

describe('DeadLetterQueue', () => {
  let dlq;
  const testFilePath = './test-dlq';

  beforeEach(async () => {
    // Clean up before each test to ensure clean state
    try {
      await fs.rm(testFilePath, { recursive: true, force: true });
      await fs.rm('./test-dlq-isolated', { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
    
    dlq = new DeadLetterQueue({
      storageType: 'memory',
      maxSize: 5,
      retentionPeriod: 1000, // 1 second for testing
      flushInterval: 0, // Disable background tasks
      enableStatsLogging: false
    });
  });

  afterEach(async () => {
    if (dlq) {
      await dlq.shutdown();
    }
    // Clean up test files
    try {
      await fs.rm(testFilePath, { recursive: true, force: true });
      await fs.rm('./test-dlq-isolated', { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }
  });

  describe('enqueue', () => {
    it('should enqueue failed records', async () => {
      const record = { id: 1, data: 'test' };
      const error = new Error('Processing failed');
      const context = { mappingId: 'map1' };

      const entryId = await dlq.enqueue(record, error, context);

      expect(entryId).toBeDefined();
      expect(dlq.queue.length).toBe(1);
      expect(dlq.stats.totalEnqueued).toBe(1);
    });

    it('should remove oldest entry when queue is full', async () => {
      const records = Array(6).fill(null).map((_, i) => ({ id: i }));
      const error = new Error('Failed');

      for (const record of records) {
        await dlq.enqueue(record, error);
      }

      expect(dlq.queue.length).toBe(5); // Max size
      expect(dlq.queue[0].record.id).toBe(1); // Oldest (0) was removed
    });

    it('should emit queueFull event', async () => {
      const queueFullHandler = jest.fn();
      dlq.on('queueFull', queueFullHandler);

      // Fill the queue
      for (let i = 0; i < 5; i++) {
        await dlq.enqueue({ id: i }, new Error('Failed'));
      }

      // This should trigger queueFull
      await dlq.enqueue({ id: 5 }, new Error('Failed'));

      expect(queueFullHandler).toHaveBeenCalled();
    });
  });

  describe('dequeue', () => {
    beforeEach(async () => {
      // Add some entries
      for (let i = 0; i < 3; i++) {
        await dlq.enqueue(
          { id: i },
          new Error(`Error ${i}`),
          { mappingId: `map${i}` }
        );
      }
    });

    it('should dequeue entries for reprocessing', async () => {
      const entries = await dlq.dequeue({ limit: 2 });

      expect(entries.length).toBe(2);
      expect(entries[0].status).toBe('processing');
      expect(dlq.stats.totalDequeued).toBe(2);
    });

    it('should skip entries already being processed', async () => {
      await dlq.dequeue({ limit: 2 });
      const entries = await dlq.dequeue({ limit: 3 });

      expect(entries.length).toBe(1); // Only 1 remaining
    });

    it('should apply filter when provided', async () => {
      const filter = (entry) => entry.context.mappingId === 'map1';
      const entries = await dlq.dequeue({ filter });

      expect(entries.length).toBe(1);
      expect(entries[0].context.mappingId).toBe('map1');
    });
  });

  describe('markAsResolved', () => {
    it('should mark entry as resolved and remove from queue', async () => {
      const entryId = await dlq.enqueue({ id: 1 }, new Error('Failed'));
      const result = { processed: true };

      const resolved = await dlq.markAsResolved(entryId, result);

      expect(resolved.status).toBe('resolved');
      expect(resolved.result).toEqual(result);
      expect(dlq.queue.length).toBe(0);
      expect(dlq.stats.totalReprocessed).toBe(1);
    });

    it('should throw error if entry not found', async () => {
      await expect(dlq.markAsResolved('invalid-id')).rejects.toThrow('not found');
    });
  });

  describe('markAsFailed', () => {
    it('should add attempt record and keep as pending', async () => {
      const entryId = await dlq.enqueue({ id: 1 }, new Error('Failed'));
      const retryError = new Error('Retry failed');

      const entry = await dlq.markAsFailed(entryId, retryError, true);

      expect(entry.attempts.length).toBe(1);
      expect(entry.status).toBe('pending');
    });

    it('should mark as permanently failed when shouldRetry is false', async () => {
      const entryId = await dlq.enqueue({ id: 1 }, new Error('Failed'));
      const retryError = new Error('Permanent failure');

      const entry = await dlq.markAsFailed(entryId, retryError, false);

      expect(entry.status).toBe('failed');
      expect(entry.failedAt).toBeDefined();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await dlq.enqueue({ id: 1 }, new Error('Error 1'), { mappingId: 'map1' });
      await dlq.enqueue({ id: 2 }, new Error('Error 2'), { mappingId: 'map2' });
      await dlq.enqueue({ id: 3 }, new Error('Network error'), { mappingId: 'map1' });
    });

    it('should search by status', async () => {
      // Mark one as failed
      const entries = await dlq.dequeue({ limit: 1 });
      await dlq.markAsFailed(entries[0].id, new Error('Failed'), false);

      const failed = await dlq.search({ status: 'failed' });
      expect(failed.length).toBe(1);
    });

    it('should search by mappingId', async () => {
      const results = await dlq.search({ mappingId: 'map1' });
      expect(results.length).toBe(2);
    });

    it('should search by error pattern', async () => {
      const results = await dlq.search({ errorPattern: 'Network' });
      expect(results.length).toBe(1);
      expect(results[0].error.message).toContain('Network');
    });
  });

  describe('clearExpired', () => {
    it('should remove expired entries', async () => {
      jest.useFakeTimers();
      
      await dlq.enqueue({ id: 1 }, new Error('Failed'));
      
      // Advance time past retention period
      jest.advanceTimersByTime(1001);
      
      const cleared = await dlq.clearExpired();
      
      expect(cleared).toBe(1);
      expect(dlq.queue.length).toBe(0);
      expect(dlq.stats.totalExpired).toBe(1);
      
      jest.useRealTimers();
    });
  });

  describe('getStatistics', () => {
    it('should return queue statistics', async () => {
      await dlq.enqueue({ id: 1 }, new Error('Failed'), { mappingId: 'map1' });
      await dlq.enqueue({ id: 2 }, new Error('Failed'), { mappingId: 'map1' });
      await dlq.enqueue({ id: 3 }, new Error('Failed'), { mappingId: 'map2' });

      const stats = dlq.getStatistics();

      expect(stats.totalEnqueued).toBe(3);
      expect(stats.currentSize).toBe(3);
      expect(stats.statusCounts.pending).toBe(3);
      expect(stats.contextCounts.map1).toBe(2);
      expect(stats.contextCounts.map2).toBe(1);
    });
  });

  describe('file storage', () => {
    it('should persist entries to file storage', async () => {
      const fileDlq = new DeadLetterQueue({
        storageType: 'file',
        filePath: testFilePath,
        maxSize: 5,
        flushInterval: 0, // Disable background tasks
        enableStatsLogging: false
      });

      await fileDlq.initializeStorage();
      const entryId = await fileDlq.enqueue({ id: 1 }, new Error('Failed'));

      // Check file exists
      const files = await fs.readdir(testFilePath);
      expect(files.length).toBe(1);
      expect(files[0]).toContain(entryId);

      await fileDlq.shutdown();
    });

    it.skip('should load existing entries on initialization', async () => {
      const testDir = `./test-dlq-reload-${Date.now()}`;
      
      // Step 1: Create and populate a DLQ
      const firstDLQ = new DeadLetterQueue({
        storageType: 'file',
        filePath: testDir,
        flushInterval: 0,
        enableStatsLogging: false
      });
      
      await firstDLQ.initializeStorage();
      await firstDLQ.enqueue({ id: 42, name: 'test' }, new Error('Test error'));
      await firstDLQ.shutdown();
      
      // Step 2: Create a new DLQ instance and verify it loads the data
      const secondDLQ = new DeadLetterQueue({
        storageType: 'file',
        filePath: testDir,
        flushInterval: 0,
        enableStatsLogging: false
      });
      
      await secondDLQ.initializeStorage();
      
      // Verify the data was loaded
      expect(secondDLQ.queue.length).toBe(1);
      expect(secondDLQ.queue[0].record.id).toBe(42);
      expect(secondDLQ.queue[0].record.name).toBe('test');
      
      await secondDLQ.shutdown();
      
      // Clean up
      await fs.rm(testDir, { recursive: true, force: true });
    });
  });

  describe('exportToFile', () => {
    it('should export queue to file', async () => {
      await dlq.enqueue({ id: 1 }, new Error('Failed'));
      await dlq.enqueue({ id: 2 }, new Error('Failed'));

      // Ensure directory exists
      await fs.mkdir(testFilePath, { recursive: true });
      const exportPath = path.join(testFilePath, 'export.json');
      const result = await dlq.exportToFile(exportPath);

      expect(result.entryCount).toBe(2);
      expect(result.filepath).toBe(exportPath);

      // Verify file contents
      const content = await fs.readFile(exportPath, 'utf8');
      const data = JSON.parse(content);
      expect(data.entries.length).toBe(2);
    });
  });
});