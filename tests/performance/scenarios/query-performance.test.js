/**
 * Query Performance Test
 * Benchmarks SQL query execution times for different time windows
 *
 * Metrics measured:
 * - Query execution time by time window (5m, 1h, 24h)
 * - Count query performance
 * - Range query performance
 * - Aggregation query performance
 *
 * False Positive Prevention:
 * - Environment unavailable → test FAILS
 * - All assertions required
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
const { generateRecords, bulkInsertOracle } = require('../utils/data-generator');
const { MetricsCollector } = require('../utils/metrics-collector');

// Test configuration
const QUERY_CONFIG = {
  dataSize: 5000,           // 5K records for query tests
  iterations: 5,            // Run each query 5 times
  timeWindows: {
    '5m': 5 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000
  }
};

let metrics;
let testDataInserted = false;

describe('Query Performance Test', () => {

  beforeAll(async () => {
    const envStatus = await initPerfEnvironment();
    metrics = new MetricsCollector('query-performance');

    if (envStatus.oracle && envStatus.elasticsearch) {
      await cleanupTestData();

      // Insert test data with distributed timestamps
      console.log(`Inserting ${QUERY_CONFIG.dataSize} test records...`);
      const records = generateRecords(
        QUERY_CONFIG.dataSize,
        QUERY_CONFIG.timeWindows['24h'],
        CONFIG.testDataIdStart
      );
      const insertStats = await bulkInsertOracle(records);
      testDataInserted = insertStats.inserted === QUERY_CONFIG.dataSize;

      // Sync to Elasticsearch
      const client = await getEsClient();
      const result = await executeOracleSQL(
        `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE WHERE ID >= :startId ORDER BY UPDATED_AT`,
        { startId: CONFIG.testDataIdStart }
      );

      const operations = result.rows.flatMap(row => [
        { index: { _index: CONFIG.elasticsearch.index, _id: String(row[0]) } },
        { ID: row[0], NAME: row[1], VALUE: row[2], UPDATED_AT: row[3]?.toISOString() }
      ]);

      if (operations.length > 0) {
        await client.bulk({ operations, refresh: true });
      }
      console.log(`Test data ready: ${result.rows.length} records`);
    }
  }, TIMEOUTS.MEDIUM);

  afterAll(async () => {
    if (metrics) {
      metrics.printSummary();
      metrics.saveReport('query-performance');
    }

    try {
      await cleanupTestData();
    } catch (e) {
      console.log(`Cleanup warning: ${e.message}`);
    }

    await closeConnections();
  });

  describe('Environment Validation', () => {
    test('Test data should be available', () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }
      if (!testDataInserted) {
        throw new Error('Test data was not inserted successfully');
      }
      expect(testDataInserted).toBe(true);
    });
  });

  describe('Oracle Count Queries', () => {
    test('should execute total count query', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const durations = [];

      for (let i = 0; i < QUERY_CONFIG.iterations; i++) {
        const startTime = Date.now();
        const result = await executeOracleSQL(
          `SELECT COUNT(*) FROM MY_TABLE WHERE ID >= :startId`,
          { startId: CONFIG.testDataIdStart }
        );
        const duration = Date.now() - startTime;

        durations.push(duration);
        metrics.recordQueryTime('oracle_count_total', 'total', duration);

        expect(result.rows[0][0]).toBeGreaterThan(0);
      }

      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      console.log(`Oracle COUNT(*) total: avg=${avg}ms`);

      expect(avg).toBeLessThan(1000); // < 1s average
    });

    test('should execute count queries for time windows', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const now = new Date();

      for (const [windowName, windowMs] of Object.entries(QUERY_CONFIG.timeWindows)) {
        const threshold = THRESHOLDS.query[windowName];
        const startTime = new Date(now.getTime() - windowMs);
        const durations = [];

        for (let i = 0; i < QUERY_CONFIG.iterations; i++) {
          const queryStart = Date.now();
          const result = await executeOracleSQL(
            `SELECT COUNT(*) FROM MY_TABLE
             WHERE ID >= :startId
             AND UPDATED_AT >= :startTime`,
            { startId: CONFIG.testDataIdStart, startTime }
          );
          const duration = Date.now() - queryStart;

          durations.push(duration);
          metrics.recordQueryTime('oracle_count', windowName, duration);
        }

        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const max = Math.max(...durations);

        console.log(`Oracle COUNT [${windowName}]: avg=${avg}ms, max=${max}ms (threshold: ${threshold}ms)`);

        expect(avg).toBeLessThan(threshold);
      }
    });
  });

  describe('Oracle Range Queries', () => {
    test('should execute range queries for time windows', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const now = new Date();

      for (const [windowName, windowMs] of Object.entries(QUERY_CONFIG.timeWindows)) {
        const threshold = THRESHOLDS.query[windowName];
        const startTime = new Date(now.getTime() - windowMs);
        const durations = [];
        let rowCount = 0;

        for (let i = 0; i < QUERY_CONFIG.iterations; i++) {
          const queryStart = Date.now();
          const result = await executeOracleSQL(
            `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE
             WHERE ID >= :startId
             AND UPDATED_AT >= :startTime
             ORDER BY UPDATED_AT`,
            { startId: CONFIG.testDataIdStart, startTime }
          );
          const duration = Date.now() - queryStart;

          durations.push(duration);
          rowCount = result.rows.length;
          metrics.recordQueryTime('oracle_range', windowName, duration);
        }

        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        console.log(`Oracle RANGE [${windowName}]: avg=${avg}ms, rows=${rowCount} (threshold: ${threshold}ms)`);

        expect(avg).toBeLessThan(threshold * 2); // Allow 2x for data fetch
      }
    });
  });

  describe('Elasticsearch Queries', () => {
    test('should execute ES count queries for time windows', async () => {
      if (!ENV_STATUS.elasticsearch) {
        throw new Error('Elasticsearch is not available');
      }

      const client = await getEsClient();
      const now = new Date();

      for (const [windowName, windowMs] of Object.entries(QUERY_CONFIG.timeWindows)) {
        const threshold = THRESHOLDS.query[windowName];
        const startTime = new Date(now.getTime() - windowMs);
        const durations = [];
        let count = 0;

        for (let i = 0; i < QUERY_CONFIG.iterations; i++) {
          const queryStart = Date.now();
          const result = await client.count({
            index: CONFIG.elasticsearch.index,
            query: {
              bool: {
                must: [
                  { range: { ID: { gte: CONFIG.testDataIdStart } } },
                  { range: { UPDATED_AT: { gte: startTime.toISOString() } } }
                ]
              }
            }
          });
          const duration = Date.now() - queryStart;

          durations.push(duration);
          count = result.count;
          metrics.recordQueryTime('es_count', windowName, duration);
        }

        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        console.log(`ES COUNT [${windowName}]: avg=${avg}ms, count=${count} (threshold: ${threshold}ms)`);

        expect(avg).toBeLessThan(threshold);
      }
    });

    test('should execute ES search queries for time windows', async () => {
      if (!ENV_STATUS.elasticsearch) {
        throw new Error('Elasticsearch is not available');
      }

      const client = await getEsClient();
      const now = new Date();

      for (const [windowName, windowMs] of Object.entries(QUERY_CONFIG.timeWindows)) {
        const threshold = THRESHOLDS.query[windowName];
        const startTime = new Date(now.getTime() - windowMs);
        const durations = [];
        let hits = 0;

        for (let i = 0; i < QUERY_CONFIG.iterations; i++) {
          const queryStart = Date.now();
          const result = await client.search({
            index: CONFIG.elasticsearch.index,
            size: 1000,
            query: {
              bool: {
                must: [
                  { range: { ID: { gte: CONFIG.testDataIdStart } } },
                  { range: { UPDATED_AT: { gte: startTime.toISOString() } } }
                ]
              }
            },
            sort: [{ UPDATED_AT: 'asc' }]
          });
          const duration = Date.now() - queryStart;

          durations.push(duration);
          hits = result.hits.total.value;
          metrics.recordQueryTime('es_search', windowName, duration);
        }

        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        console.log(`ES SEARCH [${windowName}]: avg=${avg}ms, hits=${hits} (threshold: ${threshold}ms)`);

        expect(avg).toBeLessThan(threshold * 2); // Allow 2x for data fetch
      }
    });
  });

  describe('Aggregation Queries', () => {
    test('should execute Oracle aggregation query', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const durations = [];

      for (let i = 0; i < QUERY_CONFIG.iterations; i++) {
        const queryStart = Date.now();
        const result = await executeOracleSQL(
          `SELECT
             COUNT(*) as cnt,
             MIN(VALUE) as min_val,
             MAX(VALUE) as max_val,
             AVG(VALUE) as avg_val
           FROM MY_TABLE
           WHERE ID >= :startId`,
          { startId: CONFIG.testDataIdStart }
        );
        const duration = Date.now() - queryStart;

        durations.push(duration);
        metrics.recordQueryTime('oracle_agg', 'total', duration);
      }

      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      console.log(`Oracle AGG: avg=${avg}ms`);

      expect(avg).toBeLessThan(2000);
    });

    test('should execute ES aggregation query', async () => {
      if (!ENV_STATUS.elasticsearch) {
        throw new Error('Elasticsearch is not available');
      }

      const client = await getEsClient();
      const durations = [];

      for (let i = 0; i < QUERY_CONFIG.iterations; i++) {
        const queryStart = Date.now();
        const result = await client.search({
          index: CONFIG.elasticsearch.index,
          size: 0,
          query: {
            range: { ID: { gte: CONFIG.testDataIdStart } }
          },
          aggs: {
            stats: {
              stats: { field: 'VALUE' }
            }
          }
        });
        const duration = Date.now() - queryStart;

        durations.push(duration);
        metrics.recordQueryTime('es_agg', 'total', duration);
      }

      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      console.log(`ES AGG: avg=${avg}ms`);

      expect(avg).toBeLessThan(1000);
    });
  });

  describe('Query Performance Summary', () => {
    test('should report all query statistics', () => {
      const queryStats = metrics.getQueryStats();

      console.log('\nQuery Performance Summary:');
      for (const [queryName, windows] of Object.entries(queryStats)) {
        for (const [window, stats] of Object.entries(windows)) {
          console.log(`  ${queryName} [${window}]: avg=${stats.avg}ms, p95=${stats.p95}ms`);
        }
      }

      expect(Object.keys(queryStats).length).toBeGreaterThan(0);
    });

    test('should meet query performance thresholds', () => {
      const queryStats = metrics.getQueryStats();
      const failures = [];

      for (const windowName of Object.keys(QUERY_CONFIG.timeWindows)) {
        const threshold = THRESHOLDS.query[windowName];

        // Check Oracle count
        if (queryStats['oracle_count']?.[windowName]) {
          const stats = queryStats['oracle_count'][windowName];
          if (stats.avg > threshold) {
            failures.push(`oracle_count[${windowName}]: ${stats.avg}ms > ${threshold}ms`);
          }
        }

        // Check ES count
        if (queryStats['es_count']?.[windowName]) {
          const stats = queryStats['es_count'][windowName];
          if (stats.avg > threshold) {
            failures.push(`es_count[${windowName}]: ${stats.avg}ms > ${threshold}ms`);
          }
        }
      }

      if (failures.length > 0) {
        console.log('\nThreshold Failures:');
        failures.forEach(f => console.log(`  ✗ ${f}`));
      }

      expect(failures).toHaveLength(0);
    });
  });
});
