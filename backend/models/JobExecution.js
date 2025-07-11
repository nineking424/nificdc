const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobExecution = sequelize.define('JobExecution', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Jobs',
      key: 'id'
    }
  },
  executionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '실행 고유 식별자'
  },
  status: {
    type: DataTypes.ENUM('queued', 'running', 'completed', 'failed', 'cancelled', 'timeout'),
    allowNull: false,
    defaultValue: 'queued',
    comment: '실행 상태'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '실행 시작 시간'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '실행 완료 시간'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '실행 시간 (밀리초)'
  },
  triggerType: {
    type: DataTypes.ENUM('manual', 'scheduled', 'dependency', 'retry'),
    allowNull: false,
    defaultValue: 'scheduled',
    comment: '실행 트리거 유형'
  },
  triggeredBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: '수동 실행한 사용자 ID'
  },
  parameters: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '실행 파라미터'
  },
  sourceRecordsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '처리된 소스 레코드 수'
  },
  targetRecordsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '생성된 타겟 레코드 수'
  },
  errorRecordsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '오류 레코드 수'
  },
  metrics: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '상세 실행 메트릭'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '오류 메시지'
  },
  errorStack: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '오류 스택 트레이스'
  },
  logs: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '실행 로그'
  },
  nifiFlowFileUuids: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'NiFi FlowFile UUID 목록'
  },
  nifiProcessorSnapshots: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'NiFi 프로세서 스냅샷 정보'
  },
  retryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '재시도 횟수'
  },
  parentExecutionId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'JobExecutions',
      key: 'id'
    },
    comment: '부모 실행 ID (재시도의 경우)'
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    comment: '실행 우선순위'
  },
  queuedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '큐에 추가된 시간'
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '예약된 실행 시간'
  },
  executionContext: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '실행 컨텍스트 정보'
  },
  resourceUsage: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '리소스 사용량 정보'
  },
  warnings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '경고 메시지 목록'
  },
  checkpoints: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '실행 체크포인트 정보'
  }
}, {
  tableName: 'job_executions',
  timestamps: true,
  indexes: [
    {
      fields: ['jobId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['startedAt']
    },
    {
      fields: ['completedAt']
    },
    {
      fields: ['triggerType']
    },
    {
      fields: ['triggeredBy']
    },
    {
      fields: ['parentExecutionId']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['queuedAt']
    },
    {
      unique: true,
      fields: ['executionId']
    }
  ],
  hooks: {
    beforeCreate: (execution) => {
      // 실행 ID 생성
      if (!execution.executionId) {
        execution.executionId = `job_${execution.jobId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // 큐에 추가된 시간 설정
      if (!execution.queuedAt) {
        execution.queuedAt = new Date();
      }
    },
    beforeUpdate: (execution) => {
      // 실행 시간 계산
      if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
        if (execution.startedAt && execution.completedAt) {
          execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
        }
      }
    }
  }
});

// 연관 관계 정의
JobExecution.associate = (models) => {
  JobExecution.belongsTo(models.Job, {
    foreignKey: 'jobId',
    as: 'job'
  });
  
  JobExecution.belongsTo(models.User, {
    foreignKey: 'triggeredBy',
    as: 'triggeredByUser'
  });
  
  // 자기 참조 관계 (재시도)
  JobExecution.belongsTo(models.JobExecution, {
    foreignKey: 'parentExecutionId',
    as: 'parentExecution'
  });
  
  JobExecution.hasMany(models.JobExecution, {
    foreignKey: 'parentExecutionId',
    as: 'retryExecutions'
  });
};

// 인스턴스 메서드
JobExecution.prototype.start = function() {
  this.status = 'running';
  this.startedAt = new Date();
  this.addCheckpoint('execution_started', '실행 시작');
};

JobExecution.prototype.complete = function(metrics = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.metrics = { ...this.metrics, ...metrics };
  this.addCheckpoint('execution_completed', '실행 완료');
  this.calculateDuration();
};

JobExecution.prototype.fail = function(error, metrics = {}) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.errorMessage = error.message || error;
  this.errorStack = error.stack;
  this.metrics = { ...this.metrics, ...metrics };
  this.addCheckpoint('execution_failed', `실행 실패: ${error.message || error}`);
  this.calculateDuration();
};

JobExecution.prototype.cancel = function(reason = '사용자 취소') {
  this.status = 'cancelled';
  this.completedAt = new Date();
  this.errorMessage = reason;
  this.addCheckpoint('execution_cancelled', reason);
  this.calculateDuration();
};

JobExecution.prototype.timeout = function() {
  this.status = 'timeout';
  this.completedAt = new Date();
  this.errorMessage = '실행 시간 초과';
  this.addCheckpoint('execution_timeout', '실행 시간 초과');
  this.calculateDuration();
};

JobExecution.prototype.calculateDuration = function() {
  if (this.startedAt && this.completedAt) {
    this.duration = this.completedAt.getTime() - this.startedAt.getTime();
  }
};

JobExecution.prototype.addCheckpoint = function(type, message, data = null) {
  const checkpoint = {
    type,
    message,
    timestamp: new Date(),
    data
  };
  
  this.checkpoints = [...(this.checkpoints || []), checkpoint];
};

JobExecution.prototype.addWarning = function(message, code = null) {
  const warning = {
    message,
    code,
    timestamp: new Date()
  };
  
  this.warnings = [...(this.warnings || []), warning];
};

JobExecution.prototype.updateMetrics = function(metrics) {
  this.metrics = { ...(this.metrics || {}), ...metrics };
};

JobExecution.prototype.updateRecordCounts = function(source, target, errors) {
  this.sourceRecordsCount = source;
  this.targetRecordsCount = target;
  this.errorRecordsCount = errors;
};

JobExecution.prototype.updateResourceUsage = function(cpu, memory, disk) {
  this.resourceUsage = {
    cpu: cpu || 0,
    memory: memory || 0,
    disk: disk || 0,
    timestamp: new Date()
  };
};

JobExecution.prototype.isRunning = function() {
  return this.status === 'running';
};

JobExecution.prototype.isCompleted = function() {
  return ['completed', 'failed', 'cancelled', 'timeout'].includes(this.status);
};

JobExecution.prototype.isSuccessful = function() {
  return this.status === 'completed';
};

JobExecution.prototype.canRetry = function() {
  return this.status === 'failed' && this.retryCount < 3;
};

JobExecution.prototype.getFormattedDuration = function() {
  if (!this.duration) return 'N/A';
  
  const seconds = Math.floor(this.duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`;
  } else if (minutes > 0) {
    return `${minutes}분 ${seconds % 60}초`;
  } else {
    return `${seconds}초`;
  }
};

JobExecution.prototype.getExecutionSummary = function() {
  return {
    id: this.id,
    executionId: this.executionId,
    status: this.status,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
    duration: this.duration,
    formattedDuration: this.getFormattedDuration(),
    sourceRecordsCount: this.sourceRecordsCount,
    targetRecordsCount: this.targetRecordsCount,
    errorRecordsCount: this.errorRecordsCount,
    retryCount: this.retryCount,
    triggerType: this.triggerType,
    warnings: this.warnings ? this.warnings.length : 0,
    checkpoints: this.checkpoints ? this.checkpoints.length : 0
  };
};

// 클래스 메서드
JobExecution.findByJobId = async function(jobId, options = {}) {
  return await this.findAll({
    where: { jobId },
    order: [['startedAt', 'DESC']],
    limit: options.limit || 50,
    offset: options.offset || 0,
    include: [
      {
        model: require('./User'),
        as: 'triggeredByUser',
        attributes: ['id', 'name', 'email']
      }
    ]
  });
};

JobExecution.findRunningExecutions = async function() {
  return await this.findAll({
    where: { status: 'running' },
    order: [['startedAt', 'ASC']],
    include: [
      {
        model: require('./Job'),
        as: 'job',
        include: [
          {
            model: require('./Mapping'),
            as: 'mapping'
          }
        ]
      }
    ]
  });
};

JobExecution.findQueuedExecutions = async function() {
  return await this.findAll({
    where: { status: 'queued' },
    order: [['priority', 'DESC'], ['queuedAt', 'ASC']],
    include: [
      {
        model: require('./Job'),
        as: 'job'
      }
    ]
  });
};

JobExecution.getExecutionStats = async function(jobId, period = '30d') {
  const where = { jobId };
  
  // 기간 필터 추가
  if (period !== 'all') {
    const days = parseInt(period.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    where.startedAt = {
      [sequelize.Op.gte]: startDate
    };
  }
  
  const executions = await this.findAll({
    where,
    attributes: [
      'status',
      'duration',
      'sourceRecordsCount',
      'targetRecordsCount',
      'errorRecordsCount',
      'startedAt'
    ]
  });
  
  const stats = {
    total: executions.length,
    completed: 0,
    failed: 0,
    cancelled: 0,
    timeout: 0,
    totalDuration: 0,
    averageDuration: 0,
    totalSourceRecords: 0,
    totalTargetRecords: 0,
    totalErrorRecords: 0,
    successRate: 0,
    dailyStats: {}
  };
  
  executions.forEach(execution => {
    stats[execution.status] = (stats[execution.status] || 0) + 1;
    
    if (execution.duration) {
      stats.totalDuration += execution.duration;
    }
    
    if (execution.sourceRecordsCount) {
      stats.totalSourceRecords += execution.sourceRecordsCount;
    }
    
    if (execution.targetRecordsCount) {
      stats.totalTargetRecords += execution.targetRecordsCount;
    }
    
    if (execution.errorRecordsCount) {
      stats.totalErrorRecords += execution.errorRecordsCount;
    }
    
    // 일별 통계
    if (execution.startedAt) {
      const dateKey = execution.startedAt.toISOString().split('T')[0];
      if (!stats.dailyStats[dateKey]) {
        stats.dailyStats[dateKey] = { total: 0, completed: 0, failed: 0 };
      }
      stats.dailyStats[dateKey].total++;
      stats.dailyStats[dateKey][execution.status]++;
    }
  });
  
  if (stats.total > 0) {
    stats.averageDuration = stats.totalDuration / stats.total;
    stats.successRate = (stats.completed / stats.total) * 100;
  }
  
  return stats;
};

JobExecution.cleanup = async function(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const deletedCount = await this.destroy({
    where: {
      completedAt: {
        [sequelize.Op.lt]: cutoffDate
      },
      status: {
        [sequelize.Op.in]: ['completed', 'failed', 'cancelled']
      }
    }
  });
  
  return deletedCount;
};

module.exports = JobExecution;