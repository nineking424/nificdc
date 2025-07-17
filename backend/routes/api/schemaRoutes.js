const express = require('express');
const router = express.Router();
const SchemaDiscoveryService = require('../../services/schemaDiscovery');
const ConnectionManager = require('../../services/connectionManager');
const { asyncHandler } = require('../../utils/asyncHandler');
const { AppError } = require('../../utils/errors');
const { validateRequest } = require('../../utils/validation');
const { body, param, query } = require('express-validator');
const { authenticate, authorize, requirePermissions } = require('../../middleware/auth');
const { schemaDiscoveryLimiter } = require('../../middleware/rateLimiter');

// Initialize services
let schemaDiscoveryService;
let connectionManager;

/**
 * Initialize router with required services
 * @param {Object} services - Services object containing schemaDiscoveryService and connectionManager
 */
router.initialize = (services) => {
  schemaDiscoveryService = services.schemaDiscoveryService;
  connectionManager = services.connectionManager;
};

/**
 * GET /api/schemas/discover/:systemId
 * Discover schemas from a connected system
 */
router.get('/discover/:systemId',
  authenticate,
  requirePermissions(['read:schemas']),
  schemaDiscoveryLimiter,
  [
    param('systemId').isString().notEmpty().withMessage('System ID is required'),
    query('forceRefresh').optional().isBoolean().toBoolean(),
    query('includeSystemSchemas').optional().isBoolean().toBoolean(),
    query('schemaPattern').optional().isString(),
    query('tablePattern').optional().isString()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { systemId } = req.params;
    const { forceRefresh = false, includeSystemSchemas = false, schemaPattern, tablePattern } = req.query;

    // Check if system exists and user has access
    const connection = await connectionManager.getConnection(systemId);
    if (!connection) {
      throw new AppError('System not found', 404);
    }

    // Discover schemas
    const schemas = await schemaDiscoveryService.discoverSchemas(systemId, {
      forceRefresh,
      includeSystemSchemas,
      schemaPattern,
      tablePattern
    });

    res.json({
      success: true,
      data: {
        systemId,
        schemas,
        discoveredAt: new Date().toISOString(),
        cached: !forceRefresh && schemaDiscoveryService.isCached(systemId)
      },
      metadata: {
        totalSchemas: schemas.length,
        totalTables: schemas.reduce((acc, schema) => acc + schema.tables.length, 0),
        totalColumns: schemas.reduce((acc, schema) => 
          acc + schema.tables.reduce((tableAcc, table) => tableAcc + table.columns.length, 0), 0
        )
      }
    });
  })
);

/**
 * GET /api/schemas/refresh/:schemaId
 * Refresh a specific schema's metadata
 */
router.get('/refresh/:schemaId',
  authenticate,
  requirePermissions(['read:schemas']),
  [
    param('schemaId').isString().notEmpty().withMessage('Schema ID is required'),
    query('deep').optional().isBoolean().toBoolean()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { schemaId } = req.params;
    const { deep = false } = req.query;

    // Parse schemaId to get systemId and schemaName
    const [systemId, schemaName] = schemaId.split('.');
    if (!systemId || !schemaName) {
      throw new AppError('Invalid schema ID format. Expected: systemId.schemaName', 400);
    }

    // Check if system exists
    const connection = await connectionManager.getConnection(systemId);
    if (!connection) {
      throw new AppError('System not found', 404);
    }

    // Refresh schema
    const refreshedSchema = await schemaDiscoveryService.refreshSchema(systemId, schemaName, {
      deep
    });

    if (!refreshedSchema) {
      throw new AppError('Schema not found', 404);
    }

    res.json({
      success: true,
      data: {
        schema: refreshedSchema,
        refreshedAt: new Date().toISOString()
      }
    });
  })
);

/**
 * GET /api/schemas/sample/:schemaId
 * Get sample data from a specific table
 */
router.get('/sample/:schemaId',
  authenticate,
  requirePermissions(['read:schemas']),
  [
    param('schemaId').isString().notEmpty().withMessage('Schema ID is required'),
    query('tableName').isString().notEmpty().withMessage('Table name is required'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('orderBy').optional().isString(),
    query('orderDirection').optional().isIn(['asc', 'desc'])
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { schemaId } = req.params;
    const { 
      tableName, 
      limit = 100, 
      offset = 0, 
      orderBy,
      orderDirection = 'asc' 
    } = req.query;

    // Parse schemaId
    const [systemId, schemaName] = schemaId.split('.');
    if (!systemId || !schemaName) {
      throw new AppError('Invalid schema ID format. Expected: systemId.schemaName', 400);
    }

    // Check if system exists
    const connection = await connectionManager.getConnection(systemId);
    if (!connection) {
      throw new AppError('System not found', 404);
    }

    // Get sample data
    const sampleData = await schemaDiscoveryService.getSampleData(systemId, schemaName, tableName, {
      limit,
      offset,
      orderBy,
      orderDirection
    });

    res.json({
      success: true,
      data: {
        systemId,
        schemaName,
        tableName,
        samples: sampleData.rows,
        columns: sampleData.columns,
        totalRows: sampleData.totalRows
      },
      pagination: {
        limit,
        offset,
        totalRows: sampleData.totalRows,
        hasMore: offset + limit < sampleData.totalRows
      }
    });
  })
);

/**
 * GET /api/schemas/statistics/:schemaId
 * Get statistics for a specific table
 */
router.get('/statistics/:schemaId',
  authenticate,
  requirePermissions(['read:schemas']),
  [
    param('schemaId').isString().notEmpty().withMessage('Schema ID is required'),
    query('tableName').isString().notEmpty().withMessage('Table name is required')
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { schemaId } = req.params;
    const { tableName } = req.query;

    // Parse schemaId
    const [systemId, schemaName] = schemaId.split('.');
    if (!systemId || !schemaName) {
      throw new AppError('Invalid schema ID format. Expected: systemId.schemaName', 400);
    }

    // Check if system exists
    const connection = await connectionManager.getConnection(systemId);
    if (!connection) {
      throw new AppError('System not found', 404);
    }

    // Get table statistics
    const statistics = await schemaDiscoveryService.getTableStatistics(systemId, schemaName, tableName);

    res.json({
      success: true,
      data: {
        systemId,
        schemaName,
        tableName,
        statistics
      }
    });
  })
);

/**
 * POST /api/schemas/compare
 * Compare two schemas for compatibility
 */
router.post('/compare',
  authenticate,
  requirePermissions(['read:schemas']),
  [
    body('sourceSchema').isObject().withMessage('Source schema is required'),
    body('sourceSchema.systemId').isString().notEmpty(),
    body('sourceSchema.schemaName').isString().notEmpty(),
    body('sourceSchema.tableName').isString().notEmpty(),
    body('targetSchema').isObject().withMessage('Target schema is required'),
    body('targetSchema.systemId').isString().notEmpty(),
    body('targetSchema.schemaName').isString().notEmpty(),
    body('targetSchema.tableName').isString().notEmpty()
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const { sourceSchema, targetSchema } = req.body;

    // Verify both systems exist
    const sourceConnection = await connectionManager.getConnection(sourceSchema.systemId);
    const targetConnection = await connectionManager.getConnection(targetSchema.systemId);

    if (!sourceConnection) {
      throw new AppError('Source system not found', 404);
    }
    if (!targetConnection) {
      throw new AppError('Target system not found', 404);
    }

    // Compare schemas
    const comparison = await schemaDiscoveryService.compareSchemas(
      sourceSchema,
      targetSchema
    );

    res.json({
      success: true,
      data: {
        comparison,
        compatibilityScore: comparison.compatibilityScore,
        issues: comparison.issues
      }
    });
  })
);

/**
 * GET /api/schemas/cache/status
 * Get cache status and statistics
 */
router.get('/cache/status',
  authenticate,
  authorize(['admin', 'developer']),
  asyncHandler(async (req, res) => {
    const cacheStatus = schemaDiscoveryService.getCacheStatus();

    res.json({
      success: true,
      data: cacheStatus
    });
  })
);

/**
 * DELETE /api/schemas/cache/:systemId?
 * Clear cache for a specific system or all systems
 */
router.delete('/cache/:systemId?',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { systemId } = req.params;

    if (systemId) {
      // Clear cache for specific system
      schemaDiscoveryService.clearCache(systemId);
      res.json({
        success: true,
        message: `Cache cleared for system: ${systemId}`
      });
    } else {
      // Clear all cache
      schemaDiscoveryService.clearAllCache();
      res.json({
        success: true,
        message: 'All schema cache cleared'
      });
    }
  })
);

module.exports = router;