# 문제 해결 프롬프트

## 사용법

CDC 파이프라인에서 문제가 발생했을 때 Claude Code에 전달합니다.

---

## 프롬프트 템플릿

```
CDC 파이프라인에서 문제가 발생했습니다.

문제 유형: {ISSUE_TYPE}
테이블: {TABLE_NAME}
증상: {SYMPTOM}

로그/에러:
{ERROR_LOG}

요청사항:
1. 원인 분석
2. 해결 방안 제시
3. 수정 적용 (가능한 경우)
4. 테스트로 검증
```

---

## 일반적인 문제 유형

### 1. 데이터 중복
```
문제 유형: 데이터 중복
테이블: MY_TABLE
증상: Elasticsearch에 동일 ID 레코드가 여러 개 존재

요청사항:
1. PutElasticsearchRecord 설정 확인
2. ID Record Path 설정 검증
3. upsert 모드 확인
```

### 2. 데이터 누락
```
문제 유형: 데이터 누락
테이블: ORDERS
증상: Oracle에는 있지만 ES에 없는 레코드 발생

요청사항:
1. NiFi State 확인
2. SQL 쿼리 범위 검증
3. Maximum-value Columns 설정 확인
```

### 3. 테스트 실패
```
문제 유형: 테스트 실패
테이블: (전체)
증상: npm test 실행 시 실패

로그/에러:
{테스트 실패 로그}

요청사항:
1. 실패 원인 분석
2. 코드 수정
3. 테스트 재실행
```

### 4. SQL Registry 불일치
```
문제 유형: SQL Registry 불일치
테이블: {TABLE_NAME}
증상: Flow LookupService와 SQL Registry가 일치하지 않음

요청사항:
1. npm run generate:all 실행
2. 차이점 분석
3. 동기화 확인
```

---

## 디버깅 명령어

```bash
# 테스트 실행
npm test

# 특정 테스트만 실행
npm run test:unit
npm run test:contract

# SQL Registry 확인
cat sql-registry/oracle.json | jq

# Flow LookupService 확인
cat flows/oracle_cdc_flow.json | jq '.flowContents.controllerServices[] | select(.identifier == "sql-lookup-service")'

# 전체 재생성
npm run generate:all
```
