/**
 * Performance Test Setup
 * Environment checks, test helpers, and utilities
 */

const path = require('path');
const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');
const { CONFIG, TIMEOUTS } = require('./config');

// Environment status tracking
const ENV_STATUS = {
  elasticsearch: false,
  oracle: false,
  nifi: false
};

// Cached clients
let esClient = null;
let oracledb = null;

/**
 * Initialize Elasticsearch client
 */
const getEsClient = async () => {
  if (!esClient) {
    esClient = new Client({ node: CONFIG.elasticsearch.node });
    const health = await esClient.cluster.health();
    if (health.status !== 'green' && health.status !== 'yellow') {
      throw new Error(`Elasticsearch unhealthy: ${health.status}`);
    }
    ENV_STATUS.elasticsearch = true;
  }
  return esClient;
};

/**
 * Get Oracle connection
 */
const getOracleConnection = async () => {
  if (!oracledb) {
    oracledb = require('oracledb');
  }
  return await oracledb.getConnection({
    user: CONFIG.oracle.user,
    password: CONFIG.oracle.password,
    connectString: CONFIG.oracle.connectString
  });
};

/**
 * Execute Oracle SQL
 */
const executeOracleSQL = async (sql, binds = [], options = { autoCommit: true }) => {
  const connection = await getOracleConnection();
  try {
    return await connection.execute(sql, binds, options);
  } finally {
    await connection.close();
  }
};

/**
 * Check Oracle availability
 */
const checkOracle = async () => {
  try {
    await executeOracleSQL('SELECT 1 FROM DUAL');
    ENV_STATUS.oracle = true;
    return true;
  } catch (e) {
    ENV_STATUS.oracle = false;
    throw e;
  }
};

/**
 * Check NiFi availability
 */
const checkNiFi = async () => {
  const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/system-diagnostics`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NiFi not accessible: ${response.status}`);
  }
  ENV_STATUS.nifi = true;
  return true;
};

/**
 * Initialize performance test environment
 */
const initPerfEnvironment = async () => {
  console.log('\n=== Performance Test Environment Check ===');

  const results = {
    elasticsearch: false,
    oracle: false,
    nifi: false
  };

  // Check Elasticsearch
  try {
    await getEsClient();
    results.elasticsearch = true;
    console.log('✓ Elasticsearch: available');
  } catch (e) {
    console.log(`✗ Elasticsearch: ${e.message}`);
  }

  // Check Oracle
  try {
    await checkOracle();
    results.oracle = true;
    console.log('✓ Oracle: available');
  } catch (e) {
    console.log(`✗ Oracle: ${e.message}`);
  }

  // Check NiFi
  try {
    await checkNiFi();
    results.nifi = true;
    console.log('✓ NiFi: available');
  } catch (e) {
    console.log(`✗ NiFi: ${e.message}`);
  }

  console.log('==========================================\n');

  return results;
};

/**
 * Clean up test data (IDs >= testDataIdStart)
 */
const cleanupTestData = async () => {
  const client = await getEsClient();

  // Clean Oracle test data
  try {
    await executeOracleSQL(
      `DELETE FROM MY_TABLE WHERE ID >= :idStart`,
      { idStart: CONFIG.testDataIdStart }
    );
    console.log('✓ Oracle test data cleaned');
  } catch (e) {
    console.log(`⚠ Oracle cleanup failed: ${e.message}`);
  }

  // Clean Elasticsearch test data
  try {
    await client.deleteByQuery({
      index: CONFIG.elasticsearch.index,
      query: {
        range: { ID: { gte: CONFIG.testDataIdStart } }
      },
      refresh: true
    });
    console.log('✓ Elasticsearch test data cleaned');
  } catch (e) {
    console.log(`⚠ Elasticsearch cleanup failed: ${e.message}`);
  }
};

/**
 * Ensure reports directory exists
 */
const ensureReportsDir = () => {
  const reportsPath = path.join(process.cwd(), CONFIG.reportsDir);
  if (!fs.existsSync(reportsPath)) {
    fs.mkdirSync(reportsPath, { recursive: true });
  }
  return reportsPath;
};

/**
 * Close all connections
 */
const closeConnections = async () => {
  if (esClient) {
    await esClient.close();
    esClient = null;
  }
};

module.exports = {
  ENV_STATUS,
  getEsClient,
  getOracleConnection,
  executeOracleSQL,
  checkOracle,
  checkNiFi,
  initPerfEnvironment,
  cleanupTestData,
  ensureReportsDir,
  closeConnections,
  CONFIG
};
