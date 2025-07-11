# NiFiCDC Git 브랜치 전략

## 브랜치 구조

### 주요 브랜치

1. **main** (또는 master)
   - 프로덕션 준비 완료 코드
   - 직접 커밋 금지, PR을 통해서만 머지
   - 항상 배포 가능한 상태 유지

2. **develop**
   - 개발 통합 브랜치
   - 다음 릴리스를 위한 기능들이 통합되는 브랜치
   - feature 브랜치들이 머지되는 대상

### 보조 브랜치

3. **feature/***
   - 새로운 기능 개발용 브랜치
   - develop 브랜치에서 분기
   - 명명 규칙: `feature/기능명` (예: `feature/user-authentication`)
   - 완료 후 develop에 머지

4. **release/***
   - 릴리스 준비 브랜치
   - develop에서 분기하여 main으로 머지
   - 명명 규칙: `release/버전` (예: `release/1.0.0`)
   - 버그 수정만 허용, 새 기능 추가 금지

5. **hotfix/***
   - 프로덕션 긴급 수정용
   - main에서 분기하여 main과 develop에 머지
   - 명명 규칙: `hotfix/이슈명` (예: `hotfix/critical-bug`)

## 워크플로우

### 기능 개발 플로우

```bash
# 1. develop에서 feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 2. 기능 개발 및 커밋
git add .
git commit -m "feat: 새로운 기능 구현"

# 3. develop 최신 상태 반영
git checkout develop
git pull origin develop
git checkout feature/new-feature
git merge develop

# 4. PR 생성 및 코드 리뷰 후 머지
```

### 릴리스 플로우

```bash
# 1. develop에서 release 브랜치 생성
git checkout develop
git checkout -b release/1.0.0

# 2. 버전 업데이트 및 마지막 테스트
# package.json, 문서 등 버전 정보 업데이트

# 3. main과 develop에 머지
git checkout main
git merge --no-ff release/1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"

git checkout develop
git merge --no-ff release/1.0.0
```

### 핫픽스 플로우

```bash
# 1. main에서 hotfix 브랜치 생성
git checkout main
git checkout -b hotfix/critical-bug

# 2. 버그 수정

# 3. main과 develop에 머지
git checkout main
git merge --no-ff hotfix/critical-bug
git tag -a v1.0.1 -m "Hotfix version 1.0.1"

git checkout develop
git merge --no-ff hotfix/critical-bug
```

## 커밋 메시지 규칙

### 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- **feat**: 새로운 기능 추가
- **fix**: 버그 수정
- **docs**: 문서 수정
- **style**: 코드 포맷팅, 세미콜론 누락 등
- **refactor**: 코드 리팩토링
- **test**: 테스트 추가/수정
- **chore**: 빌드 프로세스, 도구 설정 변경

### 예시

```
feat(auth): JWT 기반 사용자 인증 구현

- JWT 토큰 생성 및 검증 로직 추가
- 로그인/로그아웃 API 엔드포인트 구현
- 인증 미들웨어 작성

Closes #123
```

## 보호 규칙

### main 브랜치

- 직접 push 금지
- PR 필수
- 최소 1명 이상의 리뷰 승인 필요
- CI/CD 파이프라인 통과 필수

### develop 브랜치

- 직접 push 금지 (feature 브랜치 사용)
- PR 권장
- 자동 테스트 통과 필수

## 버전 관리

Semantic Versioning (SemVer) 사용:
- MAJOR.MINOR.PATCH (예: 1.2.3)
- MAJOR: 호환되지 않는 API 변경
- MINOR: 하위 호환 기능 추가
- PATCH: 하위 호환 버그 수정