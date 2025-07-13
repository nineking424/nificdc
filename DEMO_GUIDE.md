# NiFiCDC 프로젝트 시연 가이드

## 1. 환경 준비
- Docker와 Docker Compose가 설치되어 있는지 확인
- 필요한 환경 변수 파일(.env) 생성
- 필요한 포트(8080, 3000, 8443, 5432, 6379, 5050)가 사용 가능한지 확인

## 2. 프로젝트 실행
```bash
# 환경 변수 파일 생성
cp env.template .env

# Docker Compose로 전체 스택 실행
docker-compose up -d

# 또는 개발 모드로 실행
docker-compose -f docker-compose.dev.yml up -d
```

## 3. 서비스 접속 및 확인
- **Frontend (Vue.js)**: http://localhost:8080
- **Backend API**: http://localhost:3000
- **Apache NiFi**: https://localhost:8443 (admin/adminpassword123)
- **pgAdmin**: http://localhost:5050 (admin@nificdc.local/pgadminpassword123)

## 4. 주요 기능 시연
1. **시스템 관리**: 데이터 소스/타겟 시스템 등록 및 연결 테스트
2. **스키마 관리**: 데이터베이스 스키마 자동 탐색 및 버전 관리
3. **매핑 설계**: 드래그앤드롭으로 소스-타겟 데이터 매핑 구성
4. **작업 관리**: CDC 작업 생성 및 스케줄링
5. **모니터링**: 실시간 작업 상태 및 성능 메트릭 확인
6. **보안**: RBAC 기반 권한 관리 및 감사 로그 확인

## 5. 데이터베이스 초기화 (필요시)
```bash
# Backend 컨테이너 접속
docker exec -it nificdc-backend bash

# 마이그레이션 실행
npm run migrate

# 시드 데이터 입력
npm run seed
```

## 6. 개발 모드 실행 (로컬 개발시)
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run serve
```

## 7. 헬스체크 확인
- Backend: http://localhost:3000/health
- NiFi: https://localhost:8443/nifi (자체 서명 인증서 경고 수락 필요)

이 계획대로 진행하면 NiFiCDC 프로젝트의 전체 기능을 시연할 수 있습니다.