const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

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
      model: 'jobs',
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'job_id'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['pending', 'running', 'completed', 'failed', 'cancelled']]
    }
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'started_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  },
  metrics: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'job_executions',
  timestamps: false,
  underscored: true,
  validate: {
    startEndCheck() {
      if (this.completedAt && this.startedAt && this.completedAt < this.startedAt) {
        throw new Error('Completed time cannot be before started time');
      }
    }
  },
  indexes: [
    {
      fields: ['job_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['started_at']
    },
    {
      fields: ['completed_at']
    }
  ]
});

// 모델 연관관계 정의
JobExecution.associate = (models) => {
  JobExecution.belongsTo(models.Job, {
    foreignKey: 'jobId',
    as: 'job',
    onDelete: 'CASCADE'
  });
};

// 인스턴스 메서드
JobExecution.prototype.start = async function() {
  if (this.status !== 'pending') {
    throw new Error('Only pending executions can be started');
  }
  
  this.status = 'running';
  this.startedAt = new Date();
  return this.save();
};

JobExecution.prototype.complete = async function(metrics = null) {
  if (this.status !== 'running') {
    throw new Error('Only running executions can be completed');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  if (metrics) {
    this.metrics = metrics;
  }
  return this.save();
};

JobExecution.prototype.fail = async function(errorMessage, metrics = null) {
  if (this.status !== 'running') {
    throw new Error('Only running executions can be failed');
  }
  
  this.status = 'failed';
  this.completedAt = new Date();
  this.errorMessage = errorMessage;
  if (metrics) {
    this.metrics = metrics;
  }
  return this.save();
};

JobExecution.prototype.cancel = async function() {
  if (!['pending', 'running'].includes(this.status)) {
    throw new Error('Only pending or running executions can be cancelled');
  }
  
  this.status = 'cancelled';
  this.completedAt = new Date();
  return this.save();
};

JobExecution.prototype.getDuration = function() {
  if (!this.startedAt || !this.completedAt) {
    return null;
  }
  
  return this.completedAt - this.startedAt;
};

JobExecution.prototype.getDurationSeconds = function() {
  const duration = this.getDuration();
  return duration ? Math.floor(duration / 1000) : null;
};

JobExecution.prototype.isRunning = function() {
  return this.status === 'running';
};

JobExecution.prototype.isCompleted = function() {
  return ['completed', 'failed', 'cancelled'].includes(this.status);
};

JobExecution.prototype.isSuccess = function() {
  return this.status === 'completed';
};

JobExecution.prototype.getMetric = function(key) {
  if (!this.metrics || typeof this.metrics !== 'object') {
    return null;
  }
  return this.metrics[key] || null;
};

JobExecution.prototype.setMetric = function(key, value) {
  if (!this.metrics) {
    this.metrics = {};
  }
  this.metrics[key] = value;
};

JobExecution.prototype.addMetrics = function(newMetrics) {
  if (!this.metrics) {
    this.metrics = {};
  }
  Object.assign(this.metrics, newMetrics);
};

// 정적 메서드
JobExecution.findByJob = function(jobId, options = {}) {
  return this.findAll({
    where: {
      jobId: jobId
    },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

JobExecution.findRunning = function() {
  return this.findAll({
    where: {
      status: 'running'
    },
    order: [['startedAt', 'ASC']]
  });
};

JobExecution.findByStatus = function(status) {
  return this.findAll({
    where: {
      status: status
    },
    order: [['createdAt', 'DESC']]
  });
};

JobExecution.findRecent = function(limit = 10) {
  return this.findAll({
    order: [['createdAt', 'DESC']],
    limit: limit,
    include: [
      {
        model: sequelize.models.Job,
        as: 'job',
        attributes: ['id', 'name']
      }
    ]
  });
};

JobExecution.getExecutionStats = async function(jobId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.findAll({
    where: {
      jobId: jobId,
      createdAt: {
        [sequelize.Op.gte]: startDate
      }
    },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalExecutions'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")), 'successfulExecutions'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'failed' THEN 1 END")), 'failedExecutions'],
      [sequelize.fn('AVG', sequelize.literal("CASE WHEN status = 'completed' THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END")), 'avgExecutionTimeSeconds'],
      [sequelize.fn('MIN', sequelize.literal("CASE WHEN status = 'completed' THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END")), 'minExecutionTimeSeconds'],
      [sequelize.fn('MAX', sequelize.literal("CASE WHEN status = 'completed' THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END")), 'maxExecutionTimeSeconds']
    ],
    raw: true
  });
  
  const result = stats[0] || {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgExecutionTimeSeconds: null,
    minExecutionTimeSeconds: null,
    maxExecutionTimeSeconds: null
  };
  
  // 성공률 계산
  if (result.totalExecutions > 0) {
    result.successRate = (result.successfulExecutions / result.totalExecutions) * 100;
  } else {
    result.successRate = 0;
  }
  
  return result;
};

JobExecution.cleanupOldExecutions = async function(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const deletedCount = await this.destroy({
    where: {
      createdAt: {
        [sequelize.Op.lt]: cutoffDate
      },
      status: {
        [sequelize.Op.in]: ['completed', 'failed', 'cancelled']
      }
    }
  });
  
  return deletedCount;
};

JobExecution.getDailyStats = async function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  const stats = await this.findAll({
    where: {
      createdAt: {
        [sequelize.Op.gte]: startDate
      }
    },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalExecutions'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")), 'successfulExecutions'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'failed' THEN 1 END")), 'failedExecutions']
    ],
    group: [sequelize.fn('DATE', sequelize.col('created_at'))],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
    raw: true
  });
  
  return stats.map(stat => ({
    ...stat,
    successRate: stat.totalExecutions > 0 ? (stat.successfulExecutions / stat.totalExecutions) * 100 : 0
  }));
};

module.exports = JobExecution;