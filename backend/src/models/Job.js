const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  mappingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'mappings',
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'mapping_id'
  },
  scheduleConfig: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'schedule_config'
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    validate: {
      min: 1,
      max: 10
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deleted_at'
  }
}, {
  tableName: 'jobs',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    {
      fields: ['mapping_id']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['priority']
    }
  ]
});

// 모델 연관관계 정의
Job.associate = (models) => {
  Job.belongsTo(models.Mapping, {
    foreignKey: 'mappingId',
    as: 'mapping',
    onDelete: 'CASCADE'
  });
  
  Job.hasMany(models.JobExecution, {
    foreignKey: 'jobId',
    as: 'executions',
    onDelete: 'CASCADE'
  });
};

// 인스턴스 메서드
Job.prototype.getScheduleType = function() {
  const config = this.scheduleConfig;
  if (config && config.type) {
    return config.type;
  }
  return null;
};

Job.prototype.getCronExpression = function() {
  const config = this.scheduleConfig;
  if (config && config.type === 'cron' && config.expression) {
    return config.expression;
  }
  return null;
};

Job.prototype.getIntervalMs = function() {
  const config = this.scheduleConfig;
  if (config && config.type === 'interval' && config.intervalMs) {
    return config.intervalMs;
  }
  return null;
};

Job.prototype.isScheduled = function() {
  const config = this.scheduleConfig;
  return config && config.type && (config.expression || config.intervalMs);
};

Job.prototype.canExecute = function() {
  return this.isActive && this.isScheduled();
};

Job.prototype.createExecution = async function(status = 'pending') {
  const JobExecution = sequelize.models.JobExecution;
  return JobExecution.create({
    jobId: this.id,
    status: status,
    startedAt: status === 'running' ? new Date() : null
  });
};

Job.prototype.getLastExecution = async function() {
  const JobExecution = sequelize.models.JobExecution;
  return JobExecution.findOne({
    where: {
      jobId: this.id
    },
    order: [['createdAt', 'DESC']]
  });
};

Job.prototype.getExecutionStats = async function() {
  const JobExecution = sequelize.models.JobExecution;
  const stats = await JobExecution.findAll({
    where: {
      jobId: this.id
    },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalExecutions'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")), 'successfulExecutions'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'failed' THEN 1 END")), 'failedExecutions'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'running' THEN 1 END")), 'runningExecutions'],
      [sequelize.fn('AVG', sequelize.literal("CASE WHEN status = 'completed' THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END")), 'avgExecutionTimeSeconds'],
      [sequelize.fn('MAX', sequelize.col('completed_at')), 'lastExecutionAt']
    ],
    raw: true
  });
  
  return stats[0] || {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    runningExecutions: 0,
    avgExecutionTimeSeconds: null,
    lastExecutionAt: null
  };
};

Job.prototype.validateScheduleConfig = function() {
  const config = this.scheduleConfig;
  
  if (!config) {
    return { valid: true, errors: [] };
  }
  
  const errors = [];
  
  if (!config.type) {
    errors.push('Schedule type is required');
  } else if (!['cron', 'interval'].includes(config.type)) {
    errors.push('Schedule type must be either "cron" or "interval"');
  }
  
  if (config.type === 'cron') {
    if (!config.expression) {
      errors.push('Cron expression is required for cron schedule');
    } else {
      // 기본적인 cron 표현식 검증
      const cronParts = config.expression.split(' ');
      if (cronParts.length < 5 || cronParts.length > 6) {
        errors.push('Invalid cron expression format');
      }
    }
  }
  
  if (config.type === 'interval') {
    if (!config.intervalMs) {
      errors.push('Interval in milliseconds is required for interval schedule');
    } else if (config.intervalMs < 1000) {
      errors.push('Interval must be at least 1000ms (1 second)');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
};

// 정적 메서드
Job.findActive = function() {
  return this.findAll({
    where: {
      isActive: true
    },
    order: [['priority', 'DESC'], ['createdAt', 'ASC']]
  });
};

Job.findScheduled = function() {
  return this.findAll({
    where: {
      isActive: true,
      scheduleConfig: {
        [sequelize.Op.ne]: null
      }
    },
    order: [['priority', 'DESC'], ['createdAt', 'ASC']]
  });
};

Job.findByPriority = function(priority) {
  return this.findAll({
    where: {
      priority: priority,
      isActive: true
    },
    order: [['createdAt', 'ASC']]
  });
};

Job.findWithMapping = function(options = {}) {
  return this.findAll({
    ...options,
    include: [
      {
        model: sequelize.models.Mapping,
        as: 'mapping',
        include: [
          { 
            model: sequelize.models.DataSchema, 
            as: 'sourceSchema',
            include: [{ model: sequelize.models.System, as: 'system' }]
          },
          { 
            model: sequelize.models.DataSchema, 
            as: 'targetSchema',
            include: [{ model: sequelize.models.System, as: 'system' }]
          }
        ]
      }
    ]
  });
};

Job.createFromTemplate = async function(templateData) {
  const { name, mappingId, scheduleType, scheduleValue, priority, description } = templateData;
  
  let scheduleConfig = null;
  
  if (scheduleType && scheduleValue) {
    if (scheduleType === 'cron') {
      scheduleConfig = {
        type: 'cron',
        expression: scheduleValue
      };
    } else if (scheduleType === 'interval') {
      scheduleConfig = {
        type: 'interval',
        intervalMs: parseInt(scheduleValue)
      };
    }
  }
  
  return this.create({
    name,
    mappingId,
    scheduleConfig,
    priority: priority || 5,
    description
  });
};

Job.getNextToExecute = async function() {
  const jobs = await this.findActive();
  
  // 우선순위가 높고 마지막 실행 시간이 오래된 작업 선택
  for (const job of jobs) {
    if (job.canExecute()) {
      const runningExecutions = await sequelize.models.JobExecution.count({
        where: {
          jobId: job.id,
          status: 'running'
        }
      });
      
      if (runningExecutions === 0) {
        return job;
      }
    }
  }
  
  return null;
};

module.exports = Job;