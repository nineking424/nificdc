#!/bin/bash

# Performance Test Runner for nificdc CDC Pipeline
# Usage: ./scripts/run-perf-test.sh [scenario] [options]
#
# Scenarios:
#   baseline    - Run baseline test (1K records)
#   latency     - Run latency measurement test
#   query       - Run query performance test
#   load        - Run load test (10K-50K records)
#   stress      - Run stress test (100K+ records)
#   all         - Run all tests sequentially
#
# Options:
#   --save-baseline    Save results as new baseline
#   --force-baseline   Force baseline update even on regression
#   --load-level       Set load level (MEDIUM or LARGE) for load test
#   --report-only      Generate report from existing results

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_DIR/tests/performance/reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
SCENARIO="baseline"
SAVE_BASELINE=""
FORCE_BASELINE=""
LOAD_LEVEL="MEDIUM"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    baseline|latency|query|load|stress|all)
      SCENARIO="$1"
      shift
      ;;
    --save-baseline)
      SAVE_BASELINE="true"
      shift
      ;;
    --force-baseline)
      FORCE_BASELINE="true"
      shift
      ;;
    --load-level)
      LOAD_LEVEL="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [scenario] [options]"
      echo ""
      echo "Scenarios:"
      echo "  baseline    Run baseline test (1K records)"
      echo "  latency     Run latency measurement test"
      echo "  query       Run query performance test"
      echo "  load        Run load test (10K-50K records)"
      echo "  stress      Run stress test (100K+ records)"
      echo "  all         Run all tests sequentially"
      echo ""
      echo "Options:"
      echo "  --save-baseline    Save results as new baseline"
      echo "  --force-baseline   Force baseline update even on regression"
      echo "  --load-level       Set load level for load test (MEDIUM or LARGE)"
      echo "  --help, -h         Show this help"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Ensure reports directory exists
mkdir -p "$REPORTS_DIR"

# Export environment variables
export SAVE_BASELINE="$SAVE_BASELINE"
export FORCE_BASELINE="$FORCE_BASELINE"
export LOAD_LEVEL="$LOAD_LEVEL"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN} nificdc Performance Test Runner${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Scenario: $SCENARIO"
echo "Save Baseline: ${SAVE_BASELINE:-no}"
echo "Load Level: $LOAD_LEVEL"
echo ""

run_test() {
  local test_name=$1
  local test_file=$2
  local timeout=$3

  echo -e "${YELLOW}Running: $test_name${NC}"
  echo "----------------------------------------"

  if npx jest "$test_file" --runInBand --testTimeout="$timeout" --forceExit; then
    echo -e "${GREEN}✓ $test_name passed${NC}"
    return 0
  else
    echo -e "${RED}✗ $test_name failed${NC}"
    return 1
  fi
}

cd "$PROJECT_DIR"

case $SCENARIO in
  baseline)
    run_test "Baseline Test" "tests/performance/scenarios/baseline.test.js" 300000
    ;;
  latency)
    run_test "Latency Test" "tests/performance/scenarios/latency.test.js" 300000
    ;;
  query)
    run_test "Query Performance Test" "tests/performance/scenarios/query-performance.test.js" 120000
    ;;
  load)
    run_test "Load Test" "tests/performance/scenarios/load.test.js" 900000
    ;;
  stress)
    echo -e "${YELLOW}⚠ Stress test may take 30-60 minutes${NC}"
    run_test "Stress Test" "tests/performance/scenarios/stress.test.js" 3600000
    ;;
  all)
    echo "Running all performance tests..."
    echo ""

    FAILED=0

    run_test "Baseline Test" "tests/performance/scenarios/baseline.test.js" 300000 || FAILED=1
    run_test "Latency Test" "tests/performance/scenarios/latency.test.js" 300000 || FAILED=1
    run_test "Query Performance Test" "tests/performance/scenarios/query-performance.test.js" 120000 || FAILED=1
    run_test "Load Test" "tests/performance/scenarios/load.test.js" 900000 || FAILED=1

    echo ""
    echo -e "${GREEN}======================================${NC}"
    if [ $FAILED -eq 0 ]; then
      echo -e "${GREEN} All tests passed!${NC}"
    else
      echo -e "${RED} Some tests failed${NC}"
    fi
    echo -e "${GREEN}======================================${NC}"

    exit $FAILED
    ;;
esac

echo ""
echo "Reports saved to: $REPORTS_DIR"
echo ""
