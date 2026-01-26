/**
 * Test Data Generator
 * Generates test records for performance testing
 */

const { CONFIG, LOAD_LEVELS } = require('../config');
const { executeOracleSQL } = require('../setup');

/**
 * Generate a single MY_TABLE record
 * @param {number} id - Record ID
 * @param {Date} timestamp - UPDATED_AT timestamp
 * @returns {object} Record object
 */
const generateRecord = (id, timestamp = new Date()) => {
  return {
    id,
    name: `PerfTest_Record_${id}`,
    value: Math.round(Math.random() * 10000 * 100) / 100,
    updatedAt: timestamp
  };
};

/**
 * Generate multiple MY_TABLE records with distributed timestamps
 * @param {number} count - Number of records to generate
 * @param {number} timeSpreadMs - Time spread in milliseconds
 * @param {number} startId - Starting ID (default: testDataIdStart)
 * @returns {Array} Array of record objects
 */
const generateRecords = (count, timeSpreadMs, startId = CONFIG.testDataIdStart) => {
  const records = [];
  const now = Date.now();
  const startTime = now - timeSpreadMs;

  for (let i = 0; i < count; i++) {
    // Distribute timestamps evenly across the time spread
    const timestamp = new Date(startTime + (timeSpreadMs * i / count));
    records.push(generateRecord(startId + i, timestamp));
  }

  return records;
};

/**
 * Generate records for a specific load level
 * @param {string} level - Load level (SMALL, MEDIUM, LARGE, STRESS)
 * @param {number} startId - Starting ID
 * @returns {Array} Array of record objects
 */
const generateForLoadLevel = (level, startId = CONFIG.testDataIdStart) => {
  const loadConfig = LOAD_LEVELS[level];
  if (!loadConfig) {
    throw new Error(`Unknown load level: ${level}`);
  }
  return generateRecords(loadConfig.count, loadConfig.timeSpread, startId);
};

/**
 * Format date to Oracle TIMESTAMP format
 * @param {Date} date - Date object
 * @returns {string} Oracle timestamp string
 */
const formatOracleTimestamp = (date) => {
  return date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
};

/**
 * Bulk insert records into Oracle
 * @param {Array} records - Array of record objects
 * @param {number} batchSize - Batch size for inserts (default: 1000)
 * @returns {object} Insert statistics
 */
const bulkInsertOracle = async (records, batchSize = 1000) => {
  const stats = {
    total: records.length,
    inserted: 0,
    failed: 0,
    batches: 0,
    startTime: Date.now(),
    endTime: null,
    errors: []
  };

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      // Build multi-row INSERT
      const values = batch.map(r =>
        `(${r.id}, '${r.name}', ${r.value}, TO_TIMESTAMP('${formatOracleTimestamp(r.updatedAt)}', 'YYYY-MM-DD HH24:MI:SS.FF3'))`
      ).join(',\n');

      // Oracle doesn't support multi-row INSERT with VALUES, use INSERT ALL
      const insertStatements = batch.map(r =>
        `INTO MY_TABLE (ID, NAME, VALUE, UPDATED_AT) VALUES (${r.id}, '${r.name}', ${r.value}, TO_TIMESTAMP('${formatOracleTimestamp(r.updatedAt)}', 'YYYY-MM-DD HH24:MI:SS.FF3'))`
      ).join('\n');

      const sql = `INSERT ALL\n${insertStatements}\nSELECT 1 FROM DUAL`;

      await executeOracleSQL(sql);
      stats.inserted += batch.length;
      stats.batches++;

      // Progress logging every 10 batches
      if (stats.batches % 10 === 0) {
        console.log(`  Inserted ${stats.inserted}/${stats.total} records...`);
      }
    } catch (e) {
      // Fallback to individual inserts on batch failure
      for (const record of batch) {
        try {
          await executeOracleSQL(
            `INSERT INTO MY_TABLE (ID, NAME, VALUE, UPDATED_AT) VALUES (:id, :name, :value, TO_TIMESTAMP(:updatedAt, 'YYYY-MM-DD HH24:MI:SS.FF3'))`,
            {
              id: record.id,
              name: record.name,
              value: record.value,
              updatedAt: formatOracleTimestamp(record.updatedAt)
            }
          );
          stats.inserted++;
        } catch (insertError) {
          stats.failed++;
          stats.errors.push({ id: record.id, error: insertError.message });
        }
      }
      stats.batches++;
    }
  }

  stats.endTime = Date.now();
  stats.durationMs = stats.endTime - stats.startTime;
  stats.recordsPerSecond = Math.round(stats.inserted / (stats.durationMs / 1000));

  console.log(`  Bulk insert complete: ${stats.inserted}/${stats.total} records in ${stats.durationMs}ms (${stats.recordsPerSecond} rec/s)`);

  return stats;
};

/**
 * Insert a single record and return timing
 * @param {object} record - Record object
 * @returns {object} Insert result with timing
 */
const insertSingleRecord = async (record) => {
  const startTime = Date.now();

  await executeOracleSQL(
    `INSERT INTO MY_TABLE (ID, NAME, VALUE, UPDATED_AT) VALUES (:id, :name, :value, CURRENT_TIMESTAMP)`,
    {
      id: record.id,
      name: record.name,
      value: record.value
    }
  );

  return {
    id: record.id,
    insertTime: Date.now(),
    insertDurationMs: Date.now() - startTime
  };
};

/**
 * Update a record and return timing
 * @param {number} id - Record ID
 * @param {object} updates - Fields to update
 * @returns {object} Update result with timing
 */
const updateRecord = async (id, updates) => {
  const startTime = Date.now();

  const setClauses = [];
  const binds = { id };

  if (updates.name !== undefined) {
    setClauses.push('NAME = :name');
    binds.name = updates.name;
  }
  if (updates.value !== undefined) {
    setClauses.push('VALUE = :value');
    binds.value = updates.value;
  }
  setClauses.push('UPDATED_AT = CURRENT_TIMESTAMP');

  const sql = `UPDATE MY_TABLE SET ${setClauses.join(', ')} WHERE ID = :id`;
  await executeOracleSQL(sql, binds);

  return {
    id,
    updateTime: Date.now(),
    updateDurationMs: Date.now() - startTime
  };
};

/**
 * Get the next available test ID
 * @returns {number} Next available ID
 */
const getNextTestId = async () => {
  const result = await executeOracleSQL(
    `SELECT COALESCE(MAX(ID), :startId - 1) + 1 AS next_id FROM MY_TABLE WHERE ID >= :startId`,
    { startId: CONFIG.testDataIdStart }
  );
  return result.rows[0][0];
};

module.exports = {
  generateRecord,
  generateRecords,
  generateForLoadLevel,
  formatOracleTimestamp,
  bulkInsertOracle,
  insertSingleRecord,
  updateRecord,
  getNextTestId,
  LOAD_LEVELS
};
