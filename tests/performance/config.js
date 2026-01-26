/**
 * Performance Test Configuration
 * Load levels, timeouts, and environment settings
 */

const LOAD_LEVELS = {
  SMALL: { count: 1000, timeSpread: 5 * 60 * 1000, description: '1K records (baseline)' },
  MEDIUM: { count: 10000, timeSpread: 30 * 60 * 1000, description: '10K records (load)' },
  LARGE: { count: 50000, timeSpread: 60 * 60 * 1000, description: '50K records (load)' },
  STRESS: { count: 100000, timeSpread: 120 * 60 * 1000, description: '100K records (stress)' }
};

const TIMEOUTS = {
  SMALL: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 15 * 60 * 1000,    // 15 minutes
  LARGE: 30 * 60 * 1000,     // 30 minutes
  STRESS: 60 * 60 * 1000,    // 60 minutes
  CDC_SYNC: 60 * 1000,       // 1 minute for single record sync
  QUERY: 30 * 1000           // 30 seconds for query execution
};

const THRESHOLDS = {
  latency: {
    p50: 10000,   // 10s
    p95: 30000,   // 30s
    p99: 60000    // 60s
  },
  throughput: {
    min: 5000,    // 5K records/min minimum
    target: 10000 // 10K records/min target
  },
  query: {
    '5m': 500,    // 5-minute window: 500ms max
    '1h': 2000,   // 1-hour window: 2s max
    '24h': 10000  // 24-hour window: 10s max
  },
  errorRate: 0.001  // 0.1% max error rate
};

// Environment configuration
const CONFIG = {
  elasticsearch: {
    node: process.env.ES_HOST || 'http://localhost:9200',
    index: 'my_table',
    testIndex: 'my_table_perf_test'
  },
  oracle: {
    user: 'cdc_user',
    password: 'cdc_password',
    connectString: process.env.ORACLE_HOST || 'localhost:1521/FREEPDB1'
  },
  nifi: {
    host: process.env.NIFI_HOST || 'localhost',
    port: process.env.NIFI_PORT || '8080'
  },
  // Test data IDs start from 10000 for easy cleanup
  testDataIdStart: 10000,
  // Reports directory
  reportsDir: 'tests/performance/reports'
};

module.exports = {
  LOAD_LEVELS,
  TIMEOUTS,
  THRESHOLDS,
  CONFIG
};
