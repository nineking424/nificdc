const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 감사 로그 모델
 * 모든 보안 관련 활동과 시스템 변경사항을 추적
 */
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
    allowNull: false,
    comment: '감사 로그 고유 ID'
  },
  
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '이벤트 발생 시간'
  },
  
  eventType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '이벤트 타입 (LOGIN_SUCCESS, UNAUTHORIZED_ACCESS_ATTEMPT 등)',
    validate: {
      notEmpty: true
    }
  },
  
  userId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '사용자 ID'
  },
  
  userName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '사용자명'
  },
  
  userRole: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '사용자 역할',
    validate: {
      isIn: [['admin', 'operator', 'developer', 'analyst', 'viewer', 'unknown']]
    }
  },
  
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '수행된 액션 (CREATE, READ, UPDATE, DELETE 등)',
    validate: {
      notEmpty: true
    }
  },
  
  resource: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '대상 리소스 타입 (systems, jobs, users 등)',
    validate: {
      notEmpty: true
    }
  },
  
  resourceId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '대상 리소스 ID'
  },
  
  changes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '변경사항 (JSON 형태)'
  },
  
  oldValues: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '변경 전 값 (JSON 형태)'
  },
  
  newValues: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '변경 후 값 (JSON 형태)'
  },
  
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: '클라이언트 IP 주소 (IPv6 지원)',
    validate: {
      isIP: true
    }
  },
  
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '사용자 에이전트 정보'
  },
  
  sessionId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '세션 ID'
  },
  
  result: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'SUCCESS',
    comment: '작업 결과',
    validate: {
      isIn: [['SUCCESS', 'FAILURE', 'ERROR', 'DENIED', 'ALERT']]
    }
  },
  
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '오류 메시지 (실패 시)'
  },
  
  severity: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'LOW',
    comment: '심각도 수준',
    validate: {
      isIn: [['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']]
    }
  },
  
  tags: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '태그 정보 (JSON 배열)'
  },
  
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '추가 메타데이터 (JSON 형태)'
  },
  
  correlationId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '연관 ID (관련 이벤트 그룹핑용)'
  },
  
  sourceSystem: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'nificdc',
    comment: '이벤트 발생 시스템'
  },
  
  processed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '처리 완료 여부'
  },
  
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '처리 완료 시간'
  },
  
  alertSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '알림 발송 여부'
  },
  
  retentionPeriod: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 365,
    comment: '보관 기간 (일)'
  }
}, {
  tableName: 'audit_logs',
  timestamps: false, // timestamp 필드를 직접 관리
  indexes: [
    {
      name: 'idx_audit_timestamp',
      fields: ['timestamp']
    },
    {
      name: 'idx_audit_event_type',
      fields: ['eventType']
    },
    {
      name: 'idx_audit_user',
      fields: ['userId', 'userName']
    },
    {
      name: 'idx_audit_resource',
      fields: ['resource', 'resourceId']
    },
    {
      name: 'idx_audit_ip',
      fields: ['ipAddress']
    },
    {
      name: 'idx_audit_severity',
      fields: ['severity']
    },
    {
      name: 'idx_audit_result',
      fields: ['result']
    },
    {
      name: 'idx_audit_processed',
      fields: ['processed', 'alertSent']
    },
    {
      name: 'idx_audit_correlation',
      fields: ['correlationId']
    },
    {
      name: 'idx_audit_composite',
      fields: ['timestamp', 'eventType', 'severity']
    }
  ],
  hooks: {
    beforeCreate: (auditLog) => {
      // 자동으로 처리된 것으로 표시 (실시간 처리)
      if (auditLog.result === 'SUCCESS') {
        auditLog.processed = true;
        auditLog.processedAt = new Date();
      }
    },
    
    afterCreate: async (auditLog) => {
      // 중요 이벤트는 별도 알림 테이블에도 기록
      if (['CRITICAL', 'HIGH'].includes(auditLog.severity)) {
        // 별도 처리 로직 (예: 즉시 알림)
      }
    }
  }
});

// 클래스 메서드 추가
AuditLog.findByTimeRange = function(startDate, endDate, options = {}) {
  return this.findAll({
    where: {
      timestamp: {
        [require('sequelize').Op.between]: [startDate, endDate]
      },
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    limit: options.limit || 1000,
    offset: options.offset || 0
  });
};

AuditLog.findByUser = function(userId, options = {}) {
  return this.findAll({
    where: {
      userId,
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    limit: options.limit || 100
  });
};

AuditLog.findBySeverity = function(severity, options = {}) {
  return this.findAll({
    where: {
      severity,
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    limit: options.limit || 100
  });
};

AuditLog.findCriticalEvents = function(timeWindow = '24h') {
  const timeWindowMs = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  
  const since = new Date(Date.now() - (timeWindowMs[timeWindow] || timeWindowMs['24h']));
  
  return this.findAll({
    where: {
      severity: ['HIGH', 'CRITICAL'],
      timestamp: {
        [require('sequelize').Op.gte]: since
      }
    },
    order: [['timestamp', 'DESC']]
  });
};

AuditLog.getSecuritySummary = async function(timeWindow = '24h') {
  const timeWindowMs = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  
  const since = new Date(Date.now() - (timeWindowMs[timeWindow] || timeWindowMs['24h']));
  
  const summary = await this.findAll({
    where: {
      timestamp: {
        [require('sequelize').Op.gte]: since
      }
    },
    attributes: [
      'eventType',
      'severity',
      'result',
      [require('sequelize').fn('COUNT', '*'), 'count']
    ],
    group: ['eventType', 'severity', 'result']
  });
  
  return summary;
};

// 인스턴스 메서드 추가
AuditLog.prototype.getParsedChanges = function() {
  try {
    return this.changes ? JSON.parse(this.changes) : null;
  } catch (error) {
    return null;
  }
};

AuditLog.prototype.getParsedOldValues = function() {
  try {
    return this.oldValues ? JSON.parse(this.oldValues) : null;
  } catch (error) {
    return null;
  }
};

AuditLog.prototype.getParsedNewValues = function() {
  try {
    return this.newValues ? JSON.parse(this.newValues) : null;
  } catch (error) {
    return null;
  }
};

AuditLog.prototype.getParsedMetadata = function() {
  try {
    return this.metadata ? JSON.parse(this.metadata) : null;
  } catch (error) {
    return null;
  }
};

AuditLog.prototype.getParsedTags = function() {
  try {
    return this.tags ? JSON.parse(this.tags) : [];
  } catch (error) {
    return [];
  }
};

AuditLog.prototype.isCritical = function() {
  return ['HIGH', 'CRITICAL'].includes(this.severity);
};

AuditLog.prototype.isSecurityRelated = function() {
  const securityEvents = [
    'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT',
    'UNAUTHORIZED_ACCESS_ATTEMPT', 'PRIVILEGE_ESCALATION',
    'PASSWORD_CHANGE', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
    'SECURITY_BREACH', 'SUSPICIOUS_ACTIVITY'
  ];
  
  return securityEvents.includes(this.eventType);
};

AuditLog.prototype.formatForDisplay = function() {
  return {
    id: this.id,
    timestamp: this.timestamp,
    event: this.eventType,
    user: `${this.userName} (${this.userId})`,
    action: this.action,
    resource: this.resource,
    result: this.result,
    severity: this.severity,
    ip: this.ipAddress,
    message: this.getDisplayMessage()
  };
};

AuditLog.prototype.getDisplayMessage = function() {
  const user = this.userName || this.userId || 'Unknown User';
  const resource = this.resourceId ? `${this.resource}:${this.resourceId}` : this.resource;
  
  switch (this.eventType) {
    case 'LOGIN_SUCCESS':
      return `${user}이(가) 성공적으로 로그인했습니다.`;
    case 'LOGIN_FAILURE':
      return `${user}의 로그인이 실패했습니다.`;
    case 'UNAUTHORIZED_ACCESS_ATTEMPT':
      return `${user}이(가) ${resource}에 무권한 접근을 시도했습니다.`;
    case 'DATA_CHANGE':
      return `${user}이(가) ${resource}을(를) ${this.action}했습니다.`;
    case 'SYSTEM_CONFIG_CHANGE':
      return `${user}이(가) 시스템 설정을 변경했습니다.`;
    default:
      return `${user}이(가) ${resource}에 대해 ${this.action} 작업을 수행했습니다.`;
  }
};

module.exports = AuditLog;