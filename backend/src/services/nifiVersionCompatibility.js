const logger = require('../utils/logger');

/**
 * NiFi Version Compatibility Layer
 * 
 * Handles API differences between NiFi versions
 * and provides unified interface for different NiFi versions
 */
class NiFiVersionCompatibility {
  constructor() {
    this.supportedVersions = {
      '1.12.x': { major: 1, minor: 12, patch: 0 },
      '1.13.x': { major: 1, minor: 13, patch: 0 },
      '1.14.x': { major: 1, minor: 14, patch: 0 },
      '1.15.x': { major: 1, minor: 15, patch: 0 },
      '1.16.x': { major: 1, minor: 16, patch: 0 },
      '1.17.x': { major: 1, minor: 17, patch: 0 },
      '1.18.x': { major: 1, minor: 18, patch: 0 },
      '1.19.x': { major: 1, minor: 19, patch: 0 },
      '1.20.x': { major: 1, minor: 20, patch: 0 }
    };
    
    this.featureMatrix = {
      // API 기능 지원 매트릭스
      'cluster-api': { minVersion: '1.12.0' },
      'parameter-contexts': { minVersion: '1.10.0' },
      'process-group-parameters': { minVersion: '1.10.0' },
      'flow-registry': { minVersion: '1.6.0' },
      'variable-registry': { minVersion: '1.4.0' },
      'process-group-status-history': { minVersion: '1.3.0' },
      'reporting-tasks': { minVersion: '1.0.0' },
      'controller-services': { minVersion: '1.0.0' },
      'connections-load-balance': { minVersion: '1.8.0' },
      'flow-file-expiration': { minVersion: '1.0.0' },
      'flow-analysis-rules': { minVersion: '1.16.0' },
      'stateless-engine': { minVersion: '1.15.0' },
      'python-processors': { minVersion: '1.16.0' }
    };
    
    this.apiChanges = {
      '1.13.0': {
        // 1.13.0에서 추가된 변경사항
        'process-groups': {
          createEndpoint: '/process-groups/{id}/process-groups',
          createPayload: this.createProcessGroupPayload_1_13
        }
      },
      '1.14.0': {
        // 1.14.0에서 추가된 변경사항
        'processors': {
          createEndpoint: '/process-groups/{id}/processors',
          createPayload: this.createProcessorPayload_1_14
        }
      },
      '1.15.0': {
        // 1.15.0에서 추가된 변경사항
        'parameter-contexts': {
          createEndpoint: '/parameter-contexts',
          createPayload: this.createParameterContextPayload_1_15
        }
      },
      '1.16.0': {
        // 1.16.0에서 추가된 변경사항
        'flow-analysis-rules': {
          listEndpoint: '/flow-analysis-rules',
          configureEndpoint: '/flow-analysis-rules/{id}/config'
        }
      }
    };
  }

  /**
   * 버전 파싱
   */
  parseVersion(versionString) {
    if (!versionString) {
      return null;
    }
    
    const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)(-.*)?$/);
    if (!match) {
      logger.warn(`Invalid version format: ${versionString}`);
      return null;
    }
    
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      suffix: match[4] || '',
      raw: versionString
    };
  }

  /**
   * 버전 비교
   */
  compareVersions(version1, version2) {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);
    
    if (!v1 || !v2) {
      return 0;
    }
    
    if (v1.major !== v2.major) {
      return v1.major - v2.major;
    }
    
    if (v1.minor !== v2.minor) {
      return v1.minor - v2.minor;
    }
    
    return v1.patch - v2.patch;
  }

  /**
   * 기능 지원 여부 확인
   */
  isFeatureSupported(feature, version) {
    const featureConfig = this.featureMatrix[feature];
    if (!featureConfig) {
      logger.warn(`Unknown feature: ${feature}`);
      return false;
    }
    
    return this.compareVersions(version, featureConfig.minVersion) >= 0;
  }

  /**
   * API 엔드포인트 조회 (버전별)
   */
  getApiEndpoint(operation, version, params = {}) {
    const parsedVersion = this.parseVersion(version);
    if (!parsedVersion) {
      return this.getDefaultEndpoint(operation, params);
    }
    
    const versionKey = `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}`;
    const apiChange = this.apiChanges[versionKey];
    
    if (apiChange && apiChange[operation]) {
      return this.replaceParams(apiChange[operation].endpoint, params);
    }
    
    return this.getDefaultEndpoint(operation, params);
  }

  /**
   * 기본 API 엔드포인트 조회
   */
  getDefaultEndpoint(operation, params = {}) {
    const endpoints = {
      'system-diagnostics': '/system-diagnostics',
      'cluster-summary': '/cluster/summary',
      'root-process-group': '/process-groups/root',
      'process-groups': '/process-groups/{id}/process-groups',
      'processors': '/process-groups/{id}/processors',
      'connections': '/process-groups/{id}/connections',
      'controller-services': '/controller-services',
      'reporting-tasks': '/reporting-tasks',
      'parameter-contexts': '/parameter-contexts',
      'flow-status': '/flow/status',
      'processor-types': '/flow/processor-types',
      'controller-service-types': '/flow/controller-service-types',
      'flow-registry-clients': '/flow/registries',
      'flow-analysis-rules': '/flow-analysis-rules'
    };
    
    const endpoint = endpoints[operation];
    if (!endpoint) {
      throw new Error(`Unknown operation: ${operation}`);
    }
    
    return this.replaceParams(endpoint, params);
  }

  /**
   * 매개변수 치환
   */
  replaceParams(endpoint, params) {
    let result = endpoint;
    
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`{${key}}`, value);
    }
    
    return result;
  }

  /**
   * 요청 페이로드 생성 (버전별)
   */
  createPayload(operation, version, data) {
    const parsedVersion = this.parseVersion(version);
    if (!parsedVersion) {
      return this.createDefaultPayload(operation, data);
    }
    
    const versionKey = `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}`;
    const apiChange = this.apiChanges[versionKey];
    
    if (apiChange && apiChange[operation] && apiChange[operation].createPayload) {
      return apiChange[operation].createPayload(data);
    }
    
    return this.createDefaultPayload(operation, data);
  }

  /**
   * 기본 페이로드 생성
   */
  createDefaultPayload(operation, data) {
    switch (operation) {
      case 'process-groups':
        return this.createProcessGroupPayload(data);
      case 'processors':
        return this.createProcessorPayload(data);
      case 'connections':
        return this.createConnectionPayload(data);
      case 'controller-services':
        return this.createControllerServicePayload(data);
      case 'parameter-contexts':
        return this.createParameterContextPayload(data);
      default:
        return data;
    }
  }

  /**
   * 프로세스 그룹 생성 페이로드 (기본)
   */
  createProcessGroupPayload(data) {
    return {
      revision: { version: 0 },
      component: {
        name: data.name,
        position: data.position || { x: 0, y: 0 },
        comments: data.comments || ''
      }
    };
  }

  /**
   * 프로세스 그룹 생성 페이로드 (1.13+)
   */
  createProcessGroupPayload_1_13(data) {
    return {
      revision: { version: 0 },
      component: {
        name: data.name,
        position: data.position || { x: 0, y: 0 },
        comments: data.comments || '',
        // 1.13+에서 추가된 필드
        parameterContext: data.parameterContext || null,
        flowFileConcurrency: data.flowFileConcurrency || 'UNBOUNDED',
        flowFileOutboundPolicy: data.flowFileOutboundPolicy || 'STREAM_WHEN_AVAILABLE'
      }
    };
  }

  /**
   * 프로세서 생성 페이로드 (기본)
   */
  createProcessorPayload(data) {
    return {
      revision: { version: 0 },
      component: {
        type: data.type,
        name: data.name,
        position: data.position || { x: 0, y: 0 },
        config: {
          schedulingPeriod: data.config?.schedulingPeriod || '0 sec',
          schedulingStrategy: data.config?.schedulingStrategy || 'TIMER_DRIVEN',
          executionNode: data.config?.executionNode || 'ALL',
          penaltyDuration: data.config?.penaltyDuration || '30 sec',
          yieldDuration: data.config?.yieldDuration || '1 sec',
          bulletinLevel: data.config?.bulletinLevel || 'WARN',
          runDurationMillis: data.config?.runDurationMillis || 0,
          concurrentlySchedulableTaskCount: data.config?.concurrentlySchedulableTaskCount || 1,
          properties: data.config?.properties || {},
          comments: data.config?.comments || ''
        }
      }
    };
  }

  /**
   * 프로세서 생성 페이로드 (1.14+)
   */
  createProcessorPayload_1_14(data) {
    const basePayload = this.createProcessorPayload(data);
    
    // 1.14+에서 추가된 필드
    if (data.config) {
      basePayload.component.config.retryCount = data.config.retryCount || 10;
      basePayload.component.config.retriedRelationships = data.config.retriedRelationships || [];
      basePayload.component.config.backoffMechanism = data.config.backoffMechanism || 'PENALIZE_FLOWFILE';
      basePayload.component.config.maxBackoffPeriod = data.config.maxBackoffPeriod || '10 mins';
    }
    
    return basePayload;
  }

  /**
   * 연결 생성 페이로드
   */
  createConnectionPayload(data) {
    return {
      revision: { version: 0 },
      component: {
        name: data.name || '',
        source: {
          id: data.sourceId,
          groupId: data.processGroupId,
          type: data.sourceType || 'PROCESSOR'
        },
        destination: {
          id: data.destinationId,
          groupId: data.processGroupId,
          type: data.destinationType || 'PROCESSOR'
        },
        selectedRelationships: data.relationships || [],
        flowFileExpiration: data.flowFileExpiration || '0 sec',
        backPressureDataSizeThreshold: data.backPressureDataSizeThreshold || '1 GB',
        backPressureObjectThreshold: data.backPressureObjectThreshold || 10000,
        bends: data.bends || [],
        labelIndex: data.labelIndex || 1,
        zIndex: data.zIndex || 0
      }
    };
  }

  /**
   * 컨트롤러 서비스 생성 페이로드
   */
  createControllerServicePayload(data) {
    return {
      revision: { version: 0 },
      component: {
        type: data.type,
        name: data.name,
        comments: data.comments || '',
        properties: data.properties || {}
      }
    };
  }

  /**
   * 파라미터 컨텍스트 생성 페이로드 (기본)
   */
  createParameterContextPayload(data) {
    return {
      revision: { version: 0 },
      component: {
        name: data.name,
        description: data.description || '',
        parameters: data.parameters || []
      }
    };
  }

  /**
   * 파라미터 컨텍스트 생성 페이로드 (1.15+)
   */
  createParameterContextPayload_1_15(data) {
    const basePayload = this.createParameterContextPayload(data);
    
    // 1.15+에서 추가된 필드
    basePayload.component.inheritedParameterContexts = data.inheritedParameterContexts || [];
    
    return basePayload;
  }

  /**
   * 응답 데이터 정규화
   */
  normalizeResponse(operation, version, response) {
    const parsedVersion = this.parseVersion(version);
    if (!parsedVersion) {
      return response;
    }
    
    switch (operation) {
      case 'system-diagnostics':
        return this.normalizeSystemDiagnostics(response, parsedVersion);
      case 'cluster-summary':
        return this.normalizeClusterSummary(response, parsedVersion);
      case 'flow-status':
        return this.normalizeFlowStatus(response, parsedVersion);
      default:
        return response;
    }
  }

  /**
   * 시스템 진단 정보 정규화
   */
  normalizeSystemDiagnostics(response, version) {
    const normalized = {
      timestamp: response.systemDiagnostics?.aggregateSnapshot?.timestamp || new Date().toISOString(),
      uptime: response.systemDiagnostics?.aggregateSnapshot?.uptime || 'Unknown',
      version: response.systemDiagnostics?.aggregateSnapshot?.versionInfo?.niFiVersion || 'Unknown',
      processors: {
        available: response.systemDiagnostics?.aggregateSnapshot?.availableProcessors || 0,
        running: response.systemDiagnostics?.aggregateSnapshot?.processorLoadAverage || 0
      },
      memory: {
        used: response.systemDiagnostics?.aggregateSnapshot?.usedHeap || 0,
        free: response.systemDiagnostics?.aggregateSnapshot?.freeHeap || 0,
        total: response.systemDiagnostics?.aggregateSnapshot?.totalHeap || 0,
        max: response.systemDiagnostics?.aggregateSnapshot?.maxHeap || 0
      },
      storage: {
        used: response.systemDiagnostics?.aggregateSnapshot?.usedNonHeap || 0,
        free: response.systemDiagnostics?.aggregateSnapshot?.freeNonHeap || 0,
        total: response.systemDiagnostics?.aggregateSnapshot?.totalNonHeap || 0,
        max: response.systemDiagnostics?.aggregateSnapshot?.maxNonHeap || 0
      },
      raw: response
    };
    
    return normalized;
  }

  /**
   * 클러스터 요약 정보 정규화
   */
  normalizeClusterSummary(response, version) {
    const normalized = {
      connected: response.clusterSummary?.connectedNodes || 0,
      total: response.clusterSummary?.totalNodes || 0,
      clustered: response.clusterSummary?.clustered || false,
      connectedToCluster: response.clusterSummary?.connectedToCluster || false,
      raw: response
    };
    
    return normalized;
  }

  /**
   * 플로우 상태 정보 정규화
   */
  normalizeFlowStatus(response, version) {
    const normalized = {
      activeThreadCount: response.processGroupStatus?.aggregateSnapshot?.activeThreadCount || 0,
      queuedCount: response.processGroupStatus?.aggregateSnapshot?.queuedCount || 0,
      queuedSize: response.processGroupStatus?.aggregateSnapshot?.queuedSize || 0,
      bytesRead: response.processGroupStatus?.aggregateSnapshot?.bytesRead || 0,
      bytesWritten: response.processGroupStatus?.aggregateSnapshot?.bytesWritten || 0,
      flowFilesIn: response.processGroupStatus?.aggregateSnapshot?.flowFilesIn || 0,
      flowFilesOut: response.processGroupStatus?.aggregateSnapshot?.flowFilesOut || 0,
      raw: response
    };
    
    return normalized;
  }

  /**
   * 지원되는 버전 목록 조회
   */
  getSupportedVersions() {
    return Object.keys(this.supportedVersions);
  }

  /**
   * 버전 호환성 확인
   */
  isVersionSupported(version) {
    const parsed = this.parseVersion(version);
    if (!parsed) {
      return false;
    }
    
    // 지원되는 버전 범위 확인
    return parsed.major >= 1 && parsed.minor >= 12;
  }

  /**
   * 버전별 기능 목록 조회
   */
  getAvailableFeatures(version) {
    const features = [];
    
    for (const [feature, config] of Object.entries(this.featureMatrix)) {
      if (this.isFeatureSupported(feature, version)) {
        features.push(feature);
      }
    }
    
    return features;
  }

  /**
   * 버전 호환성 보고서 생성
   */
  generateCompatibilityReport(version) {
    const parsed = this.parseVersion(version);
    const isSupported = this.isVersionSupported(version);
    const features = this.getAvailableFeatures(version);
    
    return {
      version: version,
      parsed: parsed,
      isSupported: isSupported,
      supportedFeatures: features,
      unsupportedFeatures: Object.keys(this.featureMatrix).filter(f => !features.includes(f)),
      recommendations: this.generateRecommendations(version)
    };
  }

  /**
   * 버전별 권장사항 생성
   */
  generateRecommendations(version) {
    const recommendations = [];
    const parsed = this.parseVersion(version);
    
    if (!parsed) {
      recommendations.push('Invalid version format. Please use semantic versioning (e.g., 1.16.3).');
      return recommendations;
    }
    
    if (parsed.major < 1 || parsed.minor < 12) {
      recommendations.push('This version is not supported. Please upgrade to NiFi 1.12.0 or later.');
    }
    
    if (parsed.minor < 16) {
      recommendations.push('Consider upgrading to NiFi 1.16+ for Flow Analysis Rules support.');
    }
    
    if (parsed.minor < 15) {
      recommendations.push('Consider upgrading to NiFi 1.15+ for Stateless Engine support.');
    }
    
    if (parsed.minor < 14) {
      recommendations.push('Consider upgrading to NiFi 1.14+ for enhanced processor retry mechanisms.');
    }
    
    return recommendations;
  }
}

// 싱글톤 인스턴스
const nifiVersionCompatibility = new NiFiVersionCompatibility();

module.exports = {
  NiFiVersionCompatibility,
  nifiVersionCompatibility
};