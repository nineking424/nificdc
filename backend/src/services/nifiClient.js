const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');
const { nifiVersionCompatibility } = require('./nifiVersionCompatibility');

class NiFiClient {
  constructor(config) {
    this.baseUrl = config.url || config.baseUrl;
    this.username = config.username;
    this.password = config.password;
    this.token = null;
    this.tokenExpiry = null;
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.version = null; // NiFi 버전 정보
    
    // SSL 설정
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: config.rejectUnauthorized !== false,
      cert: config.cert,
      key: config.key,
      ca: config.ca
    });

    // Axios 인스턴스 생성
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      httpsAgent: this.httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // 요청 인터셉터 - 자동 토큰 추가
    this.httpClient.interceptors.request.use(
      async (config) => {
        await this.ensureValidToken();
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        logger.debug(`NiFi API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('NiFi API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터 - 에러 처리 및 재시도
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug(`NiFi API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        const config = error.config;
        
        // 401 에러 시 토큰 갱신 후 재시도
        if (error.response?.status === 401 && !config._retry) {
          config._retry = true;
          try {
            await this.authenticate(true); // 강제 재인증
            config.headers.Authorization = `Bearer ${this.token}`;
            return this.httpClient.request(config);
          } catch (authError) {
            logger.error('Token refresh failed:', authError);
            return Promise.reject(error);
          }
        }
        
        logger.error(`NiFi API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * NiFi 인증
   */
  async authenticate(force = false) {
    try {
      // 토큰이 유효하고 강제 갱신이 아닌 경우 스킵
      if (!force && this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.token;
      }

      logger.info('Authenticating with NiFi...');
      
      const response = await axios.post(
        `${this.baseUrl}/access/token`,
        `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          httpsAgent: this.httpsAgent,
          timeout: this.timeout
        }
      );

      this.token = response.data;
      // 토큰 만료 시간 설정 (보통 12시간, 안전하게 11시간으로 설정)
      this.tokenExpiry = new Date(Date.now() + 11 * 60 * 60 * 1000);
      
      logger.info('NiFi authentication successful');
      return this.token;
    } catch (error) {
      logger.error('NiFi authentication failed:', error);
      this.token = null;
      this.tokenExpiry = null;
      throw new Error(`NiFi authentication failed: ${error.message}`);
    }
  }

  /**
   * 유효한 토큰 보장
   */
  async ensureValidToken() {
    if (!this.token || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.authenticate(true);
    }
  }

  /**
   * 시스템 정보 조회
   */
  async getSystemDiagnostics() {
    try {
      const endpoint = nifiVersionCompatibility.getApiEndpoint('system-diagnostics', this.version);
      const response = await this.httpClient.get(endpoint);
      
      // 버전 정보 캐싱 (처음 호출 시)
      if (!this.version && response.data.systemDiagnostics?.aggregateSnapshot?.versionInfo?.niFiVersion) {
        this.version = response.data.systemDiagnostics.aggregateSnapshot.versionInfo.niFiVersion;
        logger.info(`Detected NiFi version: ${this.version}`);
      }
      
      return nifiVersionCompatibility.normalizeResponse('system-diagnostics', this.version, response.data);
    } catch (error) {
      throw new Error(`Failed to get system diagnostics: ${error.message}`);
    }
  }

  /**
   * 클러스터 정보 조회
   */
  async getClusterSummary() {
    try {
      const endpoint = nifiVersionCompatibility.getApiEndpoint('cluster-summary', this.version);
      const response = await this.httpClient.get(endpoint);
      return nifiVersionCompatibility.normalizeResponse('cluster-summary', this.version, response.data);
    } catch (error) {
      throw new Error(`Failed to get cluster summary: ${error.message}`);
    }
  }

  /**
   * 루트 프로세스 그룹 조회
   */
  async getRootProcessGroup() {
    try {
      const response = await this.httpClient.get('/process-groups/root');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get root process group: ${error.message}`);
    }
  }

  /**
   * 프로세스 그룹 생성
   */
  async createProcessGroup(parentId, name, position = { x: 0, y: 0 }, options = {}) {
    try {
      const endpoint = nifiVersionCompatibility.getApiEndpoint('process-groups', this.version, { id: parentId });
      const payload = nifiVersionCompatibility.createPayload('process-groups', this.version, {
        name: name,
        position: position,
        ...options
      });

      const response = await this.httpClient.post(endpoint, payload);
      
      logger.info(`Created process group: ${name}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create process group: ${error.message}`);
    }
  }

  /**
   * 프로세서 생성
   */
  async createProcessor(processGroupId, type, name, position = { x: 0, y: 0 }, config = {}) {
    try {
      const endpoint = nifiVersionCompatibility.getApiEndpoint('processors', this.version, { id: processGroupId });
      const payload = nifiVersionCompatibility.createPayload('processors', this.version, {
        type: type,
        name: name,
        position: position,
        config: config
      });

      const response = await this.httpClient.post(endpoint, payload);
      
      logger.info(`Created processor: ${name} (${type})`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create processor: ${error.message}`);
    }
  }

  /**
   * 프로세서 설정 업데이트
   */
  async updateProcessor(processorId, updates) {
    try {
      // 현재 프로세서 정보 조회
      const current = await this.getProcessor(processorId);
      
      const payload = {
        revision: current.revision,
        component: {
          id: processorId,
          ...current.component,
          ...updates
        }
      };

      const response = await this.httpClient.put(`/processors/${processorId}`, payload);
      
      logger.info(`Updated processor: ${processorId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update processor: ${error.message}`);
    }
  }

  /**
   * 프로세서 조회
   */
  async getProcessor(processorId) {
    try {
      const response = await this.httpClient.get(`/processors/${processorId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get processor: ${error.message}`);
    }
  }

  /**
   * 프로세서 시작
   */
  async startProcessor(processorId) {
    try {
      const current = await this.getProcessor(processorId);
      
      const payload = {
        revision: current.revision,
        component: {
          id: processorId,
          state: 'RUNNING'
        }
      };

      const response = await this.httpClient.put(`/processors/${processorId}/run-status`, payload);
      
      logger.info(`Started processor: ${processorId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start processor: ${error.message}`);
    }
  }

  /**
   * 프로세서 중지
   */
  async stopProcessor(processorId) {
    try {
      const current = await this.getProcessor(processorId);
      
      const payload = {
        revision: current.revision,
        component: {
          id: processorId,
          state: 'STOPPED'
        }
      };

      const response = await this.httpClient.put(`/processors/${processorId}/run-status`, payload);
      
      logger.info(`Stopped processor: ${processorId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to stop processor: ${error.message}`);
    }
  }

  /**
   * 연결 생성
   */
  async createConnection(sourceId, destinationId, relationships, processGroupId, name = '') {
    try {
      const payload = {
        revision: { version: 0 },
        component: {
          name: name,
          source: {
            id: sourceId,
            groupId: processGroupId,
            type: 'PROCESSOR'
          },
          destination: {
            id: destinationId,
            groupId: processGroupId,
            type: 'PROCESSOR'
          },
          selectedRelationships: relationships,
          flowFileExpiration: '0 sec',
          backPressureDataSizeThreshold: '1 GB',
          backPressureObjectThreshold: 10000
        }
      };

      const response = await this.httpClient.post(
        `/process-groups/${processGroupId}/connections`,
        payload
      );
      
      logger.info(`Created connection from ${sourceId} to ${destinationId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create connection: ${error.message}`);
    }
  }

  /**
   * 프로세서 타입 목록 조회
   */
  async getProcessorTypes() {
    try {
      const response = await this.httpClient.get('/flow/processor-types');
      return response.data.processorTypes;
    } catch (error) {
      throw new Error(`Failed to get processor types: ${error.message}`);
    }
  }

  /**
   * 플로우 상태 조회
   */
  async getFlowStatus() {
    try {
      const response = await this.httpClient.get('/flow/status');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get flow status: ${error.message}`);
    }
  }

  /**
   * 연결 상태 확인
   */
  async isConnected() {
    try {
      await this.getSystemDiagnostics();
      return true;
    } catch (error) {
      logger.warn('NiFi connection check failed:', error.message);
      return false;
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck() {
    try {
      const start = Date.now();
      const systemDiagnostics = await this.getSystemDiagnostics();
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        version: systemDiagnostics.systemDiagnostics?.aggregateSnapshot?.versionInfo?.niFiVersion,
        uptime: systemDiagnostics.systemDiagnostics?.aggregateSnapshot?.uptime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 버전 정보 조회
   */
  async getVersion() {
    if (!this.version) {
      await this.getSystemDiagnostics();
    }
    return this.version;
  }

  /**
   * 버전 호환성 보고서 조회
   */
  async getCompatibilityReport() {
    const version = await this.getVersion();
    return nifiVersionCompatibility.generateCompatibilityReport(version);
  }

  /**
   * 지원되는 기능 목록 조회
   */
  async getAvailableFeatures() {
    const version = await this.getVersion();
    return nifiVersionCompatibility.getAvailableFeatures(version);
  }

  /**
   * 특정 기능 지원 여부 확인
   */
  async isFeatureSupported(feature) {
    const version = await this.getVersion();
    return nifiVersionCompatibility.isFeatureSupported(feature, version);
  }

  /**
   * 리소스 정리
   */
  disconnect() {
    this.token = null;
    this.tokenExpiry = null;
    this.version = null;
    logger.info('NiFi client disconnected');
  }
}

module.exports = NiFiClient;