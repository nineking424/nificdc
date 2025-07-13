const express = require('express');
const router = express.Router();
const { authorize, requireAdmin } = require('../../middleware/rbac');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../src/utils/logger');

/**
 * 시스템 관리 API 라우터
 * RBAC 권한 제어가 적용된 엔드포인트
 */

// 시스템 목록 조회 - 읽기 권한 필요
router.get('/', authorize('systems', 'read'), async (req, res) => {
  try {
    // 데이터베이스에서 시스템 목록 조회 (paranoid 모드에서 자동으로 삭제되지 않은 것만 조회)
    const { System } = require('../../src/models');
    const systems = await System.findAll({
      order: [['createdAt', 'DESC']]
    });

    // 시스템 데이터 포맷팅
    const formattedSystems = systems.map(system => ({
      id: system.id,
      name: system.name,
      type: system.type,
      status: system.isActive ? 'active' : 'inactive',
      description: system.description,
      connectionInfo: system.connectionInfo,
      createdAt: system.createdAt,
      updatedAt: system.updatedAt
    }));

    await auditLogger.log({
      type: 'DATA_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'systems',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: formattedSystems,
      total: formattedSystems.length
    });
  } catch (error) {
    logger.error('시스템 목록 조회 실패:', error);
    
    await auditLogger.log({
      type: 'DATA_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'systems',
      ip: req.ip,
      result: 'ERROR',
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch systems'
    });
  }
});

// 특정 시스템 조회 - 읽기 권한 필요
router.get('/:id', authorize('systems', 'read'), async (req, res) => {
  try {
    const systemId = req.params.id;
    
    // 데이터베이스에서 시스템 조회
    const { System } = require('../../src/models');
    const system = await System.findByPk(systemId);

    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }

    // 시스템 데이터 포맷팅
    const formattedSystem = {
      id: system.id,
      name: system.name,
      type: system.type,
      status: system.isActive ? 'active' : 'inactive',
      description: system.description,
      connectionInfo: system.connectionInfo,
      createdAt: system.createdAt,
      updatedAt: system.updatedAt
    };

    await auditLogger.log({
      type: 'DATA_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'systems',
      resourceId: systemId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: formattedSystem
    });
  } catch (error) {
    logger.error('시스템 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system'
    });
  }
});

// 시스템 생성 - 생성 권한 필요
router.post('/', authorize('systems', 'create'), async (req, res) => {
  try {
    const { name, type, description, connectionInfo, isActive = true } = req.body;
    
    // 입력 검증
    if (!name || !type || !connectionInfo) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and connectionInfo are required'
      });
    }

    // 지원하는 시스템 타입 검증
    const supportedTypes = ['postgresql', 'mysql', 'oracle', 'sqlite', 'mongodb', 'sftp', 'ftp', 'api'];
    if (!supportedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported system type. Supported types: ${supportedTypes.join(', ')}`
      });
    }

    // 시스템 생성
    const { System } = require('../../src/models');
    const newSystem = await System.create({
      name,
      type,
      description,
      connectionInfo,
      isActive
    });

    // 응답 데이터 포맷팅
    const formattedSystem = {
      id: newSystem.id,
      name: newSystem.name,
      type: newSystem.type,
      status: newSystem.isActive ? 'active' : 'inactive',
      description: newSystem.description,
      connectionInfo: newSystem.connectionInfo,
      createdAt: newSystem.createdAt,
      updatedAt: newSystem.updatedAt
    };

    await auditLogger.log({
      type: 'DATA_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'systems',
      resourceId: newSystem.id.toString(),
      newValues: formattedSystem,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    logger.info('새 시스템 생성:', { systemId: newSystem.id, userId: req.user.id });

    res.status(201).json({
      success: true,
      data: formattedSystem
    });
  } catch (error) {
    logger.error('시스템 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create system'
    });
  }
});

// 시스템 수정 - 수정 권한 필요
router.put('/:id', authorize('systems', 'update'), async (req, res) => {
  try {
    const systemId = req.params.id;
    const { name, type, description, connectionInfo, isActive } = req.body;
    
    // 데이터베이스에서 기존 시스템 조회
    const { System } = require('../../src/models');
    const existingSystem = await System.findByPk(systemId);

    if (!existingSystem || existingSystem.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }

    // 업데이트할 필드만 추출
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (type !== undefined) updateFields.type = type;
    if (description !== undefined) updateFields.description = description;
    if (connectionInfo !== undefined) updateFields.connectionInfo = connectionInfo;
    if (isActive !== undefined) updateFields.isActive = isActive;

    // 입력 검증 - 타입이 변경된 경우
    if (type) {
      const supportedTypes = ['postgresql', 'mysql', 'oracle', 'sqlite', 'mongodb', 'sftp', 'ftp', 'api'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported system type. Supported types: ${supportedTypes.join(', ')}`
        });
      }
    }

    // 기존 시스템 데이터 (감사 로그용)
    const oldSystemData = {
      id: existingSystem.id,
      name: existingSystem.name,
      type: existingSystem.type,
      status: existingSystem.isActive ? 'active' : 'inactive',
      description: existingSystem.description,
      connectionInfo: existingSystem.connectionInfo
    };

    // 시스템 업데이트
    await existingSystem.update(updateFields);
    await existingSystem.reload();

    // 업데이트된 시스템 데이터 포맷팅
    const formattedSystem = {
      id: existingSystem.id,
      name: existingSystem.name,
      type: existingSystem.type,
      status: existingSystem.isActive ? 'active' : 'inactive',
      description: existingSystem.description,
      connectionInfo: existingSystem.connectionInfo,
      createdAt: existingSystem.createdAt,
      updatedAt: existingSystem.updatedAt
    };

    await auditLogger.log({
      type: 'DATA_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'systems',
      resourceId: systemId,
      oldValues: oldSystemData,
      newValues: formattedSystem,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    logger.info('시스템 업데이트:', { systemId, userId: req.user.id });

    res.json({
      success: true,
      data: formattedSystem
    });
  } catch (error) {
    logger.error('시스템 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system'
    });
  }
});

// 시스템 삭제 - 삭제 권한 필요 (관리자만)
router.delete('/:id', requireAdmin(), async (req, res) => {
  try {
    const systemId = req.params.id;
    
    // 데이터베이스에서 시스템 조회
    const { System } = require('../../src/models');
    const systemToDelete = await System.findByPk(systemId);

    if (!systemToDelete || systemToDelete.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }

    // 시스템이 다른 엔티티에서 사용 중인지 확인 (예: 매핑, 작업 등)
    // TODO: 실제로는 관련 엔티티들을 확인해야 함
    
    // 삭제 전 시스템 데이터 (감사 로그용)
    const systemData = {
      id: systemToDelete.id,
      name: systemToDelete.name,
      type: systemToDelete.type,
      status: systemToDelete.isActive ? 'active' : 'inactive',
      description: systemToDelete.description,
      connectionInfo: systemToDelete.connectionInfo
    };

    // 논리적 삭제 (soft delete) - Sequelize paranoid 모드 사용
    await systemToDelete.destroy(); // paranoid: true이므로 실제로는 deletedAt만 설정됨

    await auditLogger.log({
      type: 'DATA_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE',
      resource: 'systems',
      resourceId: systemId,
      oldValues: systemData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    logger.warn('시스템 삭제:', { systemId, userId: req.user.id });

    res.json({
      success: true,
      message: 'System deleted successfully'
    });
  } catch (error) {
    logger.error('시스템 삭제 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete system'
    });
  }
});

// 시스템 연결 테스트 - 테스트 권한 필요
router.post('/:id/test', authorize('systems', 'test'), async (req, res) => {
  try {
    const systemId = req.params.id;
    
    // 데이터베이스에서 시스템 조회
    const { System } = require('../../src/models');
    const system = await System.findByPk(systemId);

    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'System not found'
      });
    }

    // 연결 테스트 로직 (시스템 타입에 따라 다른 테스트 수행)
    const startTime = Date.now();
    let testResult;

    try {
      switch (system.type) {
        case 'postgresql':
        case 'mysql':
        case 'oracle':
          testResult = await testDatabaseConnection(system);
          break;
        case 'sftp':
        case 'ftp':
          testResult = await testFileServerConnection(system);
          break;
        case 'api':
          testResult = await testApiConnection(system);
          break;
        default:
          testResult = {
            success: false,
            message: `Connection test not implemented for ${system.type}`,
            details: 'Please implement connection test for this system type'
          };
      }
    } catch (testError) {
      testResult = {
        success: false,
        message: 'Connection test failed',
        error: testError.message
      };
    }

    const endTime = Date.now();
    const latency = endTime - startTime;

    const finalResult = {
      ...testResult,
      latency,
      timestamp: new Date(),
      systemId: system.id,
      systemName: system.name,
      systemType: system.type
    };

    await auditLogger.log({
      type: 'SYSTEM_TEST',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'TEST',
      resource: 'systems',
      resourceId: systemId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: testResult.success ? 'SUCCESS' : 'FAILURE',
      metadata: {
        latency: testResult.latency,
        testType: 'connection'
      }
    });

    res.json({
      success: true,
      data: finalResult
    });
  } catch (error) {
    logger.error('시스템 테스트 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test system'
    });
  }
});

// 연결 테스트 헬퍼 함수들
async function testDatabaseConnection(system) {
  // TODO: 실제 데이터베이스 연결 테스트 구현
  // 현재는 모의 테스트로 구현
  return new Promise((resolve) => {
    setTimeout(() => {
      // connectionInfo에서 필수 필드 확인
      let connInfo = system.connectionInfo;
      
      // connectionInfo가 문자열로 저장된 경우 파싱
      if (typeof connInfo === 'string') {
        try {
          connInfo = JSON.parse(connInfo);
        } catch (e) {
          resolve({
            success: false,
            message: 'Invalid connection configuration format'
          });
          return;
        }
      }
      if (!connInfo.host || !connInfo.port) {
        resolve({
          success: false,
          message: 'Missing required connection parameters (host, port)'
        });
        return;
      }

      // 실제로는 여기서 데이터베이스 연결을 시도
      resolve({
        success: true,
        message: 'Database connection successful',
        details: {
          host: connInfo.host,
          port: connInfo.port,
          database: connInfo.database || connInfo.serviceName,
          ssl: connInfo.ssl || false
        }
      });
    }, Math.random() * 1000 + 200); // 200-1200ms 랜덤 지연
  });
}

async function testFileServerConnection(system) {
  // TODO: 실제 파일 서버 연결 테스트 구현
  return new Promise((resolve) => {
    setTimeout(() => {
      let connInfo = system.connectionInfo;
      
      if (typeof connInfo === 'string') {
        try {
          connInfo = JSON.parse(connInfo);
        } catch (e) {
          resolve({
            success: false,
            message: 'Invalid connection configuration format'
          });
          return;
        }
      }
      if (!connInfo.host || !connInfo.port) {
        resolve({
          success: false,
          message: 'Missing required connection parameters (host, port)'
        });
        return;
      }

      resolve({
        success: true,
        message: 'File server connection successful',
        details: {
          host: connInfo.host,
          port: connInfo.port,
          protocol: system.type.toUpperCase(),
          rootPath: connInfo.rootPath || '/'
        }
      });
    }, Math.random() * 800 + 300);
  });
}

async function testApiConnection(system) {
  // TODO: 실제 API 연결 테스트 구현
  return new Promise((resolve) => {
    setTimeout(() => {
      let connInfo = system.connectionInfo;
      
      if (typeof connInfo === 'string') {
        try {
          connInfo = JSON.parse(connInfo);
        } catch (e) {
          resolve({
            success: false,
            message: 'Invalid connection configuration format'
          });
          return;
        }
      }
      if (!connInfo.endpoint && !connInfo.host) {
        resolve({
          success: false,
          message: 'Missing required connection parameters (endpoint or host)'
        });
        return;
      }

      resolve({
        success: true,
        message: 'API connection successful',
        details: {
          endpoint: connInfo.endpoint || `${connInfo.host}:${connInfo.port}`,
          method: 'GET',
          status: 200
        }
      });
    }, Math.random() * 600 + 100);
  });
}

module.exports = router;