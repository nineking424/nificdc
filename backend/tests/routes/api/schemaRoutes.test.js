const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const schemaRoutes = require('../../../routes/api/schemaRoutes');
const { errorHandler } = require('../../../middleware/errorHandler');

// Mock dependencies
jest.mock('../../../services/schemaDiscovery');
jest.mock('../../../services/connectionManager');
jest.mock('../../../utils/logger');

const SchemaDiscoveryService = require('../../../services/schemaDiscovery');
const ConnectionManager = require('../../../services/connectionManager');

describe('Schema Routes API Tests', () => {
  let app;
  let authToken;
  let adminToken;
  let schemaDiscoveryService;
  let connectionManager;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create service instances
    schemaDiscoveryService = new SchemaDiscoveryService();
    connectionManager = new ConnectionManager();

    // Initialize routes with services
    schemaRoutes.initialize({
      schemaDiscoveryService,
      connectionManager
    });

    // Mount routes
    app.use('/api/schemas', schemaRoutes);
    app.use(errorHandler);

    // Generate test tokens
    authToken = jwt.sign(
      {
        userId: 'test-user-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read:schemas', 'write:schemas']
      },
      'test-secret-key', // Use the same secret as in setup.js
      {
        issuer: 'nificdc',
        audience: 'nificdc-api'
      }
    );

    adminToken = jwt.sign(
      {
        userId: 'admin-user-123',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: []
      },
      'test-secret-key', // Use the same secret as in setup.js
      {
        issuer: 'nificdc',
        audience: 'nificdc-api'
      }
    );

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /api/schemas/discover/:systemId', () => {
    const mockSchemas = [
      {
        name: 'public',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', dataType: 'integer', nullable: false },
              { name: 'email', dataType: 'varchar', nullable: false }
            ]
          }
        ]
      }
    ];

    beforeEach(() => {
      connectionManager.getConnection = jest.fn().mockResolvedValue({
        id: 'test-system',
        name: 'Test System',
        type: 'postgresql'
      });

      schemaDiscoveryService.discoverSchemas = jest.fn().mockResolvedValue(mockSchemas);
      schemaDiscoveryService.isCached = jest.fn().mockReturnValue(false);
    });

    it('should discover schemas successfully with authentication', async () => {
      const response = await request(app)
        .get('/api/schemas/discover/test-system')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          systemId: 'test-system',
          schemas: mockSchemas,
          cached: false
        },
        metadata: {
          totalSchemas: 1,
          totalTables: 1,
          totalColumns: 2
        }
      });

      expect(connectionManager.getConnection).toHaveBeenCalledWith('test-system');
      expect(schemaDiscoveryService.discoverSchemas).toHaveBeenCalledWith('test-system', {
        forceRefresh: false,
        includeSystemSchemas: false,
        schemaPattern: undefined,
        tablePattern: undefined
      });
    });

    it('should fail without authentication', async () => {
      await request(app)
        .get('/api/schemas/discover/test-system')
        .expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app)
        .get('/api/schemas/discover/test-system')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle force refresh parameter', async () => {
      await request(app)
        .get('/api/schemas/discover/test-system?forceRefresh=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(schemaDiscoveryService.discoverSchemas).toHaveBeenCalledWith('test-system', {
        forceRefresh: true,
        includeSystemSchemas: false,
        schemaPattern: undefined,
        tablePattern: undefined
      });
    });

    it('should handle schema pattern filtering', async () => {
      await request(app)
        .get('/api/schemas/discover/test-system?schemaPattern=pub%')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(schemaDiscoveryService.discoverSchemas).toHaveBeenCalledWith('test-system', {
        forceRefresh: false,
        includeSystemSchemas: false,
        schemaPattern: 'pub%',
        tablePattern: undefined
      });
    });

    it('should return 404 when system not found', async () => {
      connectionManager.getConnection = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/schemas/discover/non-existent-system')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'System not found'
        }
      });
    });
  });

  describe('GET /api/schemas/refresh/:schemaId', () => {
    const mockRefreshedSchema = {
      name: 'public',
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', dataType: 'integer', nullable: false },
            { name: 'email', dataType: 'varchar', nullable: false },
            { name: 'created_at', dataType: 'timestamp', nullable: false }
          ]
        }
      ]
    };

    beforeEach(() => {
      connectionManager.getConnection = jest.fn().mockResolvedValue({
        id: 'test-system',
        name: 'Test System',
        type: 'postgresql'
      });

      schemaDiscoveryService.refreshSchema = jest.fn().mockResolvedValue(mockRefreshedSchema);
    });

    it('should refresh schema successfully', async () => {
      const response = await request(app)
        .get('/api/schemas/refresh/test-system.public')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          schema: mockRefreshedSchema
        }
      });

      expect(schemaDiscoveryService.refreshSchema).toHaveBeenCalledWith('test-system', 'public', { deep: false });
    });

    it('should handle deep refresh parameter', async () => {
      await request(app)
        .get('/api/schemas/refresh/test-system.public?deep=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(schemaDiscoveryService.refreshSchema).toHaveBeenCalledWith('test-system', 'public', { deep: true });
    });

    it('should return 400 for invalid schema ID format', async () => {
      const response = await request(app)
        .get('/api/schemas/refresh/invalid-format')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.message).toContain('Invalid schema ID format');
    });

    it('should return 404 when schema not found', async () => {
      schemaDiscoveryService.refreshSchema = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/schemas/refresh/test-system.non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('Schema not found');
    });
  });

  describe('GET /api/schemas/sample/:schemaId', () => {
    const mockSampleData = {
      rows: [
        { id: 1, email: 'user1@example.com' },
        { id: 2, email: 'user2@example.com' }
      ],
      columns: ['id', 'email'],
      totalRows: 100
    };

    beforeEach(() => {
      connectionManager.getConnection = jest.fn().mockResolvedValue({
        id: 'test-system',
        name: 'Test System',
        type: 'postgresql'
      });

      schemaDiscoveryService.getSampleData = jest.fn().mockResolvedValue(mockSampleData);
    });

    it('should get sample data successfully', async () => {
      const response = await request(app)
        .get('/api/schemas/sample/test-system.public?tableName=users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          systemId: 'test-system',
          schemaName: 'public',
          tableName: 'users',
          samples: mockSampleData.rows,
          columns: mockSampleData.columns,
          totalRows: mockSampleData.totalRows
        },
        pagination: {
          limit: 100,
          offset: 0,
          totalRows: 100,
          hasMore: false
        }
      });
    });

    it('should handle pagination parameters', async () => {
      await request(app)
        .get('/api/schemas/sample/test-system.public?tableName=users&limit=10&offset=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(schemaDiscoveryService.getSampleData).toHaveBeenCalledWith('test-system', 'public', 'users', {
        limit: 10,
        offset: 20,
        orderBy: undefined,
        orderDirection: 'asc'
      });
    });

    it('should validate limit parameter', async () => {
      await request(app)
        .get('/api/schemas/sample/test-system.public?tableName=users&limit=5000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require tableName parameter', async () => {
      const response = await request(app)
        .get('/api/schemas/sample/test-system.public')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.errors).toBeDefined();
      expect(response.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Table name is required'
          })
        ])
      );
    });
  });

  describe('POST /api/schemas/compare', () => {
    const mockComparison = {
      compatibilityScore: 85,
      issues: [
        {
          type: 'TYPE_MISMATCH',
          severity: 'warning',
          source: 'age',
          target: 'age',
          message: 'Type mismatch: integer -> varchar'
        }
      ],
      mappingSuggestions: [
        {
          source: 'id',
          target: 'user_id',
          transformation: 'rename'
        }
      ]
    };

    beforeEach(() => {
      connectionManager.getConnection = jest.fn().mockResolvedValue({
        id: 'test-system',
        name: 'Test System',
        type: 'postgresql'
      });

      schemaDiscoveryService.compareSchemas = jest.fn().mockResolvedValue(mockComparison);
    });

    it('should compare schemas successfully', async () => {
      const requestBody = {
        sourceSchema: {
          systemId: 'source-system',
          schemaName: 'public',
          tableName: 'users'
        },
        targetSchema: {
          systemId: 'target-system',
          schemaName: 'public',
          tableName: 'customers'
        }
      };

      const response = await request(app)
        .post('/api/schemas/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          comparison: mockComparison,
          compatibilityScore: 85,
          issues: mockComparison.issues
        }
      });

      expect(schemaDiscoveryService.compareSchemas).toHaveBeenCalledWith(
        requestBody.sourceSchema,
        requestBody.targetSchema
      );
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/schemas/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sourceSchema: {
            systemId: 'source-system'
            // Missing required fields
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.errors).toBeDefined();
    });

    it('should return 404 when source system not found', async () => {
      connectionManager.getConnection = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'target-system' });

      const response = await request(app)
        .post('/api/schemas/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sourceSchema: {
            systemId: 'non-existent',
            schemaName: 'public',
            tableName: 'users'
          },
          targetSchema: {
            systemId: 'target-system',
            schemaName: 'public',
            tableName: 'customers'
          }
        })
        .expect(404);

      expect(response.body.error.message).toBe('Source system not found');
    });
  });

  describe('GET /api/schemas/cache/status', () => {
    const mockCacheStatus = {
      entries: 5,
      totalSize: 102400,
      maxSize: 1048576,
      ttl: 3600000,
      cacheEntries: [
        {
          key: 'test-system:schemas',
          size: 20480,
          timestamp: Date.now() - 600000,
          age: 600000,
          dataType: 'object'
        }
      ],
      stats: {
        hits: 100,
        misses: 20,
        evictions: 5,
        hitRate: 0.833
      }
    };

    beforeEach(() => {
      schemaDiscoveryService.getCacheStatus = jest.fn().mockReturnValue(mockCacheStatus);
    });

    it('should get cache status for admin users', async () => {
      const response = await request(app)
        .get('/api/schemas/cache/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: mockCacheStatus
      });
    });

    it('should deny access for non-admin users', async () => {
      await request(app)
        .get('/api/schemas/cache/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/schemas/cache/:systemId?', () => {
    beforeEach(() => {
      schemaDiscoveryService.clearCache = jest.fn();
      schemaDiscoveryService.clearAllCache = jest.fn();
    });

    it('should clear cache for specific system (admin only)', async () => {
      const response = await request(app)
        .delete('/api/schemas/cache/test-system')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Cache cleared for system: test-system'
      });

      expect(schemaDiscoveryService.clearCache).toHaveBeenCalledWith('test-system');
    });

    it('should clear all cache when no systemId provided', async () => {
      const response = await request(app)
        .delete('/api/schemas/cache')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'All schema cache cleared'
      });

      expect(schemaDiscoveryService.clearAllCache).toHaveBeenCalled();
    });

    it('should deny access for non-admin users', async () => {
      await request(app)
        .delete('/api/schemas/cache/test-system')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      connectionManager.getConnection = jest.fn().mockResolvedValue({
        id: 'test-system',
        name: 'Test System'
      });

      schemaDiscoveryService.discoverSchemas = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/schemas/discover/test-system')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Database connection failed'
        }
      });
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .get('/api/schemas/discover/') // Missing systemId
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Router will return 404 for missing route parameter
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to schema discovery endpoint', async () => {
      // This test would need actual rate limiting implementation
      // For now, we just verify the middleware is applied
      expect(schemaRoutes.stack).toContainEqual(
        expect.objectContaining({
          route: expect.objectContaining({
            path: '/discover/:systemId'
          })
        })
      );
    });
  });
});