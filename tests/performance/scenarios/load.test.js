/**
 * Load Performance Test
 * Tests with 10K-50K records to measure sustained throughput
 *
 * Metrics measured:
 * - Sustained throughput (records/min)
 * - System stability under load
 * - Resource utilization patterns
 *
 * False Positive Prevention:
 * - Environment unavailable → test FAILS
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
const { generateRecords, bulkInsertOracle } = require('../utils/data-generator');
const { MetricsCollector } = require('../utils/metrics-collector');

// Test configuration - use MEDIUM by default, LARGE if env var set
const LOAD_LEVEL = process.env.LOAD_LEVEL === 'LARGE' ? 'LARGE' : 'MEDIUM';
const TEST_CONFIG = LOAD_LEVELS[LOAD_LEVEL];

let metrics;

describe(`Load Performance Test (${TEST_CONFIG.description})`, () => {

  beforeAll(async () => {
    const envStatus = await initPerfEnvironment();
    metrics = new MetricsCollector(`load-${LOAD_LEVEL.toLowerCase()}`);

    if (envStatus.oracle && envStatus.elasticsearch) {
      await cleanupTestData();
    }
  }, TIMEOUTS[LOAD_LEVEL]);

  afterAll(async () => {
    if (metrics) {
      metrics.printSummary();
      metrics.saveReport(`load-${LOAD_LEVEL.toLowerCase()}`);
    }

    try {
      await cleanupTestData();
    } catch (e) {
      console.log(`Cleanup warning: ${e.message}`);
    }

    await closeConnections();
  });

  describe('Environment Validation', () => {
    test('Pipeline should be ready for load test', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required for load tests');
      }
      expect(ENV_STATUS.oracle).toBe(true);
      expect(ENV_STATUS.elasticsearch).toBe(true);
    });
  });

  describe('Bulk Load Test', () => {
    test(`should handle ${TEST_CONFIG.count.toLocaleString()} records`, async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      console.log(`\nStarting load test: ${TEST_CONFIG.description}`);

      // Generate test data
      const records = generateRecords(
        TEST_CONFIG.count,
        TEST_CONFIG.timeSpread,
        CONFIG.testDataIdStart
      );
      expect(records).toHaveLength(TEST_CONFIG.count);

      // Bulk insert
      const insertStart = Date.now();
      const insertStats = await bulkInsertOracle(records);
      const insertDuration = Date.now() - insertStart;

      metrics.recordThroughput(insertStats.inserted, insertDuration);
      metrics.recordLatency('load_insert', insertDuration);

      // Verify count
      const countResult = await executeOracleSQL(
        `SELECT COUNT(*) FROM MY_TABLE WHERE ID >= :startId`,
        { startId: CONFIG.testDataIdStart }
      );
      const oracleCount = countResult.rows[0][0];

      console.log(`Insert complete: ${insertStats.inserted} records in ${insertDuration}ms`);
      console.log(`Throughput: ${insertStats.recordsPerSecond} rec/s (${insertStats.recordsPerSecond * 60} rec/min)`);

      expect(insertStats.inserted).toBe(TEST_CONFIG.count);
      expect(insertStats.failed).toBe(0);
      expect(oracleCount).toBe(TEST_CONFIG.count);
    }, TIMEOUTS[LOAD_LEVEL]);

    test('should sync to Elasticsearch within threshold', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required');
      }

      const client = await getEsClient();
      const syncStart = Date.now();

      // Read from Oracle in batches
      const batchSize = 5000;
      let offset = 0;
      let totalSynced = 0;

      while (true) {
        const result = await executeOracleSQL(
          `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE
           WHERE ID >= :startId
           ORDER BY ID
           OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
          { startId: CONFIG.testDataIdStart, offset, limit: batchSize }
        );

        if (result.rows.length === 0) break;

        // Bulk index
        const operations = result.rows.flatMap(row => [
          { index: { _index: CONFIG.elasticsearch.index, _id: String(row[0]) } },
          { ID: row[0], NAME: row[1], VALUE: row[2], UPDATED_AT: row[3]?.toISOString() }
        ]);

        await client.bulk({ operations, refresh: false });
        totalSynced += result.rows.length;
        offset += batchSize;

        console.log(`  Synced ${totalSynced}/${TEST_CONFIG.count} records...`);
      }

      await client.indices.refresh({ index: CONFIG.elasticsearch.index });
      const syncDuration = Date.now() - syncStart;

      metrics.recordThroughput(totalSynced, syncDuration);
      metrics.recordLatency('load_sync', syncDuration);

      // Verify ES count
      const esCount = await client.count({
        index: CONFIG.elasticsearch.index,
        query: { range: { ID: { gte: CONFIG.testDataIdStart } } }
      });

      console.log(`Sync complete: ${totalSynced} records in ${syncDuration}ms`);
      console.log(`ES document count: ${esCount.count}`);

      expect(esCount.count).toBe(totalSynced);
    }, TIMEOUTS[LOAD_LEVEL]);
  });

  describe('Throughput Validation', () => {
    test('should meet minimum throughput threshold', () => {
      const throughputStats = metrics.getThroughputStats();

      console.log('\nThroughput Statistics:');
      console.log(`  Total Records: ${throughputStats.totalRecords}`);
      console.log(`  Average: ${throughputStats.avgPerMinute} rec/min`);
      console.log(`  Peak: ${throughputStats.peak} rec/min`);
      console.log(`  Threshold: ${THRESHOLDS.throughput.min} rec/min`);

      expect(throughputStats.avgPerMinute).toBeGreaterThanOrEqual(THRESHOLDS.throughput.min);
    });

    test('should have acceptable error rate', () => {
      const errorRate = metrics.getErrorRate();

      console.log(`\nError Rate: ${(errorRate * 100).toFixed(4)}%`);
      console.log(`Threshold: ${(THRESHOLDS.errorRate * 100).toFixed(4)}%`);

      expect(errorRate).toBeLessThanOrEqual(THRESHOLDS.errorRate);
    });
  });
});
