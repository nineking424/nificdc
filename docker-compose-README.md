# NiFiCDC Docker Compose 설정

## 포함된 서비스

1. **Apache NiFi** (포트: 8443)
   - CDC 백엔드 엔진
   - HTTPS로 접속 (https://localhost:8443/nifi)
   - 기본 계정: admin / adminpassword123

2. **Redis** (포트: 6379)
   - 캐싱 서버
   - 비밀번호: redispassword123

3. **PostgreSQL** (포트: 5432)
   - 메타데이터 저장용 데이터베이스
   - 데이터베이스명: nificdc
   - 사용자: nificdc_user / postgrespassword123

4. **pgAdmin** (포트: 5050)
   - PostgreSQL 관리 도구
   - http://localhost:5050
   - 계정: admin@nificdc.local / pgadminpassword123

## 사용 방법

### 1. 환경 변수 설정
```bash
cp env.template .env
# 필요시 .env 파일의 비밀번호 등을 수정
```

### 2. 서비스 시작
```bash
# 모든 서비스 시작
docker-compose up -d

# 특정 서비스만 시작
docker-compose up -d nifi redis postgres

# 로그 확인
docker-compose logs -f
```

### 3. 서비스 접속
- NiFi: https://localhost:8443/nifi (자체 서명 인증서 경고 무시)
- pgAdmin: http://localhost:5050

### 4. 서비스 중지
```bash
# 서비스 중지
docker-compose stop

# 서비스 삭제 (볼륨은 유지)
docker-compose down

# 서비스 및 볼륨 모두 삭제
docker-compose down -v
```

## 주의사항

1. **보안**: 프로덕션 환경에서는 반드시 모든 비밀번호를 변경하세요.
2. **메모리**: NiFi는 최소 4GB의 메모리가 필요합니다.
3. **포트**: 사용 중인 포트가 있다면 docker-compose.yml에서 변경하세요.
4. **볼륨**: 데이터는 Docker 볼륨에 저장되어 컨테이너를 재시작해도 유지됩니다.

## 개발 환경 설정

NiFiCDC 애플리케이션에서 사용할 연결 정보:
- NiFi API URL: https://localhost:8443/nifi-api
- Redis: localhost:6379
- PostgreSQL: localhost:5432/nificdc 