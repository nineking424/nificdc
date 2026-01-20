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

## 산출물 생성 원칙

- NiFi Flow는 JSON으로 직접 생성 (UI 수동 생성 금지)
- 테이블 추가 시 `specs/<table>.yaml`만 작성
- 모든 산출물은 Git 기반 관리
