// Jest 테스트 설정 파일
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.LOG_LEVEL = 'error'; // 테스트 중 로그 출력 최소화

// 테스트 전역 설정
beforeAll(async () => {
  // 테스트 데이터베이스 연결 등 전역 설정
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // 테스트 후 정리
  console.log('Cleaning up test environment...');
});

// 테스트 간 상태 초기화
beforeEach(() => {
  // 각 테스트 전 상태 초기화
});

afterEach(() => {
  // 각 테스트 후 정리
});