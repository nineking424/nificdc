const Joi = require('joi');

/**
 * 시스템 타입별 연결 정보 유효성 검증 스키마
 */
const connectionInfoSchemas = {
  // 데이터베이스 시스템들
  postgresql: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).default(5432),
    database: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
    ssl: Joi.boolean().default(false),
    schema: Joi.string().optional()
  }),

  mysql: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).default(3306),
    database: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
    ssl: Joi.boolean().default(false),
    charset: Joi.string().default('utf8mb4')
  }),

  oracle: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).default(1521),
    serviceName: Joi.string().optional(),
    database: Joi.string().optional(),
    username: Joi.string().required(),
    password: Joi.string().required()
  }).or('serviceName', 'database'),

  sqlite: Joi.object({
    database: Joi.string().required(), // 파일 경로
    path: Joi.string().optional() // database의 alias
  }),

  mongodb: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).default(27017),
    database: Joi.string().required(),
    username: Joi.string().optional(),
    password: Joi.string().optional(),
    authSource: Joi.string().default('admin'),
    ssl: Joi.boolean().default(false)
  }),

  redis: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).default(6379),
    password: Joi.string().optional(),
    database: Joi.number().integer().min(0).max(15).default(0),
    ssl: Joi.boolean().default(false)
  }),

  // 파일 시스템들
  sftp: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).default(22),
    username: Joi.string().required(),
    password: Joi.string().optional(),
    privateKey: Joi.string().optional(),
    rootPath: Joi.string().default('/'),
    timeout: Joi.number().integer().min(1000).default(10000)
  }).or('password', 'privateKey'),

  ftp: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).default(21),
    username: Joi.string().required(),
    password: Joi.string().required(),
    rootPath: Joi.string().default('/'),
    ssl: Joi.boolean().default(false), // FTPS
    passive: Joi.boolean().default(true)
  }),

  local_fs: Joi.object({
    rootPath: Joi.string().required(),
    permissions: Joi.object({
      read: Joi.boolean().default(true),
      write: Joi.boolean().default(false),
      delete: Joi.boolean().default(false)
    }).optional()
  }),

  // 클라우드 스토리지
  aws_s3: Joi.object({
    accessKeyId: Joi.string().required(),
    secretAccessKey: Joi.string().required(),
    region: Joi.string().required(),
    bucket: Joi.string().required(),
    endpoint: Joi.string().optional(), // For S3-compatible services
    pathPrefix: Joi.string().default('')
  }),

  azure_blob: Joi.object({
    accountName: Joi.string().required(),
    accountKey: Joi.string().optional(),
    connectionString: Joi.string().optional(),
    container: Joi.string().required(),
    pathPrefix: Joi.string().default('')
  }).or('accountKey', 'connectionString'),

  // API 시스템들
  api: Joi.object({
    endpoint: Joi.string().uri().optional(),
    host: Joi.string().optional(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    protocol: Joi.string().valid('http', 'https').default('https'),
    headers: Joi.object().optional(),
    timeout: Joi.number().integer().min(1000).default(30000),
    authentication: Joi.object({
      type: Joi.string().valid('basic', 'bearer', 'apikey', 'oauth2').optional(),
      username: Joi.string().optional(),
      password: Joi.string().optional(),
      token: Joi.string().optional(),
      apiKey: Joi.string().optional()
    }).optional()
  }).or('endpoint', 'host'),

  api_rest: Joi.object({
    endpoint: Joi.string().uri().optional(),
    host: Joi.string().optional(),
    port: Joi.number().integer().min(1).max(65535).optional(),
    protocol: Joi.string().valid('http', 'https').default('https'),
    headers: Joi.object().optional(),
    timeout: Joi.number().integer().min(1000).default(30000)
  }).or('endpoint', 'host'),

  // 메시징 시스템
  kafka: Joi.object({
    brokers: Joi.alternatives().try(
      Joi.string(), // 단일 브로커
      Joi.array().items(Joi.string()).min(1) // 브로커 배열
    ).required(),
    clientId: Joi.string().optional(),
    ssl: Joi.boolean().default(false),
    sasl: Joi.object({
      mechanism: Joi.string().valid('plain', 'scram-sha-256', 'scram-sha-512').required(),
      username: Joi.string().required(),
      password: Joi.string().required()
    }).optional(),
    connectionTimeout: Joi.number().integer().min(1000).default(10000)
  })
};

/**
 * 연결 정보 유효성 검증
 * @param {string} systemType - 시스템 타입
 * @param {object} connectionInfo - 연결 정보 객체
 * @returns {object} 검증 결과 { isValid, error, value }
 */
function validateConnectionInfo(systemType, connectionInfo) {
  const schema = connectionInfoSchemas[systemType];
  
  if (!schema) {
    return {
      isValid: false,
      error: `Validation schema not found for system type: ${systemType}`,
      value: null
    };
  }

  const { error, value } = schema.validate(connectionInfo, {
    allowUnknown: false, // 정의되지 않은 필드 허용 안함
    stripUnknown: true,  // 정의되지 않은 필드 제거
    abortEarly: false    // 모든 오류 수집
  });

  if (error) {
    return {
      isValid: false,
      error: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      })),
      value: null
    };
  }

  return {
    isValid: true,
    error: null,
    value
  };
}

/**
 * 시스템 타입별 필수 필드 목록 반환
 * @param {string} systemType - 시스템 타입
 * @returns {string[]} 필수 필드 배열
 */
function getRequiredFields(systemType) {
  const schema = connectionInfoSchemas[systemType];
  if (!schema) return [];

  const describe = schema.describe();
  return Object.keys(describe.keys || {}).filter(key => {
    const fieldSchema = describe.keys[key];
    return fieldSchema.flags?.presence === 'required';
  });
}

/**
 * 시스템 타입별 기본값 반환
 * @param {string} systemType - 시스템 타입
 * @returns {object} 기본값 객체
 */
function getDefaultValues(systemType) {
  const schema = connectionInfoSchemas[systemType];
  if (!schema) return {};

  const { value } = schema.validate({}, { allowUnknown: true });
  return value || {};
}

/**
 * 지원하는 모든 시스템 타입 목록 반환
 * @returns {string[]} 시스템 타입 배열
 */
function getSupportedSystemTypes() {
  return Object.keys(connectionInfoSchemas);
}

module.exports = {
  validateConnectionInfo,
  getRequiredFields,
  getDefaultValues,
  getSupportedSystemTypes,
  connectionInfoSchemas
};