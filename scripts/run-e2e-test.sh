#!/bin/bash
# E2E 테스트 실행 스크립트
# 환경 준비 → 테스트 실행 → 정리 자동화

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_step() {
    echo -e "${GREEN}==>${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

echo_error() {
    echo -e "${RED}Error:${NC} $1"
}

# 정리 함수
cleanup() {
    if [ "$KEEP_ENV" != "true" ]; then
        echo_step "Cleaning up Docker environment..."
        cd "$PROJECT_ROOT"
        docker-compose down -v 2>/dev/null || true
    else
        echo_warn "KEEP_ENV=true, keeping Docker environment running"
    fi
}

# 에러 시 정리
trap cleanup EXIT

# 환경 변수 기본값
SKIP_SETUP="${SKIP_SETUP:-false}"
KEEP_ENV="${KEEP_ENV:-false}"
WAIT_ORACLE="${WAIT_ORACLE:-300}"

echo "========================================"
echo "  NiFi CDC E2E Test Runner"
echo "========================================"
echo ""
echo "Options:"
echo "  SKIP_SETUP=true  - Skip Docker startup (use existing environment)"
echo "  KEEP_ENV=true    - Don't clean up after test"
echo "  WAIT_ORACLE=N    - Wait N seconds for Oracle (default: 300)"
echo ""

# 1. JDBC 드라이버 확인
echo_step "Checking JDBC driver..."
if [ ! -f "${PROJECT_ROOT}/drivers/ojdbc8.jar" ]; then
    echo "JDBC driver not found, downloading..."
    "${SCRIPT_DIR}/download-jdbc-driver.sh"
else
    echo "JDBC driver found"
fi

# 2. Docker 환경 시작
if [ "$SKIP_SETUP" != "true" ]; then
    echo_step "Starting Docker environment..."
    cd "$PROJECT_ROOT"

    # 기존 환경 정리
    docker-compose down -v 2>/dev/null || true

    # 환경 시작
    docker-compose up -d

    # 3. Elasticsearch 대기
    echo_step "Waiting for Elasticsearch to be ready..."
    for i in $(seq 1 60); do
        if curl -s "http://localhost:9200/_cluster/health" 2>/dev/null | grep -q '"status"'; then
            echo "Elasticsearch is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            echo_error "Elasticsearch did not become ready"
            exit 1
        fi
        echo "  Waiting... ($i/60)"
        sleep 2
    done

    # 4. NiFi 대기
    echo_step "Waiting for NiFi to be ready..."
    for i in $(seq 1 60); do
        if curl -s "http://localhost:8080/nifi-api/system-diagnostics" 2>/dev/null | grep -q 'systemDiagnostics'; then
            echo "NiFi is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            echo_error "NiFi did not become ready"
            exit 1
        fi
        echo "  Waiting... ($i/60)"
        sleep 5
    done

    # 5. Oracle 대기 (가장 오래 걸림)
    echo_step "Waiting for Oracle to be ready (this may take a while)..."
    ORACLE_READY=false
    for i in $(seq 1 $WAIT_ORACLE); do
        # Oracle 컨테이너 healthcheck 확인
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nificdc-oracle 2>/dev/null || echo "not_found")
        if [ "$HEALTH" = "healthy" ]; then
            echo "Oracle is ready"
            ORACLE_READY=true
            break
        fi
        if [ $((i % 10)) -eq 0 ]; then
            echo "  Waiting for Oracle... ($i/${WAIT_ORACLE}s) - Status: $HEALTH"
        fi
        sleep 1
    done

    if [ "$ORACLE_READY" != "true" ]; then
        echo_warn "Oracle may not be fully ready, continuing anyway..."
    fi

    # 6. NiFi 설정
    echo_step "Setting up NiFi..."
    "${SCRIPT_DIR}/setup-nifi.sh" setup || echo_warn "NiFi setup had issues, tests may fail"

else
    echo_step "Skipping Docker setup (SKIP_SETUP=true)"
fi

# 7. 테스트 실행
echo_step "Running E2E tests..."
cd "$PROJECT_ROOT"

# Jest 실행
npm run test:e2e:run

# 결과 확인
TEST_RESULT=$?

echo ""
echo "========================================"
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "  ${GREEN}E2E Tests PASSED${NC}"
else
    echo -e "  ${RED}E2E Tests FAILED${NC}"
fi
echo "========================================"

exit $TEST_RESULT
