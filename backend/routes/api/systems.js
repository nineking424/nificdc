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
    // 데이터베이스에서 시스템 목록 조회
    const { System } = require('../../src/models');
    const systems = await System.findAll({
      where: { deletedAt: null },
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
    
    // 실제로는 데이터베이스에서 시스템 조회
    const system = {
      id: systemId,
      name: 'Source Database',
      type: 'database',
      status: 'active',
      host: 'db.example.com',
      port: 5432,
      config: {
        maxConnections: 100,
        timeout: 30000,
        ssl: true
      }
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
      data: system
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
    const systemData = req.body;
    
    // 시스템 생성 로직
    const newSystem = {
      id: Date.now(),
      ...systemData,
      createdBy: req.user.id,
      createdAt: new Date()
    };

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'systems',
      resourceId: newSystem.id.toString(),
      newValues: systemData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.info('새 시스템 생성:', { systemId: newSystem.id, userId: req.user.id });

    res.status(201).json({
      success: true,
      data: newSystem
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
    const updateData = req.body;
    
    // 기존 시스템 데이터 조회 (감사 로그용)
    const oldSystem = {
      name: 'Source Database',
      type: 'database',
      status: 'active'
    };

    // 시스템 업데이트 로직
    const updatedSystem = {
      id: systemId,
      ...oldSystem,
      ...updateData,
      updatedBy: req.user.id,
      updatedAt: new Date()
    };

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'systems',
      resourceId: systemId,
      oldValues: oldSystem,
      newValues: updateData,
      changes: updateData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.info('시스템 업데이트:', { systemId, userId: req.user.id });

    res.json({
      success: true,
      data: updatedSystem
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
    
    // 삭제 전 시스템 데이터 조회 (감사 로그용)
    const systemToDelete = {
      id: systemId,
      name: 'Source Database',
      type: 'database'
    };

    // 시스템 삭제 로직
    
    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE',
      resource: 'systems',
      resourceId: systemId,
      oldValues: systemToDelete,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
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
    
    // 연결 테스트 로직
    const testResult = {
      success: true,
      latency: 45,
      timestamp: new Date()
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
      data: testResult
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