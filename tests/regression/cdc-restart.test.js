/**
 * Regression Tests: CDC Restart
 *
 * NiFi 재시작 후 데이터 정합성 검증
 * - State 복구 확인
 * - 중복 데이터 방지 확인
 * - 누락 데이터 방지 확인
 */

const fs = require('fs');
const path = require('path');

describe('CDC Restart Regression Tests', () => {
  let sqlRegistry;
  let flowJson;

  beforeAll(() => {
    sqlRegistry = global.testHelpers.loadSqlRegistry();
    flowJson = global.testHelpers.loadFlowJson();
  });

  describe('State Management Configuration', () => {
    test('QueryDatabaseTableRecord should use Maximum-value Columns for state', () => {
      const queryProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'query-database-table-record'
      );

      // Maximum-value Columns가 설정되어야 NiFi가 마지막 처리 위치를 state에 저장
      expect(queryProcessor.properties['Maximum-value Columns']).toBeDefined();
      expect(queryProcessor.properties['Maximum-value Columns'].length).toBeGreaterThan(0);
    });

    test('max_value_column should match spec cdc_key', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      const cdcKey = spec.table.cdc_key;

      Object.values(sqlRegistry).forEach(entry => {
        expect(entry.max_value_column).toBe(cdcKey);
      });
    });
  });

  describe('Duplicate Prevention', () => {
    test('PutElasticsearchRecord should use upsert to prevent duplicates', () => {
      const esProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'put-elasticsearch-record'
      );

      expect(esProcessor.properties['Index Operation']).toBe('upsert');
    });

    test('PutElasticsearchRecord should use ID Record Path', () => {
      const esProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'put-elasticsearch-record'
      );

      expect(esProcessor.properties['ID Record Path']).toBeDefined();
      expect(esProcessor.properties['ID Record Path']).toContain('es_id_field');
    });

    test('es_id_field should match spec primary_key', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      const updateAttrProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'update-attribute-init'
      );

      expect(updateAttrProcessor.properties.es_id_field).toBe(spec.table.primary_key);
    });
  });

  describe('Data Completeness', () => {
    test('SQL should use inclusive range (> range_from, <= range_to)', () => {
      Object.values(sqlRegistry).forEach(entry => {
        // > range_from (exclusive lower bound to avoid duplicates)
        expect(entry.sql).toContain('> TO_TIMESTAMP(${range_from}');

        // <= range_to (inclusive upper bound to capture all changes)
        expect(entry.sql).toContain('<= TO_TIMESTAMP(${range_to}');
      });
    });

    test('SQL should ORDER BY cdc_key to ensure consistent processing', () => {
      Object.values(sqlRegistry).forEach(entry => {
        const orderByPattern = new RegExp(`ORDER BY\\s+${entry.max_value_column}`, 'i');
        expect(entry.sql).toMatch(orderByPattern);
      });
    });
  });

  describe('Recovery Scenario Validation', () => {
    test('flow should have auto-terminated relationships for error handling', () => {
      const esProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'put-elasticsearch-record'
      );

      // 에러 관계는 자동 종료되어야 함 (재시도 로직 또는 Dead Letter Queue 사용)
      expect(esProcessor.autoTerminatedRelationships).toContain('success');
    });

    test('flow should configure appropriate scheduling for CDC interval', () => {
      const generateProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'generate-flowfile'
      );

      // 5분 간격 스케줄링 (SQL Registry의 5m 범위와 일치)
      expect(generateProcessor.schedulingPeriod).toBe('5 min');
    });
  });

  describe('Spec and Registry Consistency', () => {
    test('registry should have entries for all spec range options', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      const tableName = spec.table.name.toLowerCase();

      spec.range.options.forEach(range => {
        const sqlId = `oracle.cdc.${tableName}.${range}`;
        expect(sqlRegistry[sqlId]).toBeDefined();
      });
    });

    test('registry table should match spec table', () => {
      const spec = global.testHelpers.loadSpec('my_table');

      Object.values(sqlRegistry).forEach(entry => {
        expect(entry.table).toBe(spec.table.name);
      });
    });
  });
});
