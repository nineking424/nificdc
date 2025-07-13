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
    const formattedSystems = systems.map(system => {
      console.log('Backend formatting system:', {
        id: system.id,
        name: system.name,
        type: system.type,
        connectionInfo: system.connectionInfo,
        isActive: system.isActive
      });
      
      return {
        id: system.id,
        name: system.name,
        type: system.type,
        status: system.isActive ? 'active' : 'inactive',
        description: system.description,
        connectionInfo: system.connectionInfo,
        isActive: system.isActive,
        createdAt: system.createdAt,
        updatedAt: system.updatedAt
      };
    });
    
    console.log('Backend sending formatted systems:', formattedSystems);

    // TODO: Fix audit logs table issue
    try {
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
    } catch (auditError) {
      console.warn('Audit logging failed:', auditError.message);
    }

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
      isActive: system.isActive,
      createdAt: system.createdAt,
      updatedAt: system.updatedAt
    };

    try {
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
    } catch (auditError) {
      console.warn('Audit logging failed:', auditError.message);
    }

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
    const { getSupportedSystemTypes } = require('../../src/utils/connectionInfoValidator');
    const supportedTypes = getSupportedSystemTypes();
    
    if (!supportedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported system type. Supported types: ${supportedTypes.join(', ')}`
      });
    }

    // 연결 정보 유효성 검증
    const { validateConnectionInfo } = require('../../src/utils/connectionInfoValidator');
    let parsedConnectionInfo = connectionInfo;
    
    // 문자열인 경우 JSON 파싱
    if (typeof connectionInfo === 'string') {
      try {
        parsedConnectionInfo = JSON.parse(connectionInfo);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid connectionInfo JSON format'
        });
      }
    }
    
    const validation = validateConnectionInfo(type, parsedConnectionInfo);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid connection information',
        details: validation.error
      });
    }

    // 시스템 생성 - 유효성 검증된 연결 정보 사용
    const { System } = require('../../src/models');
    const newSystem = await System.create({
      name,
      type,
      description,
      connectionInfo: validation.value, // 객체로 직접 저장 (모델에서 처리)
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
      isActive: newSystem.isActive,
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
    if (isActive !== undefined) updateFields.isActive = isActive;
    // connectionInfo는 유효성 검증 후 별도로 처리

    // 입력 검증 - 타입이 변경된 경우
    const { getSupportedSystemTypes, validateConnectionInfo } = require('../../src/utils/connectionInfoValidator');
    const supportedTypes = getSupportedSystemTypes();
    
    if (type && !supportedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported system type. Supported types: ${supportedTypes.join(', ')}`
      });
    }

    // 연결 정보 유효성 검증 (연결 정보가 업데이트되는 경우)
    if (connectionInfo !== undefined) {
      let parsedConnectionInfo = connectionInfo;
      
      // 문자열인 경우 JSON 파싱
      if (typeof connectionInfo === 'string') {
        try {
          parsedConnectionInfo = JSON.parse(connectionInfo);
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid connectionInfo JSON format'
          });
        }
      }
      
      const systemType = type || existingSystem.type; // 새 타입 또는 기존 타입 사용
      const validation = validateConnectionInfo(systemType, parsedConnectionInfo);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection information',
          details: validation.error
        });
      }
      
      // 유효성 검증된 연결 정보로 교체
      updateFields.connectionInfo = validation.value;
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
      isActive: existingSystem.isActive,
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

    // 시스템이 다른 엔티티에서 사용 중인지 확인
    const { DataSchema, Mapping, Job } = require('../../src/models');
    
    // 데이터 스키마에서 사용 중인지 확인
    const relatedSchemas = await DataSchema.findAll({
      where: { systemId: systemId },
      attributes: ['id', 'name']
    });
    
    // 매핑에서 사용 중인지 확인 (소스 또는 타겟 스키마를 통해)
    const relatedMappings = await Mapping.findAll({
      include: [
        {
          model: DataSchema,
          as: 'sourceSchema',
          where: { systemId: systemId },
          required: false,
          attributes: ['id', 'name']
        },
        {
          model: DataSchema,
          as: 'targetSchema', 
          where: { systemId: systemId },
          required: false,
          attributes: ['id', 'name']
        }
      ],
      attributes: ['id', 'name']
    });
    
    // 활성 매핑이 있는지 확인
    const activeMappings = relatedMappings.filter(mapping => 
      mapping.sourceSchema || mapping.targetSchema
    );
    
    // 관련 작업이 있는지 확인 (매핑을 통해)
    let relatedJobs = [];
    if (activeMappings.length > 0) {
      const mappingIds = activeMappings.map(m => m.id);
      relatedJobs = await Job.findAll({
        where: { mappingId: mappingIds },
        attributes: ['id', 'name', 'status']
      });
    }
    
    // 관련 엔티티가 있는 경우 삭제 차단
    if (relatedSchemas.length > 0 || activeMappings.length > 0 || relatedJobs.length > 0) {
      const dependencies = [];
      
      if (relatedSchemas.length > 0) {
        dependencies.push(`데이터 스키마 ${relatedSchemas.length}개`);
      }
      if (activeMappings.length > 0) {
        dependencies.push(`데이터 매핑 ${activeMappings.length}개`);
      }
      if (relatedJobs.length > 0) {
        dependencies.push(`작업 ${relatedJobs.length}개`);
      }
      
      return res.status(409).json({
        success: false,
        error: 'Cannot delete system: dependencies exist',
        details: {
          message: `이 시스템은 다음 항목들에서 사용 중입니다: ${dependencies.join(', ')}`,
          dependencies: {
            schemas: relatedSchemas,
            mappings: activeMappings,
            jobs: relatedJobs
          }
        }
      });
    }
    
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

    // connectionInfo 파싱
    let connectionInfo = system.connectionInfo;
    if (typeof connectionInfo === 'string') {
      try {
        connectionInfo = JSON.parse(connectionInfo);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection configuration format'
        });
      }
    }

    // 실제 연결 테스트 수행
    const connectionTestService = require('../../src/services/connectionTestService');
    const testResult = await connectionTestService.testConnection(system.type, connectionInfo);

    const finalResult = {
      ...testResult,
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


module.exports = router;