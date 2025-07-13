const express = require('express');
const router = express.Router();
const { System } = require('../models');
const { SystemValidator } = require('./src/utils/systemValidator');
const ConnectionTester = require('./src/utils/connectionTester');
const crypto = require('./src/utils/crypto');
const { authenticateToken, authorize } = require('./middleware/auth');
const { Op } = require('sequelize');

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 시스템 목록 조회
 * GET /api/systems
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      type = '',
      isActive = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // 검색 조건
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // 타입 필터
    if (type) {
      whereClause.type = type;
    }

    // 활성 상태 필터
    if (isActive !== '') {
      whereClause.isActive = isActive === 'true';
    }

    const { count, rows } = await System.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: require('./src/models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: require('./src/models/User'),
          as: 'updater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // 연결 정보 마스킹
    const systems = rows.map(system => {
      const systemData = system.toJSON();
      try {
        const connectionInfo = system.getDecryptedConnectionInfo();
        systemData.connectionInfo = SystemValidator.maskSensitiveInfo(connectionInfo, system.type);
      } catch (error) {
        systemData.connectionInfo = { error: '연결 정보 복호화 실패' };
      }
      return systemData;
    });

    res.json({
      systems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('시스템 목록 조회 실패:', error);
    res.status(500).json({
      error: '시스템 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 상세 조회
 * GET /api/systems/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeSensitive = false } = req.query;

    const system = await System.findByPk(id, {
      include: [
        {
          model: require('./src/models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: require('./src/models/User'),
          as: 'updater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!system) {
      return res.status(404).json({
        error: '시스템을 찾을 수 없습니다.'
      });
    }

    const systemData = system.toJSON();

    // 연결 정보 처리
    try {
      const connectionInfo = system.getDecryptedConnectionInfo();
      
      // 민감한 정보 포함 여부 확인 (관리자만 가능)
      if (includeSensitive === 'true' && req.user.role === 'admin') {
        systemData.connectionInfo = connectionInfo;
      } else {
        systemData.connectionInfo = SystemValidator.maskSensitiveInfo(connectionInfo, system.type);
      }
    } catch (error) {
      systemData.connectionInfo = { error: '연결 정보 복호화 실패' };
    }

    res.json(systemData);
  } catch (error) {
    console.error('시스템 상세 조회 실패:', error);
    res.status(500).json({
      error: '시스템 상세 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 생성
 * POST /api/systems
 */
router.post('/', authorize(['admin', 'manager']), async (req, res) => {
  try {
    // 입력 데이터 검증
    const validatedData = await SystemValidator.validateSystem(req.body);
    
    // 중복 이름 확인
    const existingSystem = await System.findOne({
      where: { name: validatedData.name }
    });

    if (existingSystem) {
      return res.status(400).json({
        error: '이미 동일한 이름의 시스템이 존재합니다.'
      });
    }

    // 시스템 생성
    const system = await System.create({
      ...validatedData,
      createdBy: req.user.id
    });

    // 연결 정보 암호화
    system.setConnectionInfo(validatedData.connectionInfo);
    await system.save();

    // 생성된 시스템 정보 반환 (민감한 정보 마스킹)
    const systemData = system.toJSON();
    systemData.connectionInfo = SystemValidator.maskSensitiveInfo(validatedData.connectionInfo, system.type);

    res.status(201).json({
      message: '시스템이 성공적으로 생성되었습니다.',
      system: systemData
    });
  } catch (error) {
    console.error('시스템 생성 실패:', error);
    res.status(400).json({
      error: '시스템 생성 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 수정
 * PUT /api/systems/:id
 */
router.put('/:id', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const system = await System.findByPk(id);
    if (!system) {
      return res.status(404).json({
        error: '시스템을 찾을 수 없습니다.'
      });
    }

    // 입력 데이터 검증
    const validatedData = await SystemValidator.validateSystem(req.body, true);
    
    // 이름 중복 확인 (자신 제외)
    if (validatedData.name) {
      const existingSystem = await System.findOne({
        where: { 
          name: validatedData.name,
          id: { [Op.ne]: id }
        }
      });

      if (existingSystem) {
        return res.status(400).json({
          error: '이미 동일한 이름의 시스템이 존재합니다.'
        });
      }
    }

    // 시스템 업데이트
    const updateData = {
      ...validatedData,
      updatedBy: req.user.id
    };

    // 연결 정보가 있는 경우 암호화
    if (validatedData.connectionInfo) {
      system.setConnectionInfo(validatedData.connectionInfo);
    }

    await system.update(updateData);

    // 업데이트된 시스템 정보 반환
    const systemData = system.toJSON();
    if (validatedData.connectionInfo) {
      systemData.connectionInfo = SystemValidator.maskSensitiveInfo(validatedData.connectionInfo, system.type);
    } else {
      try {
        const connectionInfo = system.getDecryptedConnectionInfo();
        systemData.connectionInfo = SystemValidator.maskSensitiveInfo(connectionInfo, system.type);
      } catch (error) {
        systemData.connectionInfo = { error: '연결 정보 복호화 실패' };
      }
    }

    res.json({
      message: '시스템이 성공적으로 수정되었습니다.',
      system: systemData
    });
  } catch (error) {
    console.error('시스템 수정 실패:', error);
    res.status(400).json({
      error: '시스템 수정 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 삭제
 * DELETE /api/systems/:id
 */
router.delete('/:id', authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const system = await System.findByPk(id);
    if (!system) {
      return res.status(404).json({
        error: '시스템을 찾을 수 없습니다.'
      });
    }

    // 연관된 데이터 확인
    const relatedSchemas = await system.getSchemas();
    const relatedSourceMappings = await system.getSourceMappings();
    const relatedTargetMappings = await system.getTargetMappings();

    if (relatedSchemas.length > 0 || relatedSourceMappings.length > 0 || relatedTargetMappings.length > 0) {
      return res.status(400).json({
        error: '연관된 데이터가 있어 시스템을 삭제할 수 없습니다.',
        details: {
          schemas: relatedSchemas.length,
          sourceMappings: relatedSourceMappings.length,
          targetMappings: relatedTargetMappings.length
        }
      });
    }

    await system.destroy();

    res.json({
      message: '시스템이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('시스템 삭제 실패:', error);
    res.status(500).json({
      error: '시스템 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 연결 테스트
 * POST /api/systems/:id/test-connection
 */
router.post('/:id/test-connection', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const system = await System.findByPk(id);
    if (!system) {
      return res.status(404).json({
        error: '시스템을 찾을 수 없습니다.'
      });
    }

    // 연결 정보 복호화
    const connectionInfo = system.getDecryptedConnectionInfo();
    
    // 연결 테스트 수행
    const testResult = await ConnectionTester.testConnection(system.type, connectionInfo);
    
    // 테스트 결과 저장
    await system.update({
      lastConnectionTest: new Date(),
      lastConnectionStatus: testResult.success ? 'success' : 'failed',
      lastConnectionError: testResult.success ? null : testResult.message
    });

    res.json({
      message: testResult.success ? '연결 테스트 성공' : '연결 테스트 실패',
      result: testResult
    });
  } catch (error) {
    console.error('연결 테스트 실패:', error);
    
    // 테스트 실패 기록
    try {
      const system = await System.findByPk(req.params.id);
      if (system) {
        await system.update({
          lastConnectionTest: new Date(),
          lastConnectionStatus: 'failed',
          lastConnectionError: error.message
        });
      }
    } catch (updateError) {
      console.error('테스트 결과 저장 실패:', updateError);
    }

    res.status(500).json({
      error: '연결 테스트 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 타입 목록 조회
 * GET /api/systems/types
 */
router.get('/meta/types', (req, res) => {
  try {
    const systemTypes = System.getSystemTypes();
    res.json({
      types: systemTypes
    });
  } catch (error) {
    console.error('시스템 타입 목록 조회 실패:', error);
    res.status(500).json({
      error: '시스템 타입 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 타입별 필수 필드 조회
 * GET /api/systems/types/:type/fields
 */
router.get('/meta/types/:type/fields', (req, res) => {
  try {
    const { type } = req.params;
    
    const requiredFields = SystemValidator.getRequiredFields(type);
    const defaultValues = SystemValidator.getDefaultValues(type);
    
    res.json({
      type,
      requiredFields,
      defaultValues
    });
  } catch (error) {
    console.error('시스템 타입 필드 조회 실패:', error);
    res.status(500).json({
      error: '시스템 타입 필드 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 연결 정보 유효성 검증
 * POST /api/systems/validate-connection
 */
router.post('/validate-connection', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { type, connectionInfo } = req.body;
    
    if (!type || !connectionInfo) {
      return res.status(400).json({
        error: '시스템 타입과 연결 정보가 필요합니다.'
      });
    }

    // 연결 정보 검증
    const validatedData = await SystemValidator.validateSystem({ type, connectionInfo });
    
    res.json({
      message: '연결 정보 검증 성공',
      validatedConnectionInfo: SystemValidator.maskSensitiveInfo(validatedData.connectionInfo, type)
    });
  } catch (error) {
    console.error('연결 정보 검증 실패:', error);
    res.status(400).json({
      error: '연결 정보 검증 실패',
      details: error.message
    });
  }
});

/**
 * 대량 연결 테스트
 * POST /api/systems/bulk-test-connection
 */
router.post('/bulk-test-connection', authorize(['admin']), async (req, res) => {
  try {
    const { systemIds } = req.body;
    
    if (!systemIds || !Array.isArray(systemIds)) {
      return res.status(400).json({
        error: '시스템 ID 배열이 필요합니다.'
      });
    }

    const systems = await System.findAll({
      where: { id: { [Op.in]: systemIds } }
    });

    const testResults = [];
    
    for (const system of systems) {
      try {
        const connectionInfo = system.getDecryptedConnectionInfo();
        const testResult = await ConnectionTester.testConnection(system.type, connectionInfo);
        
        // 테스트 결과 저장
        await system.update({
          lastConnectionTest: new Date(),
          lastConnectionStatus: testResult.success ? 'success' : 'failed',
          lastConnectionError: testResult.success ? null : testResult.message
        });

        testResults.push({
          systemId: system.id,
          systemName: system.name,
          success: testResult.success,
          message: testResult.message,
          responseTime: testResult.responseTime
        });
      } catch (error) {
        await system.update({
          lastConnectionTest: new Date(),
          lastConnectionStatus: 'failed',
          lastConnectionError: error.message
        });

        testResults.push({
          systemId: system.id,
          systemName: system.name,
          success: false,
          message: error.message,
          responseTime: null
        });
      }
    }

    res.json({
      message: '대량 연결 테스트 완료',
      results: testResults
    });
  } catch (error) {
    console.error('대량 연결 테스트 실패:', error);
    res.status(500).json({
      error: '대량 연결 테스트 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

module.exports = router;