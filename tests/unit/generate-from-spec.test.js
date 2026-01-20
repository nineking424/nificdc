/**
 * Generate From Spec Script Tests
 *
 * 테이블 추가 자동화 스크립트 검증
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPTS_DIR = path.join(__dirname, '../../scripts');
const SPECS_DIR = path.join(__dirname, '../../specs');
const SQL_REGISTRY_PATH = path.join(__dirname, '../../sql-registry/oracle.json');
const FLOW_PATH = path.join(__dirname, '../../flows/oracle_cdc_flow.json');

describe('Generate From Spec Script', () => {
  describe('Script Existence', () => {
    test('generate-from-spec.js should exist', () => {
      const scriptPath = path.join(SCRIPTS_DIR, 'generate-from-spec.js');
      expect(fs.existsSync(scriptPath)).toBe(true);
    });
  });

  describe('Spec Loading', () => {
    test('should load my_table.yaml spec', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      expect(spec.table).toBeDefined();
      expect(spec.table.name).toBe('MY_TABLE');
      expect(spec.range.options).toContain('5m');
    });
  });

  describe('SQL Generation Rules', () => {
    let spec;

    beforeAll(() => {
      spec = global.testHelpers.loadSpec('my_table');
    });

    test('generated SQL should contain ORDER BY cdc_key', () => {
      const sqlRegistry = global.testHelpers.loadSqlRegistry();
      const tableLower = spec.table.name.toLowerCase();

      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        if (sqlId.includes(tableLower)) {
          expect(entry.sql).toContain(`ORDER BY ${spec.table.cdc_key}`);
        }
      });
    });

    test('generated SQL should use range_from and range_to', () => {
      const sqlRegistry = global.testHelpers.loadSqlRegistry();
      const tableLower = spec.table.name.toLowerCase();

      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        if (sqlId.includes(tableLower)) {
          expect(entry.sql).toContain('${range_from}');
          expect(entry.sql).toContain('${range_to}');
        }
      });
    });

    test('sql_id should follow naming convention', () => {
      const sqlRegistry = global.testHelpers.loadSqlRegistry();
      const tableLower = spec.table.name.toLowerCase();

      spec.range.options.forEach(range => {
        const expectedSqlId = `oracle.cdc.${tableLower}.${range}`;
        expect(sqlRegistry[expectedSqlId]).toBeDefined();
      });
    });
  });

  describe('Flow LookupService Sync', () => {
    test('LookupService should have entries for all SQL Registry entries', () => {
      const sqlRegistry = global.testHelpers.loadSqlRegistry();
      const flow = global.testHelpers.loadFlowJson();

      const lookupService = flow.flowContents.controllerServices.find(
        s => s.identifier === 'sql-lookup-service'
      );

      Object.keys(sqlRegistry).forEach(sqlId => {
        expect(lookupService.properties[sqlId]).toBeDefined();
      });
    });

    test('LookupService SQL should match Registry SQL', () => {
      const sqlRegistry = global.testHelpers.loadSqlRegistry();
      const flow = global.testHelpers.loadFlowJson();

      const lookupService = flow.flowContents.controllerServices.find(
        s => s.identifier === 'sql-lookup-service'
      );

      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(lookupService.properties[sqlId]).toBe(entry.sql);
      });
    });
  });

  describe('Spec Required Fields', () => {
    test('spec should have table.name', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      expect(spec.table.name).toBeDefined();
      expect(spec.table.name.length).toBeGreaterThan(0);
    });

    test('spec should have table.schema', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      expect(spec.table.schema).toBeDefined();
    });

    test('spec should have table.primary_key', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      expect(spec.table.primary_key).toBeDefined();
    });

    test('spec should have table.cdc_key', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      expect(spec.table.cdc_key).toBeDefined();
    });

    test('spec should have range.options', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      expect(spec.range.options).toBeDefined();
      expect(Array.isArray(spec.range.options)).toBe(true);
      expect(spec.range.options.length).toBeGreaterThan(0);
    });

    test('spec should have elasticsearch config', () => {
      const spec = global.testHelpers.loadSpec('my_table');
      expect(spec.elasticsearch).toBeDefined();
      expect(spec.elasticsearch.index).toBeDefined();
      expect(spec.elasticsearch.id_field).toBeDefined();
    });
  });
});
