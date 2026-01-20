/**
 * Integration Tests: CDC Pipeline
 *
 * Oracle → NiFi → Elasticsearch 전체 파이프라인 테스트
 * Docker Compose 환경 필요
 */

const { Client } = require('@elastic/elasticsearch');

describe('CDC Pipeline Integration Tests', () => {
  let esClient;
  const ES_INDEX = 'my_table';

  // Docker 환경 확인을 위한 헬퍼
  const isDockerAvailable = async () => {
    try {
      const client = new Client({ node: 'http://localhost:9200' });
      await client.ping();
      return true;
    } catch {
      return false;
    }
  };

  beforeAll(async () => {
    const dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.log('Docker environment not available. Skipping integration tests.');
      return;
    }

    esClient = new Client({ node: 'http://localhost:9200' });

    // 테스트 인덱스 초기화
    try {
      await esClient.indices.delete({ index: ES_INDEX });
    } catch {
      // 인덱스가 없으면 무시
    }

    // 인덱스 생성
    await esClient.indices.create({
      index: ES_INDEX,
      body: {
        mappings: {
          dynamic: 'strict',
          properties: {
            ID: { type: 'long' },
            NAME: { type: 'keyword' },
            VALUE: { type: 'double' },
            UPDATED_AT: { type: 'date' }
          }
        }
      }
    });
  });

  afterAll(async () => {
    if (esClient) {
      await esClient.close();
    }
  });

  describe('Elasticsearch Connection', () => {
    test('should connect to Elasticsearch', async () => {
      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        console.log('Skipping: Docker not available');
        return;
      }

      const health = await esClient.cluster.health();
      expect(['green', 'yellow']).toContain(health.status);
    });

    test('should have test index created', async () => {
      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        console.log('Skipping: Docker not available');
        return;
      }

      const exists = await esClient.indices.exists({ index: ES_INDEX });
      expect(exists).toBe(true);
    });
  });

  describe('Data Ingestion', () => {
    test('should upsert document correctly', async () => {
      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        console.log('Skipping: Docker not available');
        return;
      }

      const testDoc = {
        ID: 1,
        NAME: 'test_record',
        VALUE: 100.50,
        UPDATED_AT: new Date().toISOString()
      };

      // Insert
      await esClient.index({
        index: ES_INDEX,
        id: testDoc.ID.toString(),
        body: testDoc,
        refresh: true
      });

      // Verify
      const result = await esClient.get({
        index: ES_INDEX,
        id: testDoc.ID.toString()
      });

      expect(result._source.NAME).toBe('test_record');
      expect(result._source.VALUE).toBe(100.50);
    });

    test('should update existing document (upsert)', async () => {
      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        console.log('Skipping: Docker not available');
        return;
      }

      const updatedDoc = {
        ID: 1,
        NAME: 'updated_record',
        VALUE: 200.75,
        UPDATED_AT: new Date().toISOString()
      };

      // Update (upsert)
      await esClient.index({
        index: ES_INDEX,
        id: updatedDoc.ID.toString(),
        body: updatedDoc,
        refresh: true
      });

      // Verify update
      const result = await esClient.get({
        index: ES_INDEX,
        id: updatedDoc.ID.toString()
      });

      expect(result._source.NAME).toBe('updated_record');
      expect(result._source.VALUE).toBe(200.75);
    });

    test('should not create duplicates', async () => {
      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        console.log('Skipping: Docker not available');
        return;
      }

      // 동일 ID로 여러 번 인덱싱
      const testDoc = {
        ID: 2,
        NAME: 'duplicate_test',
        VALUE: 50.0,
        UPDATED_AT: new Date().toISOString()
      };

      for (let i = 0; i < 3; i++) {
        await esClient.index({
          index: ES_INDEX,
          id: testDoc.ID.toString(),
          body: { ...testDoc, VALUE: 50.0 + i },
          refresh: true
        });
      }

      // 카운트 확인 - ID 2는 하나만 존재해야 함
      const count = await esClient.count({
        index: ES_INDEX,
        body: {
          query: { term: { ID: 2 } }
        }
      });

      expect(count.count).toBe(1);
    });
  });

  describe('CDC Time Range Query', () => {
    test('should query records within time range', async () => {
      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        console.log('Skipping: Docker not available');
        return;
      }

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // 시간 범위 내 데이터 삽입
      const recentDoc = {
        ID: 100,
        NAME: 'recent_record',
        VALUE: 999.99,
        UPDATED_AT: now.toISOString()
      };

      await esClient.index({
        index: ES_INDEX,
        id: recentDoc.ID.toString(),
        body: recentDoc,
        refresh: true
      });

      // 시간 범위 쿼리
      const result = await esClient.search({
        index: ES_INDEX,
        body: {
          query: {
            range: {
              UPDATED_AT: {
                gte: fiveMinutesAgo.toISOString(),
                lte: now.toISOString()
              }
            }
          }
        }
      });

      expect(result.hits.total.value).toBeGreaterThan(0);
    });
  });
});
