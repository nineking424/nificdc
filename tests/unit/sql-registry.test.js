/**
 * SQL Registry Unit Tests
 *
 * CDC 규칙 검증:
 * - ORDER BY CDC_KEY 필수
 * - max_value_column 존재 필수
 * - sql_id 형식: oracle.cdc.<table>.<range>
 * - range_from, range_to 변수 사용
 */

const fs = require('fs');
const path = require('path');

describe('SQL Registry Validation', () => {
  let sqlRegistry;

  beforeAll(() => {
    const registryPath = path.join(__dirname, '../../sql-registry/oracle.json');
    const content = fs.readFileSync(registryPath, 'utf8');
    sqlRegistry = JSON.parse(content);
  });

  describe('SQL ID Format', () => {
    test('should have sql_id in format: oracle.cdc.<table>.<range>', () => {
      const sqlIdPattern = /^oracle\.cdc\.[a-z_]+\.[0-9]+m$/;

      Object.keys(sqlRegistry).forEach(sqlId => {
        expect(sqlId).toMatch(sqlIdPattern);
      });
    });

    test('should have at least one SQL entry', () => {
      expect(Object.keys(sqlRegistry).length).toBeGreaterThan(0);
    });
  });

  describe('SQL Query Rules', () => {
    test('should contain ORDER BY clause', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        const hasOrderBy = entry.sql.toUpperCase().includes('ORDER BY');
        expect(hasOrderBy).toBe(true);
      });
    });

    test('should ORDER BY the max_value_column', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        const maxValueColumn = entry.max_value_column;
        const orderByRegex = new RegExp(`ORDER BY\\s+${maxValueColumn}`, 'i');
        expect(entry.sql).toMatch(orderByRegex);
      });
    });

    test('should use ${range_from} variable', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(entry.sql).toContain('${range_from}');
      });
    });

    test('should use ${range_to} variable', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(entry.sql).toContain('${range_to}');
      });
    });
  });

  describe('Required Fields', () => {
    test('should have max_value_column', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(entry.max_value_column).toBeDefined();
        expect(entry.max_value_column.length).toBeGreaterThan(0);
      });
    });

    test('should have table name', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(entry.table).toBeDefined();
        expect(entry.table.length).toBeGreaterThan(0);
      });
    });

    test('should have range', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(entry.range).toBeDefined();
        expect(entry.range).toMatch(/^[0-9]+m$/);
      });
    });

    test('should have sql', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(entry.sql).toBeDefined();
        expect(entry.sql.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SQL ID and Entry Consistency', () => {
    test('sql_id table should match entry table', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        const parts = sqlId.split('.');
        const tableFromId = parts[2].toUpperCase();
        expect(entry.table.toUpperCase()).toBe(tableFromId);
      });
    });

    test('sql_id range should match entry range', () => {
      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        const parts = sqlId.split('.');
        const rangeFromId = parts[3];
        expect(entry.range).toBe(rangeFromId);
      });
    });
  });
});
