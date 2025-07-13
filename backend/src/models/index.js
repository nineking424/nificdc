const { sequelize } = require('../database/connection');

// 모델 로드
const User = require('./User');
const System = require('./System');
const DataSchema = require('./DataSchema');
const Mapping = require('./Mapping');
const Job = require('./Job');
const JobExecution = require('./JobExecution');
const AuditLog = require('./AuditLog');

// 모델 객체
const models = {
  User,
  System,
  DataSchema,
  Mapping,
  Job,
  JobExecution,
  AuditLog,
  sequelize
};

// 연관관계 설정
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;