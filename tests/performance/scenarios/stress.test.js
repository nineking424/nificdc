/**
 * Stress Performance Test
 * Tests with 100K+ records to find system limits
 *
 * Metrics measured:
 * - Maximum throughput
 * - Error rate under stress
 * - Recovery behavior
 *
 * WARNING: This test requires significant resources and time.
 * Run with: LOAD_LEVEL=STRESS npm run test:perf:stress
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

const TEST_CONFIG = LOAD_LEVELS.STRESS;
let metrics;

describe(`Stress Performance Test (${TEST_CONFIG.description})`, () => {

  beforeAll(async () => {
    const envStatus = await initPerfEnvironment();
    metrics = new MetricsCollector('stress');

    if (envStatus.oracle && envStatus.elasticsearch) {
      await cleanupTestData();
    }

    console.log('\n⚠ STRESS TEST: This test may take 30-60 minutes to complete.');
    console.log(`Target: ${TEST_CONFIG.count.toLocaleString()} records\n`);
  }, 60000);

  afterAll(async () => {
    if (metrics) {
      metrics.printSummary();
      metrics.saveReport('stress');
    }

    try {
      await cleanupTestData();
    } catch (e) {
      console.log(`Cleanup warning: ${e.message}`);
    }

    await closeConnections();
  });

  describe('Stress Load', () => {
    test('should handle 100K records with acceptable error rate', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required for stress tests');
      }

      // Insert in chunks to monitor progress
      const chunkSize = 10000;
      const chunks = Math.ceil(TEST_CONFIG.count / chunkSize);
      let totalInserted = 0;
      let totalFailed = 0;
      const overallStart = Date.now();

      for (let chunk = 0; chunk < chunks; chunk++) {
        const startId = CONFIG.testDataIdStart + (chunk * chunkSize);
        const recordCount = Math.min(chunkSize, TEST_CONFIG.count - totalInserted);

        console.log(`\nChunk ${chunk + 1}/${chunks}: Inserting ${recordCount} records...`);

        const records = generateRecords(
          recordCount,
          TEST_CONFIG.timeSpread / chunks,
          startId
        );

        const chunkStart = Date.now();
        const insertStats = await bulkInsertOracle(records, 500);
        const chunkDuration = Date.now() - chunkStart;

        totalInserted += insertStats.inserted;
        totalFailed += insertStats.failed;

        metrics.recordThroughput(insertStats.inserted, chunkDuration);
        metrics.recordLatency(`stress_chunk_${chunk}`, chunkDuration);

        if (insertStats.failed > 0) {
          for (const error of insertStats.errors.slice(0, 5)) {
            metrics.recordError('insert', `ID ${error.id}: ${error.error}`);
          }
        }

        console.log(`  Inserted: ${insertStats.inserted}, Failed: ${insertStats.failed}`);
        console.log(`  Progress: ${totalInserted}/${TEST_CONFIG.count} (${Math.round(totalInserted/TEST_CONFIG.count*100)}%)`);
      }

      const totalDuration = Date.now() - overallStart;
      const errorRate = totalFailed / (totalInserted + totalFailed);

      console.log('\n=== Stress Insert Summary ===');
      console.log(`Total Inserted: ${totalInserted}`);
      console.log(`Total Failed: ${totalFailed}`);
      console.log(`Error Rate: ${(errorRate * 100).toFixed(4)}%`);
      console.log(`Total Duration: ${Math.round(totalDuration / 1000)}s`);
      console.log(`Average Throughput: ${Math.round(totalInserted / (totalDuration / 1000 / 60))} rec/min`);

      // Assertions
      expect(totalInserted).toBeGreaterThan(TEST_CONFIG.count * 0.99); // 99%+ success
      expect(errorRate).toBeLessThanOrEqual(THRESHOLDS.errorRate);
    }, TIMEOUTS.STRESS);

    test('should sync all data to Elasticsearch', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required');
      }

      const client = await getEsClient();
      const syncStart = Date.now();

      // Count Oracle records
      const oracleCount = await executeOracleSQL(
        `SELECT COUNT(*) FROM MY_TABLE WHERE ID >= :startId`,
        { startId: CONFIG.testDataIdStart }
      );
      const targetCount = oracleCount.rows[0][0];

      // Sync in batches
      const batchSize = 10000;
      let totalSynced = 0;
      let offset = 0;

      console.log(`\nSyncing ${targetCount} records to Elasticsearch...`);

      while (totalSynced < targetCount) {
        const result = await executeOracleSQL(
          `SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE
           WHERE ID >= :startId
           ORDER BY ID
           OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
          { startId: CONFIG.testDataIdStart, offset, limit: batchSize }
        );

        if (result.rows.length === 0) break;

        const operations = result.rows.flatMap(row => [
          { index: { _index: CONFIG.elasticsearch.index, _id: String(row[0]) } },
          { ID: row[0], NAME: row[1], VALUE: row[2], UPDATED_AT: row[3]?.toISOString() }
        ]);

        try {
          await client.bulk({ operations, refresh: false });
          totalSynced += result.rows.length;
        } catch (e) {
          metrics.recordError('es_bulk', e.message);
          console.log(`  Bulk error at offset ${offset}: ${e.message}`);
        }

        offset += batchSize;

        if (totalSynced % 50000 === 0) {
          console.log(`  Synced ${totalSynced}/${targetCount} (${Math.round(totalSynced/targetCount*100)}%)`);
        }
      }

      await client.indices.refresh({ index: CONFIG.elasticsearch.index });
      const syncDuration = Date.now() - syncStart;

      metrics.recordThroughput(totalSynced, syncDuration);
      metrics.recordLatency('stress_sync', syncDuration);

      // Verify
      const esCount = await client.count({
        index: CONFIG.elasticsearch.index,
        query: { range: { ID: { gte: CONFIG.testDataIdStart } } }
      });

      console.log('\n=== Stress Sync Summary ===');
      console.log(`Synced: ${totalSynced} records`);
      console.log(`ES Count: ${esCount.count}`);
      console.log(`Duration: ${Math.round(syncDuration / 1000)}s`);

      expect(esCount.count).toBe(totalSynced);
    }, TIMEOUTS.STRESS);
  });

  describe('Stress Validation', () => {
    test('should maintain data integrity under stress', async () => {
      if (!ENV_STATUS.oracle || !ENV_STATUS.elasticsearch) {
        throw new Error('Oracle and Elasticsearch are required');
      }

      const client = await getEsClient();

      // Oracle count
      const oracleResult = await executeOracleSQL(
        `SELECT COUNT(*) FROM MY_TABLE WHERE ID >= :startId`,
        { startId: CONFIG.testDataIdStart }
      );
      const oracleCount = oracleResult.rows[0][0];

      // ES count
      const esCount = await client.count({
        index: CONFIG.elasticsearch.index,
        query: { range: { ID: { gte: CONFIG.testDataIdStart } } }
      });

      // ES unique IDs (cardinality)
      const cardinalityResult = await client.search({
        index: CONFIG.elasticsearch.index,
        size: 0,
        query: { range: { ID: { gte: CONFIG.testDataIdStart } } },
        aggs: { unique_ids: { cardinality: { field: 'ID' } } }
      });
      const uniqueIds = cardinalityResult.aggregations.unique_ids.value;

      console.log('\n=== Data Integrity Check ===');
      console.log(`Oracle Count: ${oracleCount}`);
      console.log(`ES Count: ${esCount.count}`);
      console.log(`ES Unique IDs: ${uniqueIds}`);

      // No duplicates in ES
      expect(esCount.count).toBe(uniqueIds);
      // Counts should match
      expect(esCount.count).toBe(oracleCount);
    });

    test('should meet error rate threshold', () => {
      const errorRate = metrics.getErrorRate();
      const errorCount = metrics.metrics.errors.length;

      console.log(`\nError Summary:`);
      console.log(`  Total Errors: ${errorCount}`);
      console.log(`  Error Rate: ${(errorRate * 100).toFixed(4)}%`);
      console.log(`  Threshold: ${(THRESHOLDS.errorRate * 100).toFixed(4)}%`);

      expect(errorRate).toBeLessThanOrEqual(THRESHOLDS.errorRate);
    });

    test('should report stress test statistics', () => {
      const stats = metrics.getStatistics();
      const throughput = metrics.getThroughputStats();

      console.log('\n=== Stress Test Final Statistics ===');
      console.log(`Duration: ${Math.round(stats.duration / 1000)}s`);
      console.log(`Total Records: ${throughput.totalRecords}`);
      console.log(`Average Throughput: ${throughput.avgPerMinute} rec/min`);
      console.log(`Peak Throughput: ${throughput.peak} rec/min`);
      console.log(`Error Rate: ${(stats.errorRate * 100).toFixed(4)}%`);

      expect(throughput.totalRecords).toBeGreaterThan(0);
    });
  });
});
