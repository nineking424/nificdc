const logger = require('../src/utils/logger');
const auditLogger = require('../services/auditLogger');

/**
 * 역할 기반 접근 제어(RBAC) 미들웨어
 * 세밀한 권한 제어 및 감사 로그 기능 포함
 */

// 시스템 역할 및 권한 정의
const rolePermissions = {
  // 시스템 관리자 - 모든 권한
  admin: ['*'],
  
  // 운영자 - 대부분의 운영 권한
  operator: [
    'systems:read', 'systems:test', 'systems:create', 'systems:update',
    'jobs:*',
    'monitoring:*',
    'mappings:*',
    'schemas:*',
    'executions:read', 'executions:create', 'executions:stop',
    'alerts:read', 'alerts:acknowledge'
  ],
  
  // 개발자 - 개발 관련 권한
  developer: [
    'systems:read', 'systems:test',
    'jobs:read', 'jobs:create', 'jobs:update', 'jobs:test',
    'monitoring:read',
    'mappings:*',
    'schemas:*',
    'executions:read', 'executions:create',
    'alerts:read'
  ],
  
  // 분석가 - 읽기 및 분석 권한
  analyst: [
    '*:read',
    'monitoring:read',
    'executions:read',
    'alerts:read',
    'reports:*'
  ],
  
  // 뷰어 - 읽기 전용 권한
  viewer: [
    '*:read',
    'monitoring:read'
  ]
};

// 리소스별 권한 매트릭스
const resourceActions = {
  systems: ['read', 'create', 'update', 'delete', 'test'],
  jobs: ['read', 'create', 'update', 'delete', 'execute', 'stop'],
  monitoring: ['read', 'configure'],
  mappings: ['read', 'create', 'update', 'delete', 'validate'],
  schemas: ['read', 'create', 'update', 'delete', 'validate'],
  executions: ['read', 'create', 'stop', 'retry'],
  alerts: ['read', 'acknowledge', 'dismiss', 'configure'],
  reports: ['read', 'create', 'export'],
  users: ['read', 'create', 'update', 'delete', 'activate', 'deactivate'],
  audit: ['read', 'export']
};

// 특별 권한 (조건부 권한)
const conditionalPermissions = {
  // 자신의 프로필만 수정 가능
  'users:update_own': (user, resourceId) => user.id === resourceId,
  
  // 자신이 생성한 작업만 수정 가능 (관리자 제외)
  'jobs:update_own': (user, resourceId) => {
    if (user.role === 'admin') return true;
    return user.id === resourceId || user.createdJobs?.includes(resourceId);
  },
  
  // 부서별 데이터 접근 제어
  'data:department_access': (user, resourceId) => {
    return user.department === resourceId || user.role === 'admin';
  }
};

/**
 * 권한 확인 함수
 * @param {string} userRole - 사용자 역할
 * @param {string} resource - 리소스 타입
 * @param {string} action - 수행할 액션
 * @returns {boolean} 권한 여부
 */
function hasPermission(userRole, resource, action) {
  const permissions = rolePermissions[userRole];
  if (!permissions) return false;
  
  const permission = `${resource}:${action}`;
  
  return permissions.some(p => {
    // 모든 권한
    if (p === '*') return true;
    
    // 특정 리소스의 모든 액션
    if (p === `${resource}:*`) return true;
    
    // 모든 리소스의 특정 액션
    if (p === `*:${action}`) return true;
    
    // 정확한 권한 매치
    return p === permission;
  });
}

/**
 * 조건부 권한 확인
 * @param {Object} user - 사용자 객체
 * @param {string} resource - 리소스 타입
 * @param {string} action - 수행할 액션
 * @param {string} resourceId - 리소스 ID
 * @returns {boolean} 권한 여부
 */
function hasConditionalPermission(user, resource, action, resourceId) {
  const permissionKey = `${resource}:${action}`;
  const checker = conditionalPermissions[permissionKey];
  
  if (!checker) return false;
  
  return checker(user, resourceId);
}

/**
 * RBAC 권한 검증 미들웨어
 * @param {string} resource - 리소스 타입
 * @param {string} action - 수행할 액션
 * @param {Object} options - 추가 옵션
 * @returns {Function} Express 미들웨어 함수
 */
function authorize(resource, action, options = {}) {
  return async (req, res, next) => {
    try {
      // 사용자 인증 확인
      if (!req.user) {
        await auditLogger.log({
          type: 'UNAUTHENTICATED_ACCESS_ATTEMPT',
          resource,
          action,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          result: 'DENIED'
        });
        
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const user = req.user;
      const userRole = user.role;
      
      // 기본 권한 확인
      let hasAccess = hasPermission(userRole, resource, action);
      
      // 조건부 권한 확인 (리소스 ID가 있는 경우)
      if (!hasAccess && options.conditionalPermission && req.params.id) {
        hasAccess = hasConditionalPermission(user, resource, action, req.params.id);
      }
      
      // 커스텀 권한 검증 함수
      if (hasAccess && options.customValidator) {
        hasAccess = await options.customValidator(user, req);
      }
      
      if (!hasAccess) {
        // 무권한 접근 시도 감사 로그
        await auditLogger.log({
          type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          userId: user.id,
          userName: user.name,
          userRole,
          resource,
          action,
          resourceId: req.params.id || null,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          result: 'DENIED'
        });
        
        logger.warn('무권한 접근 시도', {
          userId: user.id,
          userRole,
          resource,
          action,
          ip: req.ip
        });
        
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: `${resource}:${action}`
        });
      }
      
      // 성공적인 권한 검증 로그 (중요한 액션만)
      if (['create', 'update', 'delete', 'execute', 'stop'].includes(action)) {
        await auditLogger.log({
          type: 'AUTHORIZED_ACTION',
          userId: user.id,
          userName: user.name,
          userRole,
          resource,
          action,
          resourceId: req.params.id || null,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          result: 'ALLOWED'
        });
      }
      
      // 요청 객체에 권한 정보 추가
      req.permissions = {
        resource,
        action,
        userRole,
        hasFullAccess: userRole === 'admin'
      };
      
      next();
    } catch (error) {
      logger.error('RBAC 권한 검증 중 오류:', error);
      
      await auditLogger.log({
        type: 'RBAC_ERROR',
        userId: req.user?.id,
        resource,
        action,
        error: error.message,
        ip: req.ip,
        result: 'ERROR'
      });
      
      res.status(500).json({ 
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_FAILED'
      });
    }
  };
}

/**
 * 다중 권한 검증 미들웨어
 * @param {Array} permissionSets - 권한 세트 배열
 * @param {string} operator - 연산자 ('OR' | 'AND')
 * @returns {Function} Express 미들웨어 함수
 */
function authorizeMultiple(permissionSets, operator = 'OR') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const user = req.user;
    const userRole = user.role;
    
    let hasAccess = false;
    
    if (operator === 'OR') {
      // 하나라도 충족하면 통과
      hasAccess = permissionSets.some(({ resource, action }) => 
        hasPermission(userRole, resource, action)
      );
    } else if (operator === 'AND') {
      // 모두 충족해야 통과
      hasAccess = permissionSets.every(({ resource, action }) => 
        hasPermission(userRole, resource, action)
      );
    }
    
    if (!hasAccess) {
      await auditLogger.log({
        type: 'UNAUTHORIZED_MULTIPLE_ACCESS_ATTEMPT',
        userId: user.id,
        userName: user.name,
        userRole,
        permissions: permissionSets,
        operator,
        ip: req.ip,
        result: 'DENIED'
      });
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissionSets
      });
    }
    
    next();
  };
}

/**
 * 관리자 전용 미들웨어
 */
function requireAdmin() {
  return authorize('admin', 'access', {
    customValidator: (user) => user.role === 'admin'
  });
}

/**
 * 자신의 리소스만 접근 가능한 미들웨어
 * @param {string} userIdField - 사용자 ID 필드명
 */
function requireOwnership(userIdField = 'userId') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // 관리자는 모든 리소스 접근 가능
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceUserId = req.body[userIdField] || req.params[userIdField];
    
    if (req.user.id !== resourceUserId) {
      await auditLogger.log({
        type: 'OWNERSHIP_VIOLATION_ATTEMPT',
        userId: req.user.id,
        userName: req.user.name,
        targetUserId: resourceUserId,
        ip: req.ip,
        result: 'DENIED'
      });
      
      return res.status(403).json({ 
        error: 'You can only access your own resources',
        code: 'OWNERSHIP_REQUIRED'
      });
    }
    
    next();
  };
}

/**
 * 사용자 역할 정보 조회
 * @param {string} userId - 사용자 ID
 * @returns {Object} 역할 정보
 */
async function getUserRoleInfo(userId) {
  try {
    // 실제로는 데이터베이스에서 조회
    // const user = await User.findByPk(userId);
    // return { role: user.role, permissions: rolePermissions[user.role] };
    
    // 임시 구현
    return {
      role: 'operator',
      permissions: rolePermissions.operator
    };
  } catch (error) {
    logger.error('사용자 역할 정보 조회 실패:', error);
    return null;
  }
}

/**
 * 권한 확인 유틸리티 함수 (라우터에서 직접 사용)
 * @param {Object} user - 사용자 객체
 * @param {string} resource - 리소스
 * @param {string} action - 액션
 * @returns {boolean} 권한 여부
 */
function checkPermission(user, resource, action) {
  if (!user || !user.role) return false;
  return hasPermission(user.role, resource, action);
}

module.exports = {
  authorize,
  authorizeMultiple,
  requireAdmin,
  requireOwnership,
  hasPermission,
  hasConditionalPermission,
  checkPermission,
  getUserRoleInfo,
  rolePermissions,
  resourceActions,
  conditionalPermissions
};