# 배포 프롬프트

## 사용법

CDC 파이프라인을 Kubernetes에 배포할 때 Claude Code에 전달합니다.

---

## 프롬프트 템플릿

```
CDC 파이프라인을 Kubernetes에 배포해주세요.

환경: {ENVIRONMENT}
네임스페이스: {NAMESPACE}

요청사항:
1. 배포 전 검증 (테스트 실행)
2. Kubernetes manifest 확인
3. 배포 명령어 제공
4. 배포 후 확인 방법 안내
```

---

## 배포 체크리스트

### 배포 전
- [ ] 모든 테스트 통과 (`npm test`)
- [ ] SQL Registry 검증
- [ ] Flow JSON 유효성 확인
- [ ] Kubernetes manifest 검토

### 배포 중
- [ ] 네임스페이스 생성/확인
- [ ] ConfigMap (SQL Registry) 적용
- [ ] Secret (Oracle 자격 증명) 적용
- [ ] NiFi Deployment 적용
- [ ] Service 적용

### 배포 후
- [ ] Pod 상태 확인
- [ ] NiFi UI 접속 확인
- [ ] Flow import 확인
- [ ] Controller Services 활성화
- [ ] CDC 동작 테스트

---

## 배포 명령어

```bash
# 1. 테스트 실행
npm test

# 2. 네임스페이스 생성
kubectl create namespace nificdc

# 3. 전체 배포
kubectl apply -f k8s/nifi.yaml

# 4. 배포 상태 확인
kubectl get pods -n nificdc -w

# 5. NiFi 로그 확인
kubectl logs -f deployment/nifi -n nificdc

# 6. NiFi UI 접속 (NodePort)
# http://<node-ip>:30080/nifi
```

---

## 배포 후 확인

```bash
# Pod 상태
kubectl get pods -n nificdc

# Service 상태
kubectl get svc -n nificdc

# PVC 상태
kubectl get pvc -n nificdc

# NiFi 로그
kubectl logs -f deployment/nifi -n nificdc

# NiFi UI 포트포워딩 (선택)
kubectl port-forward svc/nifi 8080:8080 -n nificdc
```

---

## Flow Import 방법

1. NiFi UI 접속 (http://localhost:8080/nifi)
2. Process Group 우클릭 → "Upload Template" 또는 "Import Flow"
3. `flows/oracle_cdc_flow.json` 업로드
4. Controller Services 활성화:
   - Oracle DBCP Connection Pool
   - SQL Registry Lookup Service
   - Elasticsearch Client Service
   - JSON Record Reader/Writer
5. Processor 시작
