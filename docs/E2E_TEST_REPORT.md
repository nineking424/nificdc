# E2E 테스트 상세 리포트

## 개요

| 항목 | 값 |
|------|-----|
| 테스트 파일 | `tests/e2e/full-pipeline.test.js` |
| 총 테스트 수 | 9개 |
| 통과 | 9개 (100%) |
| 실패 | 0개 |
| 최종 실행일 | 2026-01-20 |

## 테스트 환경

| 컴포넌트 | Docker 이미지 | 버전 |
|----------|--------------|------|
| Oracle | `gvenzl/oracle-free:23-slim` | 23c (arm64 native) |
| NiFi | `apache/nifi:1.28.0` | 1.28.0 |
| Elasticsearch | `docker.elastic.co/elasticsearch/elasticsearch:8.11.0` | 8.11.0 |

### 연결 정보

```
Oracle:        localhost:1521/FREEPDB1 (cdc_user/cdc_password)
Elasticsearch: http://localhost:9200
NiFi:          http://localhost:8080
```

---

## 테스트 구조

```
E2E Pipeline Tests
├── Infrastructure (3 tests)
│   ├── Elasticsearch health check
│   ├── NiFi accessibility check
│   └── Oracle connectivity check
└── Data Pipeline (6 tests)
    ├── Oracle initial data verification
    ├── Oracle → ES sync test
    ├── ES document structure validation
    ├── Upsert (update without duplicates) test
    ├── New insert capture test
    └── Data integrity (no duplicates) test
```

---

## 테스트 상세

### 1. Infrastructure Tests

#### 1.1 Elasticsearch should be running and healthy

| 항목 | 내용 |
|------|------|
| **목적** | Elasticsearch 클러스터가 정상 작동 중인지 확인 |
| **검증 항목** | 클러스터 상태가 `green` 또는 `yellow`인지 |
| **실패 조건** | 클러스터 상태가 `red`이거나 연결 불가 |

**테스트 코드:**
```javascript
const health = await esClient.cluster.health();
expect(['green', 'yellow']).toContain(health.status);
```

---

#### 1.2 NiFi should be accessible

| 항목 | 내용 |
|------|------|
| **목적** | NiFi REST API가 응답하는지 확인 |
| **검증 항목** | `/nifi-api/system-diagnostics` 엔드포인트가 200 OK 반환 |
| **실패 조건** | HTTP 응답이 200이 아니거나 연결 불가 |

**테스트 코드:**
```javascript
const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/system-diagnostics`;
const response = await fetch(url);
expect(response.ok).toBe(true);
```

---

#### 1.3 Oracle should be accessible

| 항목 | 내용 |
|------|------|
| **목적** | Oracle DB에 연결 가능한지 확인 |
| **검증 항목** | `SELECT 1 FROM DUAL` 쿼리 실행 성공 |
| **실패 조건** | 연결 실패 또는 쿼리 실행 실패 |

**테스트 코드:**
```javascript
const result = await executeOracleSQL('SELECT 1 FROM DUAL');
expect(result.rows).toHaveLength(1);
```

---

### 2. Data Pipeline Tests

#### 2.1 should have initial data in Oracle

| 항목 | 내용 |
|------|------|
| **목적** | Oracle에 초기 테스트 데이터가 존재하는지 확인 |
| **검증 항목** | `MY_TABLE`에 최소 3개 레코드 존재 |
| **데이터 출처** | `tests/fixtures/oracle-init/01_create_schema.sql` |

**초기 데이터:**
```sql
INSERT INTO MY_TABLE (ID, NAME, VALUE) VALUES (1, 'Record 1', 100.50);
INSERT INTO MY_TABLE (ID, NAME, VALUE) VALUES (2, 'Record 2', 200.75);
INSERT INTO MY_TABLE (ID, NAME, VALUE) VALUES (3, 'Record 3', 300.25);
```

**테스트 코드:**
```javascript
const result = await executeOracleSQL('SELECT COUNT(*) AS cnt FROM MY_TABLE');
expect(result.rows[0][0]).toBeGreaterThanOrEqual(3);
```

---

#### 2.2 should sync data from Oracle to Elasticsearch

| 항목 | 내용 |
|------|------|
| **목적** | Oracle 데이터가 Elasticsearch로 정확히 동기화되는지 확인 |
| **동작** | `syncOracleToElasticsearch()` 함수 호출 |
| **검증 항목** | 동기화된 레코드 수 ≥ 3, ES 문서 수 ≥ 3 |

**동작 순서:**
1. Oracle에서 `MY_TABLE` 전체 조회 (`ORDER BY UPDATED_AT`)
2. 각 레코드를 ES에 upsert (ID를 문서 ID로 사용)
3. ES 인덱스 refresh
4. 문서 수 확인

**테스트 코드:**
```javascript
const syncedCount = await syncOracleToElasticsearch();
expect(syncedCount).toBeGreaterThanOrEqual(3);

await esClient.indices.refresh({ index: CONFIG.elasticsearch.index });
const countResult = await esClient.count({ index: CONFIG.elasticsearch.index });
expect(countResult.count).toBeGreaterThanOrEqual(3);
```

---

#### 2.3 should have correct document structure in Elasticsearch

| 항목 | 내용 |
|------|------|
| **목적** | ES 문서가 올바른 필드 구조를 가지는지 확인 |
| **검증 항목** | `ID`, `NAME`, `VALUE`, `UPDATED_AT` 필드 존재 |

**예상 문서 구조:**
```json
{
  "ID": 1,
  "NAME": "Record 1",
  "VALUE": 100.50,
  "UPDATED_AT": "2026-01-20T12:00:00.000Z"
}
```

**테스트 코드:**
```javascript
const result = await esClient.search({ index: CONFIG.elasticsearch.index, size: 1 });
const doc = result.hits.hits[0]._source;
expect(doc).toHaveProperty('ID');
expect(doc).toHaveProperty('NAME');
expect(doc).toHaveProperty('VALUE');
expect(doc).toHaveProperty('UPDATED_AT');
```

---

#### 2.4 should upsert updated records without duplicates

| 항목 | 내용 |
|------|------|
| **목적** | 레코드 업데이트 시 upsert가 올바르게 동작하는지 확인 |
| **핵심 검증** | 동일 ID의 중복 문서가 생성되지 않음 |

**동작 순서:**
1. Oracle에서 ID=1 레코드 UPDATE
2. `syncOracleToElasticsearch()` 호출
3. ES에서 ID=1 검색
4. 정확히 1개만 존재하는지 확인
5. 업데이트된 값 검증

**테스트 코드:**
```javascript
// Step 1: Oracle UPDATE
await executeOracleSQL(`
  UPDATE MY_TABLE
  SET NAME = 'Updated Record 1', VALUE = 999.99, UPDATED_AT = CURRENT_TIMESTAMP
  WHERE ID = 1
`);

// Step 2: Sync
await syncOracleToElasticsearch();

// Step 3-4: Search and verify count
const result = await esClient.search({
  index: CONFIG.elasticsearch.index,
  query: { term: { ID: 1 } },
});
expect(result.hits.hits.length).toBe(1);

// Step 5: Verify values
expect(result.hits.hits[0]._source.NAME).toBe('Updated Record 1');
expect(result.hits.hits[0]._source.VALUE).toBe(999.99);
```

---

#### 2.5 should capture new inserts

| 항목 | 내용 |
|------|------|
| **목적** | 새 레코드 삽입이 ES에 정확히 반영되는지 확인 |
| **동작** | Oracle INSERT → Sync → ES 검색 |

**동작 순서:**
1. Oracle에 새 레코드 INSERT (랜덤 ID 사용)
2. `syncOracleToElasticsearch()` 호출
3. ES에서 새 ID 검색
4. 정확히 1개 존재 확인
5. 값 검증

**테스트 코드:**
```javascript
// Step 1: Insert with random ID
const newId = 1000 + Math.floor(Math.random() * 1000);
await executeOracleSQL(`
  INSERT INTO MY_TABLE (ID, NAME, VALUE, UPDATED_AT)
  VALUES (${newId}, 'E2E Test Record', 12345.67, CURRENT_TIMESTAMP)
`);

// Step 2-3: Sync and search
await syncOracleToElasticsearch();
const result = await esClient.search({
  index: CONFIG.elasticsearch.index,
  query: { term: { ID: newId } },
});

// Step 4-5: Verify
expect(result.hits.hits.length).toBe(1);
expect(result.hits.hits[0]._source.NAME).toBe('E2E Test Record');
```

---

#### 2.6 should maintain data integrity (no duplicates)

| 항목 | 내용 |
|------|------|
| **목적** | 전체 데이터에 중복이 없는지 확인 |
| **검증 방법** | 총 문서 수 = 고유 ID 수 |

**검증 로직:**
- Cardinality Aggregation으로 고유 ID 수 계산
- 총 문서 수와 비교
- 일치하면 중복 없음

**테스트 코드:**
```javascript
// 총 문서 수
const countResult = await esClient.count({ index: CONFIG.elasticsearch.index });

// 고유 ID 수 (cardinality aggregation)
const aggResult = await esClient.search({
  index: CONFIG.elasticsearch.index,
  size: 0,
  aggs: {
    unique_ids: { cardinality: { field: 'ID' } },
  },
});

const totalCount = countResult.count;
const uniqueCount = aggResult.aggregations.unique_ids.value;

// 중복 없음 확인
expect(totalCount).toBe(uniqueCount);
```

---

## 거짓 양성(False Positive) 방지

모든 테스트는 다음 원칙을 따릅니다:

| 원칙 | 설명 |
|------|------|
| **1. try-catch 스킵 금지** | 예외 발생 시 테스트가 반드시 실패 |
| **2. 명시적 스킵** | `test.skip()` 또는 `describe.skip()` 만 허용 |
| **3. 환경 검증 선행** | `beforeAll`에서 환경 확인 후 플래그 설정 |
| **4. Assertion 필수** | 모든 테스트에 `expect()` 포함 |
| **5. 조건부 return 금지** | `if (!ready) return` 대신 `throw Error` 사용 |

**환경 미준비 시 동작:**
```javascript
if (!ENV_STATUS.elasticsearch) {
  throw new Error('Elasticsearch is not available');
}
```

---

## 실행 방법

```bash
# 전체 환경 구성 + 테스트
npm run test:e2e

# 테스트만 실행 (환경 이미 준비된 경우)
npm run test:e2e:run

# Docker 환경 수동 시작
docker-compose --profile full up -d
```

---

## 테스트 결과 예시

```
 PASS  tests/e2e/full-pipeline.test.js
  E2E Pipeline Tests
    Infrastructure
      ✓ Elasticsearch should be running and healthy (4 ms)
      ✓ NiFi should be accessible (6 ms)
      ✓ Oracle should be accessible (22 ms)
    Data Pipeline
      ✓ should have initial data in Oracle (17 ms)
      ✓ should sync data from Oracle to Elasticsearch (159 ms)
      ✓ should have correct document structure in Elasticsearch (5 ms)
      ✓ should upsert updated records without duplicates (166 ms)
      ✓ should capture new inserts (105 ms)
      ✓ should maintain data integrity (no duplicates) (4 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `tests/e2e/full-pipeline.test.js` | E2E 테스트 코드 |
| `tests/fixtures/oracle-init/01_create_schema.sql` | Oracle 초기화 스크립트 |
| `docker-compose.yml` | Docker 환경 설정 |
| `scripts/run-e2e-test.sh` | E2E 테스트 실행 스크립트 |
| `flows/oracle_cdc_flow.json` | NiFi CDC Flow 정의 |
