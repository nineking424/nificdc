/**
 * Jest Test Setup
 * 테스트 환경 초기화 및 헬퍼 함수
 */

const path = require('path');
const fs = require('fs');

// Global test helpers
global.testHelpers = {
  /**
   * SQL Registry 로드
   */
  loadSqlRegistry: () => {
    const registryPath = path.join(__dirname, '../sql-registry/oracle.json');
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  },

  /**
   * Flow JSON 로드
   */
  loadFlowJson: (flowName = 'oracle_cdc_flow') => {
    const flowPath = path.join(__dirname, `../flows/${flowName}.json`);
    return JSON.parse(fs.readFileSync(flowPath, 'utf8'));
  },

  /**
   * Spec YAML 로드
   */
  loadSpec: (tableName) => {
    const yaml = require('js-yaml');
    const specPath = path.join(__dirname, `../specs/${tableName}.yaml`);
    return yaml.load(fs.readFileSync(specPath, 'utf8'));
  },

  /**
   * 타임스탬프 포맷 (Oracle)
   */
  formatTimestamp: (date) => {
    return date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
  },

  /**
   * 지정된 시간만큼 대기
   */
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Jest lifecycle hooks
beforeAll(() => {
  console.log('Test suite starting...');
});

afterAll(() => {
  console.log('Test suite completed.');
});

// Environment check
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}
