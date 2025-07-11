const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: '작업 이름은 필수입니다.' },
      len: { args: [1, 100], msg: '작업 이름은 1-100자 사이여야 합니다.' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  mappingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Mappings',
      key: 'id'
    },
    comment: '연관된 매핑 ID'
  },
  scheduleConfig: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: { type: 'manual' },
    comment: '스케줄 설정 정보',
    validate: {
      isValidScheduleConfig(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('스케줄 설정이 유효하지 않습니다.');
        }
        
        const validTypes = ['manual', 'immediate', 'once', 'recurring', 'cron'];
        if (!validTypes.includes(value.type)) {
          throw new Error('유효하지 않은 스케줄 타입입니다.');
        }
        
        if (value.type === 'cron' && !value.expression) {
          throw new Error('Cron 스케줄에는 표현식이 필요합니다.');
        }
        
        if (value.type === 'once' && !value.executeAt) {
          throw new Error('일회성 스케줄에는 실행 시간이 필요합니다.');
        }
      }
    }
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: {
      min: { args: [1], msg: '우선순위는 1 이상이어야 합니다.' },
      max: { args: [10], msg: '우선순위는 10 이하여야 합니다.' }
    },
    comment: '작업 우선순위 (1: 낮음, 10: 높음)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: '작업 활성화 여부'
  },
  status: {
    type: DataTypes.ENUM('inactive', 'scheduled', 'running', 'paused', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'inactive',
    comment: '현재 작업 상태'
  },
  nifiProcessGroupId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'NiFi 프로세스 그룹 ID'
  },
  nifiProcessorId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'NiFi 프로세서 ID'
  },
  configuration: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: '작업 실행 설정 (리트라이, 타임아웃 등)'
  },
  executionStats: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: '실행 통계 정보'
  },
  lastExecutedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '마지막 실행 시간'
  },
  nextExecutionAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '다음 실행 예정 시간'
  },
  lastExecutionStatus: {
    type: DataTypes.ENUM('success', 'failed', 'cancelled'),
    allowNull: true,
    comment: '마지막 실행 상태'
  },
  lastExecutionError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '마지막 실행 오류 메시지'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '작업 태그'
  },
  dependencies: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '의존성 작업 ID 목록'
  },
  timeout: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '타임아웃 시간 (초)'
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    comment: '최대 재시도 횟수'
  },
  retryDelay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    comment: '재시도 지연 시간 (초)'
  }
}, {
  tableName: 'jobs',
  timestamps: true,
  indexes: [
    {
      fields: ['mappingId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['nextExecutionAt']
    },
    {
      fields: ['createdBy']
    },
    {
      fields: ['tags']
    }
  ],
  hooks: {
    beforeCreate: (job) => {
      // 다음 실행 시간 계산
      if (job.isActive && job.scheduleConfig) {
        job.nextExecutionAt = job.calculateNextExecution();
      }
    },
    beforeUpdate: (job) => {
      // 스케줄 또는 활성화 상태 변경 시 다음 실행 시간 재계산
      if (job.changed('scheduleConfig') || job.changed('isActive')) {
        if (job.isActive && job.scheduleConfig) {
          job.nextExecutionAt = job.calculateNextExecution();
        } else {
          job.nextExecutionAt = null;
        }
      }
    }
  }
});

// 연관 관계 정의
Job.associate = (models) => {
  Job.belongsTo(models.Mapping, {
    foreignKey: 'mappingId',
    as: 'mapping'
  });
  
  Job.belongsTo(models.User, {
    foreignKey: 'createdBy',
    as: 'creator'
  });
  
  Job.belongsTo(models.User, {
    foreignKey: 'updatedBy',
    as: 'updater'
  });
  
  Job.hasMany(models.JobExecution, {
    foreignKey: 'jobId',
    as: 'executions'
  });
  
  // 자기 참조 관계 (의존성)
  Job.hasMany(models.Job, {
    foreignKey: 'parentJobId',
    as: 'dependentJobs'
  });
  
  Job.belongsTo(models.Job, {
    foreignKey: 'parentJobId',
    as: 'parentJob'
  });
};

// 인스턴스 메서드
Job.prototype.calculateNextExecution = function() {
  const { scheduleConfig } = this;
  
  if (!scheduleConfig || !this.isActive) {
    return null;
  }
  
  const now = new Date();
  
  switch (scheduleConfig.type) {
    case 'immediate':
      return now;
      
    case 'once':
      return new Date(scheduleConfig.executeAt);
      
    case 'recurring':
      return this.calculateRecurringNextExecution(now);
      
    case 'cron':
      return this.calculateCronNextExecution(now);
      
    default:
      return null;
  }
};

Job.prototype.calculateRecurringNextExecution = function(baseTime) {
  const { scheduleConfig } = this;
  const { intervalType, interval, startDate } = scheduleConfig;
  
  let nextExecution = new Date(startDate || baseTime);
  
  // 현재 시간보다 이후로 설정
  while (nextExecution <= baseTime) {
    switch (intervalType) {
      case 'minutes':
        nextExecution.setMinutes(nextExecution.getMinutes() + interval);
        break;
      case 'hours':
        nextExecution.setHours(nextExecution.getHours() + interval);
        break;
      case 'days':
        nextExecution.setDate(nextExecution.getDate() + interval);
        break;
      case 'weeks':
        nextExecution.setDate(nextExecution.getDate() + (interval * 7));
        break;
      case 'months':
        nextExecution.setMonth(nextExecution.getMonth() + interval);
        break;
      default:
        return null;
    }
  }
  
  return nextExecution;
};

Job.prototype.calculateCronNextExecution = function(baseTime) {
  // 간단한 cron 파싱 구현 (실제로는 node-cron 라이브러리 사용)
  const { expression } = this.scheduleConfig;
  
  try {
    const cron = require('node-cron');
    if (!cron.validate(expression)) {
      throw new Error('유효하지 않은 cron 표현식');
    }
    
    // 다음 실행 시간 계산을 위해 cron-parser 사용
    const parser = require('cron-parser');
    const interval = parser.parseExpression(expression);
    return interval.next().toDate();
  } catch (error) {
    console.error('Cron 계산 오류:', error);
    return null;
  }
};

Job.prototype.canExecute = function() {
  if (!this.isActive) return false;
  if (this.status === 'running') return false;
  
  const now = new Date();
  if (this.nextExecutionAt && this.nextExecutionAt > now) return false;
  
  return true;
};

Job.prototype.isDependenciesMet = async function() {
  if (!this.dependencies || this.dependencies.length === 0) {
    return true;
  }
  
  const dependentJobs = await Job.findAll({
    where: {
      id: this.dependencies
    }
  });
  
  return dependentJobs.every(job => 
    job.lastExecutionStatus === 'success' || 
    job.status === 'completed'
  );
};

Job.prototype.getExecutionStatistics = function() {
  const stats = this.executionStats || {};
  
  return {
    totalExecutions: stats.totalExecutions || 0,
    successfulExecutions: stats.successfulExecutions || 0,
    failedExecutions: stats.failedExecutions || 0,
    averageExecutionTime: stats.averageExecutionTime || 0,
    lastExecutionTime: stats.lastExecutionTime || 0,
    successRate: stats.totalExecutions > 0 ? 
      (stats.successfulExecutions / stats.totalExecutions * 100) : 0
  };
};

Job.prototype.updateExecutionStats = function(executionTime, success) {
  const stats = this.executionStats || {};
  
  stats.totalExecutions = (stats.totalExecutions || 0) + 1;
  stats.lastExecutionTime = executionTime;
  
  if (success) {
    stats.successfulExecutions = (stats.successfulExecutions || 0) + 1;
  } else {
    stats.failedExecutions = (stats.failedExecutions || 0) + 1;
  }
  
  // 평균 실행 시간 계산
  if (stats.totalExecutions === 1) {
    stats.averageExecutionTime = executionTime;
  } else {
    stats.averageExecutionTime = (
      (stats.averageExecutionTime * (stats.totalExecutions - 1)) + executionTime
    ) / stats.totalExecutions;
  }
  
  this.executionStats = stats;
};

Job.prototype.activate = function() {
  this.isActive = true;
  this.status = 'scheduled';
  this.nextExecutionAt = this.calculateNextExecution();
};

Job.prototype.deactivate = function() {
  this.isActive = false;
  this.status = 'inactive';
  this.nextExecutionAt = null;
};

Job.prototype.pause = function() {
  this.status = 'paused';
};

Job.prototype.resume = function() {
  if (this.isActive) {
    this.status = 'scheduled';
    this.nextExecutionAt = this.calculateNextExecution();
  }
};

// 클래스 메서드
Job.findExecutableJobs = async function() {
  const now = new Date();
  
  return await this.findAll({
    where: {
      isActive: true,
      status: 'scheduled',
      nextExecutionAt: {
        [sequelize.Op.lte]: now
      }
    },
    order: [
      ['priority', 'DESC'],
      ['nextExecutionAt', 'ASC']
    ],
    include: [
      {
        model: require('./Mapping'),
        as: 'mapping',
        include: [
          {
            model: require('./System'),
            as: 'sourceSystem'
          },
          {
            model: require('./System'),
            as: 'targetSystem'
          }
        ]
      }
    ]
  });
};

Job.findByStatus = async function(status) {
  return await this.findAll({
    where: { status },
    order: [['priority', 'DESC'], ['createdAt', 'ASC']],
    include: [
      {
        model: require('./Mapping'),
        as: 'mapping'
      },
      {
        model: require('./User'),
        as: 'creator',
        attributes: ['id', 'name', 'email']
      }
    ]
  });
};

Job.findByTag = async function(tag) {
  return await this.findAll({
    where: {
      tags: {
        [sequelize.Op.contains]: [tag]
      }
    },
    order: [['priority', 'DESC'], ['createdAt', 'ASC']]
  });
};

Job.getScheduleTypes = function() {
  return [
    { value: 'manual', label: '수동 실행', description: '직접 실행 버튼을 클릭해야 실행됩니다.' },
    { value: 'immediate', label: '즉시 실행', description: '생성 즉시 실행됩니다.' },
    { value: 'once', label: '일회성 실행', description: '지정된 시간에 한 번만 실행됩니다.' },
    { value: 'recurring', label: '주기적 실행', description: '일정한 간격으로 반복 실행됩니다.' },
    { value: 'cron', label: 'Cron 스케줄', description: 'Cron 표현식으로 정교한 스케줄링을 설정합니다.' }
  ];
};

Job.getStatusTypes = function() {
  return [
    { value: 'inactive', label: '비활성', color: 'grey' },
    { value: 'scheduled', label: '예약됨', color: 'blue' },
    { value: 'running', label: '실행 중', color: 'orange' },
    { value: 'paused', label: '일시정지', color: 'yellow' },
    { value: 'completed', label: '완료', color: 'green' },
    { value: 'failed', label: '실패', color: 'red' }
  ];
};

Job.prototype.toJSON = function() {
  const values = { ...this.dataValues };
  
  // 민감한 정보 제거
  delete values.nifiProcessGroupId;
  delete values.nifiProcessorId;
  
  // 통계 정보 추가
  values.statistics = this.getExecutionStatistics();
  
  return values;
};

module.exports = Job;