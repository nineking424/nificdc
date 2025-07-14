const express = require('express');
const router = express.Router();
const System = require('../models/System');
const ConnectionTestService = require('../services/ConnectionTestService');
const { Op } = require('sequelize');

const connectionTestService = new ConnectionTestService();

/**
 * @swagger
 * components:
 *   schemas:
 *     System:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - connectionInfo
 *       properties:
 *         id:
 *           type: string
 *           description: System ID
 *         name:
 *           type: string
 *           description: System name
 *         type:
 *           type: string
 *           enum: [oracle, postgresql, sqlite, ftp, local_fs]
 *           description: System type
 *         connectionInfo:
 *           type: object
 *           description: Connection information (encrypted)
 *         isActive:
 *           type: boolean
 *           description: Whether the system is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/systems:
 *   get:
 *     summary: Get all systems
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of systems
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/System'
 */
router.get('/', async (req, res) => {
  try {
    const { search, type, isActive, page = 1, limit = 10 } = req.query;
    
    // 검색 조건 구성
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (type) {
      where.type = type;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    // 페이지네이션
    const offset = (page - 1) * limit;
    
    const { count, rows } = await System.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
    
  } catch (error) {
    console.error('Get systems error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch systems',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/systems/{id}:
 *   get:
 *     summary: Get system by ID
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     responses:
 *       200:
 *         description: System details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/System'
 *       404:
 *         description: System not found
 */
router.get('/:id', async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    
    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }
    
    res.json({
      success: true,
      data: system
    });
    
  } catch (error) {
    console.error('Get system error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/systems:
 *   post:
 *     summary: Create new system
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/System'
 *     responses:
 *       201:
 *         description: System created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/System'
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, description, connectionInfo, isActive = true } = req.body;
    
    // 기본 유효성 검증
    if (!name || !type || !connectionInfo) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'name, type, and connectionInfo are required'
      });
    }
    
    // 시스템 생성
    const system = await System.create({
      name,
      type,
      description,
      connectionInfo,
      isActive
    });
    
    res.status(201).json({
      success: true,
      data: system,
      message: 'System created successfully'
    });
    
  } catch (error) {
    console.error('Create system error:', error);
    
    // Sequelize 유효성 검증 오류 처리
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }
    
    // 중복 이름 오류 처리
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'System name already exists',
        details: 'A system with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create system',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/systems/{id}:
 *   put:
 *     summary: Update system
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/System'
 *     responses:
 *       200:
 *         description: System updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/System'
 *       404:
 *         description: System not found
 */
router.put('/:id', async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    
    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }
    
    const { name, type, description, connectionInfo, isActive } = req.body;
    
    // 업데이트할 필드만 추출
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (connectionInfo !== undefined) updateData.connectionInfo = connectionInfo;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    await system.update(updateData);
    
    res.json({
      success: true,
      data: system,
      message: 'System updated successfully'
    });
    
  } catch (error) {
    console.error('Update system error:', error);
    
    // Sequelize 유효성 검증 오류 처리
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }
    
    // 중복 이름 오류 처리
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'System name already exists',
        details: 'A system with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update system',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/systems/{id}:
 *   delete:
 *     summary: Delete system
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     responses:
 *       204:
 *         description: System deleted
 *       404:
 *         description: System not found
 */
router.delete('/:id', async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    
    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }
    
    await system.destroy();
    
    res.json({
      success: true,
      message: 'System deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete system error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete system',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/systems/{id}/test:
 *   post:
 *     summary: Test system connection
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: System ID
 *     responses:
 *       200:
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 responseTime:
 *                   type: number
 */
/**
 * @swagger
 * /api/v1/systems/test-connection:
 *   post:
 *     summary: Test connection without saving system
 *     tags: [Systems]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               connectionInfo:
 *                 type: object
 *               timeout:
 *                 type: number
 *               testQuery:
 *                 type: string
 *               validateSSL:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { name, type, connectionInfo, timeout, testQuery, validateSSL, collectMetrics } = req.body;
    
    if (!name || !type || !connectionInfo) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'name, type, and connectionInfo are required'
      });
    }
    
    // 임시 시스템 객체 생성 (저장하지 않음)
    const tempSystem = {
      name,
      type,
      connectionInfo
    };
    
    // 연결 테스트 실행
    const testResult = await connectionTestService.testConnection(tempSystem, {
      timeout: timeout || 30000,
      testQuery,
      validateSSL: validateSSL !== false,
      collectMetrics: collectMetrics === true
    });
    
    res.json({
      success: true,
      data: testResult,
      message: testResult.success ? 'Connection test successful' : 'Connection test failed'
    });
    
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error.message
    });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const system = await System.findByPk(req.params.id);
    
    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }
    
    const { timeout, testQuery, validateSSL, collectMetrics } = req.body;
    
    // 연결 테스트 실행
    const testResult = await connectionTestService.testConnection(system, {
      timeout: timeout || 30000,
      testQuery,
      validateSSL: validateSSL !== false,
      collectMetrics: collectMetrics === true
    });
    
    // 테스트 결과를 데이터베이스에 저장
    await system.update({
      lastConnectionStatus: testResult.success ? 'success' : 'failed',
      lastConnectionTest: new Date(),
      lastConnectionMessage: testResult.message || testResult.error?.message,
      lastConnectionLatency: testResult.connectionTime
    });
    
    res.json({
      success: true,
      data: testResult,
      message: testResult.success ? 'Connection test successful' : 'Connection test failed'
    });
    
  } catch (error) {
    console.error('Connection test error:', error);
    
    // 테스트 실패를 데이터베이스에 기록
    try {
      const system = await System.findByPk(req.params.id);
      if (system) {
        await system.update({
          lastConnectionStatus: 'failed',
          lastConnectionTest: new Date(),
          lastConnectionMessage: error.message,
          lastConnectionLatency: null
        });
      }
    } catch (updateError) {
      console.error('Failed to update system status:', updateError);
    }
    
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error.message
    });
  }
});

module.exports = router;