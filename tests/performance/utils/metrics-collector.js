/**
 * Metrics Collector
 * Collects, calculates, and reports performance metrics
 */

const path = require('path');
const fs = require('fs');
const { CONFIG, THRESHOLDS } = require('../config');

/**
 * MetricsCollector class
 * Collects timing and throughput metrics for performance analysis
 */
class MetricsCollector {
  constructor(testName) {
    this.testName = testName;
    this.startTime = Date.now();
    this.metrics = {
      latencies: [],
      throughput: [],
      queries: {},
      errors: [],
      custom: {}
    };
  }

  /**
   * Record a latency measurement
   * @param {string} operation - Operation name
   * @param {number} durationMs - Duration in milliseconds
   */
  recordLatency(operation, durationMs) {
    this.metrics.latencies.push({
      operation,
      durationMs,
      timestamp: Date.now()
    });
  }

  /**
   * Record throughput measurement
   * @param {number} records - Number of records processed
   * @param {number} durationMs - Duration in milliseconds
   */
  recordThroughput(records, durationMs) {
    const recordsPerSecond = Math.round(records / (durationMs / 1000));
    const recordsPerMinute = recordsPerSecond * 60;

    this.metrics.throughput.push({
      records,
      durationMs,
      recordsPerSecond,
      recordsPerMinute,
      timestamp: Date.now()
    });
  }

  /**
   * Record query execution time
   * @param {string} queryName - Query identifier
   * @param {string} timeWindow - Time window (e.g., '5m', '1h', '24h')
   * @param {number} durationMs - Execution time in milliseconds
   */
  recordQueryTime(queryName, timeWindow, durationMs) {
    if (!this.metrics.queries[queryName]) {
      this.metrics.queries[queryName] = [];
    }
    this.metrics.queries[queryName].push({
      timeWindow,
      durationMs,
      timestamp: Date.now()
    });
  }

  /**
   * Record an error
   * @param {string} operation - Operation that failed
   * @param {Error|string} error - Error object or message
   */
  recordError(operation, error) {
    this.metrics.errors.push({
      operation,
      error: error.message || error,
      timestamp: Date.now()
    });
  }

  /**
   * Record custom metric
   * @param {string} name - Metric name
   * @param {*} value - Metric value
   */
  recordCustom(name, value) {
    if (!this.metrics.custom[name]) {
      this.metrics.custom[name] = [];
    }
    this.metrics.custom[name].push({
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Calculate percentile from sorted array
   * @param {Array} sortedArr - Sorted array of numbers
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   */
  static calculatePercentile(sortedArr, percentile) {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, index)];
  }

  /**
   * Get latency statistics
   * @param {string} operation - Optional filter by operation
   * @returns {object} Latency statistics
   */
  getLatencyStats(operation = null) {
    let latencies = this.metrics.latencies;
    if (operation) {
      latencies = latencies.filter(l => l.operation === operation);
    }

    if (latencies.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const durations = latencies.map(l => l.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: Math.round(sum / durations.length),
      p50: MetricsCollector.calculatePercentile(durations, 50),
      p95: MetricsCollector.calculatePercentile(durations, 95),
      p99: MetricsCollector.calculatePercentile(durations, 99)
    };
  }

  /**
   * Get throughput statistics
   * @returns {object} Throughput statistics
   */
  getThroughputStats() {
    if (this.metrics.throughput.length === 0) {
      return { count: 0, totalRecords: 0, avgPerSecond: 0, avgPerMinute: 0, peak: 0 };
    }

    const totalRecords = this.metrics.throughput.reduce((a, b) => a + b.records, 0);
    const totalDuration = this.metrics.throughput.reduce((a, b) => a + b.durationMs, 0);
    const rates = this.metrics.throughput.map(t => t.recordsPerMinute);

    return {
      count: this.metrics.throughput.length,
      totalRecords,
      totalDurationMs: totalDuration,
      avgPerSecond: Math.round(totalRecords / (totalDuration / 1000)),
      avgPerMinute: Math.round(totalRecords / (totalDuration / 1000) * 60),
      peak: Math.max(...rates)
    };
  }

  /**
   * Get query performance statistics
   * @returns {object} Query statistics by name and time window
   */
  getQueryStats() {
    const stats = {};

    for (const [queryName, measurements] of Object.entries(this.metrics.queries)) {
      stats[queryName] = {};

      // Group by time window
      const byWindow = {};
      for (const m of measurements) {
        if (!byWindow[m.timeWindow]) {
          byWindow[m.timeWindow] = [];
        }
        byWindow[m.timeWindow].push(m.durationMs);
      }

      for (const [window, durations] of Object.entries(byWindow)) {
        durations.sort((a, b) => a - b);
        stats[queryName][window] = {
          count: durations.length,
          min: durations[0],
          max: durations[durations.length - 1],
          avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          p95: MetricsCollector.calculatePercentile(durations, 95)
        };
      }
    }

    return stats;
  }

  /**
   * Get error rate
   * @returns {number} Error rate (0-1)
   */
  getErrorRate() {
    const totalOps = this.metrics.latencies.length + this.metrics.errors.length;
    if (totalOps === 0) return 0;
    return this.metrics.errors.length / totalOps;
  }

  /**
   * Get complete statistics summary
   * @returns {object} Complete statistics
   */
  getStatistics() {
    return {
      testName: this.testName,
      duration: Date.now() - this.startTime,
      latency: this.getLatencyStats(),
      throughput: this.getThroughputStats(),
      queries: this.getQueryStats(),
      errorRate: this.getErrorRate(),
      errorCount: this.metrics.errors.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if metrics pass thresholds
   * @param {object} thresholds - Custom thresholds (defaults to THRESHOLDS)
   * @returns {object} Pass/fail results
   */
  checkThresholds(thresholds = THRESHOLDS) {
    const stats = this.getStatistics();
    const results = {
      passed: true,
      checks: []
    };

    // Check latency thresholds
    if (thresholds.latency) {
      for (const [metric, threshold] of Object.entries(thresholds.latency)) {
        const actual = stats.latency[metric];
        const passed = actual <= threshold;
        results.checks.push({
          name: `latency.${metric}`,
          threshold,
          actual,
          passed
        });
        if (!passed) results.passed = false;
      }
    }

    // Check throughput thresholds
    if (thresholds.throughput) {
      if (thresholds.throughput.min) {
        const actual = stats.throughput.avgPerMinute;
        const passed = actual >= thresholds.throughput.min;
        results.checks.push({
          name: 'throughput.min',
          threshold: thresholds.throughput.min,
          actual,
          passed
        });
        if (!passed) results.passed = false;
      }
    }

    // Check error rate
    if (thresholds.errorRate !== undefined) {
      const actual = stats.errorRate;
      const passed = actual <= thresholds.errorRate;
      results.checks.push({
        name: 'errorRate',
        threshold: thresholds.errorRate,
        actual,
        passed
      });
      if (!passed) results.passed = false;
    }

    return results;
  }

  /**
   * Generate report object
   * @returns {object} Full report
   */
  generateReport() {
    return {
      testName: this.testName,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      statistics: this.getStatistics(),
      thresholdCheck: this.checkThresholds(),
      rawMetrics: this.metrics
    };
  }

  /**
   * Save report to file
   * @param {string} filename - Report filename (without extension)
   * @returns {string} Full path to saved report
   */
  saveReport(filename = null) {
    const reportsDir = path.join(process.cwd(), CONFIG.reportsDir);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFilename = filename || `${this.testName}-${Date.now()}`;
    const reportPath = path.join(reportsDir, `${reportFilename}.json`);

    const report = this.generateReport();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`Report saved: ${reportPath}`);
    return reportPath;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const stats = this.getStatistics();
    const thresholds = this.checkThresholds();

    console.log('\n' + '='.repeat(60));
    console.log(`Performance Test Summary: ${this.testName}`);
    console.log('='.repeat(60));

    console.log('\nLatency (ms):');
    console.log(`  P50: ${stats.latency.p50}  P95: ${stats.latency.p95}  P99: ${stats.latency.p99}`);
    console.log(`  Min: ${stats.latency.min}  Max: ${stats.latency.max}  Avg: ${stats.latency.avg}`);

    console.log('\nThroughput:');
    console.log(`  Total Records: ${stats.throughput.totalRecords}`);
    console.log(`  Average: ${stats.throughput.avgPerMinute} rec/min (${stats.throughput.avgPerSecond} rec/s)`);
    console.log(`  Peak: ${stats.throughput.peak} rec/min`);

    if (Object.keys(stats.queries).length > 0) {
      console.log('\nQuery Performance (ms):');
      for (const [query, windows] of Object.entries(stats.queries)) {
        for (const [window, data] of Object.entries(windows)) {
          console.log(`  ${query} [${window}]: avg=${data.avg} p95=${data.p95}`);
        }
      }
    }

    console.log('\nErrors:');
    console.log(`  Count: ${stats.errorCount}  Rate: ${(stats.errorRate * 100).toFixed(3)}%`);

    console.log('\nThreshold Check:');
    console.log(`  Result: ${thresholds.passed ? '✓ PASSED' : '✗ FAILED'}`);
    for (const check of thresholds.checks) {
      const status = check.passed ? '✓' : '✗';
      console.log(`  ${status} ${check.name}: ${check.actual} (threshold: ${check.threshold})`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

module.exports = { MetricsCollector };
