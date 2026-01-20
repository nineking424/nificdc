# CDC 검증 프롬프트

## 사용법

이 프롬프트를 Claude Code에 전달하여 CDC 파이프라인의 정합성을 검증합니다.

---

## 프롬프트 템플릿

```
CDC 파이프라인을 검증해주세요.

검증 대상:
- [ ] SQL Registry 규칙 준수
- [ ] Flow ↔ SQL 매핑 일치
- [ ] 테스트 통과 여부

요청사항:
1. npm test 실행
2. 실패 항목 분석
3. 수정 필요 사항 리포트
```

---

## 검증 체크리스트

### SQL Registry 규칙
- [ ] ORDER BY CDC_KEY 존재
- [ ] max_value_column 정의됨
- [ ] ${range_from}, ${range_to} 사용
- [ ] sql_id 네이밍 규칙 준수 (oracle.cdc.<table>.<range>)

### Flow 규칙
- [ ] LookupService에 모든 sql_id 존재
- [ ] LookupService SQL과 Registry SQL 일치
- [ ] QueryDatabaseTableRecord Maximum-value Columns 설정
- [ ] PutElasticsearchRecord upsert 모드

### Spec ↔ Registry 일치
- [ ] 모든 spec의 range.options에 대한 sql_id 존재
- [ ] max_value_column = spec.table.cdc_key
- [ ] registry.table = spec.table.name

---

## 예상 출력

```
## CDC 검증 리포트

### 테스트 결과
- Total: 52 tests
- Passed: 52
- Failed: 0

### SQL Registry 검증
✅ ORDER BY 규칙 준수
✅ max_value_column 정의됨
✅ range 변수 사용

### Flow 검증
✅ LookupService 동기화됨
✅ upsert 모드 설정됨

### 결론
CDC 파이프라인이 모든 규칙을 준수합니다.
```
