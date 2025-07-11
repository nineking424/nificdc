const Joi = require('joi');

// 공통 검증 스키마
const schemas = {
  // 사용자 관련
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).required()
  }),

  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('admin', 'user').default('user')
  }),

  // 시스템 관련
  system: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    type: Joi.string().valid('oracle', 'postgresql', 'sqlite', 'ftp', 'local_fs').required(),
    connectionInfo: Joi.object().required(),
    isActive: Joi.boolean().default(true)
  }),

  // 데이터 스키마 관련
  dataSchema: Joi.object({
    systemId: Joi.string().uuid().required(),
    name: Joi.string().min(1).max(255).required(),
    version: Joi.number().integer().min(1).default(1),
    schemaDefinition: Joi.object().required()
  }),

  // 매핑 관련
  mapping: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    sourceSchemaId: Joi.string().uuid().required(),
    targetSchemaId: Joi.string().uuid().required(),
    mappingRules: Joi.object().required(),
    transformationScript: Joi.string().allow('', null)
  }),

  // 작업 관련
  job: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    mappingId: Joi.string().uuid().required(),
    scheduleConfig: Joi.object({
      type: Joi.string().valid('cron', 'interval').required(),
      expression: Joi.when('type', {
        is: 'cron',
        then: Joi.string().required(),
        otherwise: Joi.forbidden()
      }),
      intervalMs: Joi.when('type', {
        is: 'interval',
        then: Joi.number().integer().min(1000).required(),
        otherwise: Joi.forbidden()
      })
    }).allow(null),
    priority: Joi.number().integer().min(1).max(10).default(5),
    isActive: Joi.boolean().default(true)
  }),

  // 페이지네이션
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // UUID 파라미터
  uuid: Joi.string().uuid().required()
};

// 검증 미들웨어 생성 함수
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property]);
    
    if (error) {
      return res.status(400).json({
        error: {
          message: 'Validation Error',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    // 검증된 값으로 대체
    req[property] = value;
    next();
  };
};

// 파라미터 검증 미들웨어
const validateParams = (schema) => validate(schema, 'params');
const validateQuery = (schema) => validate(schema, 'query');
const validateBody = (schema) => validate(schema, 'body');

module.exports = {
  schemas,
  validate,
  validateParams,
  validateQuery,
  validateBody
};