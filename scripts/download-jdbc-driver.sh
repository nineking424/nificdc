#!/bin/bash
# JDBC 드라이버 다운로드 스크립트
# Oracle JDBC 드라이버(ojdbc8)를 Maven Central에서 다운로드

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DRIVERS_DIR="${PROJECT_ROOT}/drivers"

# Oracle JDBC 드라이버 버전
OJDBC_VERSION="21.9.0.0"
OJDBC_JAR="ojdbc8.jar"
OJDBC_URL="https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/${OJDBC_VERSION}/ojdbc8-${OJDBC_VERSION}.jar"

echo "=== Oracle JDBC Driver Download Script ==="
echo "Driver Version: ${OJDBC_VERSION}"
echo "Target Directory: ${DRIVERS_DIR}"

# 드라이버 디렉토리 생성
mkdir -p "${DRIVERS_DIR}"

# 이미 존재하는지 확인
if [ -f "${DRIVERS_DIR}/${OJDBC_JAR}" ]; then
    echo "Driver already exists: ${DRIVERS_DIR}/${OJDBC_JAR}"
    echo "Skipping download."
    exit 0
fi

echo "Downloading Oracle JDBC Driver..."

# curl 또는 wget으로 다운로드
if command -v curl &> /dev/null; then
    curl -L -o "${DRIVERS_DIR}/${OJDBC_JAR}" "${OJDBC_URL}"
elif command -v wget &> /dev/null; then
    wget -O "${DRIVERS_DIR}/${OJDBC_JAR}" "${OJDBC_URL}"
else
    echo "Error: curl or wget is required to download the driver"
    exit 1
fi

# 다운로드 확인
if [ -f "${DRIVERS_DIR}/${OJDBC_JAR}" ]; then
    FILE_SIZE=$(ls -lh "${DRIVERS_DIR}/${OJDBC_JAR}" | awk '{print $5}')
    echo "Download complete: ${DRIVERS_DIR}/${OJDBC_JAR} (${FILE_SIZE})"
else
    echo "Error: Download failed"
    exit 1
fi

echo "=== Done ==="
