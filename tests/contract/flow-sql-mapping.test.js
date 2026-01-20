/**
 * Contract Tests: SQL ↔ Flow Mapping
 *
 * SQL Registry와 NiFi Flow 간의 매핑 정합성 검증
 */

const fs = require('fs');
const path = require('path');

describe('Flow-SQL Contract Tests', () => {
  let sqlRegistry;
  let flowJson;

  beforeAll(() => {
    sqlRegistry = global.testHelpers.loadSqlRegistry();
    flowJson = global.testHelpers.loadFlowJson();
  });

  describe('SQL Registry and Flow Consistency', () => {
    test('flow should reference valid sql_id from registry', () => {
      const updateAttributeProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'update-attribute-init'
      );

      const sqlId = updateAttributeProcessor.properties.sql_id;
      expect(sqlRegistry[sqlId]).toBeDefined();
    });

    test('lookup service should contain all sql_ids from registry', () => {
      const lookupService = flowJson.flowContents.controllerServices.find(
        s => s.identifier === 'sql-lookup-service'
      );

      Object.keys(sqlRegistry).forEach(sqlId => {
        expect(lookupService.properties[sqlId]).toBeDefined();
      });
    });

    test('lookup service SQL should match registry SQL', () => {
      const lookupService = flowJson.flowContents.controllerServices.find(
        s => s.identifier === 'sql-lookup-service'
      );

      Object.entries(sqlRegistry).forEach(([sqlId, entry]) => {
        expect(lookupService.properties[sqlId]).toBe(entry.sql);
      });
    });
  });

  describe('Flow Processor Chain', () => {
    test('should have correct processor sequence', () => {
      const expectedSequence = [
        'generate-flowfile',
        'update-attribute-init',
        'lookup-attribute',
        'update-attribute-range',
        'query-database-table-record',
        'put-elasticsearch-record'
      ];

      const processors = flowJson.flowContents.processors;
      expectedSequence.forEach(id => {
        const processor = processors.find(p => p.identifier === id);
        expect(processor).toBeDefined();
      });
    });

    test('connections should link processors correctly', () => {
      const connections = flowJson.flowContents.connections;

      // GenerateFlowFile -> UpdateAttribute (Init)
      const connGenToInit = connections.find(c => c.identifier === 'conn-generate-to-init');
      expect(connGenToInit.source.id).toBe('generate-flowfile');
      expect(connGenToInit.destination.id).toBe('update-attribute-init');

      // UpdateAttribute (Init) -> LookupAttribute
      const connInitToLookup = connections.find(c => c.identifier === 'conn-init-to-lookup');
      expect(connInitToLookup.source.id).toBe('update-attribute-init');
      expect(connInitToLookup.destination.id).toBe('lookup-attribute');

      // LookupAttribute -> UpdateAttribute (Range)
      const connLookupToRange = connections.find(c => c.identifier === 'conn-lookup-to-range');
      expect(connLookupToRange.source.id).toBe('lookup-attribute');
      expect(connLookupToRange.destination.id).toBe('update-attribute-range');

      // UpdateAttribute (Range) -> QueryDatabaseTableRecord
      const connRangeToQuery = connections.find(c => c.identifier === 'conn-range-to-query');
      expect(connRangeToQuery.source.id).toBe('update-attribute-range');
      expect(connRangeToQuery.destination.id).toBe('query-database-table-record');

      // QueryDatabaseTableRecord -> PutElasticsearchRecord
      const connQueryToEs = connections.find(c => c.identifier === 'conn-query-to-es');
      expect(connQueryToEs.source.id).toBe('query-database-table-record');
      expect(connQueryToEs.destination.id).toBe('put-elasticsearch-record');
    });
  });

  describe('Controller Services', () => {
    test('should have Oracle DBCP connection pool', () => {
      const dbcp = flowJson.flowContents.controllerServices.find(
        s => s.identifier === 'oracle-dbcp'
      );
      expect(dbcp).toBeDefined();
      expect(dbcp.properties['Database Driver Class Name']).toBe('oracle.jdbc.OracleDriver');
    });

    test('should have Elasticsearch client service', () => {
      const esClient = flowJson.flowContents.controllerServices.find(
        s => s.identifier === 'elasticsearch-client'
      );
      expect(esClient).toBeDefined();
      expect(esClient.properties['HTTP Hosts']).toContain('elasticsearch');
    });

    test('should have JSON record writer and reader', () => {
      const writer = flowJson.flowContents.controllerServices.find(
        s => s.identifier === 'json-record-writer'
      );
      const reader = flowJson.flowContents.controllerServices.find(
        s => s.identifier === 'json-record-reader'
      );
      expect(writer).toBeDefined();
      expect(reader).toBeDefined();
    });
  });

  describe('CDC Configuration', () => {
    test('QueryDatabaseTableRecord should use Maximum-value Columns', () => {
      const queryProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'query-database-table-record'
      );
      expect(queryProcessor.properties['Maximum-value Columns']).toBe('UPDATED_AT');
    });

    test('PutElasticsearchRecord should use upsert operation', () => {
      const esProcessor = flowJson.flowContents.processors.find(
        p => p.identifier === 'put-elasticsearch-record'
      );
      expect(esProcessor.properties['Index Operation']).toBe('upsert');
    });
  });
});
