# 브루트포스 방어 시스템

NiFiCDC의 고급 브루트포스 방어 시스템은 다층 보안과 적응형 임계값을 가진 지능형 방어 메커니즘을 제공합니다.

## 주요 기능

### 1. 다층 방어 시스템

- **로그인 기반 제한**: IP + 사용자 조합으로 로그인 시도 제한
- **IP 기반 제한**: 단일 IP에서의 모든 실패 시도 모니터링
- **계정 기반 제한**: 특정 계정에 대한 공격 시도 추적
- **패턴 기반 탐지**: 의심스러운 사용자명 및 공격 패턴 감지

### 2. 적응형 임계값

```javascript
// 기본 설정
{
  login: {
    maxAttempts: 5,        // 15분간 최대 5회 시도
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 60 * 60 * 1000  // 1시간 차단
  },
  ip: {
    maxAttempts: 20,       // 1시간간 최대 20회 시도
    windowMs: 60 * 60 * 1000,
    blockDurationMs: 4 * 60 * 60 * 1000  // 4시간 차단
  },
  account: {
    maxAttempts: 10,       // 30분간 최대 10회 시도
    windowMs: 30 * 60 * 1000,
    blockDurationMs: 2 * 60 * 60 * 1000,  // 2시간 차단
    permanentLockThreshold: 50  // 50회 시도 후 영구 잠금
  }
}
```

### 3. 지능형 패턴 감지

#### 의심스러운 사용자명 패턴
- `admin`, `administrator`, `root`, `superuser`
- `password`, `123456`, `qwerty`, `letmein`
- `test`, `demo`, `guest`, `public`

#### 자동화 도구 탐지
- Bot User-Agent 패턴
- 비정상적으로 짧거나 누락된 User-Agent
- 자동화 도구 시그니처 (`curl`, `python-requests`, `postman` 등)

#### 시간 기반 분석
- 업무 시간 외 접근 (22:00 - 06:00)
- 비정상적인 요청 빈도

### 4. 지역 기반 필터링 (선택사항)

```javascript
// 환경 변수 설정
GEO_BLOCKING_ENABLED=true
ALLOWED_COUNTRIES=KR,US,JP
BLOCKED_COUNTRIES=CN,RU,KP
```

## API 엔드포인트

### 차단 상태 조회
```http
GET /api/v1/brute-force/status/:ip/:identifier
Authorization: Bearer <token>
```

### 차단 해제 (관리자)
```http
POST /api/v1/brute-force/unblock
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "type": "ip|login|account|permanent",
  "key": "192.168.1.100",
  "reason": "Manual unblock by admin"
}
```

### 화이트리스트 추가 (관리자)
```http
POST /api/v1/brute-force/whitelist
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "ip": "192.168.1.100",
  "reason": "Trusted office IP",
  "duration": 86400000  // 24시간 (ms), null이면 영구
}
```

### 통계 조회 (관리자)
```http
GET /api/v1/brute-force/statistics?timeWindow=24h
Authorization: Bearer <admin-token>
```

### 설정 조회 (관리자)
```http
GET /api/v1/brute-force/config
Authorization: Bearer <admin-token>
```

## Rate Limiting 통합

### API Rate Limiting
- **적응형 제한**: 사용자 역할 및 인증 상태에 따른 동적 조정
- **시간대 조정**: 업무 시간과 심야 시간의 차등 적용
- **시스템 부하 반영**: CPU/메모리 사용량에 따른 자동 조정

```javascript
// 사용자별 제한 예시
{
  admin: 1000,      // 관리자: 15분간 1000회
  operator: 500,    // 운영자: 15분간 500회
  user: 200,        // 일반 사용자: 15분간 200회
  anonymous: 100    // 미인증: 15분간 100회
}
```

### 특화된 Rate Limiter

#### 로그인 Rate Limiter
- 실패한 로그인만 카운트
- IP + 사용자명 조합 키
- 브루트포스 보호와 완전 통합

#### 관리자 API Rate Limiter
- 엄격한 제한 (5분간 50회)
- 과다 사용 시 즉시 알림
- 상세한 감사 로그

#### 파일 업로드 Rate Limiter
- 대용량 파일 업로드 남용 방지
- 시간당 제한 (1시간간 10개 파일)

## 모니터링 및 알림

### 자동 알림 조건
1. **Level 2 IP 차단**: 50회 시도 후 24시간 차단
2. **Level 3 IP 차단**: 100회 시도 후 7일 차단
3. **계정 영구 잠금**: 50회 실패 후 영구 차단
4. **의심스러운 활동**: 위험 점수 70점 이상

### 감사 로그
모든 보안 이벤트는 감사 로그에 기록됩니다:
- 로그인 시도 (성공/실패)
- Rate Limit 초과
- 차단 적용/해제
- 화이트리스트 변경
- 설정 접근

## Redis 데이터 구조

### 키 패턴
```
bf:login:{ip}:{identifier}     # 로그인 시도 카운터
bf:ip:{ip}                     # IP 기반 카운터
bf:account:{identifier}        # 계정 기반 카운터
bf:block:{type}:{key}          # 차단 정보
bf:whitelist:{ip}              # 화이트리스트
bf:pattern:{identifier}        # 패턴 기반 추적
```

### 데이터 만료
- 카운터: 윈도우 시간에 따라 자동 만료
- 차단 정보: 차단 기간에 따라 자동 만료
- 화이트리스트: 설정된 기간 또는 영구 보존

## 설정 및 환경 변수

```env
# 기본 설정
SCHEDULED_SCANS_ENABLED=true
TIMEZONE=Asia/Seoul

# 지역 기반 필터링
GEO_BLOCKING_ENABLED=false
ALLOWED_COUNTRIES=KR,US,JP
BLOCKED_COUNTRIES=CN,RU,KP,IR

# 관리자 IP 화이트리스트
ADMIN_IPS=192.168.1.0/24,10.0.0.0/8

# Redis 설정
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
```

## 성능 최적화

### Redis 최적화
- 키 만료 시간 설정으로 메모리 효율성
- Pipeline 사용으로 네트워크 오버헤드 감소
- 읽기 전용 복제본 사용 고려

### 메모리 사용량
- 기본 설정으로 10,000 동시 사용자 지원
- IP당 평균 1KB 메모리 사용
- 자동 정리로 메모리 누수 방지

## 보안 고려사항

### 타이밍 공격 방어
- 일정한 응답 시간 보장
- 사용자 존재 여부 정보 누출 방지

### 우회 방법 차단
- 다중 IP 사용 공격 탐지
- 분산 공격 패턴 인식
- VPN/프록시 탐지

### 가용성 보장
- Redis 장애 시 Fall-through 정책
- 보수적 접근 (의심스러운 경우 차단)
- 관리자 응급 해제 기능

## 테스트

```bash
# 단위 테스트 실행
npm test -- tests/security/bruteForceProtection.test.js

# 통합 테스트
npm test -- tests/integration/auth.test.js

# 부하 테스트
npm run test:load -- --scenario brute-force
```

## 문제 해결

### 일반적인 문제

1. **정상 사용자 차단**
   - 화이트리스트 추가
   - 임계값 조정 검토
   - 패턴 매칭 규칙 수정

2. **성능 저하**
   - Redis 연결 풀 크기 조정
   - 키 만료 시간 최적화
   - 불필요한 로깅 제거

3. **메모리 사용량 증가**
   - 자동 정리 주기 확인
   - 카운터 윈도우 크기 조정
   - 오래된 데이터 수동 정리

### 디버깅

```javascript
// 디버그 모드 활성화
process.env.DEBUG_BRUTE_FORCE = 'true';

// 상세 로깅 확인
logger.level = 'debug';

// Redis 키 직접 조회
redis-cli keys "bf:*"
redis-cli get "bf:login:192.168.1.100:user@example.com"
```

## 향후 개선 사항

1. **머신러닝 기반 탐지**
   - 행동 패턴 분석
   - 이상 탐지 모델
   - 적응형 학습

2. **지역 정보 고도화**
   - 정확한 GeoIP 데이터베이스
   - VPN/프록시 탐지 강화
   - 시간대 기반 정밀 분석

3. **분산 환경 지원**
   - 다중 서버 간 정보 공유
   - 클러스터 단위 통계
   - 중앙집중식 관리

4. **사용자 경험 개선**
   - CAPTCHA 통합
   - 다단계 인증 연동
   - 점진적 지연 적용