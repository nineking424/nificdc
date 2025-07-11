#!/bin/bash

# NiFiCDC 프로젝트 셋업 스크립트

set -e

echo "🚀 NiFiCDC 프로젝트 셋업을 시작합니다..."

# 색상 코드 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수 정의
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 필수 도구 확인
check_dependencies() {
    log_info "필수 도구 확인 중..."
    
    # Docker 확인
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다. https://docs.docker.com/get-docker/ 를 참조하세요."
        exit 1
    fi
    
    # Docker Compose 확인
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose가 설치되지 않았습니다."
        exit 1
    fi
    
    # Node.js 확인
    if ! command -v node &> /dev/null; then
        log_warn "Node.js가 설치되지 않았습니다. 로컬 개발을 위해 설치를 권장합니다."
    fi
    
    # Git 확인
    if ! command -v git &> /dev/null; then
        log_error "Git이 설치되지 않았습니다."
        exit 1
    fi
    
    log_info "모든 필수 도구가 설치되어 있습니다."
}

# 환경 변수 파일 생성
setup_env_files() {
    log_info "환경 변수 파일 설정 중..."
    
    # Docker 환경 변수 파일
    if [ ! -f ".env" ]; then
        if [ -f "docker/.env.example" ]; then
            cp docker/.env.example .env
            log_info ".env 파일을 생성했습니다."
        else
            log_warn ".env.example 파일을 찾을 수 없습니다."
        fi
    else
        log_info ".env 파일이 이미 존재합니다."
    fi
}

# Docker 볼륨 초기화
setup_volumes() {
    log_info "Docker 볼륨 초기화 중..."
    
    # PostgreSQL 초기화 스크립트 디렉토리 생성
    mkdir -p database/init-scripts
    
    # 필요한 디렉토리들 생성
    mkdir -p docker/volumes/{postgres,redis,nifi,pgadmin}
    
    log_info "볼륨 디렉토리가 생성되었습니다."
}

# 프로젝트 템플릿 생성
create_project_templates() {
    log_info "프로젝트 템플릿 생성 중..."
    
    # Frontend package.json 템플릿
    if [ ! -f "frontend/package.json" ]; then
        cat > frontend/package.json << EOF
{
  "name": "nificdc-frontend",
  "version": "1.0.0",
  "description": "NiFiCDC Frontend - Vue.js SPA",
  "main": "src/main.js",
  "scripts": {
    "serve": "vue-cli-service serve",
    "build": "vue-cli-service build",
    "lint": "vue-cli-service lint",
    "test": "vue-cli-service test:unit"
  },
  "dependencies": {
    "vue": "^3.3.0",
    "vue-router": "^4.2.0",
    "vuex": "^4.0.0",
    "axios": "^1.4.0"
  },
  "devDependencies": {
    "@vue/cli-service": "^5.0.0",
    "eslint": "^8.0.0",
    "eslint-plugin-vue": "^9.0.0"
  }
}
EOF
        log_info "Frontend package.json 생성 완료"
    fi
    
    # Backend package.json 템플릿
    if [ ! -f "backend/package.json" ]; then
        cat > backend/package.json << EOF
{
  "name": "nificdc-backend",
  "version": "1.0.0",
  "description": "NiFiCDC Backend - RESTful API",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "lint": "eslint src/",
    "build": "echo 'No build step needed'"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "dotenv": "^16.0.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "axios": "^1.4.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0",
    "supertest": "^6.3.0"
  }
}
EOF
        log_info "Backend package.json 생성 완료"
    fi
    
    # Backend 헬스체크 파일
    if [ ! -f "backend/healthcheck.js" ]; then
        cat > backend/healthcheck.js << EOF
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', () => {
  process.exit(1);
});

request.end();
EOF
        log_info "Backend healthcheck.js 생성 완료"
    fi
}

# Git 초기화
setup_git() {
    log_info "Git 저장소 초기화 중..."
    
    # 이미 Git 저장소인지 확인
    if [ ! -d ".git" ]; then
        git init
        log_info "Git 저장소가 초기화되었습니다."
    else
        log_info "Git 저장소가 이미 존재합니다."
    fi
    
    # develop 브랜치 생성
    if ! git show-ref --verify --quiet refs/heads/develop; then
        git checkout -b develop
        log_info "develop 브랜치가 생성되었습니다."
    fi
    
    # main 브랜치로 돌아가기
    git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
}

# Docker 빌드 및 테스트
build_and_test() {
    log_info "Docker 이미지 빌드 및 테스트 중..."
    
    # Docker Compose 빌드
    docker-compose build --parallel
    
    if [ $? -eq 0 ]; then
        log_info "Docker 이미지 빌드 완료"
    else
        log_error "Docker 이미지 빌드 실패"
        exit 1
    fi
    
    # 간단한 연결 테스트
    log_info "서비스 연결 테스트 중..."
    docker-compose up -d postgres redis
    
    # 잠시 대기
    sleep 10
    
    # 연결 테스트
    docker-compose exec -T postgres pg_isready -U nificdc_user -d nificdc
    docker-compose exec -T redis redis-cli -a redispassword123 ping
    
    # 테스트 서비스 종료
    docker-compose down
    
    log_info "연결 테스트 완료"
}

# 메인 실행
main() {
    echo "========================="
    echo "  NiFiCDC Project Setup  "
    echo "========================="
    
    check_dependencies
    setup_env_files
    setup_volumes
    create_project_templates
    setup_git
    
    if [ "$1" == "--with-build" ]; then
        build_and_test
    fi
    
    echo ""
    log_info "✅ 셋업이 완료되었습니다!"
    echo ""
    echo "다음 단계:"
    echo "1. 환경 변수 파일 확인: .env"
    echo "2. 서비스 시작: docker-compose up -d"
    echo "3. 서비스 상태 확인: docker-compose ps"
    echo "4. 개발 시작: cd frontend && npm install"
    echo ""
    echo "자세한 내용은 README.md를 참조하세요."
}

# 스크립트 실행
main "$@"