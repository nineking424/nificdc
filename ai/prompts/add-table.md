# 새 테이블 추가 프롬프트

## 사용법

이 프롬프트를 Claude Code에 전달하여 새 CDC 테이블을 추가합니다.

---

## 프롬프트 템플릿

```
새 CDC 테이블을 추가해주세요.

테이블 정보:
- 테이블명: {TABLE_NAME}
- 스키마: {SCHEMA_NAME}
- Primary Key: {PK_COLUMN}
- CDC Key (타임스탬프): {CDC_KEY_COLUMN}

컬럼 목록:
{COLUMN_LIST}

Elasticsearch:
- 인덱스명: {ES_INDEX}

요청사항:
1. specs/{table_name}.yaml 생성
2. npm run generate -- {table_name} 실행
3. 테스트 실행하여 검증
4. 결과 요약
```

---

## 예시

```
새 CDC 테이블을 추가해주세요.

테이블 정보:
- 테이블명: CUSTOMERS
- 스키마: CDC_TEST
- Primary Key: CUSTOMER_ID
- CDC Key (타임스탬프): LAST_MODIFIED

컬럼 목록:
- CUSTOMER_ID (NUMBER, NOT NULL)
- NAME (VARCHAR2(200), NOT NULL)
- EMAIL (VARCHAR2(100))
- PHONE (VARCHAR2(20))
- STATUS (VARCHAR2(20))
- CREATED_AT (TIMESTAMP)
- LAST_MODIFIED (TIMESTAMP, NOT NULL)

Elasticsearch:
- 인덱스명: customers

요청사항:
1. specs/customers.yaml 생성
2. npm run generate -- customers 실행
3. 테스트 실행하여 검증
4. 결과 요약
```

---

## 예상 산출물

1. `specs/{table_name}.yaml` - 테이블 스펙 파일
2. `sql-registry/oracle.json` 업데이트 - CDC SQL 쿼리 추가
3. `flows/oracle_cdc_flow.json` 업데이트 - LookupService에 SQL 추가
4. 테스트 통과 확인
