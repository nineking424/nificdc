const nock = require('nock');
const NiFiClient = require('../../src/services/nifiClient');
const { nifiVersionCompatibility } = require('../../src/services/nifiVersionCompatibility');

describe('NiFiClient', () => {
  let client;
  let baseUrl;

  beforeEach(() => {
    baseUrl = 'http://localhost:8080/nifi-api';
    client = new NiFiClient({
      baseUrl: baseUrl,
      username: 'admin',
      password: 'admin',
      timeout: 5000
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Authentication', () => {
    it('should authenticate successfully', async () => {
      const mockToken = 'mock-jwt-token';
      
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, mockToken);

      const token = await client.authenticate();

      expect(token).toBe(mockToken);
      expect(client.token).toBe(mockToken);
      expect(client.tokenExpiry).toBeDefined();
    });

    it('should handle authentication failure', async () => {
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(401, { error: 'Invalid credentials' });

      await expect(client.authenticate()).rejects.toThrow('NiFi authentication failed');
      expect(client.token).toBeNull();
    });

    it('should reuse valid token', async () => {
      const mockToken = 'mock-jwt-token';
      
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, mockToken);

      const token1 = await client.authenticate();
      const token2 = await client.authenticate();

      expect(token1).toBe(mockToken);
      expect(token2).toBe(mockToken);
      expect(nock.pendingMocks().length).toBe(0);
    });

    it('should force re-authentication when requested', async () => {
      const mockToken1 = 'mock-jwt-token-1';
      const mockToken2 = 'mock-jwt-token-2';
      
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, mockToken1);

      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, mockToken2);

      const token1 = await client.authenticate();
      const token2 = await client.authenticate(true);

      expect(token1).toBe(mockToken1);
      expect(token2).toBe(mockToken2);
    });
  });

  describe('System Information', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should get system diagnostics', async () => {
      const mockDiagnostics = {
        systemDiagnostics: {
          aggregateSnapshot: {
            timestamp: '2023-01-01T00:00:00.000Z',
            uptime: '1 day, 2 hours, 3 minutes',
            versionInfo: {
              niFiVersion: '1.16.3'
            },
            availableProcessors: 8,
            usedHeap: 1024000000,
            freeHeap: 512000000,
            totalHeap: 1536000000,
            maxHeap: 2048000000
          }
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(200, mockDiagnostics);

      const result = await client.getSystemDiagnostics();

      expect(result).toBeDefined();
      expect(result.version).toBe('1.16.3');
      expect(result.uptime).toBe('1 day, 2 hours, 3 minutes');
      expect(client.version).toBe('1.16.3');
    });

    it('should get cluster summary', async () => {
      const mockClusterSummary = {
        clusterSummary: {
          connectedNodes: 3,
          totalNodes: 3,
          clustered: true,
          connectedToCluster: true
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/cluster/summary')
        .reply(200, mockClusterSummary);

      const result = await client.getClusterSummary();

      expect(result).toBeDefined();
      expect(result.connected).toBe(3);
      expect(result.total).toBe(3);
      expect(result.clustered).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(500, { error: 'Internal server error' });

      await expect(client.getSystemDiagnostics()).rejects.toThrow('Failed to get system diagnostics');
    });
  });

  describe('Process Group Management', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should create process group', async () => {
      const mockProcessGroup = {
        id: 'process-group-id',
        component: {
          id: 'process-group-id',
          name: 'Test Process Group',
          position: { x: 100, y: 200 }
        }
      };

      nock('http://localhost:8080')
        .post('/nifi-api/process-groups/root/process-groups')
        .reply(200, mockProcessGroup);

      const result = await client.createProcessGroup('root', 'Test Process Group', { x: 100, y: 200 });

      expect(result).toBeDefined();
      expect(result.id).toBe('process-group-id');
      expect(result.component.name).toBe('Test Process Group');
    });

    it('should get root process group', async () => {
      const mockRootGroup = {
        id: 'root',
        component: {
          id: 'root',
          name: 'NiFi Flow',
          processGroupCount: 2,
          runningCount: 1,
          stoppedCount: 1
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/process-groups/root')
        .reply(200, mockRootGroup);

      const result = await client.getRootProcessGroup();

      expect(result).toBeDefined();
      expect(result.id).toBe('root');
      expect(result.component.name).toBe('NiFi Flow');
    });
  });

  describe('Processor Management', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should create processor', async () => {
      const mockProcessor = {
        id: 'processor-id',
        component: {
          id: 'processor-id',
          name: 'Test Processor',
          type: 'org.apache.nifi.processors.standard.GenerateFlowFile',
          state: 'STOPPED'
        }
      };

      nock('http://localhost:8080')
        .post('/nifi-api/process-groups/root/processors')
        .reply(200, mockProcessor);

      const result = await client.createProcessor(
        'root',
        'org.apache.nifi.processors.standard.GenerateFlowFile',
        'Test Processor',
        { x: 100, y: 200 }
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('processor-id');
      expect(result.component.name).toBe('Test Processor');
    });

    it('should get processor', async () => {
      const mockProcessor = {
        id: 'processor-id',
        component: {
          id: 'processor-id',
          name: 'Test Processor',
          type: 'org.apache.nifi.processors.standard.GenerateFlowFile',
          state: 'RUNNING'
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/processors/processor-id')
        .reply(200, mockProcessor);

      const result = await client.getProcessor('processor-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('processor-id');
      expect(result.component.state).toBe('RUNNING');
    });

    it('should start processor', async () => {
      const mockProcessor = {
        revision: { version: 1 },
        component: {
          id: 'processor-id',
          state: 'STOPPED'
        }
      };

      const updatedProcessor = {
        revision: { version: 2 },
        component: {
          id: 'processor-id',
          state: 'RUNNING'
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/processors/processor-id')
        .reply(200, mockProcessor);

      nock('http://localhost:8080')
        .put('/nifi-api/processors/processor-id/run-status')
        .reply(200, updatedProcessor);

      const result = await client.startProcessor('processor-id');

      expect(result).toBeDefined();
      expect(result.component.state).toBe('RUNNING');
    });

    it('should stop processor', async () => {
      const mockProcessor = {
        revision: { version: 1 },
        component: {
          id: 'processor-id',
          state: 'RUNNING'
        }
      };

      const updatedProcessor = {
        revision: { version: 2 },
        component: {
          id: 'processor-id',
          state: 'STOPPED'
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/processors/processor-id')
        .reply(200, mockProcessor);

      nock('http://localhost:8080')
        .put('/nifi-api/processors/processor-id/run-status')
        .reply(200, updatedProcessor);

      const result = await client.stopProcessor('processor-id');

      expect(result).toBeDefined();
      expect(result.component.state).toBe('STOPPED');
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should create connection', async () => {
      const mockConnection = {
        id: 'connection-id',
        component: {
          id: 'connection-id',
          name: 'Test Connection',
          source: { id: 'source-id' },
          destination: { id: 'destination-id' },
          selectedRelationships: ['success']
        }
      };

      nock('http://localhost:8080')
        .post('/nifi-api/process-groups/root/connections')
        .reply(200, mockConnection);

      const result = await client.createConnection(
        'source-id',
        'destination-id',
        ['success'],
        'root',
        'Test Connection'
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('connection-id');
      expect(result.component.selectedRelationships).toEqual(['success']);
    });
  });

  describe('Flow Management', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should get processor types', async () => {
      const mockProcessorTypes = {
        processorTypes: [
          {
            type: 'org.apache.nifi.processors.standard.GenerateFlowFile',
            displayName: 'GenerateFlowFile',
            description: 'Generates FlowFiles with random data'
          }
        ]
      };

      nock('http://localhost:8080')
        .get('/nifi-api/flow/processor-types')
        .reply(200, mockProcessorTypes);

      const result = await client.getProcessorTypes();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('org.apache.nifi.processors.standard.GenerateFlowFile');
    });

    it('should get flow status', async () => {
      const mockFlowStatus = {
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

      nock('http://localhost:8080')
        .get('/nifi-api/flow/status')
        .reply(200, mockFlowStatus);

      const result = await client.getFlowStatus();

      expect(result).toBeDefined();
      expect(result.activeThreadCount).toBe(5);
      expect(result.queuedCount).toBe(100);
      expect(result.flowFilesIn).toBe(50);
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should perform health check successfully', async () => {
      const mockDiagnostics = {
        systemDiagnostics: {
          aggregateSnapshot: {
            timestamp: '2023-01-01T00:00:00.000Z',
            uptime: '1 day, 2 hours, 3 minutes',
            versionInfo: {
              niFiVersion: '1.16.3'
            }
          }
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(200, mockDiagnostics);

      const result = await client.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.version).toBe('1.16.3');
      expect(result.uptime).toBe('1 day, 2 hours, 3 minutes');
      expect(result.responseTime).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle health check failure', async () => {
      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(500, { error: 'Internal server error' });

      const result = await client.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Connection Status', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should check connection status', async () => {
      const mockDiagnostics = {
        systemDiagnostics: {
          aggregateSnapshot: {
            timestamp: '2023-01-01T00:00:00.000Z'
          }
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(200, mockDiagnostics);

      const result = await client.isConnected();

      expect(result).toBe(true);
    });

    it('should detect disconnection', async () => {
      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(500, { error: 'Connection refused' });

      const result = await client.isConnected();

      expect(result).toBe(false);
    });
  });

  describe('Version Compatibility', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should get version information', async () => {
      const mockDiagnostics = {
        systemDiagnostics: {
          aggregateSnapshot: {
            versionInfo: {
              niFiVersion: '1.16.3'
            }
          }
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(200, mockDiagnostics);

      const version = await client.getVersion();

      expect(version).toBe('1.16.3');
    });

    it('should get compatibility report', async () => {
      const mockDiagnostics = {
        systemDiagnostics: {
          aggregateSnapshot: {
            versionInfo: {
              niFiVersion: '1.16.3'
            }
          }
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(200, mockDiagnostics);

      const report = await client.getCompatibilityReport();

      expect(report).toBeDefined();
      expect(report.version).toBe('1.16.3');
      expect(report.isSupported).toBe(true);
      expect(Array.isArray(report.supportedFeatures)).toBe(true);
    });

    it('should check feature support', async () => {
      const mockDiagnostics = {
        systemDiagnostics: {
          aggregateSnapshot: {
            versionInfo: {
              niFiVersion: '1.16.3'
            }
          }
        }
      };

      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(200, mockDiagnostics);

      const isSupported = await client.isFeatureSupported('flow-analysis-rules');

      expect(isSupported).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Mock authentication
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'mock-token');
    });

    it('should handle 401 errors with token refresh', async () => {
      const mockDiagnostics = {
        systemDiagnostics: {
          aggregateSnapshot: {
            timestamp: '2023-01-01T00:00:00.000Z'
          }
        }
      };

      // First request fails with 401
      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(401, { error: 'Unauthorized' });

      // Token refresh
      nock('http://localhost:8080')
        .post('/nifi-api/access/token')
        .reply(200, 'new-token');

      // Retry with new token
      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .reply(200, mockDiagnostics);

      const result = await client.getSystemDiagnostics();

      expect(result).toBeDefined();
      expect(client.token).toBe('new-token');
    });

    it('should handle network timeouts', async () => {
      nock('http://localhost:8080')
        .get('/nifi-api/system-diagnostics')
        .delayConnection(6000) // Delay longer than timeout
        .reply(200, {});

      await expect(client.getSystemDiagnostics()).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should disconnect properly', () => {
      client.token = 'test-token';
      client.tokenExpiry = new Date();
      client.version = '1.16.3';

      client.disconnect();

      expect(client.token).toBeNull();
      expect(client.tokenExpiry).toBeNull();
      expect(client.version).toBeNull();
    });
  });
});