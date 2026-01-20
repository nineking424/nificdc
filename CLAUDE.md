# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**nificdc**는 Oracle DB → Apache NiFi → Elasticsearch 간 timestamp 기반 CDC(Change Data Capture) 파이프라인 프로젝트입니다.

핵심 특징:
- NiFi 1.28 단일 노드 (Kubernetes 배포)
- Timestamp 기반 증분 CDC (DELETE 제외, UPDATE는 upsert)
- SQL Registry + LookupService 기반 SQL 중앙 관리
- Claude Code가 NiFi Flow JSON, SQL Registry, K8s Manifest 직접 생성

## 아키텍처

```
[Oracle (Docker)] → JDBC → [NiFi 1.28 (K8s)]
                              ├─ SQL Registry (ConfigMap)
                              ├─ LookupService
                              ├─ QueryDatabaseTableRecord
                              └─ PutElasticsearchRecord → [Elasticsearch (Docker)]
```

## 디렉토리 구조 (목표)

```
nificdc/
├── k8s/              # Kubernetes manifests
├── sql-registry/     # SQL Registry JSON (sql_id 기반)
├── flows/            # NiFi Flow JSON
├── specs/            # 테이블별 spec.yaml
├── tests/            # unit, integration, regression
└── ai/prompts/       # AI 프롬프트 템플릿
```

## CDC 핵심 규칙

1. **CDC_KEY**: `TIMESTAMP` 컬럼만 사용
2. **SQL 필수 요소**:
   - NiFi State 또는 Expression Language (`${max.value.column}`)
   - `ORDER BY CDC_KEY` 필수
   - `${range_from}`, `${range_to}` attribute 사용
3. **sql_id 네이밍**: `oracle.cdc.<table>.<range>`

## 테스트 환경

| 컴포넌트 | Docker 이미지 |
|---------|--------------|
| Oracle | `absolutapps/oracle-12c-ee:latest` |
| NiFi | `apache/nifi:1.28.1` |
| Elasticsearch | 로컬 Docker |

## TDD 규칙

**테스트 레벨**:
| 레벨 | 검증 대상 |
|------|----------|
| Unit | SQL Registry 검증 |
| Contract | SQL ↔ Flow 매핑 |
| Integration | Oracle → NiFi → ES 전체 흐름 |
| Regression | CDC 재실행 시 데이터 정합성 |
| E2E | 전체 파이프라인 실제 실행 |

**실패 조건**:
- `ORDER BY` 누락 시 실패
- NiFi State 또는 `${max.value.column}` 미사용 시 실패
- 동일 데이터 중복 적재 시 실패
- NiFi 재기동 후 데이터 누락 시 실패

## 거짓 양성(False Positive) 방지 원칙

모든 테스트 코드 작성 시 반드시 준수:

| 원칙 | 금지 | 허용 |
|------|------|------|
| 1. try-catch 스킵 금지 | `catch(e) { console.log('skip') }` | 예외 시 테스트 실패 |
| 2. 명시적 스킵만 허용 | 암묵적 통과 | `test.skip()` 또는 `describe.skip()` |
| 3. 환경 검증 선행 | 테스트 중 환경 체크 후 return | `beforeAll`에서 환경 확인 후 실패 |
| 4. 필수 assertion | assertion 없는 테스트 | 모든 경로에 `expect()` 필수 |
| 5. 조건부 return 금지 | `if (!ready) return;` | 환경 없으면 `throw Error` |

**나쁜 예 (거짓 양성 발생)**:
```javascript
test('should have data in Oracle', async () => {
  try {
    const result = await executeOracleSQL(...);
    expect(result.rows.length).toBeGreaterThan(0);
  } catch (e) {
    console.log('Skipping...'); // ❌ 실패해도 통과
  }
});
```

**좋은 예 (정직한 결과)**:
```javascript
test('should have data in Oracle', async () => {
  if (!ENV_STATUS.oracle) {
    throw new Error('Oracle is not available'); // ✅ 환경 없으면 실패
  }
  const result = await executeOracleSQL(...);
  expect(result.rows.length).toBeGreaterThan(0);
});
```

**핵심**: 통과한 테스트는 실제로 검증된 것이어야 한다. 환경 미충족 시 테스트는 반드시 실패해야 한다.

## 산출물 생성 원칙

- NiFi Flow는 JSON으로 직접 생성 (UI 수동 생성 금지)
- 테이블 추가 시 `specs/<table>.yaml`만 작성
- 모든 산출물은 Git 기반 관리
