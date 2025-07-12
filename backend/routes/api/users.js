const express = require('express');
const router = express.Router();
const { authorize, requireAdmin, requireOwnership } = require('../../middleware/rbac');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../utils/logger');

/**
 * 사용자 관리 API 라우터
 * RBAC 권한 제어가 적용된 엔드포인트
 */

// 사용자 목록 조회 - 관리자만 가능
router.get('/', requireAdmin(), async (req, res) => {
  try {
    // 실제로는 데이터베이스에서 사용자 목록 조회
    const users = [
      {
        id: '1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        lastLogin: new Date(),
        createdAt: new Date()
      },
      {
        id: '2',
        name: 'Operator User',
        email: 'operator@example.com',
        role: 'operator',
        status: 'active',
        lastLogin: new Date(),
        createdAt: new Date()
      }
    ];

    await auditLogger.log({
      type: 'USER_DATA_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'users',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        accessedUserCount: users.length
      }
    });

    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    logger.error('사용자 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// 특정 사용자 조회 - 관리자 또는 본인만 가능
router.get('/:id', authorize('users', 'read', { conditionalPermission: true }), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 실제로는 데이터베이스에서 사용자 조회
    const user = {
      id: userId,
      name: 'User Name',
      email: 'user@example.com',
      role: 'operator',
      status: 'active',
      lastLogin: new Date(),
      createdAt: new Date(),
      profile: {
        department: 'Engineering',
        position: 'Senior Developer'
      }
    };

    await auditLogger.log({
      type: 'USER_PROFILE_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'users',
      resourceId: userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('사용자 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// 사용자 생성 - 관리자만 가능
router.post('/', requireAdmin(), async (req, res) => {
  try {
    const userData = req.body;
    
    // 사용자 생성 로직
    const newUser = {
      id: Date.now().toString(),
      ...userData,
      status: 'active',
      createdBy: req.user.id,
      createdAt: new Date()
    };

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'users',
      resourceId: newUser.id,
      newValues: {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        department: userData.department
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.info('새 사용자 생성:', { userId: newUser.id, createdBy: req.user.id });

    // 비밀번호 제거 후 응답
    const { password, ...userResponse } = newUser;

    res.status(201).json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    logger.error('사용자 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// 사용자 정보 수정 - 관리자 또는 본인만 가능
router.put('/:id', requireOwnership('id'), async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;
    
    // 기존 사용자 데이터 조회 (감사 로그용)
    const oldUser = {
      name: 'Old Name',
      email: 'old@example.com',
      role: 'operator',
      department: 'Engineering'
    };

    // 권한 상승 시도 검사
    if (updateData.role && updateData.role !== oldUser.role && req.user.role !== 'admin') {
      await auditLogger.log({
        type: 'PRIVILEGE_ESCALATION',
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'UPDATE',
        resource: 'users',
        resourceId: userId,
        ip: req.ip,
        result: 'DENIED',
        metadata: {
          attemptedRole: updateData.role,
          currentRole: oldUser.role
        }
      });

      return res.status(403).json({
        success: false,
        error: 'Cannot change user role without admin privileges'
      });
    }

    // 사용자 업데이트 로직
    const updatedUser = {
      id: userId,
      ...oldUser,
      ...updateData,
      updatedBy: req.user.id,
      updatedAt: new Date()
    };

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'users',
      resourceId: userId,
      oldValues: oldUser,
      newValues: updateData,
      changes: updateData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.info('사용자 정보 업데이트:', { userId, updatedBy: req.user.id });

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error('사용자 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// 사용자 비활성화 - 관리자만 가능
router.patch('/:id/deactivate', requireAdmin(), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 자기 자신 비활성화 방지
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account'
      });
    }

    // 사용자 비활성화 로직
    const updatedUser = {
      id: userId,
      status: 'inactive',
      deactivatedBy: req.user.id,
      deactivatedAt: new Date()
    };

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DEACTIVATE',
      resource: 'users',
      resourceId: userId,
      oldValues: { status: 'active' },
      newValues: { status: 'inactive' },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.warn('사용자 비활성화:', { userId, deactivatedBy: req.user.id });

    res.json({
      success: true,
      data: updatedUser,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('사용자 비활성화 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate user'
    });
  }
});

// 사용자 활성화 - 관리자만 가능
router.patch('/:id/activate', requireAdmin(), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 사용자 활성화 로직
    const updatedUser = {
      id: userId,
      status: 'active',
      activatedBy: req.user.id,
      activatedAt: new Date()
    };

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ACTIVATE',
      resource: 'users',
      resourceId: userId,
      oldValues: { status: 'inactive' },
      newValues: { status: 'active' },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.info('사용자 활성화:', { userId, activatedBy: req.user.id });

    res.json({
      success: true,
      data: updatedUser,
      message: 'User activated successfully'
    });
  } catch (error) {
    logger.error('사용자 활성화 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate user'
    });
  }
});

// 사용자 역할 변경 - 관리자만 가능
router.patch('/:id/role', requireAdmin(), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    const validRoles = ['admin', 'operator', 'developer', 'analyst', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role specified'
      });
    }

    // 기존 역할 조회
    const oldRole = 'operator'; // 실제로는 데이터베이스에서 조회

    // 역할 변경 로직
    const updatedUser = {
      id: userId,
      role: role,
      roleChangedBy: req.user.id,
      roleChangedAt: new Date()
    };

    await auditLogger.log({
      type: 'ROLE_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'users',
      resourceId: userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        oldRole,
        newRole: role,
        targetUserId: userId
      }
    });

    logger.warn('사용자 역할 변경:', { 
      userId, 
      oldRole, 
      newRole: role, 
      changedBy: req.user.id 
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'User role updated successfully'
    });
  } catch (error) {
    logger.error('사용자 역할 변경 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
});

// 사용자 삭제 - 관리자만 가능 (매우 제한적)
router.delete('/:id', requireAdmin(), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 자기 자신 삭제 방지
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // 삭제 전 사용자 데이터 조회 (감사 로그용)
    const userToDelete = {
      id: userId,
      name: 'User Name',
      email: 'user@example.com',
      role: 'operator'
    };

    // 사용자 삭제 로직 (실제로는 soft delete 권장)
    
    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE',
      resource: 'users',
      resourceId: userId,
      oldValues: userToDelete,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.error('사용자 삭제 (중요):', { 
      userId, 
      deletedUser: userToDelete, 
      deletedBy: req.user.id 
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('사용자 삭제 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

module.exports = router;