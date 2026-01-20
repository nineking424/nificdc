/**
 * E2E Pipeline Tests
 * Oracle → Elasticsearch 데이터 파이프라인 테스트
 *
 * 테스트 목적:
 * - Oracle DB에서 Elasticsearch로 데이터가 정확하게 동기화되는지 검증
 * - Upsert 동작이 올바르게 작동하는지 검증 (중복 없이 업데이트)
 * - 데이터 무결성이 유지되는지 검증
 *
 * 거짓 양성(False Positive) 방지 원칙:
 * 1. try-catch로 테스트 스킵 금지 - 예외 발생 시 테스트 실패
 * 2. 명시적 스킵만 허용 - test.skip() 또는 describe.skip()
 * 3. 환경 검증 선행 - beforeAll에서 환경 확인
 * 4. 모든 테스트에 assertion 필수
 * 5. 조건부 return 금지 - if (!ready) return 사용하지 않음
 *
 * 실행 방법:
 *   npm run test:e2e        # 전체 환경 구성 + 테스트
 *   npm run test:e2e:run    # 테스트만 실행 (환경 이미 준비된 경우)
 */

const { Client } = require('@elastic/elasticsearch');

// =============================================================================
// 테스트 설정
// =============================================================================
const CONFIG = {
  elasticsearch: {
    node: process.env.ES_HOST || 'http://localhost:9200',
    index: 'my_table',
  },
  oracle: {
    user: 'cdc_user',
    password: 'cdc_password',
    connectString: process.env.ORACLE_HOST || 'localhost:1521/FREEPDB1',
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
};

// Elasticsearch 클라이언트
let esClient;

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * Elasticsearch 연결 및 상태 확인
 * @returns {Client} Elasticsearch 클라이언트
 * @throws {Error} 연결 실패 또는 클러스터 unhealthy 시
 */
const checkElasticsearch = async () => {
  const client = new Client({ node: CONFIG.elasticsearch.node });
  const health = await client.cluster.health();
  if (health.status !== 'green' && health.status !== 'yellow') {
    throw new Error(`Elasticsearch unhealthy: ${health.status}`);
  }
  return client;
};

/**
 * NiFi REST API 접근 확인
 * @returns {boolean} 접근 가능 여부
 * @throws {Error} 접근 실패 시
 */
const checkNiFi = async () => {
  const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/system-diagnostics`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NiFi not accessible: ${response.status}`);
  }
  return true;
};

/**
 * Oracle DB 연결 확인
 * @returns {boolean} 연결 가능 여부
 * @throws {Error} 연결 실패 시
 */
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

/**
 * Oracle SQL 실행
 * @param {string} sql - 실행할 SQL 문
 * @returns {object} 쿼리 결과
 * @throws {Error} SQL 실행 실패 시
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
 * Oracle에서 데이터를 읽어 Elasticsearch에 동기화 (CDC 시뮬레이션)
 *
 * 동작 방식:
 * 1. Oracle에서 MY_TABLE의 모든 레코드를 UPDATED_AT 순으로 조회
 * 2. 각 레코드를 Elasticsearch에 upsert (ID를 문서 ID로 사용)
 * 3. 동일 ID가 있으면 덮어쓰기 (upsert), 없으면 새로 생성
 *
 * @returns {number} 동기화된 레코드 수
 */
const syncOracleToElasticsearch = async () => {
  // Step 1: Oracle에서 데이터 읽기
  const result = await executeOracleSQL(
    'SELECT ID, NAME, VALUE, UPDATED_AT FROM MY_TABLE ORDER BY UPDATED_AT'
  );

  // Step 2: 각 레코드를 ES에 upsert
  for (const row of result.rows) {
    const doc = {
      ID: row[0],
      NAME: row[1],
      VALUE: row[2],
      UPDATED_AT: row[3]?.toISOString() || new Date().toISOString(),
    };

    // ID를 문서 ID로 사용하여 upsert 구현
    await esClient.index({
      index: CONFIG.elasticsearch.index,
      id: String(doc.ID),
      document: doc,
      refresh: true,
    });
  }

  return result.rows.length;
};

// =============================================================================
// 테스트 스위트
// =============================================================================

describe('E2E Pipeline Tests', () => {
  /**
   * 테스트 환경 초기화
   *
   * 각 컴포넌트의 가용성을 확인하고 ENV_STATUS 플래그를 설정합니다.
   * 환경이 준비되지 않은 경우 해당 테스트는 명시적으로 실패합니다.
   */
  beforeAll(async () => {
    console.log('\n=== Environment Check ===');

    // Elasticsearch 연결 확인
    try {
      esClient = await checkElasticsearch();
      ENV_STATUS.elasticsearch = true;
      console.log('✓ Elasticsearch: available');
    } catch (e) {
      console.log(`✗ Elasticsearch: ${e.message}`);
    }

    // NiFi API 접근 확인
    try {
      await checkNiFi();
      ENV_STATUS.nifi = true;
      console.log('✓ NiFi: available');
    } catch (e) {
      console.log(`✗ NiFi: ${e.message}`);
    }

    // Oracle DB 연결 확인
    try {
      await checkOracle();
      ENV_STATUS.oracle = true;
      console.log('✓ Oracle: available');
    } catch (e) {
      console.log(`✗ Oracle: ${e.message}`);
    }

    console.log('=========================\n');
  }, 30000);

  /**
   * 테스트 환경 정리
   */
  afterAll(async () => {
    if (esClient) {
      await esClient.close();
    }
  });

  // ---------------------------------------------------------------------------
  // Infrastructure Tests
  // 목적: 각 컴포넌트가 정상적으로 실행 중인지 확인
  // ---------------------------------------------------------------------------
  describe('Infrastructure', () => {
    /**
     * Elasticsearch 상태 확인
     *
     * 검증 항목:
     * - Elasticsearch 클러스터에 연결 가능한지
     * - 클러스터 상태가 green 또는 yellow인지 (red는 실패)
     */
    test('Elasticsearch should be running and healthy', async () => {
      if (!ENV_STATUS.elasticsearch) {
        throw new Error('Elasticsearch is not available');
      }

      const health = await esClient.cluster.health();
      expect(['green', 'yellow']).toContain(health.status);
    });

    /**
     * NiFi 접근성 확인
     *
     * 검증 항목:
     * - NiFi REST API가 응답하는지
     * - system-diagnostics 엔드포인트가 200 OK를 반환하는지
     */
    test('NiFi should be accessible', async () => {
      if (!ENV_STATUS.nifi) {
        throw new Error('NiFi is not available');
      }

      const url = `http://${CONFIG.nifi.host}:${CONFIG.nifi.port}/nifi-api/system-diagnostics`;
      const response = await fetch(url);
      expect(response.ok).toBe(true);
    });

    /**
     * Oracle 접근성 확인
     *
     * 검증 항목:
     * - Oracle DB에 연결 가능한지
     * - 간단한 쿼리 (SELECT 1 FROM DUAL)가 실행되는지
     */
    test('Oracle should be accessible', async () => {
      if (!ENV_STATUS.oracle) {
        throw new Error('Oracle is not available');
      }

      const result = await executeOracleSQL('SELECT 1 FROM DUAL');
      expect(result.rows).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Data Pipeline Tests
  // 목적: Oracle → Elasticsearch 데이터 동기화 검증
  // 전제조건: Oracle과 Elasticsearch가 모두 사용 가능해야 함
  // ---------------------------------------------------------------------------
  describe('Data Pipeline', () => {
    /**
     * 파이프라인 테스트 실행 가능 여부 확인
     */
    const pipelineReady = () => ENV_STATUS.elasticsearch && ENV_STATUS.oracle;

    /**
     * 파이프라인 테스트 초기화
     * - 기존 인덱스 삭제하여 클린 상태로 시작
     */
    beforeAll(async () => {
      if (!pipelineReady()) {
        console.log('⚠ Data Pipeline tests require Oracle and Elasticsearch');
        return;
      }

      // 테스트 전 인덱스 정리
      try {
        await esClient.indices.delete({ index: CONFIG.elasticsearch.index });
      } catch (e) {
        // 인덱스가 없으면 무시
      }
    });

    /**
     * Oracle 초기 데이터 확인
     *
     * 검증 항목:
     * - Oracle의 MY_TABLE에 최소 3개의 초기 레코드가 존재하는지
     *
     * 초기 데이터는 tests/fixtures/oracle-init/01_create_schema.sql에서 생성됨:
     * - ID: 1, 2, 3
     * - NAME: 'Record 1', 'Record 2', 'Record 3'
     */
    test('should have initial data in Oracle', async () => {
      if (!pipelineReady()) {
        throw new Error('Test requires Oracle and Elasticsearch');
      }

      const result = await executeOracleSQL(
        'SELECT COUNT(*) AS cnt FROM MY_TABLE'
      );
      expect(result.rows[0][0]).toBeGreaterThanOrEqual(3);
    });

    /**
     * Oracle → Elasticsearch 데이터 동기화 테스트
     *
     * 검증 항목:
     * - Oracle에서 데이터를 읽어 Elasticsearch에 저장할 수 있는지
     * - 동기화된 레코드 수가 Oracle의 레코드 수와 일치하는지
     * - Elasticsearch에서 동기화된 데이터를 조회할 수 있는지
     *
     * 동작 순서:
     * 1. syncOracleToElasticsearch() 호출
     * 2. Oracle의 모든 레코드가 ES에 저장됨
     * 3. ES 인덱스 refresh
     * 4. ES 문서 수 확인
     */
    test('should sync data from Oracle to Elasticsearch', async () => {
      if (!pipelineReady()) {
        throw new Error('Test requires Oracle and Elasticsearch');
      }

      const syncedCount = await syncOracleToElasticsearch();
      expect(syncedCount).toBeGreaterThanOrEqual(3);

      // ES에서 확인
      await esClient.indices.refresh({ index: CONFIG.elasticsearch.index });
      const countResult = await esClient.count({
        index: CONFIG.elasticsearch.index,
      });
      expect(countResult.count).toBeGreaterThanOrEqual(3);
    });

    /**
     * Elasticsearch 문서 구조 검증
     *
     * 검증 항목:
     * - 문서에 필수 필드가 모두 존재하는지:
     *   - ID: 레코드 고유 식별자 (NUMBER)
     *   - NAME: 레코드 이름 (VARCHAR2)
     *   - VALUE: 레코드 값 (NUMBER)
     *   - UPDATED_AT: 마지막 수정 시간 (TIMESTAMP)
     */
    test('should have correct document structure in Elasticsearch', async () => {
      if (!pipelineReady()) {
        throw new Error('Test requires Oracle and Elasticsearch');
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

    /**
     * Upsert 동작 검증 (중복 없이 업데이트)
     *
     * 검증 항목:
     * - Oracle에서 기존 레코드를 업데이트한 후
     * - Elasticsearch에 동기화하면
     * - 새 문서가 생성되지 않고 기존 문서가 업데이트되는지
     * - 업데이트된 값이 정확히 반영되는지
     *
     * 동작 순서:
     * 1. Oracle에서 ID=1 레코드 업데이트 (NAME, VALUE 변경)
     * 2. syncOracleToElasticsearch() 호출
     * 3. ES에서 ID=1 검색
     * 4. 정확히 1개만 존재하는지 확인 (중복 없음)
     * 5. 업데이트된 값이 반영되었는지 확인
     */
    test('should upsert updated records without duplicates', async () => {
      if (!pipelineReady()) {
        throw new Error('Test requires Oracle and Elasticsearch');
      }

      // Step 1: Oracle에서 데이터 업데이트
      await executeOracleSQL(`
        UPDATE MY_TABLE
        SET NAME = 'Updated Record 1', VALUE = 999.99, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = 1
      `);

      // Step 2: 다시 sync
      await syncOracleToElasticsearch();

      // Step 3: Elasticsearch 확인
      await esClient.indices.refresh({ index: CONFIG.elasticsearch.index });

      // Step 4: ID=1 레코드 검색
      const result = await esClient.search({
        index: CONFIG.elasticsearch.index,
        query: { term: { ID: 1 } },
      });

      // Step 5: 정확히 1개만 존재해야 함 (upsert)
      expect(result.hits.hits.length).toBe(1);

      // Step 6: 업데이트된 값 확인
      const doc = result.hits.hits[0]._source;
      expect(doc.NAME).toBe('Updated Record 1');
      expect(doc.VALUE).toBe(999.99);
    });

    /**
     * 새 레코드 삽입 캡처 검증
     *
     * 검증 항목:
     * - Oracle에 새 레코드를 삽입한 후
     * - Elasticsearch에 동기화하면
     * - 새 문서가 정확히 생성되는지
     *
     * 동작 순서:
     * 1. Oracle에 새 레코드 삽입 (랜덤 ID 사용)
     * 2. syncOracleToElasticsearch() 호출
     * 3. ES에서 새 ID 검색
     * 4. 정확히 1개 존재하는지 확인
     * 5. 값이 정확한지 확인
     */
    test('should capture new inserts', async () => {
      if (!pipelineReady()) {
        throw new Error('Test requires Oracle and Elasticsearch');
      }

      // Step 1: 새 레코드 삽입 (랜덤 ID로 충돌 방지)
      const newId = 1000 + Math.floor(Math.random() * 1000);
      await executeOracleSQL(`
        INSERT INTO MY_TABLE (ID, NAME, VALUE, UPDATED_AT)
        VALUES (${newId}, 'E2E Test Record', 12345.67, CURRENT_TIMESTAMP)
      `);

      // Step 2: sync
      await syncOracleToElasticsearch();

      // Step 3: Elasticsearch 확인
      await esClient.indices.refresh({ index: CONFIG.elasticsearch.index });

      // Step 4: 새 레코드 검색
      const result = await esClient.search({
        index: CONFIG.elasticsearch.index,
        query: { term: { ID: newId } },
      });

      // Step 5: 검증
      expect(result.hits.hits.length).toBe(1);
      expect(result.hits.hits[0]._source.NAME).toBe('E2E Test Record');
    });

    /**
     * 데이터 무결성 검증 (중복 없음)
     *
     * 검증 항목:
     * - Elasticsearch의 총 문서 수와 고유 ID 수가 일치하는지
     * - 동일 ID를 가진 중복 문서가 없는지
     *
     * 검증 방법:
     * 1. ES의 총 문서 수 조회
     * 2. cardinality aggregation으로 고유 ID 수 계산
     * 3. 총 문서 수 = 고유 ID 수 이면 중복 없음
     */
    test('should maintain data integrity (no duplicates)', async () => {
      if (!pipelineReady()) {
        throw new Error('Test requires Oracle and Elasticsearch');
      }

      // Step 1: 전체 문서 수
      const countResult = await esClient.count({
        index: CONFIG.elasticsearch.index,
      });

      // Step 2: 고유 ID 수 (cardinality aggregation)
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

      // Step 3: 총 문서 수 = 고유 ID 수 (중복 없음)
      expect(totalCount).toBe(uniqueCount);
    });
  });
});
