const express = require('express');
const router = express.Router();
const { authorize } = require('../../middleware/rbac');
const auditLogger = require('../../services/auditLogger');
const logger = require('../utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     DataSchema:
 *       type: object
 *       required:
 *         - systemId
 *         - name
 *         - schemaDefinition
 *       properties:
 *         id:
 *           type: string
 *           description: Schema ID
 *         systemId:
 *           type: string
 *           description: System ID
 *         name:
 *           type: string
 *           description: Schema name
 *         version:
 *           type: integer
 *           description: Schema version
 *         schemaDefinition:
 *           type: object
 *           description: Schema definition (JSON)
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/data:
 *   get:
 *     summary: Get all data schemas
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: systemId
 *         schema:
 *           type: string
 *         description: Filter by system ID
 *     responses:
 *       200:
 *         description: List of data schemas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DataSchema'
 */
// 데이터 스키마 목록 조회 - 읽기 권한 필요
router.get('/', authorize('schemas', 'read'), async (req, res) => {
  try {
    const { systemId } = req.query;
    
    const { DataSchema } = require('../models');
    let whereClause = {};
    
    if (systemId) {
      whereClause.systemId = systemId;
    }
    
    const schemas = await DataSchema.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    const formattedSchemas = schemas.map(schema => ({
      id: schema.id,
      systemId: schema.systemId,
      name: schema.name,
      version: schema.version,
      schemaDefinition: schema.schemaDefinition,
      isActive: schema.isActive,
      createdAt: schema.createdAt,
      updatedAt: schema.updatedAt
    }));

    await auditLogger.log({
      type: 'DATA_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'schemas',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: formattedSchemas,
      total: formattedSchemas.length
    });
  } catch (error) {
    logger.error('스키마 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schemas'
    });
  }
});

// 시스템 스키마 자동 탐색 - 새로운 엔드포인트
router.post('/discover/:systemId', authorize('schemas', 'create'), async (req, res) => {
  try {
    const { systemId } = req.params;
    const { saveSchemas = false } = req.body;
    
    // 시스템 조회
    const { System } = require('../models');
    const system = await System.findByPk(systemId);
    
    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }

    // 스키마 탐색 실행
    const discoveredSchemas = await discoverSystemSchemas(system);
    
    let savedSchemas = [];
    
    // 스키마 저장 옵션이 활성화된 경우
    if (saveSchemas && discoveredSchemas.length > 0) {
      const { DataSchema } = require('../models');
      
      for (const schema of discoveredSchemas) {
        try {
          const savedSchema = await DataSchema.create({
            systemId: systemId,
            name: schema.name,
            version: 1,
            schemaDefinition: schema,
            isActive: true
          });
          
          savedSchemas.push({
            id: savedSchema.id,
            name: savedSchema.name,
            version: savedSchema.version
          });
        } catch (error) {
          logger.warn(`스키마 저장 실패: ${schema.name}`, error.message);
        }
      }
    }
    
    await auditLogger.log({
      type: 'SCHEMA_DISCOVERY',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DISCOVER',
      resource: 'schemas',
      resourceId: systemId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        schemasFound: discoveredSchemas.length,
        schemasSaved: savedSchemas.length
      }
    });

    res.json({
      success: true,
      data: {
        systemId,
        systemName: system.name,
        schemasDiscovered: discoveredSchemas.length,
        schemasSaved: savedSchemas.length,
        schemas: discoveredSchemas,
        savedSchemas
      }
    });
  } catch (error) {
    logger.error('스키마 탐색 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover schemas'
    });
  }
});

/**
 * @swagger
 * /api/v1/data/{id}:
 *   get:
 *     summary: Get data schema by ID
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *     responses:
 *       200:
 *         description: Data schema details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataSchema'
 *       404:
 *         description: Schema not found
 */
router.get('/:id', (req, res) => {
  res.json({ message: 'Get data schema by ID', id: req.params.id });
});

/**
 * @swagger
 * /api/v1/data:
 *   post:
 *     summary: Create new data schema
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DataSchema'
 *     responses:
 *       201:
 *         description: Data schema created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataSchema'
 */
router.post('/', (req, res) => {
  res.status(201).json({ message: 'Create data schema', data: req.body });
});

/**
 * @swagger
 * /api/v1/data/{id}:
 *   put:
 *     summary: Update data schema
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DataSchema'
 *     responses:
 *       200:
 *         description: Data schema updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DataSchema'
 *       404:
 *         description: Schema not found
 */
router.put('/:id', (req, res) => {
  res.json({ message: 'Update data schema', id: req.params.id, data: req.body });
});

/**
 * @swagger
 * /api/v1/data/{id}:
 *   delete:
 *     summary: Delete data schema
 *     tags: [Data Schemas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Schema ID
 *     responses:
 *       204:
 *         description: Data schema deleted
 *       404:
 *         description: Schema not found
 */
router.delete('/:id', (req, res) => {
  res.status(204).send();
});

// 스키마 탐색 헬퍼 함수
async function discoverSystemSchemas(system) {
  // 시스템 타입에 따라 다른 스키마 탐색 로직 실행
  switch (system.type) {
    case 'postgresql':
      return await discoverPostgreSQLSchemas(system);
    case 'mysql':
      return await discoverMySQLSchemas(system);
    case 'oracle':
      return await discoverOracleSchemas(system);
    case 'sqlite':
      return await discoverSQLiteSchemas(system);
    default:
      return [];
  }
}

async function discoverPostgreSQLSchemas(system) {
  // TODO: 실제 PostgreSQL 스키마 탐색 구현
  // 현재는 모의 데이터 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          name: 'public.users',
          type: 'table',
          schema: 'public',
          table: 'users',
          columns: [
            { name: 'id', type: 'bigint', nullable: false, primaryKey: true },
            { name: 'username', type: 'varchar(50)', nullable: false },
            { name: 'email', type: 'varchar(100)', nullable: true },
            { name: 'created_at', type: 'timestamp', nullable: false },
            { name: 'updated_at', type: 'timestamp', nullable: false }
          ],
          indexes: ['PRIMARY', 'users_username_unique', 'users_email_index']
        },
        {
          name: 'public.orders',
          type: 'table',
          schema: 'public',
          table: 'orders',
          columns: [
            { name: 'id', type: 'bigint', nullable: false, primaryKey: true },
            { name: 'user_id', type: 'bigint', nullable: false },
            { name: 'amount', type: 'decimal(10,2)', nullable: false },
            { name: 'status', type: 'varchar(20)', nullable: false },
            { name: 'created_at', type: 'timestamp', nullable: false }
          ],
          indexes: ['PRIMARY', 'orders_user_id_index', 'orders_status_index']
        }
      ]);
    }, Math.random() * 2000 + 500);
  });
}

async function discoverMySQLSchemas(system) {
  // TODO: 실제 MySQL 스키마 탐색 구현
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          name: 'analytics.events',
          type: 'table',
          schema: 'analytics',
          table: 'events',
          columns: [
            { name: 'id', type: 'bigint', nullable: false, primaryKey: true },
            { name: 'event_type', type: 'varchar(100)', nullable: false },
            { name: 'user_id', type: 'bigint', nullable: true },
            { name: 'properties', type: 'json', nullable: true },
            { name: 'timestamp', type: 'datetime', nullable: false }
          ],
          indexes: ['PRIMARY', 'events_event_type_index', 'events_timestamp_index']
        }
      ]);
    }, Math.random() * 1500 + 300);
  });
}

async function discoverOracleSchemas(system) {
  // TODO: 실제 Oracle 스키마 탐색 구현
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          name: 'PROD.CUSTOMERS',
          type: 'table',
          schema: 'PROD',
          table: 'CUSTOMERS',
          columns: [
            { name: 'CUSTOMER_ID', type: 'NUMBER(10)', nullable: false, primaryKey: true },
            { name: 'CUSTOMER_NAME', type: 'VARCHAR2(100)', nullable: false },
            { name: 'EMAIL', type: 'VARCHAR2(100)', nullable: true },
            { name: 'PHONE', type: 'VARCHAR2(20)', nullable: true },
            { name: 'CREATED_DATE', type: 'DATE', nullable: false }
          ],
          indexes: ['PK_CUSTOMERS', 'IDX_CUSTOMERS_EMAIL']
        }
      ]);
    }, Math.random() * 2500 + 800);
  });
}

async function discoverSQLiteSchemas(system) {
  // TODO: 실제 SQLite 스키마 탐색 구현
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          name: 'main.products',
          type: 'table',
          schema: 'main',
          table: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'name', type: 'TEXT', nullable: false },
            { name: 'price', type: 'REAL', nullable: false },
            { name: 'category', type: 'TEXT', nullable: true }
          ],
          indexes: ['sqlite_autoindex_products_1']
        }
      ]);
    }, Math.random() * 1000 + 200);
  });
}

module.exports = router;