# nificdc

Oracle DB → Apache NiFi → Elasticsearch 간 timestamp 기반 CDC(Change Data Capture) 파이프라인

## 개요

nificdc는 다음을 목표로 합니다:
- NiFi CDC 아키텍처의 표준화
- SQL / Flow / 테스트의 코드화
- 테이블 추가 시 `spec.yaml`만 작성하면 모든 산출물 자동 생성

## 아키텍처

```
[Oracle (Docker)] → JDBC → [NiFi 1.28 (K8s)]
                              ├─ SQL Registry (ConfigMap)
                              ├─ LookupService
                              ├─ QueryDatabaseTableRecord
                              └─ PutElasticsearchRecord → [Elasticsearch (Docker)]
```

## 디렉토리 구조

```
nificdc/
├── k8s/                    # Kubernetes manifests
│   └── nifi.yaml           # NiFi 1.28 Deployment
├── sql-registry/           # SQL Registry JSON
│   └── oracle.json         # CDC 쿼리 정의
├── flows/                  # NiFi Flow JSON
│   └── oracle_cdc_flow.json
├── specs/                  # 테이블별 spec 정의
│   ├── my_table.yaml
│   └── orders.yaml
├── scripts/                # 자동화 스크립트
│   └── generate-from-spec.js
├── tests/                  # 테스트 코드
│   ├── unit/
│   ├── contract/
│   ├── integration/
│   └── regression/
└── docker-compose.yml      # 로컬 테스트 환경
```

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 테스트 실행

```bash
# 전체 테스트
npm test

# 개별 테스트
npm run test:unit
npm run test:contract
npm run test:integration
npm run test:regression
```

### 3. 새 테이블 추가

```bash
# 1. spec 템플릿 생성
npm run generate:new -- <table_name>

# 2. specs/<table_name>.yaml 수정

# 3. SQL Registry와 Flow 자동 생성
npm run generate -- <table_name>

# 4. 테스트로 검증
npm test
```

## 테이블 Spec 작성 가이드

`specs/<table_name>.yaml` 예시:

```yaml
table:
  name: MY_TABLE           # Oracle 테이블명
  schema: CDC_TEST         # 스키마명
  primary_key: ID          # PK (ES _id로 사용)
  cdc_key: UPDATED_AT      # CDC 타임스탬프 컬럼

columns:
  - name: ID
    type: NUMBER
    nullable: false
  - name: NAME
    type: VARCHAR2(100)
    nullable: true
  - name: UPDATED_AT
    type: TIMESTAMP
    nullable: false

elasticsearch:
  index: my_table          # ES 인덱스명
  id_field: ID             # _id 필드

range:
  default: 5m
  options: [5m, 15m, 30m, 60m]

cdc:
  mode: timestamp
  delete_handling: ignore  # DELETE 무시
  update_handling: upsert  # UPDATE는 upsert
```

## CDC 핵심 규칙

| 항목 | 규칙 |
|------|------|
| CDC 방식 | Timestamp 기반 증분 |
| DELETE | 완전 제외 |
| UPDATE | Upsert (덮어쓰기) |
| ORDER BY | CDC_KEY 필수 |
| State | NiFi Maximum-value Columns |

## 명령어 목록

| 명령어 | 설명 |
|--------|------|
| `npm test` | 전체 테스트 실행 |
| `npm run test:unit` | Unit 테스트 |
| `npm run test:contract` | Contract 테스트 |
| `npm run test:integration` | Integration 테스트 |
| `npm run test:regression` | Regression 테스트 |
| `npm run generate:new -- <name>` | 새 spec 템플릿 생성 |
| `npm run generate -- <name>` | spec에서 산출물 생성 |
| `npm run generate:all` | 모든 spec 재생성 |
| `npm run docker:up` | Docker 테스트 환경 시작 |
| `npm run docker:down` | Docker 환경 중지 |

## 테스트 환경 (Docker)

```bash
# 환경 시작 (Oracle, NiFi, Elasticsearch)
npm run docker:up

# 로그 확인
npm run docker:logs

# 환경 중지
npm run docker:down
```

| 서비스 | 포트 | 이미지 |
|--------|------|--------|
| Oracle | 1521 | `absolutapps/oracle-12c-ee:latest` |
| NiFi | 8080 | `apache/nifi:1.28.1` |
| Elasticsearch | 9200 | `elasticsearch:8.11.0` |

## Kubernetes 배포

```bash
# NiFi 배포
kubectl apply -f k8s/nifi.yaml

# 상태 확인
kubectl get pods -n nificdc
```

## 테스트 전략

| 레벨 | 검증 대상 | 실패 조건 |
|------|----------|----------|
| Unit | SQL Registry | ORDER BY 누락, max_value_column 누락 |
| Contract | SQL ↔ Flow 매핑 | LookupService 불일치 |
| Integration | 전체 파이프라인 | 데이터 누락/중복 |
| Regression | NiFi 재시작 | State 손실, 데이터 정합성 |

## 라이선스

MIT
