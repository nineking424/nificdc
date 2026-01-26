/**
 * Baseline Manager
 * Manages baseline metrics and comparisons for performance regression detection
 */

const path = require('path');
const fs = require('fs');

const BASELINES_DIR = path.join(process.cwd(), 'baselines/performance');
const BASELINE_FILE = path.join(BASELINES_DIR, 'baseline-metrics.json');
const THRESHOLDS_FILE = path.join(BASELINES_DIR, 'thresholds.json');

/**
 * Ensure baselines directory exists
 */
const ensureBaselinesDir = () => {
  if (!fs.existsSync(BASELINES_DIR)) {
    fs.mkdirSync(BASELINES_DIR, { recursive: true });
  }
};

/**
 * Load baseline metrics
 * @returns {object|null} Baseline metrics or null if not found
 */
const loadBaseline = () => {
  try {
    if (fs.existsSync(BASELINE_FILE)) {
      return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn(`Failed to load baseline: ${e.message}`);
  }
  return null;
};

/**
 * Save baseline metrics
 * @param {object} metrics - Metrics to save as baseline
 */
const saveBaseline = (metrics) => {
  ensureBaselinesDir();
  const baseline = {
    ...metrics,
    savedAt: new Date().toISOString(),
    version: '1.0'
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  console.log(`Baseline saved: ${BASELINE_FILE}`);
};

/**
 * Load thresholds configuration
 * @returns {object} Thresholds configuration
 */
const loadThresholds = () => {
  try {
    if (fs.existsSync(THRESHOLDS_FILE)) {
      return JSON.parse(fs.readFileSync(THRESHOLDS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn(`Failed to load thresholds: ${e.message}`);
  }

  // Return default thresholds
  return {
    latency: {
      p50: { max: 10000, regressionPercent: 20 },
      p95: { max: 30000, regressionPercent: 20 },
      p99: { max: 60000, regressionPercent: 25 }
    },
    throughput: {
      min: { value: 5000, regressionPercent: 20 }
    },
    query: {
      '5m': { max: 500, regressionPercent: 25 },
      '1h': { max: 2000, regressionPercent: 25 },
      '24h': { max: 10000, regressionPercent: 30 }
    },
    errorRate: {
      max: 0.001,
      regressionPercent: 50
    }
  };
};

/**
 * Save thresholds configuration
 * @param {object} thresholds - Thresholds to save
 */
const saveThresholds = (thresholds) => {
  ensureBaselinesDir();
  fs.writeFileSync(THRESHOLDS_FILE, JSON.stringify(thresholds, null, 2));
  console.log(`Thresholds saved: ${THRESHOLDS_FILE}`);
};

/**
 * Compare current metrics against baseline
 * @param {object} current - Current metrics
 * @param {object} baseline - Baseline metrics (optional, loads from file if not provided)
 * @returns {object} Comparison results
 */
const compareToBaseline = (current, baseline = null) => {
  const base = baseline || loadBaseline();
  const thresholds = loadThresholds();

  const results = {
    hasBaseline: !!base,
    comparisons: [],
    regressions: [],
    improvements: [],
    passed: true
  };

  if (!base) {
    console.log('No baseline found. Current metrics will be used as baseline.');
    return results;
  }

  // Compare latency metrics
  if (current.latency && base.latency) {
    for (const metric of ['p50', 'p95', 'p99']) {
      const currentVal = current.latency[metric];
      const baseVal = base.latency[metric];
      const threshold = thresholds.latency?.[metric];

      if (currentVal !== undefined && baseVal !== undefined) {
        const diff = currentVal - baseVal;
        const diffPercent = (diff / baseVal) * 100;
        const maxRegression = threshold?.regressionPercent || 20;
        const isRegression = diffPercent > maxRegression;
        const isImprovement = diffPercent < -10;

        const comparison = {
          metric: `latency.${metric}`,
          current: currentVal,
          baseline: baseVal,
          diff,
          diffPercent: Math.round(diffPercent * 10) / 10,
          status: isRegression ? 'regression' : (isImprovement ? 'improvement' : 'stable')
        };

        results.comparisons.push(comparison);

        if (isRegression) {
          results.regressions.push(comparison);
          results.passed = false;
        } else if (isImprovement) {
          results.improvements.push(comparison);
        }
      }
    }
  }

  // Compare throughput
  if (current.throughput && base.throughput) {
    const currentVal = current.throughput.avgPerMinute;
    const baseVal = base.throughput.avgPerMinute;
    const threshold = thresholds.throughput?.min;

    if (currentVal !== undefined && baseVal !== undefined) {
      const diff = currentVal - baseVal;
      const diffPercent = (diff / baseVal) * 100;
      const maxRegression = threshold?.regressionPercent || 20;
      const isRegression = diffPercent < -maxRegression; // Lower is worse for throughput
      const isImprovement = diffPercent > 10;

      const comparison = {
        metric: 'throughput.avgPerMinute',
        current: currentVal,
        baseline: baseVal,
        diff,
        diffPercent: Math.round(diffPercent * 10) / 10,
        status: isRegression ? 'regression' : (isImprovement ? 'improvement' : 'stable')
      };

      results.comparisons.push(comparison);

      if (isRegression) {
        results.regressions.push(comparison);
        results.passed = false;
      } else if (isImprovement) {
        results.improvements.push(comparison);
      }
    }
  }

  // Compare error rate
  if (current.errorRate !== undefined && base.errorRate !== undefined) {
    const currentVal = current.errorRate;
    const baseVal = base.errorRate;
    const threshold = thresholds.errorRate;

    // For error rate, any increase is concerning
    const diff = currentVal - baseVal;
    const isRegression = currentVal > (threshold?.max || 0.001) || diff > 0.0001;
    const isImprovement = diff < -0.0001;

    const comparison = {
      metric: 'errorRate',
      current: currentVal,
      baseline: baseVal,
      diff,
      diffPercent: baseVal > 0 ? Math.round((diff / baseVal) * 100 * 10) / 10 : (diff > 0 ? Infinity : 0),
      status: isRegression ? 'regression' : (isImprovement ? 'improvement' : 'stable')
    };

    results.comparisons.push(comparison);

    if (isRegression) {
      results.regressions.push(comparison);
      results.passed = false;
    } else if (isImprovement) {
      results.improvements.push(comparison);
    }
  }

  return results;
};

/**
 * Print baseline comparison summary
 * @param {object} comparison - Comparison results from compareToBaseline
 */
const printComparisonSummary = (comparison) => {
  console.log('\n' + '='.repeat(60));
  console.log('Baseline Comparison');
  console.log('='.repeat(60));

  if (!comparison.hasBaseline) {
    console.log('\nNo baseline available for comparison.');
    console.log('Run with --save-baseline to establish a baseline.\n');
    return;
  }

  console.log(`\nStatus: ${comparison.passed ? '✓ PASSED' : '✗ FAILED'}`);

  if (comparison.regressions.length > 0) {
    console.log('\n⚠ Regressions:');
    for (const r of comparison.regressions) {
      console.log(`  ${r.metric}: ${r.current} (baseline: ${r.baseline}, ${r.diffPercent > 0 ? '+' : ''}${r.diffPercent}%)`);
    }
  }

  if (comparison.improvements.length > 0) {
    console.log('\n✓ Improvements:');
    for (const i of comparison.improvements) {
      console.log(`  ${i.metric}: ${i.current} (baseline: ${i.baseline}, ${i.diffPercent > 0 ? '+' : ''}${i.diffPercent}%)`);
    }
  }

  console.log('\nAll Comparisons:');
  for (const c of comparison.comparisons) {
    const status = c.status === 'regression' ? '✗' : (c.status === 'improvement' ? '↑' : '=');
    console.log(`  ${status} ${c.metric}: ${c.current} vs ${c.baseline} (${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}%)`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
};

/**
 * Update baseline from current metrics if all thresholds pass
 * @param {object} currentMetrics - Current test metrics
 * @param {boolean} force - Force update even if thresholds fail
 * @returns {boolean} Whether baseline was updated
 */
const updateBaselineIfPassing = (currentMetrics, force = false) => {
  const comparison = compareToBaseline(currentMetrics);

  if (comparison.passed || force || !comparison.hasBaseline) {
    saveBaseline(currentMetrics);
    return true;
  }

  console.log('Baseline not updated due to regressions. Use --force to override.');
  return false;
};

module.exports = {
  loadBaseline,
  saveBaseline,
  loadThresholds,
  saveThresholds,
  compareToBaseline,
  printComparisonSummary,
  updateBaselineIfPassing,
  BASELINES_DIR,
  BASELINE_FILE,
  THRESHOLDS_FILE
};
