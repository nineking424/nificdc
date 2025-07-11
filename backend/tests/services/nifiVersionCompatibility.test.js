const { NiFiVersionCompatibility, nifiVersionCompatibility } = require('../../src/services/nifiVersionCompatibility');

describe('NiFiVersionCompatibility', () => {
  let compatibility;

  beforeEach(() => {
    compatibility = new NiFiVersionCompatibility();
  });

  describe('Version Parsing', () => {
    it('should parse valid version strings', () => {
      const tests = [
        { input: '1.16.3', expected: { major: 1, minor: 16, patch: 3, suffix: '', raw: '1.16.3' } },
        { input: '1.20.0', expected: { major: 1, minor: 20, patch: 0, suffix: '', raw: '1.20.0' } },
        { input: '1.15.1-SNAPSHOT', expected: { major: 1, minor: 15, patch: 1, suffix: '-SNAPSHOT', raw: '1.15.1-SNAPSHOT' } }
      ];

      tests.forEach(test => {
        const result = compatibility.parseVersion(test.input);
        expect(result).toEqual(test.expected);
      });
    });

    it('should handle invalid version strings', () => {
      const invalidVersions = ['1.16', '1.16.3.4', 'invalid', '', null, undefined];

      invalidVersions.forEach(version => {
        const result = compatibility.parseVersion(version);
        expect(result).toBeNull();
      });
    });
  });

  describe('Version Comparison', () => {
    it('should compare versions correctly', () => {
      const tests = [
        { v1: '1.16.3', v2: '1.16.3', expected: 0 },
        { v1: '1.16.3', v2: '1.16.2', expected: 1 },
        { v1: '1.16.2', v2: '1.16.3', expected: -1 },
        { v1: '1.17.0', v2: '1.16.3', expected: 1 },
        { v1: '1.16.3', v2: '1.17.0', expected: -1 },
        { v1: '2.0.0', v2: '1.20.0', expected: 1 }
      ];

      tests.forEach(test => {
        const result = compatibility.compareVersions(test.v1, test.v2);
        expect(result).toBe(test.expected);
      });
    });

    it('should handle invalid versions in comparison', () => {
      expect(compatibility.compareVersions('invalid', '1.16.3')).toBe(0);
      expect(compatibility.compareVersions('1.16.3', 'invalid')).toBe(0);
      expect(compatibility.compareVersions('invalid', 'invalid')).toBe(0);
    });
  });

  describe('Feature Support', () => {
    it('should identify supported features correctly', () => {
      const tests = [
        { feature: 'cluster-api', version: '1.16.3', expected: true },
        { feature: 'parameter-contexts', version: '1.16.3', expected: true },
        { feature: 'flow-analysis-rules', version: '1.16.3', expected: true },
        { feature: 'flow-analysis-rules', version: '1.15.0', expected: false },
        { feature: 'stateless-engine', version: '1.15.0', expected: true },
        { feature: 'stateless-engine', version: '1.14.0', expected: false }
      ];

      tests.forEach(test => {
        const result = compatibility.isFeatureSupported(test.feature, test.version);
        expect(result).toBe(test.expected);
      });
    });

    it('should handle unknown features', () => {
      const result = compatibility.isFeatureSupported('unknown-feature', '1.16.3');
      expect(result).toBe(false);
    });
  });

  describe('API Endpoints', () => {
    it('should return correct endpoints for operations', () => {
      const tests = [
        { operation: 'system-diagnostics', expected: '/system-diagnostics' },
        { operation: 'cluster-summary', expected: '/cluster/summary' },
        { operation: 'process-groups', params: { id: 'root' }, expected: '/process-groups/root/process-groups' },
        { operation: 'processors', params: { id: 'pg-123' }, expected: '/process-groups/pg-123/processors' }
      ];

      tests.forEach(test => {
        const result = compatibility.getApiEndpoint(test.operation, '1.16.3', test.params);
        expect(result).toBe(test.expected);
      });
    });

    it('should handle unknown operations', () => {
      expect(() => compatibility.getApiEndpoint('unknown-operation', '1.16.3')).toThrow('Unknown operation');
    });
  });

  describe('Payload Creation', () => {
    it('should create process group payload', () => {
      const data = {
        name: 'Test Process Group',
        position: { x: 100, y: 200 },
        comments: 'Test comments'
      };

      const result = compatibility.createPayload('process-groups', '1.16.3', data);

      expect(result).toHaveProperty('revision');
      expect(result).toHaveProperty('component');
      expect(result.component.name).toBe('Test Process Group');
      expect(result.component.position).toEqual({ x: 100, y: 200 });
      expect(result.component.comments).toBe('Test comments');
    });

    it('should create processor payload', () => {
      const data = {
        type: 'org.apache.nifi.processors.standard.GenerateFlowFile',
        name: 'Test Processor',
        position: { x: 300, y: 400 },
        config: {
          properties: {
            'File Size': '1KB'
          }
        }
      };

      const result = compatibility.createPayload('processors', '1.16.3', data);

      expect(result).toHaveProperty('revision');
      expect(result).toHaveProperty('component');
      expect(result.component.type).toBe('org.apache.nifi.processors.standard.GenerateFlowFile');
      expect(result.component.name).toBe('Test Processor');
      expect(result.component.config.properties['File Size']).toBe('1KB');
    });

    it('should create connection payload', () => {
      const data = {
        name: 'Test Connection',
        sourceId: 'source-123',
        destinationId: 'dest-456',
        processGroupId: 'pg-789',
        relationships: ['success']
      };

      const result = compatibility.createPayload('connections', '1.16.3', data);

      expect(result).toHaveProperty('revision');
      expect(result).toHaveProperty('component');
      expect(result.component.name).toBe('Test Connection');
      expect(result.component.source.id).toBe('source-123');
      expect(result.component.destination.id).toBe('dest-456');
      expect(result.component.selectedRelationships).toEqual(['success']);
    });
  });

  describe('Response Normalization', () => {
    it('should normalize system diagnostics response', () => {
      const mockResponse = {
        systemDiagnostics: {
          aggregateSnapshot: {
            timestamp: '2023-01-01T00:00:00.000Z',
            uptime: '1 day, 2 hours, 3 minutes',
            versionInfo: {
              niFiVersion: '1.16.3'
            },
            availableProcessors: 8,
            processorLoadAverage: 2.5,
            usedHeap: 1024000000,
            freeHeap: 512000000,
            totalHeap: 1536000000,
            maxHeap: 2048000000,
            usedNonHeap: 256000000,
            freeNonHeap: 128000000,
            totalNonHeap: 384000000,
            maxNonHeap: 512000000
          }
        }
      };

      const result = compatibility.normalizeResponse('system-diagnostics', '1.16.3', mockResponse);

      expect(result.timestamp).toBe('2023-01-01T00:00:00.000Z');
      expect(result.uptime).toBe('1 day, 2 hours, 3 minutes');
      expect(result.version).toBe('1.16.3');
      expect(result.processors.available).toBe(8);
      expect(result.processors.running).toBe(2.5);
      expect(result.memory.used).toBe(1024000000);
      expect(result.memory.free).toBe(512000000);
      expect(result.memory.total).toBe(1536000000);
      expect(result.memory.max).toBe(2048000000);
      expect(result.storage.used).toBe(256000000);
      expect(result.raw).toBe(mockResponse);
    });

    it('should normalize cluster summary response', () => {
      const mockResponse = {
        clusterSummary: {
          connectedNodes: 3,
          totalNodes: 3,
          clustered: true,
          connectedToCluster: true
        }
      };

      const result = compatibility.normalizeResponse('cluster-summary', '1.16.3', mockResponse);

      expect(result.connected).toBe(3);
      expect(result.total).toBe(3);
      expect(result.clustered).toBe(true);
      expect(result.connectedToCluster).toBe(true);
      expect(result.raw).toBe(mockResponse);
    });

    it('should normalize flow status response', () => {
      const mockResponse = {
        processGroupStatus: {
          aggregateSnapshot: {
            activeThreadCount: 5,
            queuedCount: 100,
            queuedSize: '10 MB',
            bytesRead: 1024000,
            bytesWritten: 2048000,
            flowFilesIn: 50,
            flowFilesOut: 45
          }
        }
      };

      const result = compatibility.normalizeResponse('flow-status', '1.16.3', mockResponse);

      expect(result.activeThreadCount).toBe(5);
      expect(result.queuedCount).toBe(100);
      expect(result.queuedSize).toBe('10 MB');
      expect(result.bytesRead).toBe(1024000);
      expect(result.bytesWritten).toBe(2048000);
      expect(result.flowFilesIn).toBe(50);
      expect(result.flowFilesOut).toBe(45);
      expect(result.raw).toBe(mockResponse);
    });
  });

  describe('Version Support', () => {
    it('should identify supported versions', () => {
      const supportedVersions = [
        '1.12.0',
        '1.13.2',
        '1.14.0',
        '1.15.3',
        '1.16.3',
        '1.17.0',
        '1.18.0',
        '1.19.0',
        '1.20.0'
      ];

      supportedVersions.forEach(version => {
        expect(compatibility.isVersionSupported(version)).toBe(true);
      });
    });

    it('should identify unsupported versions', () => {
      const unsupportedVersions = [
        '1.0.0',
        '1.5.0',
        '1.10.0',
        '1.11.4',
        '0.7.0'
      ];

      unsupportedVersions.forEach(version => {
        expect(compatibility.isVersionSupported(version)).toBe(false);
      });
    });
  });

  describe('Available Features', () => {
    it('should return correct features for version', () => {
      const features = compatibility.getAvailableFeatures('1.16.3');

      expect(features).toContain('cluster-api');
      expect(features).toContain('parameter-contexts');
      expect(features).toContain('flow-analysis-rules');
      expect(features).toContain('stateless-engine');
      expect(features).toContain('reporting-tasks');
      expect(features).toContain('controller-services');
    });

    it('should exclude unsupported features', () => {
      const features = compatibility.getAvailableFeatures('1.14.0');

      expect(features).toContain('cluster-api');
      expect(features).toContain('parameter-contexts');
      expect(features).not.toContain('flow-analysis-rules');
      expect(features).not.toContain('stateless-engine');
    });
  });

  describe('Compatibility Report', () => {
    it('should generate compatibility report for supported version', () => {
      const report = compatibility.generateCompatibilityReport('1.16.3');

      expect(report.version).toBe('1.16.3');
      expect(report.isSupported).toBe(true);
      expect(report.parsed).toEqual({
        major: 1,
        minor: 16,
        patch: 3,
        suffix: '',
        raw: '1.16.3'
      });
      expect(Array.isArray(report.supportedFeatures)).toBe(true);
      expect(Array.isArray(report.unsupportedFeatures)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should generate compatibility report for unsupported version', () => {
      const report = compatibility.generateCompatibilityReport('1.11.0');

      expect(report.version).toBe('1.11.0');
      expect(report.isSupported).toBe(false);
      expect(report.recommendations).toContain('This version is not supported. Please upgrade to NiFi 1.12.0 or later.');
    });

    it('should generate compatibility report for invalid version', () => {
      const report = compatibility.generateCompatibilityReport('invalid');

      expect(report.version).toBe('invalid');
      expect(report.isSupported).toBe(false);
      expect(report.parsed).toBeNull();
      expect(report.recommendations).toContain('Invalid version format. Please use semantic versioning (e.g., 1.16.3).');
    });
  });

  describe('Recommendations', () => {
    it('should provide upgrade recommendations', () => {
      const recommendations = compatibility.generateRecommendations('1.13.0');

      expect(recommendations).toContain('Consider upgrading to NiFi 1.16+ for Flow Analysis Rules support.');
      expect(recommendations).toContain('Consider upgrading to NiFi 1.15+ for Stateless Engine support.');
      expect(recommendations).toContain('Consider upgrading to NiFi 1.14+ for enhanced processor retry mechanisms.');
    });

    it('should provide no recommendations for latest version', () => {
      const recommendations = compatibility.generateRecommendations('1.20.0');

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('Singleton Instance', () => {
    it('should provide singleton instance', () => {
      expect(nifiVersionCompatibility).toBeInstanceOf(NiFiVersionCompatibility);
    });

    it('should return same instance', () => {
      const instance1 = nifiVersionCompatibility;
      const instance2 = nifiVersionCompatibility;

      expect(instance1).toBe(instance2);
    });
  });
});