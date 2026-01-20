/**
 * E2E Pipeline Tests
 * Oracle → NiFi → Elasticsearch 전체 파이프라인 테스트
 *
 * 거짓 양성(False Positive) 방지 원칙:
 * 1. try-catch로 테스트 스킵 금지 - 예외 발생 시 테스트 실패
 * 2. 명시적 스킵만 허용 - test.skip() 또는 describe.skip()
 * 3. 환경 검증 선행 - beforeAll에서 환경 확인
 * 4. 모든 테스트에 assertion 필수
 * 5. 조건부 return 금지 - if (!ready) return 사용하지 않음
 */

const { Client } = require('@elastic/elasticsearch');

// 테스트 설정
const CONFIG = {
  elasticsearch: {
    node: process.env.ES_HOST || 'http://localhost:9200',
    index: 'my_table',
  },
  oracle: {
    user: 'cdc_user',
    password: 'cdc_password',
    connectString: process.env.ORACLE_HOST || 'localhost:1521/XE',
  },
  nifi: {
    host: process.env.NIFI_HOST || 'localhost',
    port: process.env.NIFI_PORT || '8080',
  },
  timeout: {
    cdc: 60000,
  },
};

// 환경 상태 플래그 (beforeAll에서 설정)
const ENV_STATUS = {
  elasticsearch: false,
  nifi: false,
  oracle: false,
  nifiFlowDeployed: false,
};

// Elasticsearch 클라이언트
let esClient;

// 유틸리티 함수
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 환경 검증 함수들 - 실패 시 예외 발생
 */
const checkElasticsearch = async () => {
  const client = new Client({ node: CONFIG.elasticsearch.node });
  const health = await client.cluster.health();
  if (health.status !== 'green' && health.status !== 'yellow') {
    throw new Error(`Elasticsearch unhealthy: ${health.status}`);
  }
  return client;
};

const checkNiFi = async () => {
  const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/system-diagnostics`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NiFi not accessible: ${response.status}`);
  }
  return true;
};

const checkOracle = async () => {
  let oracledb;
  try {
    oracledb = require('oracledb');
  } catch (e) {
    throw new Error('oracledb module not installed');
  }

  const connection = await oracledb.getConnection({
    user: CONFIG.oracle.user,
    password: CONFIG.oracle.password,
    connectString: CONFIG.oracle.connectString,
  });
  await connection.close();
  return true;
};

const checkNiFiFlow = async () => {
  const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/flow/process-groups/root/status`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NiFi flow status not accessible: ${response.status}`);
  }
  const data = await response.json();
  const processorCount =
    data.processGroupStatus?.aggregateSnapshot?.runningCount +
    data.processGroupStatus?.aggregateSnapshot?.stoppedCount;

  if (processorCount === 0) {
    throw new Error('NiFi flow not deployed: 0 processors found');
  }
  return true;
};

/**
 * Oracle SQL 실행 - 실패 시 예외 발생 (catch 없음)
 */
const executeOracleSQL = async (sql) => {
  const oracledb = require('oracledb');
  const connection = await oracledb.getConnection({
    user: CONFIG.oracle.user,
    password: CONFIG.oracle.password,
    connectString: CONFIG.oracle.connectString,
  });

  try {
    const result = await connection.execute(sql, [], { autoCommit: true });
    return result;
  } finally {
    await connection.close();
  }
};

/**
 * NiFi Flow 제어
 */
const controlNiFiFlow = async (state) => {
  const baseUrl = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api`;
  const pgResponse = await fetch(`${baseUrl}/flow/process-groups/root`);
  if (!pgResponse.ok) {
    throw new Error('Failed to get NiFi root process group');
  }
  const pgData = await pgResponse.json();
  const rootPgId = pgData.processGroupFlow.id;

  const response = await fetch(`${baseUrl}/flow/process-groups/${rootPgId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: rootPgId, state }),
  });

  if (!response.ok) {
    throw new Error(`Failed to ${state} NiFi flow: ${response.status}`);
  }
  return true;
};

// ============================================================
// 테스트 스위트
// ============================================================

describe('E2E Pipeline Tests', () => {
  /**
   * 환경 검증 - 각 컴포넌트 가용성 확인
   * 실패한 컴포넌트의 테스트는 명시적으로 스킵됨
   */
  beforeAll(async () => {
    console.log('\n=== Environment Check ===');

    // Elasticsearch 확인
    try {
      esClient = await checkElasticsearch();
      ENV_STATUS.elasticsearch = true;
      console.log('✓ Elasticsearch: available');
    } catch (e) {
      console.log(`✗ Elasticsearch: ${e.message}`);
    }

    // NiFi 확인
    try {
      await checkNiFi();
      ENV_STATUS.nifi = true;
      console.log('✓ NiFi: available');
    } catch (e) {
      console.log(`✗ NiFi: ${e.message}`);
    }

    // Oracle 확인
    try {
      await checkOracle();
      ENV_STATUS.oracle = true;
      console.log('✓ Oracle: available');
    } catch (e) {
      console.log(`✗ Oracle: ${e.message}`);
    }

    // NiFi Flow 확인
    if (ENV_STATUS.nifi) {
      try {
        await checkNiFiFlow();
        ENV_STATUS.nifiFlowDeployed = true;
        console.log('✓ NiFi Flow: deployed');
      } catch (e) {
        console.log(`✗ NiFi Flow: ${e.message}`);
      }
    }

    console.log('=========================\n');
  }, 30000);

  afterAll(async () => {
    if (esClient) {
      await esClient.close();
    }
  });

  // --------------------------------------------------------
  // Infrastructure Tests
  // --------------------------------------------------------
  describe('Infrastructure', () => {
    test('Elasticsearch should be running and healthy', async () => {
      if (!ENV_STATUS.elasticsearch) {
        throw new Error('Elasticsearch is not available');
      }

      const health = await esClient.cluster.health();
      expect(['green', 'yellow']).toContain(health.status);
    });

    test('NiFi should be accessible', async () => {
      if (!ENV_STATUS.nifi) {
        throw new Error('NiFi is not available');
      }

      const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/system-diagnostics`;
      const response = await fetch(url);
      expect(response.ok).toBe(true);
    });

    test('Oracle should be accessible', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const result = await executeOracleSQL('SELECT 1 FROM DUAL');
      expect(result.rows).toHaveLength(1);
    });

    test('NiFi Flow should be deployed', async () => {
      if (!ENV_STATUS.nifiFlowDeployed) {
        throw new Error('NiFi Flow is not deployed');
      }

      const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/flow/process-groups/root/status`;
      const response = await fetch(url);
      const data = await response.json();
      const processorCount =
        data.processGroupStatus?.aggregateSnapshot?.runningCount +
        data.processGroupStatus?.aggregateSnapshot?.stoppedCount;

      expect(processorCount).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------
  // CDC Pipeline Tests - 모든 환경 필요
  // --------------------------------------------------------
  describe('CDC Pipeline', () => {
    // 모든 환경이 준비되어야 실행
    const allEnvironmentsReady = () =>
      ENV_STATUS.elasticsearch &&
      ENV_STATUS.nifi &&
      ENV_STATUS.oracle &&
      ENV_STATUS.nifiFlowDeployed;

    beforeAll(async () => {
      if (!allEnvironmentsReady()) {
        console.log('⚠ CDC Pipeline tests require all environments');
        return;
      }

      // 테스트 전 인덱스 정리
      try {
        await esClient.indices.delete({ index: CONFIG.elasticsearch.index });
      } catch (e) {
        // 인덱스가 없으면 무시
      }
    });

    afterAll(async () => {
      if (allEnvironmentsReady()) {
        try {
          await controlNiFiFlow('STOPPED');
        } catch (e) {
          // 무시
        }
      }
    });

    test('should have initial data in Oracle', async () => {
      if (!allEnvironmentsReady()) {
        throw new Error(
          'Test skipped: requires Oracle, NiFi, Elasticsearch, and deployed Flow'
        );
      }

      const result = await executeOracleSQL(
        'SELECT COUNT(*) AS cnt FROM CDC_TEST.MY_TABLE'
      );
      expect(result.rows[0][0]).toBeGreaterThanOrEqual(3);
    });

    test('should start NiFi CDC flow', async () => {
      if (!allEnvironmentsReady()) {
        throw new Error(
          'Test skipped: requires Oracle, NiFi, Elasticsearch, and deployed Flow'
        );
      }

      await controlNiFiFlow('RUNNING');

      // Flow 상태 확인
      const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/flow/process-groups/root/status`;
      const response = await fetch(url);
      const data = await response.json();

      expect(data.processGroupStatus.aggregateSnapshot.runningCount).toBeGreaterThan(0);
    });

    test('should replicate data to Elasticsearch', async () => {
      if (!allEnvironmentsReady()) {
        throw new Error(
          'Test skipped: requires Oracle, NiFi, Elasticsearch, and deployed Flow'
        );
      }

      // CDC 처리 대기 (최대 30초)
      let count = 0;
      for (let i = 0; i < 10; i++) {
        await sleep(3000);

        try {
          const exists = await esClient.indices.exists({
            index: CONFIG.elasticsearch.index,
          });

          if (exists) {
            await esClient.indices.refresh({ index: CONFIG.elasticsearch.index });
            const result = await esClient.count({ index: CONFIG.elasticsearch.index });
            count = result.count;
            if (count >= 3) break;
          }
        } catch (e) {
          // 인덱스가 아직 없음
        }
      }

      expect(count).toBeGreaterThanOrEqual(3);
    }, CONFIG.timeout.cdc);

    test('should have correct document structure', async () => {
      if (!allEnvironmentsReady()) {
        throw new Error(
          'Test skipped: requires Oracle, NiFi, Elasticsearch, and deployed Flow'
        );
      }

      const result = await esClient.search({
        index: CONFIG.elasticsearch.index,
        size: 1,
      });

      expect(result.hits.hits.length).toBeGreaterThan(0);

      const doc = result.hits.hits[0]._source;
      expect(doc).toHaveProperty('ID');
      expect(doc).toHaveProperty('NAME');
      expect(doc).toHaveProperty('VALUE');
      expect(doc).toHaveProperty('UPDATED_AT');
    });

    test('should upsert updated records without duplicates', async () => {
      if (!allEnvironmentsReady()) {
        throw new Error(
          'Test skipped: requires Oracle, NiFi, Elasticsearch, and deployed Flow'
        );
      }

      // Oracle에서 데이터 업데이트
      await executeOracleSQL(`
        UPDATE CDC_TEST.MY_TABLE
        SET NAME = 'Updated Record 1', VALUE = 999.99, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = 1
      `);

      // CDC 처리 대기
      await sleep(15000);

      // Elasticsearch 확인
      await esClient.indices.refresh({ index: CONFIG.elasticsearch.index });

      // ID=1 레코드 검색
      const result = await esClient.search({
        index: CONFIG.elasticsearch.index,
        query: { term: { ID: 1 } },
      });

      // 정확히 1개만 존재해야 함 (upsert)
      expect(result.hits.hits.length).toBe(1);

      // 업데이트된 값 확인
      const doc = result.hits.hits[0]._source;
      expect(doc.NAME).toBe('Updated Record 1');
      expect(doc.VALUE).toBe(999.99);
    }, CONFIG.timeout.cdc);

    test('should capture new inserts', async () => {
      if (!allEnvironmentsReady()) {
        throw new Error(
          'Test skipped: requires Oracle, NiFi, Elasticsearch, and deployed Flow'
        );
      }

      // 새 레코드 삽입
      const newId = 1000 + Math.floor(Math.random() * 1000);
      await executeOracleSQL(`
        INSERT INTO CDC_TEST.MY_TABLE (ID, NAME, VALUE, UPDATED_AT)
        VALUES (${newId}, 'E2E Test Record', 12345.67, CURRENT_TIMESTAMP)
      `);

      // CDC 처리 대기
      await sleep(15000);

      // Elasticsearch 확인
      await esClient.indices.refresh({ index: CONFIG.elasticsearch.index });

      const result = await esClient.search({
        index: CONFIG.elasticsearch.index,
        query: { term: { ID: newId } },
      });

      expect(result.hits.hits.length).toBe(1);
      expect(result.hits.hits[0]._source.NAME).toBe('E2E Test Record');
    }, CONFIG.timeout.cdc);

    test('should maintain data integrity (no duplicates)', async () => {
      if (!allEnvironmentsReady()) {
        throw new Error(
          'Test skipped: requires Oracle, NiFi, Elasticsearch, and deployed Flow'
        );
      }

      // 전체 문서 수
      const countResult = await esClient.count({
        index: CONFIG.elasticsearch.index,
      });

      // 고유 ID 수
      const aggResult = await esClient.search({
        index: CONFIG.elasticsearch.index,
        size: 0,
        aggs: {
          unique_ids: {
            cardinality: { field: 'ID' },
          },
        },
      });

      const totalCount = countResult.count;
      const uniqueCount = aggResult.aggregations.unique_ids.value;

      // 총 문서 수 = 고유 ID 수 (중복 없음)
      expect(totalCount).toBe(uniqueCount);
    });
  });
});
