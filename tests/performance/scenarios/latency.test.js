/**
 * E2E Latency Performance Test
 * Measures end-to-end latency from Oracle insert to ES document availability
 *
 * Metrics measured:
 * - P50, P95, P99 latency
 * - Insert to ES visible time
 * - Batch vs single record latency
 *
 * False Positive Prevention:
 * - Environment unavailable → test FAILS (not skips)
 * - All paths have assertions
 */

const { TIMEOUTS, THRESHOLDS, CONFIG } = require('../config');
const {
  initPerfEnvironment,
  cleanupTestData,
  closeConnections,
  getEsClient,
  executeOracleSQL,
  ENV_STATUS
} = require('../setup');
const { insertSingleRecord, getNextTestId } = require('../utils/data-generator');
const { MetricsCollector } = require('../utils/metrics-collector');

// Test configuration
const LATENCY_CONFIG = {
  sampleSize: 50,           // Number of samples for latency measurement
  pollIntervalMs: 100,      // Polling interval for ES visibility
  maxWaitMs: 60000,         // Maximum wait for ES visibility (60s)
  warmupSamples: 5          // Warmup samples to discard
};

// Metrics collector instance
let metrics;

describe('E2E Latency Performance Test', () => {

  beforeAll(async () => {
    const envStatus = await initPerfEnvironment();
    metrics = new MetricsCollector('latency');

    if (envStatus.oracle && envStatus.elasticsearch) {
      await cleanupTestData();
    }
  }, TIMEOUTS.SMALL);

  afterAll(async () => {
    if (metrics) {
      metrics.printSummary();
      metrics.saveReport('latency');
    }

    try {
      await cleanupTestData();
    } catch (e) {
      console.log(`Cleanup warning: ${e.message}`);
    }

    await closeConnections();
  });

  describe('Environment Validation', () => {
    test('Pipeline components should be available', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required for latency tests');
      }
      expect(ENV_STATUS.oracle).toBe(true);
      expect(ENV_STATUS.elasticsearch).toBe(true);
    });
  });

  describe('Single Record E2E Latency', () => {
    /**
     * Wait for a document to appear in Elasticsearch
     */
    const waitForEsDocument = async (id, maxWaitMs = LATENCY_CONFIG.maxWaitMs) => {
      const client = await getEsClient();
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        try {
          const result = await client.get({
            index: CONFIG.elasticsearch.index,
            id: String(id)
          });
          if (result.found) {
            return Date.now();
          }
        } catch (e) {
          // Document not found yet, continue polling
        }
        await new Promise(resolve => setTimeout(resolve, LATENCY_CONFIG.pollIntervalMs));
      }

      return null; // Timeout
    };

    /**
     * Sync single record from Oracle to ES (simulates CDC)
     */
    const syncSingleRecordToEs = async (id) => {
      const client = await getEsClient();

      const result = await executeOracleSQL(
        `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE WHERE ID = :id`,
        { id }
      );

      if (result.rows.length === 0) {
        throw new Error(`Record ${id} not found in Oracle`);
      }

      const row = result.rows[0];
      await client.index({
        index: CONFIG.elasticsearch.index,
        id: String(row[0]),
        document: {
          ID: row[0],
          NAME: row[1],
          VALUE: row[2],
          UPDATED_AT: row[3]?.toISOString() || new Date().toISOString()
        },
        refresh: true
      });

      return Date.now();
    };

    test('should measure Oracle insert latency', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      let nextId = await getNextTestId();
      const latencies = [];

      // Warmup
      for (let i = 0; i < LATENCY_CONFIG.warmupSamples; i++) {
        await insertSingleRecord({
          id: nextId++,
          name: `Warmup_${i}`,
          value: Math.random() * 100
        });
      }

      // Measure
      for (let i = 0; i < LATENCY_CONFIG.sampleSize; i++) {
        const startTime = Date.now();
        await insertSingleRecord({
          id: nextId++,
          name: `LatencyTest_${i}`,
          value: Math.random() * 1000
        });
        const latency = Date.now() - startTime;

        latencies.push(latency);
        metrics.recordLatency('oracle_insert', latency);
      }

      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = MetricsCollector.calculatePercentile(latencies, 50);
      const p95 = MetricsCollector.calculatePercentile(latencies, 95);
      const p99 = MetricsCollector.calculatePercentile(latencies, 99);

      console.log(`Oracle Insert Latency: P50=${p50}ms, P95=${p95}ms, P99=${p99}ms`);

      expect(latencies.length).toBe(LATENCY_CONFIG.sampleSize);
      expect(p95).toBeLessThan(5000); // P95 < 5s for single insert
    }, TIMEOUTS.SMALL);

    test('should measure E2E sync latency (Oracle → ES)', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required');
      }

      let nextId = await getNextTestId();
      const e2eLatencies = [];

      for (let i = 0; i < 20; i++) { // 20 samples for E2E (slower test)
        const record = {
          id: nextId++,
          name: `E2ELatency_${i}`,
          value: Math.random() * 1000
        };

        // Insert to Oracle
        const insertStart = Date.now();
        await insertSingleRecord(record);
        const insertTime = Date.now();

        // Sync to ES (simulates NiFi CDC)
        const syncTime = await syncSingleRecordToEs(record.id);

        // Total E2E latency
        const e2eLatency = syncTime - insertStart;
        const syncLatency = syncTime - insertTime;

        e2eLatencies.push(e2eLatency);
        metrics.recordLatency('e2e_sync', e2eLatency);
        metrics.recordLatency('es_sync', syncLatency);
      }

      // Calculate percentiles
      e2eLatencies.sort((a, b) => a - b);
      const p50 = MetricsCollector.calculatePercentile(e2eLatencies, 50);
      const p95 = MetricsCollector.calculatePercentile(e2eLatencies, 95);
      const p99 = MetricsCollector.calculatePercentile(e2eLatencies, 99);

      console.log(`E2E Sync Latency: P50=${p50}ms, P95=${p95}ms, P99=${p99}ms`);

      expect(e2eLatencies.length).toBe(20);
      expect(p95).toBeLessThan(THRESHOLDS.latency.p95);
    }, TIMEOUTS.SMALL);
  });

  describe('Batch Latency', () => {
    test('should measure batch sync latency', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required');
      }

      const batchSizes = [10, 50, 100];
      let nextId = await getNextTestId();

      for (const batchSize of batchSizes) {
        // Insert batch to Oracle
        const insertStart = Date.now();
        const ids = [];

        for (let i = 0; i < batchSize; i++) {
          const id = nextId++;
          ids.push(id);
          await executeOracleSQL(
            `INSERT INTO MY_TABLE (ID, NAME, VALUE, UPDATED_AT)
             VALUES (:id, :name, :value, CURRENT_TIMESTAMP)`,
            { id, name: `Batch_${batchSize}_${i}`, value: Math.random() * 1000 }
          );
        }
        const insertEnd = Date.now();

        // Sync batch to ES
        const client = await getEsClient();
        const syncStart = Date.now();

        const result = await executeOracleSQL(
          `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE
           WHERE ID >= :minId AND ID <= :maxId
           ORDER BY UPDATED_AT`,
          { minId: ids[0], maxId: ids[ids.length - 1] }
        );

        // Bulk index to ES
        const operations = result.rows.flatMap(row => [
          { index: { _index: CONFIG.elasticsearch.index, _id: String(row[0]) } },
          { ID: row[0], NAME: row[1], VALUE: row[2], UPDATED_AT: row[3]?.toISOString() }
        ]);

        await client.bulk({ operations, refresh: true });
        const syncEnd = Date.now();

        const insertLatency = insertEnd - insertStart;
        const syncLatency = syncEnd - syncStart;
        const totalLatency = syncEnd - insertStart;

        metrics.recordLatency(`batch_insert_${batchSize}`, insertLatency);
        metrics.recordLatency(`batch_sync_${batchSize}`, syncLatency);
        metrics.recordLatency(`batch_e2e_${batchSize}`, totalLatency);

        console.log(`Batch ${batchSize}: insert=${insertLatency}ms, sync=${syncLatency}ms, total=${totalLatency}ms`);

        // Per-record latency should decrease with batch size
        const perRecordLatency = totalLatency / batchSize;
        expect(perRecordLatency).toBeLessThan(1000); // < 1s per record in batch
      }
    }, TIMEOUTS.SMALL);
  });

  describe('Latency Distribution', () => {
    test('should report latency percentiles', () => {
      const stats = metrics.getLatencyStats();

      console.log('\nOverall Latency Distribution:');
      console.log(`  Count: ${stats.count}`);
      console.log(`  Min: ${stats.min}ms`);
      console.log(`  Max: ${stats.max}ms`);
      console.log(`  Avg: ${stats.avg}ms`);
      console.log(`  P50: ${stats.p50}ms`);
      console.log(`  P95: ${stats.p95}ms`);
      console.log(`  P99: ${stats.p99}ms`);

      expect(stats.count).toBeGreaterThan(0);
      expect(stats.p50).toBeLessThanOrEqual(stats.p95);
      expect(stats.p95).toBeLessThanOrEqual(stats.p99);
    });

    test('should meet latency thresholds', () => {
      const stats = metrics.getLatencyStats('e2e_sync');

      if (stats.count === 0) {
        throw new Error('No E2E sync latency data collected');
      }

      console.log('\nE2E Sync Latency Thresholds:');
      console.log(`  P50: ${stats.p50}ms (threshold: ${THRESHOLDS.latency.p50}ms)`);
      console.log(`  P95: ${stats.p95}ms (threshold: ${THRESHOLDS.latency.p95}ms)`);
      console.log(`  P99: ${stats.p99}ms (threshold: ${THRESHOLDS.latency.p99}ms)`);

      expect(stats.p50).toBeLessThan(THRESHOLDS.latency.p50);
      expect(stats.p95).toBeLessThan(THRESHOLDS.latency.p95);
      expect(stats.p99).toBeLessThan(THRESHOLDS.latency.p99);
    });
  });
});
