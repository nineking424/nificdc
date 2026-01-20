#!/bin/bash
# NiFi 자동 설정 스크립트
# REST API를 통해 Flow 배포 및 Controller Services 활성화

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# NiFi 설정
NIFI_HOST="${NIFI_HOST:-localhost}"
NIFI_PORT="${NIFI_PORT:-8080}"
NIFI_URL="http://${NIFI_HOST}:${NIFI_PORT}/nifi-api"
NIFI_USER="${NIFI_USER:-admin}"
NIFI_PASSWORD="${NIFI_PASSWORD:-adminadminadmin}"

# Flow 파일 경로
FLOW_FILE="${PROJECT_ROOT}/flows/oracle_cdc_flow.json"

echo "=== NiFi Auto Setup Script ==="
echo "NiFi URL: ${NIFI_URL}"

# NiFi 준비 상태 확인
wait_for_nifi() {
    echo "Waiting for NiFi to be ready..."
    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "${NIFI_URL}/system-diagnostics" > /dev/null 2>&1; then
            echo "NiFi is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        echo "Attempt $attempt/$max_attempts: NiFi not ready yet..."
        sleep 5
    done

    echo "Error: NiFi did not become ready in time"
    return 1
}

# Root Process Group ID 가져오기
get_root_process_group_id() {
    curl -s "${NIFI_URL}/flow/process-groups/root" | \
        python3 -c "import sys, json; print(json.load(sys.stdin)['processGroupFlow']['id'])"
}

# Controller Service 활성화
enable_controller_service() {
    local service_id=$1
    local service_name=$2

    echo "Enabling Controller Service: ${service_name} (${service_id})"

    # 현재 revision 가져오기
    local revision=$(curl -s "${NIFI_URL}/controller-services/${service_id}" | \
        python3 -c "import sys, json; d=json.load(sys.stdin); print(json.dumps(d.get('revision', {'version': 0})))")

    # 서비스 활성화
    curl -s -X PUT \
        -H "Content-Type: application/json" \
        -d "{\"revision\": ${revision}, \"state\": \"ENABLED\"}" \
        "${NIFI_URL}/controller-services/${service_id}/run-status" > /dev/null

    echo "  - Enabled"
}

# Process Group 내 모든 Controller Services 활성화
enable_all_controller_services() {
    local pg_id=$1

    echo "Fetching Controller Services in Process Group: ${pg_id}"

    # Controller Services 목록 가져오기
    local services=$(curl -s "${NIFI_URL}/flow/process-groups/${pg_id}/controller-services")
    local service_ids=$(echo "$services" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for cs in data.get('controllerServices', []):
    print(cs['id'], cs['component']['name'])
")

    if [ -z "$service_ids" ]; then
        echo "No Controller Services found"
        return 0
    fi

    # 각 서비스 활성화
    echo "$service_ids" | while read -r id name; do
        if [ -n "$id" ]; then
            enable_controller_service "$id" "$name"
        fi
    done
}

# Processor 시작
start_processors() {
    local pg_id=$1

    echo "Starting all Processors in Process Group: ${pg_id}"

    # Process Group 상태 변경 (RUNNING)
    curl -s -X PUT \
        -H "Content-Type: application/json" \
        -d '{"id": "'${pg_id}'", "state": "RUNNING"}' \
        "${NIFI_URL}/flow/process-groups/${pg_id}" > /dev/null

    echo "  - Processors started"
}

# Processor 중지
stop_processors() {
    local pg_id=$1

    echo "Stopping all Processors in Process Group: ${pg_id}"

    curl -s -X PUT \
        -H "Content-Type: application/json" \
        -d '{"id": "'${pg_id}'", "state": "STOPPED"}' \
        "${NIFI_URL}/flow/process-groups/${pg_id}" > /dev/null

    echo "  - Processors stopped"
}

# Flow 상태 확인
check_flow_status() {
    echo "Checking Flow Status..."

    local status=$(curl -s "${NIFI_URL}/flow/process-groups/root/status")

    echo "$status" | python3 -c "
import sys, json
data = json.load(sys.stdin)
agg = data['processGroupStatus']['aggregateSnapshot']
print(f\"  - Processors: {agg.get('runningCount', 0)} running, {agg.get('stoppedCount', 0)} stopped, {agg.get('invalidCount', 0)} invalid\")
print(f\"  - Queued: {agg.get('flowFilesQueued', 0)} FlowFiles, {agg.get('bytesQueued', 0)} bytes\")
"
}

# 변수 설정 (Oracle 접속 정보)
set_variables() {
    local pg_id=$1

    echo "Setting Process Group Variables..."

    # 현재 revision 가져오기
    local pg_info=$(curl -s "${NIFI_URL}/process-groups/${pg_id}")
    local revision=$(echo "$pg_info" | python3 -c "import sys, json; d=json.load(sys.stdin); print(json.dumps(d.get('revision', {'version': 0})))")

    # 변수 설정
    curl -s -X PUT \
        -H "Content-Type: application/json" \
        -d '{
            "processGroupRevision": '"${revision}"',
            "variableRegistry": {
                "processGroupId": "'${pg_id}'",
                "variables": [
                    {"variable": {"name": "oracle.username", "value": "cdc_user"}},
                    {"variable": {"name": "oracle.password", "value": "cdc_password"}}
                ]
            }
        }' \
        "${NIFI_URL}/process-groups/${pg_id}/variable-registry" > /dev/null

    echo "  - Variables set"
}

# 메인 실행
main() {
    # NiFi 준비 대기
    wait_for_nifi

    # Root Process Group ID 가져오기
    ROOT_PG_ID=$(get_root_process_group_id)
    echo "Root Process Group ID: ${ROOT_PG_ID}"

    # 변수 설정
    set_variables "${ROOT_PG_ID}"

    # Controller Services 활성화
    enable_all_controller_services "${ROOT_PG_ID}"

    # 잠시 대기 (서비스 활성화 대기)
    echo "Waiting for Controller Services to be enabled..."
    sleep 5

    # Flow 상태 확인
    check_flow_status

    echo ""
    echo "=== Setup Complete ==="
    echo "NiFi UI: http://${NIFI_HOST}:${NIFI_PORT}/nifi/"
    echo ""
    echo "To start the flow manually:"
    echo "  ./scripts/setup-nifi.sh start"
    echo ""
    echo "To stop the flow:"
    echo "  ./scripts/setup-nifi.sh stop"
}

# 명령어 처리
case "${1:-setup}" in
    setup)
        main
        ;;
    start)
        ROOT_PG_ID=$(get_root_process_group_id)
        start_processors "${ROOT_PG_ID}"
        ;;
    stop)
        ROOT_PG_ID=$(get_root_process_group_id)
        stop_processors "${ROOT_PG_ID}"
        ;;
    status)
        check_flow_status
        ;;
    *)
        echo "Usage: $0 {setup|start|stop|status}"
        exit 1
        ;;
esac
