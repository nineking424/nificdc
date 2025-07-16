#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Enhanced Mapping Engine Test Runner
 * 
 * This script runs all tests and benchmarks for the Enhanced Mapping Engine
 * including unit tests, integration tests, end-to-end tests, and performance benchmarks.
 */

class TestRunner {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      e2e: null,
      benchmark: null
    };
    this.startTime = Date.now();
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Running: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, {
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || process.cwd(),
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (options.silent) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          reject({ code, stdout, stderr, error: `Command failed with exit code ${code}` });
        }
      });

      child.on('error', (error) => {
        reject({ code: -1, stdout, stderr, error: error.message });
      });
    });
  }

  async runUnitTests() {
    console.log('\n📋 Running Unit Tests...\n');
    console.log('=' .repeat(80));

    try {
      const result = await this.runCommand('npx', [
        'jest',
        '--config=jest.config.js',
        '--testPathPattern=enhanced-mappings.test.js|enhanced-mapping-integration.test.js|mapping-bridge.test.js',
        '--verbose',
        '--coverage',
        '--coverageDirectory=coverage/unit'
      ]);

      this.results.unit = { success: true, ...result };
      console.log('✅ Unit tests completed successfully');
    } catch (error) {
      this.results.unit = { success: false, ...error };
      console.log('❌ Unit tests failed:', error.error);
    }
  }

  async runIntegrationTests() {
    console.log('\n🔗 Running Integration Tests...\n');
    console.log('=' .repeat(80));

    try {
      const result = await this.runCommand('npx', [
        'jest',
        '--config=jest.config.js',
        '--testPathPattern=enhanced-mapping-engine.integration.test.js',
        '--verbose',
        '--testTimeout=30000'
      ]);

      this.results.integration = { success: true, ...result };
      console.log('✅ Integration tests completed successfully');
    } catch (error) {
      this.results.integration = { success: false, ...error };
      console.log('❌ Integration tests failed:', error.error);
    }
  }

  async runE2ETests() {
    console.log('\n🌐 Running End-to-End Tests...\n');
    console.log('=' .repeat(80));

    try {
      const result = await this.runCommand('npx', [
        'jest',
        '--config=jest.config.js',
        '--testPathPattern=enhanced-mapping-api.e2e.test.js',
        '--verbose',
        '--testTimeout=60000'
      ]);

      this.results.e2e = { success: true, ...result };
      console.log('✅ End-to-end tests completed successfully');
    } catch (error) {
      this.results.e2e = { success: false, ...error };
      console.log('❌ End-to-end tests failed:', error.error);
    }
  }

  async runBenchmarks() {
    console.log('\n⚡ Running Performance Benchmarks...\n');
    console.log('=' .repeat(80));

    try {
      const result = await this.runCommand('node', [
        'tests/benchmarks/enhanced-mapping-performance.benchmark.js'
      ]);

      this.results.benchmark = { success: true, ...result };
      console.log('✅ Performance benchmarks completed successfully');
    } catch (error) {
      this.results.benchmark = { success: false, ...error };
      console.log('❌ Performance benchmarks failed:', error.error);
    }
  }

  async generateCoverageReport() {
    console.log('\n📊 Generating Coverage Report...\n');

    try {
      // Combine coverage reports if they exist
      const coverageDir = path.join(process.cwd(), 'coverage');
      if (fs.existsSync(coverageDir)) {
        console.log('Coverage reports generated in ./coverage/ directory');
        
        // Try to open coverage report in browser (optional)
        const coverageHtml = path.join(coverageDir, 'lcov-report', 'index.html');
        if (fs.existsSync(coverageHtml)) {
          console.log(`📋 Coverage report available at: file://${coverageHtml}`);
        }
      }
    } catch (error) {
      console.log('⚠️  Could not generate coverage report:', error.message);
    }
  }

  generateSummaryReport() {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;

    console.log('\n' + '='.repeat(80));
    console.log('📋 Enhanced Mapping Engine Test Summary');
    console.log('='.repeat(80));

    const tests = [
      { name: 'Unit Tests', result: this.results.unit },
      { name: 'Integration Tests', result: this.results.integration },
      { name: 'End-to-End Tests', result: this.results.e2e },
      { name: 'Performance Benchmarks', result: this.results.benchmark }
    ];

    tests.forEach(test => {
      const status = test.result?.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`${test.name.padEnd(25)}: ${status}`);
    });

    const passedCount = tests.filter(test => test.result?.success).length;
    const totalCount = tests.length;

    console.log('\n' + '-'.repeat(80));
    console.log(`Total Tests: ${totalCount}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${totalCount - passedCount}`);
    console.log(`Success Rate: ${((passedCount / totalCount) * 100).toFixed(1)}%`);
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);

    // Show detailed failure information
    const failedTests = tests.filter(test => !test.result?.success);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests Details:');
      failedTests.forEach(test => {
        console.log(`\n${test.name}:`);
        console.log(`  Error: ${test.result?.error || 'Unknown error'}`);
        if (test.result?.stderr) {
          console.log(`  Details: ${test.result.stderr.substring(0, 500)}...`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));

    // Exit with appropriate code
    process.exit(passedCount === totalCount ? 0 : 1);
  }

  async runAllTests() {
    console.log('🧪 Enhanced Mapping Engine Test Suite');
    console.log('🚀 Starting comprehensive test execution...\n');

    try {
      // Run tests in sequence to avoid resource conflicts
      await this.runUnitTests();
      await this.runIntegrationTests();
      await this.runE2ETests();
      await this.runBenchmarks();
      
      await this.generateCoverageReport();
      this.generateSummaryReport();

    } catch (error) {
      console.error('💥 Test runner encountered an unexpected error:', error);
      process.exit(1);
    }
  }
}

// Command line argument parsing
const args = process.argv.slice(2);
const options = {
  unit: args.includes('--unit') || args.includes('-u'),
  integration: args.includes('--integration') || args.includes('-i'),
  e2e: args.includes('--e2e') || args.includes('-e'),
  benchmark: args.includes('--benchmark') || args.includes('-b'),
  coverage: args.includes('--coverage') || args.includes('-c'),
  help: args.includes('--help') || args.includes('-h')
};

// If no specific tests are requested, run all
const runAll = !options.unit && !options.integration && !options.e2e && !options.benchmark;

if (options.help) {
  console.log(`
Enhanced Mapping Engine Test Runner

Usage: node run-enhanced-mapping-tests.js [options]

Options:
  -u, --unit          Run unit tests only
  -i, --integration   Run integration tests only
  -e, --e2e          Run end-to-end tests only
  -b, --benchmark    Run performance benchmarks only
  -c, --coverage     Generate coverage report
  -h, --help         Show this help message

Examples:
  node run-enhanced-mapping-tests.js                    # Run all tests
  node run-enhanced-mapping-tests.js --unit             # Run unit tests only
  node run-enhanced-mapping-tests.js --benchmark        # Run benchmarks only
  node run-enhanced-mapping-tests.js --unit --e2e       # Run unit and e2e tests
`);
  process.exit(0);
}

// Run the test runner
const runner = new TestRunner();

async function main() {
  if (runAll) {
    await runner.runAllTests();
  } else {
    console.log('🧪 Enhanced Mapping Engine Selective Test Runner\n');
    
    if (options.unit) await runner.runUnitTests();
    if (options.integration) await runner.runIntegrationTests();
    if (options.e2e) await runner.runE2ETests();
    if (options.benchmark) await runner.runBenchmarks();
    
    if (options.coverage) await runner.generateCoverageReport();
    
    runner.generateSummaryReport();
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

module.exports = TestRunner;