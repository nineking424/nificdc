/**
 * Baseline Performance Test
 * Tests with 1K records to establish baseline metrics
 *
 * Metrics measured:
 * - Insert latency (Oracle)
 * - CDC sync latency (Oracle → ES)
 * - Query execution time
 * - Overall throughput
 *
 * False Positive Prevention:
 * - Environment unavailable → test FAILS (not skips)
 * - All paths have assertions
 * - No conditional returns
 */

const { LOAD_LEVELS, TIMEOUTS, THRESHOLDS, CONFIG } = require('../config');
const {
  initPerfEnvironment,
  cleanupTestData,
  closeConnections,
  getEsClient,
  executeOracleSQL,
  ENV_STATUS
} = require('../setup');
const { generateRecords, bulkInsertOracle, insertSingleRecord } = require('../utils/data-generator');
const { MetricsCollector } = require('../utils/metrics-collector');
const { compareToBaseline, printComparisonSummary, updateBaselineIfPassing } = require('../utils/baseline-manager');

// Test configuration
const TEST_CONFIG = {
  loadLevel: 'SMALL',
  recordCount: LOAD_LEVELS.SMALL.count,
  timeSpread: LOAD_LEVELS.SMALL.timeSpread
};

// Metrics collector instance
let metrics;

describe('Baseline Performance Test (1K Records)', () => {

  beforeAll(async () => {
    // Initialize environment and check availability
    const envStatus = await initPerfEnvironment();

    // Initialize metrics collector
    metrics = new MetricsCollector('baseline');

    // Clean up any existing test data
    if (envStatus.oracle && envStatus.elasticsearch) {
      await cleanupTestData();
    }
  }, TIMEOUTS.SMALL);

  afterAll(async () => {
    // Print summary and save report
    if (metrics) {
      metrics.printSummary();
      metrics.saveReport('baseline');

      // Compare to baseline
      const stats = metrics.getStatistics();
      const comparison = compareToBaseline(stats);
      printComparisonSummary(comparison);

      // Update baseline if passing and flag is set
      if (process.env.SAVE_BASELINE === 'true') {
        updateBaselineIfPassing(stats, process.env.FORCE_BASELINE === 'true');
      }
    }

    // Clean up test data
    try {
      await cleanupTestData();
    } catch (e) {
      console.log(`Cleanup warning: ${e.message}`);
    }

    await closeConnections();
  });

  describe('Environment Validation', () => {
    test('Oracle should be available', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available - performance tests require Oracle');
      }

      const result = await executeOracleSQL('SELECT 1 FROM DUAL');
      expect(result.rows).toHaveLength(1);
    });

    test('Elasticsearch should be available', async () => {
      if (!ENV_STATUS.elasticsearch) {
        throw new Error('Elasticsearch is not available - performance tests require Elasticsearch');
      }

      const client = await getEsClient();
      const health = await client.cluster.health();
      expect(['green', 'yellow']).toContain(health.status);
    });
  });

  describe('Bulk Insert Performance', () => {
    test('should insert 1K records within threshold', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      // Generate test records
      const records = generateRecords(
        TEST_CONFIG.recordCount,
        TEST_CONFIG.timeSpread,
        CONFIG.testDataIdStart
      );
      expect(records).toHaveLength(TEST_CONFIG.recordCount);

      // Measure bulk insert time
      const startTime = Date.now();
      const insertStats = await bulkInsertOracle(records);
      const duration = Date.now() - startTime;

      // Record metrics
      metrics.recordThroughput(insertStats.inserted, duration);
      metrics.recordLatency('bulk_insert', duration);

      // Assertions
      expect(insertStats.inserted).toBe(TEST_CONFIG.recordCount);
      expect(insertStats.failed).toBe(0);

      // Verify records exist
      const countResult = await executeOracleSQL(
        `SELECT COUNT(*) FROM MY_TABLE WHERE ID >= :startId`,
        { startId: CONFIG.testDataIdStart }
      );
      expect(countResult.rows[0][0]).toBe(TEST_CONFIG.recordCount);

      console.log(`Bulk insert: ${insertStats.inserted} records in ${duration}ms (${insertStats.recordsPerSecond} rec/s)`);
    }, TIMEOUTS.SMALL);
  });

  describe('Single Record Latency', () => {
    test('should measure single insert latency', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const sampleSize = 10;
      const latencies = [];

      for (let i = 0; i < sampleSize; i++) {
        const record = {
          id: CONFIG.testDataIdStart + TEST_CONFIG.recordCount + i,
          name: `LatencyTest_${i}`,
          value: Math.random() * 1000
        };

        const startTime = Date.now();
        await insertSingleRecord(record);
        const latency = Date.now() - startTime;

        latencies.push(latency);
        metrics.recordLatency('single_insert', latency);
      }

      // Calculate statistics
      latencies.sort((a, b) => a - b);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95 = latencies[Math.floor(latencies.length * 0.95)];

      console.log(`Single insert latency: avg=${Math.round(avg)}ms, p95=${p95}ms`);

      // Assertions - single inserts should be fast
      expect(avg).toBeLessThan(1000); // avg < 1s
      expect(p95).toBeLessThan(2000); // p95 < 2s
    }, TIMEOUTS.SMALL);
  });

  describe('CDC Sync Performance', () => {
    /**
     * Simulates CDC sync from Oracle to Elasticsearch
     */
    const syncToElasticsearch = async () => {
      const client = await getEsClient();

      // Read from Oracle
      const result = await executeOracleSQL(
        `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE WHERE ID >= :startId ORDER BY UPDATED_AT`,
        { startId: CONFIG.testDataIdStart }
      );

      // Index to Elasticsearch
      for (const row of result.rows) {
        await client.index({
          index: CONFIG.elasticsearch.index,
          id: String(row[0]),
          document: {
            ID: row[0],
            NAME: row[1],
            VALUE: row[2],
            UPDATED_AT: row[3]?.toISOString() || new Date().toISOString()
          },
          refresh: false
        });
      }

      // Refresh index
      await client.indices.refresh({ index: CONFIG.elasticsearch.index });

      return result.rows.length;
    };

    test('should sync all records to Elasticsearch', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required');
      }

      const startTime = Date.now();
      const syncedCount = await syncToElasticsearch();
      const duration = Date.now() - startTime;

      metrics.recordLatency('cdc_sync', duration);
      metrics.recordThroughput(syncedCount, duration);

      // Verify in Elasticsearch
      const client = await getEsClient();
      const countResult = await client.count({
        index: CONFIG.elasticsearch.index,
        query: {
          range: { ID: { gte: CONFIG.testDataIdStart } }
        }
      });

      console.log(`CDC sync: ${syncedCount} records in ${duration}ms`);

      // Assertions
      expect(syncedCount).toBeGreaterThan(0);
      expect(countResult.count).toBe(syncedCount);
    }, TIMEOUTS.SMALL);
  });

  describe('Query Performance', () => {
    test('should execute count query within threshold', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const startTime = Date.now();
      const result = await executeOracleSQL(
        `SELECT COUNT(*) FROM MY_TABLE WHERE ID >= :startId`,
        { startId: CONFIG.testDataIdStart }
      );
      const duration = Date.now() - startTime;

      metrics.recordQueryTime('count_query', 'baseline', duration);

      console.log(`Count query: ${duration}ms`);

      expect(result.rows[0][0]).toBeGreaterThan(0);
      expect(duration).toBeLessThan(THRESHOLDS.query['5m']);
    });

    test('should execute range query within threshold', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      // Query with time range (5 minute window)
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);

      const queryStart = Date.now();
      const result = await executeOracleSQL(
        `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE
         WHERE ID >= :startId
         AND UPDATED_AT BETWEEN :startTime AND :endTime
         ORDER BY UPDATED_AT`,
        {
          startId: CONFIG.testDataIdStart,
          startTime,
          endTime
        }
      );
      const duration = Date.now() - queryStart;

      metrics.recordQueryTime('range_query', '5m', duration);

      console.log(`Range query (5m window): ${duration}ms, ${result.rows.length} rows`);

      expect(duration).toBeLessThan(THRESHOLDS.query['5m']);
    });
  });

  describe('Threshold Validation', () => {
    test('should pass all performance thresholds', () => {
      const thresholdCheck = metrics.checkThresholds();

      console.log('\nThreshold Check Results:');
      for (const check of thresholdCheck.checks) {
        const status = check.passed ? '✓' : '✗';
        console.log(`  ${status} ${check.name}: ${check.actual} (threshold: ${check.threshold})`);
      }

      // This assertion will fail if any threshold is violated
      expect(thresholdCheck.passed).toBe(true);
    });
  });
});
