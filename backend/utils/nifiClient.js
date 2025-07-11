const axios = require('axios');

/**
 * NiFi REST API 클라이언트
 * NiFi 프로세스 그룹 및 프로세서 관리
 */
class NiFiClient {
  constructor() {
    this.baseURL = process.env.NIFI_URL || 'http://localhost:8080/nifi-api';
    this.username = process.env.NIFI_USERNAME;
    this.password = process.env.NIFI_PASSWORD;
    this.token = null;
    this.tokenExpiry = null;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.setupInterceptors();
  }

  /**
   * 요청/응답 인터셉터 설정
   */
  setupInterceptors() {
    // 요청 인터셉터 - 토큰 자동 추가
    this.client.interceptors.request.use(async (config) => {
      await this.ensureAuthenticated();
      
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      
      return config;
    });

    // 응답 인터셉터 - 에러 처리
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // 토큰 만료 시 재인증 시도
          this.token = null;
          this.tokenExpiry = null;
          
          try {
            await this.authenticate();
            return this.client.request(error.config);
          } catch (authError) {
            console.error('NiFi 재인증 실패:', authError);
            throw authError;
          }
        }
        
        throw error;
      }
    );
  }

  /**
   * NiFi 인증
   */
  async authenticate() {
    if (!this.username || !this.password) {
      console.warn('NiFi 인증 정보가 설정되지 않았습니다.');
      return;
    }

    try {
      const response = await axios.post(`${this.baseURL}/access/token`, {
        username: this.username,
        password: this.password
      });

      this.token = response.data;
      this.tokenExpiry = Date.now() + (12 * 60 * 60 * 1000); // 12시간
      
      console.log('NiFi 인증 성공');
    } catch (error) {
      console.error('NiFi 인증 실패:', error.response?.data || error.message);
      throw new Error('NiFi 인증에 실패했습니다.');
    }
  }

  /**
   * 인증 상태 확인 및 갱신
   */
  async ensureAuthenticated() {
    if (!this.token || (this.tokenExpiry && Date.now() >= this.tokenExpiry)) {
      await this.authenticate();
    }
  }

  /**
   * 프로세스 그룹 생성
   */
  async createProcessGroup(name, parentGroupId = 'root', position = { x: 0, y: 0 }) {
    try {
      const response = await this.client.post('/process-groups', {
        revision: { version: 0 },
        component: {
          name,
          parentGroupId,
          position
        }
      });

      console.log(`프로세스 그룹 생성 완료: ${name}`);
      return response.data.component;
    } catch (error) {
      console.error('프로세스 그룹 생성 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 프로세서 생성
   */
  async createProcessor(processGroupId, processorType, name, position = { x: 0, y: 0 }, config = {}) {
    try {
      const response = await this.client.post(`/process-groups/${processGroupId}/processors`, {
        revision: { version: 0 },
        component: {
          name,
          type: processorType,
          position,
          config: {
            schedulingPeriod: '0 sec',
            schedulingStrategy: 'TIMER_DRIVEN',
            executionNode: 'ALL',
            penaltyDuration: '30 sec',
            yieldDuration: '1 sec',
            bulletinLevel: 'WARN',
            runDurationMillis: 0,
            concurrentlySchedulableTaskCount: 1,
            autoTerminatedRelationships: [],
            properties: config.properties || {},
            ...config
          }
        }
      });

      console.log(`프로세서 생성 완료: ${name} [${processorType}]`);
      return response.data.component;
    } catch (error) {
      console.error('프로세서 생성 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 연결 생성
   */
  async createConnection(sourceId, sourceType, destinationId, destinationType, relationships = []) {
    try {
      const response = await this.client.post('/connections', {
        revision: { version: 0 },
        component: {
          source: {
            id: sourceId,
            type: sourceType
          },
          destination: {
            id: destinationId,
            type: destinationType
          },
          selectedRelationships: relationships,
          backPressureObjectThreshold: 10000,
          backPressureDataSizeThreshold: '1 GB',
          flowFileExpiration: '0 sec',
          prioritizers: []
        }
      });

      console.log(`연결 생성 완료: ${sourceId} -> ${destinationId}`);
      return response.data.component;
    } catch (error) {
      console.error('연결 생성 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 매핑을 위한 NiFi 플로우 생성
   */
  async createMappingFlow(mapping, jobName) {
    try {
      const processGroupName = `${jobName}_${mapping.id}`;
      
      // 프로세스 그룹 생성
      const processGroup = await this.createProcessGroup(processGroupName);
      
      // 소스 프로세서 생성
      const sourceProcessor = await this.createSourceProcessor(
        processGroup.id,
        mapping.sourceSystem,
        mapping.sourceSchema
      );
      
      // 변환 프로세서 생성
      const transformProcessor = await this.createTransformProcessor(
        processGroup.id,
        mapping
      );
      
      // 타겟 프로세서 생성
      const targetProcessor = await this.createTargetProcessor(
        processGroup.id,
        mapping.targetSystem,
        mapping.targetSchema
      );
      
      // 연결 생성
      await this.createConnection(
        sourceProcessor.id,
        'PROCESSOR',
        transformProcessor.id,
        'PROCESSOR',
        ['success']
      );
      
      await this.createConnection(
        transformProcessor.id,
        'PROCESSOR',
        targetProcessor.id,
        'PROCESSOR',
        ['success']
      );
      
      console.log(`매핑 플로우 생성 완료: ${processGroupName}`);
      return {
        processGroupId: processGroup.id,
        sourceProcessorId: sourceProcessor.id,
        transformProcessorId: transformProcessor.id,
        targetProcessorId: targetProcessor.id
      };
      
    } catch (error) {
      console.error('매핑 플로우 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 소스 프로세서 생성
   */
  async createSourceProcessor(processGroupId, sourceSystem, sourceSchema) {
    const processorType = this.getSourceProcessorType(sourceSystem.type);
    const config = this.getSourceProcessorConfig(sourceSystem, sourceSchema);
    
    return await this.createProcessor(
      processGroupId,
      processorType,
      `Source_${sourceSystem.name}`,
      { x: 100, y: 100 },
      config
    );
  }

  /**
   * 변환 프로세서 생성
   */
  async createTransformProcessor(processGroupId, mapping) {
    const processorType = 'org.apache.nifi.processors.script.ExecuteScript';
    
    // 변환 스크립트 생성
    const transformScript = this.generateTransformScript(mapping);
    
    const config = {
      properties: {
        'Script Engine': 'javascript',
        'Script Body': transformScript,
        'Module Directory': '',
        'Script File': ''
      }
    };
    
    return await this.createProcessor(
      processGroupId,
      processorType,
      `Transform_${mapping.name}`,
      { x: 300, y: 100 },
      config
    );
  }

  /**
   * 타겟 프로세서 생성
   */
  async createTargetProcessor(processGroupId, targetSystem, targetSchema) {
    const processorType = this.getTargetProcessorType(targetSystem.type);
    const config = this.getTargetProcessorConfig(targetSystem, targetSchema);
    
    return await this.createProcessor(
      processGroupId,
      processorType,
      `Target_${targetSystem.name}`,
      { x: 500, y: 100 },
      config
    );
  }

  /**
   * 소스 시스템 타입에 따른 프로세서 타입 반환
   */
  getSourceProcessorType(systemType) {
    const processorTypes = {
      'mysql': 'org.apache.nifi.processors.standard.ExecuteSQL',
      'postgresql': 'org.apache.nifi.processors.standard.ExecuteSQL',
      'oracle': 'org.apache.nifi.processors.standard.ExecuteSQL',
      'mssql': 'org.apache.nifi.processors.standard.ExecuteSQL',
      'mongodb': 'org.apache.nifi.mongodb.processors.GetMongo',
      'file': 'org.apache.nifi.processors.standard.GetFile',
      'ftp': 'org.apache.nifi.processors.standard.FetchFTP',
      'sftp': 'org.apache.nifi.processors.standard.FetchSFTP',
      'http': 'org.apache.nifi.processors.standard.InvokeHTTP',
      'kafka': 'org.apache.nifi.processors.kafka.pubsub.ConsumeKafka_2_6'
    };
    
    return processorTypes[systemType] || 'org.apache.nifi.processors.standard.GenerateFlowFile';
  }

  /**
   * 타겟 시스템 타입에 따른 프로세서 타입 반환
   */
  getTargetProcessorType(systemType) {
    const processorTypes = {
      'mysql': 'org.apache.nifi.processors.standard.PutDatabaseRecord',
      'postgresql': 'org.apache.nifi.processors.standard.PutDatabaseRecord',
      'oracle': 'org.apache.nifi.processors.standard.PutDatabaseRecord',
      'mssql': 'org.apache.nifi.processors.standard.PutDatabaseRecord',
      'mongodb': 'org.apache.nifi.mongodb.processors.PutMongo',
      'file': 'org.apache.nifi.processors.standard.PutFile',
      'ftp': 'org.apache.nifi.processors.standard.PutFTP',
      'sftp': 'org.apache.nifi.processors.standard.PutSFTP',
      'http': 'org.apache.nifi.processors.standard.InvokeHTTP',
      'kafka': 'org.apache.nifi.processors.kafka.pubsub.PublishKafka_2_6'
    };
    
    return processorTypes[systemType] || 'org.apache.nifi.processors.standard.LogAttribute';
  }

  /**
   * 소스 프로세서 설정 생성
   */
  getSourceProcessorConfig(sourceSystem, sourceSchema) {
    const connectionInfo = JSON.parse(sourceSystem.connectionInfo || '{}');
    
    switch (sourceSystem.type) {
      case 'mysql':
      case 'postgresql':
      case 'oracle':
      case 'mssql':
        return {
          properties: {
            'Database Connection Pooling Service': 'DBCPConnectionPool',
            'SQL select query': this.generateSelectQuery(sourceSchema),
            'Max Wait Time': '0 seconds'
          }
        };
        
      case 'mongodb':
        return {
          properties: {
            'Mongo URI': `mongodb://${connectionInfo.host}:${connectionInfo.port}`,
            'Mongo Database Name': connectionInfo.database,
            'Mongo Collection Name': sourceSchema.name,
            'Query': '{}',
            'Projection': '',
            'Sort': ''
          }
        };
        
      case 'file':
        return {
          properties: {
            'Input Directory': connectionInfo.path || '/tmp/input',
            'File Filter': connectionInfo.filePattern || '.*',
            'Keep Source File': 'false',
            'Minimum File Age': '0 sec',
            'Polling Interval': '10 sec'
          }
        };
        
      default:
        return { properties: {} };
    }
  }

  /**
   * 타겟 프로세서 설정 생성
   */
  getTargetProcessorConfig(targetSystem, targetSchema) {
    const connectionInfo = JSON.parse(targetSystem.connectionInfo || '{}');
    
    switch (targetSystem.type) {
      case 'mysql':
      case 'postgresql':
      case 'oracle':
      case 'mssql':
        return {
          properties: {
            'Database Connection Pooling Service': 'DBCPConnectionPool',
            'Statement Type': 'INSERT',
            'Table Name': targetSchema.name,
            'Record Reader': 'JsonTreeReader',
            'Translate Field Names': 'true',
            'Unmatched Field Behavior': 'Ignore',
            'Unmatched Column Behavior': 'Fail'
          }
        };
        
      case 'mongodb':
        return {
          properties: {
            'Mongo URI': `mongodb://${connectionInfo.host}:${connectionInfo.port}`,
            'Mongo Database Name': connectionInfo.database,
            'Mongo Collection Name': targetSchema.name,
            'Mode': 'insert',
            'Upsert': 'false'
          }
        };
        
      case 'file':
        return {
          properties: {
            'Directory': connectionInfo.path || '/tmp/output',
            'Conflict Resolution Strategy': 'replace',
            'Create Missing Directories': 'true'
          }
        };
        
      default:
        return { properties: {} };
    }
  }

  /**
   * SELECT 쿼리 생성
   */
  generateSelectQuery(sourceSchema) {
    const columns = sourceSchema.columns.map(col => col.name).join(', ');
    return `SELECT ${columns} FROM ${sourceSchema.name}`;
  }

  /**
   * 변환 스크립트 생성
   */
  generateTransformScript(mapping) {
    return `
var flowFile = session.get();
if (flowFile != null) {
    var StreamCallback = Java.type("org.apache.nifi.processor.io.StreamCallback");
    var IOUtils = Java.type("org.apache.commons.io.IOUtils");
    var StandardCharsets = Java.type("java.nio.charset.StandardCharsets");
    
    flowFile = session.write(flowFile, new StreamCallback(function(inputStream, outputStream) {
        var input = IOUtils.toString(inputStream, StandardCharsets.UTF_8);
        var data = JSON.parse(input);
        
        // 매핑 규칙 적용
        var result = applyMappingRules(data);
        
        outputStream.write(JSON.stringify(result).getBytes(StandardCharsets.UTF_8));
    }));
    
    session.transfer(flowFile, REL_SUCCESS);
}

function applyMappingRules(data) {
    var result = {};
    
    // 매핑 규칙들을 JavaScript로 변환
    ${this.generateMappingRulesScript(mapping.mappingRules)}
    
    return result;
}
`;
  }

  /**
   * 매핑 규칙 스크립트 생성
   */
  generateMappingRulesScript(mappingRules) {
    return mappingRules.map(rule => {
      switch (rule.mappingType) {
        case 'direct':
          return `result['${rule.targetField}'] = data['${rule.sourceField}'];`;
          
        case 'transform':
          return `result['${rule.targetField}'] = transform_${rule.transformFunction}(data['${rule.sourceField}']);`;
          
        case 'concat':
          const fields = rule.sourceFields || [rule.sourceField];
          const fieldRefs = fields.map(f => `data['${f}']`).join(', ');
          return `result['${rule.targetField}'] = [${fieldRefs}].join('${rule.separator || ''}');`;
          
        case 'split':
          return `
            var splitValues = data['${rule.sourceField}'].split('${rule.separator || ''}');
            result['${rule.targetField}'] = splitValues[${rule.splitIndex || 0}] || '';
          `;
          
        default:
          return `result['${rule.targetField}'] = data['${rule.sourceField}'];`;
      }
    }).join('\n    ');
  }

  /**
   * 프로세스 그룹 시작
   */
  async startProcessGroup(processGroupId) {
    try {
      const response = await this.client.put(`/flow/process-groups/${processGroupId}`, {
        id: processGroupId,
        state: 'RUNNING'
      });

      console.log(`프로세스 그룹 시작: ${processGroupId}`);
      return response.data;
    } catch (error) {
      console.error('프로세스 그룹 시작 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 프로세스 그룹 중지
   */
  async stopProcessGroup(processGroupId) {
    try {
      const response = await this.client.put(`/flow/process-groups/${processGroupId}`, {
        id: processGroupId,
        state: 'STOPPED'
      });

      console.log(`프로세스 그룹 중지: ${processGroupId}`);
      return response.data;
    } catch (error) {
      console.error('프로세스 그룹 중지 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 프로세스 그룹 상태 조회
   */
  async getProcessGroupStatus(processGroupId) {
    try {
      const response = await this.client.get(`/flow/process-groups/${processGroupId}/status`);
      return response.data.processGroupStatus;
    } catch (error) {
      console.error('프로세스 그룹 상태 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 프로세스 그룹 데이터 조회
   */
  async getProcessGroupData(processGroupId) {
    try {
      // 실제 구현에서는 프로세스 그룹의 출력 데이터를 수집
      // 여기서는 시뮬레이션 데이터 반환
      return {
        data: [],
        metrics: {
          processedRecords: 0,
          processingTime: 0,
          errors: 0
        }
      };
    } catch (error) {
      console.error('프로세스 그룹 데이터 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 프로세스 그룹 삭제
   */
  async deleteProcessGroup(processGroupId) {
    try {
      // 먼저 중지
      await this.stopProcessGroup(processGroupId);
      
      // 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 삭제
      await this.client.delete(`/process-groups/${processGroupId}?version=0`);
      
      console.log(`프로세스 그룹 삭제: ${processGroupId}`);
    } catch (error) {
      console.error('프로세스 그룹 삭제 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * NiFi 연결 테스트
   */
  async testConnection() {
    try {
      const response = await this.client.get('/system-diagnostics');
      return {
        success: true,
        version: response.data.systemDiagnostics.versionInfo,
        uptime: response.data.systemDiagnostics.uptime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 싱글톤 인스턴스
const nifiClient = new NiFiClient();

module.exports = nifiClient;