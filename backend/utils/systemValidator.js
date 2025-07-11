const Joi = require('joi');

// 시스템 타입별 연결 정보 검증 스키마
const connectionSchemas = {
  // 데이터베이스 시스템
  oracle: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.',
      'string.empty': '호스트를 입력해주세요.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(1521),
    serviceName: Joi.string().required().messages({
      'any.required': '서비스명은 필수입니다.'
    }),
    username: Joi.string().required().messages({
      'any.required': '사용자명은 필수입니다.'
    }),
    password: Joi.string().required().messages({
      'any.required': '비밀번호는 필수입니다.'
    }),
    ssl: Joi.boolean().default(false),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  postgresql: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(5432),
    database: Joi.string().required().messages({
      'any.required': '데이터베이스명은 필수입니다.'
    }),
    username: Joi.string().required().messages({
      'any.required': '사용자명은 필수입니다.'
    }),
    password: Joi.string().required().messages({
      'any.required': '비밀번호는 필수입니다.'
    }),
    schema: Joi.string().default('public'),
    ssl: Joi.boolean().default(false),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  mysql: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(3306),
    database: Joi.string().required().messages({
      'any.required': '데이터베이스명은 필수입니다.'
    }),
    username: Joi.string().required().messages({
      'any.required': '사용자명은 필수입니다.'
    }),
    password: Joi.string().required().messages({
      'any.required': '비밀번호는 필수입니다.'
    }),
    ssl: Joi.boolean().default(false),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  mssql: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(1433),
    database: Joi.string().required().messages({
      'any.required': '데이터베이스명은 필수입니다.'
    }),
    username: Joi.string().required().messages({
      'any.required': '사용자명은 필수입니다.'
    }),
    password: Joi.string().required().messages({
      'any.required': '비밀번호는 필수입니다.'
    }),
    trustServerCertificate: Joi.boolean().default(false),
    encrypt: Joi.boolean().default(false),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  sqlite: Joi.object({
    path: Joi.string().required().messages({
      'any.required': '데이터베이스 파일 경로는 필수입니다.'
    }),
    readonly: Joi.boolean().default(false)
  }),

  mongodb: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(27017),
    database: Joi.string().required().messages({
      'any.required': '데이터베이스명은 필수입니다.'
    }),
    username: Joi.string().allow(''),
    password: Joi.string().allow(''),
    authSource: Joi.string().default('admin'),
    ssl: Joi.boolean().default(false),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  redis: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(6379),
    password: Joi.string().allow(''),
    database: Joi.number().integer().min(0).max(15).default(0),
    ssl: Joi.boolean().default(false),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  // 파일 시스템
  ftp: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(21),
    username: Joi.string().required().messages({
      'any.required': '사용자명은 필수입니다.'
    }),
    password: Joi.string().required().messages({
      'any.required': '비밀번호는 필수입니다.'
    }),
    passiveMode: Joi.boolean().default(true),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  sftp: Joi.object({
    host: Joi.string().required().messages({
      'any.required': '호스트는 필수입니다.'
    }),
    port: Joi.number().integer().min(1).max(65535).default(22),
    username: Joi.string().required().messages({
      'any.required': '사용자명은 필수입니다.'
    }),
    password: Joi.string().when('privateKey', {
      is: Joi.exist(),
      then: Joi.string().allow(''),
      otherwise: Joi.string().required().messages({
        'any.required': '비밀번호 또는 개인키는 필수입니다.'
      })
    }),
    privateKey: Joi.string().allow(''),
    passphrase: Joi.string().allow(''),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }),

  local_fs: Joi.object({
    path: Joi.string().required().messages({
      'any.required': '경로는 필수입니다.'
    }),
    readonly: Joi.boolean().default(false)
  }),

  // 클라우드 스토리지
  aws_s3: Joi.object({
    region: Joi.string().required().messages({
      'any.required': '리전은 필수입니다.'
    }),
    bucket: Joi.string().required().messages({
      'any.required': '버킷명은 필수입니다.'
    }),
    accessKeyId: Joi.string().required().messages({
      'any.required': 'Access Key ID는 필수입니다.'
    }),
    secretAccessKey: Joi.string().required().messages({
      'any.required': 'Secret Access Key는 필수입니다.'
    }),
    sessionToken: Joi.string().allow(''),
    endpoint: Joi.string().allow(''),
    s3ForcePathStyle: Joi.boolean().default(false)
  }),

  azure_blob: Joi.object({
    connectionString: Joi.string().when('accountName', {
      is: Joi.exist(),
      then: Joi.string().allow(''),
      otherwise: Joi.string().required().messages({
        'any.required': '연결 문자열 또는 계정 정보는 필수입니다.'
      })
    }),
    accountName: Joi.string().allow(''),
    accountKey: Joi.string().allow(''),
    containerName: Joi.string().required().messages({
      'any.required': '컨테이너명은 필수입니다.'
    })
  }),

  // API 시스템
  api_rest: Joi.object({
    baseUrl: Joi.string().uri().required().messages({
      'any.required': '기본 URL은 필수입니다.',
      'string.uri': '유효한 URL을 입력해주세요.'
    }),
    authentication: Joi.object({
      type: Joi.string().valid('none', 'basic', 'bearer', 'apikey').default('none'),
      username: Joi.string().when('type', {
        is: 'basic',
        then: Joi.string().required().messages({
          'any.required': '사용자명은 필수입니다.'
        }),
        otherwise: Joi.string().allow('')
      }),
      password: Joi.string().when('type', {
        is: 'basic',
        then: Joi.string().required().messages({
          'any.required': '비밀번호는 필수입니다.'
        }),
        otherwise: Joi.string().allow('')
      }),
      token: Joi.string().when('type', {
        is: 'bearer',
        then: Joi.string().required().messages({
          'any.required': '토큰은 필수입니다.'
        }),
        otherwise: Joi.string().allow('')
      }),
      apiKey: Joi.string().when('type', {
        is: 'apikey',
        then: Joi.string().required().messages({
          'any.required': 'API 키는 필수입니다.'
        }),
        otherwise: Joi.string().allow('')
      }),
      headerName: Joi.string().when('type', {
        is: 'apikey',
        then: Joi.string().required().messages({
          'any.required': '헤더명은 필수입니다.'
        }),
        otherwise: Joi.string().allow('')
      })
    }).default({}),
    timeout: Joi.number().integer().min(1000).max(120000).default(30000),
    retryCount: Joi.number().integer().min(0).max(5).default(3),
    headers: Joi.object().default({})
  }),

  // 스트리밍 시스템
  kafka: Joi.object({
    brokers: Joi.array().items(Joi.string()).min(1).required().messages({
      'any.required': '브로커 주소는 필수입니다.',
      'array.min': '최소 하나의 브로커 주소가 필요합니다.'
    }),
    clientId: Joi.string().default('nificdc-client'),
    ssl: Joi.boolean().default(false),
    sasl: Joi.object({
      mechanism: Joi.string().valid('plain', 'scram-sha-256', 'scram-sha-512').default('plain'),
      username: Joi.string().required().messages({
        'any.required': '사용자명은 필수입니다.'
      }),
      password: Joi.string().required().messages({
        'any.required': '비밀번호는 필수입니다.'
      })
    }).allow(null),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  })
};

// 시스템 생성/수정 기본 검증 스키마
const systemSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'any.required': '시스템 이름은 필수입니다.',
    'string.empty': '시스템 이름을 입력해주세요.',
    'string.min': '시스템 이름은 최소 1자 이상이어야 합니다.',
    'string.max': '시스템 이름은 최대 100자 이하여야 합니다.'
  }),
  type: Joi.string().valid(
    'oracle', 'postgresql', 'mysql', 'mssql', 'sqlite', 'mongodb', 'redis',
    'ftp', 'sftp', 'local_fs', 'aws_s3', 'azure_blob', 'hdfs',
    'api_rest', 'api_soap', 'kafka', 'elasticsearch', 'cassandra'
  ).required().messages({
    'any.required': '시스템 타입은 필수입니다.',
    'any.only': '지원되지 않는 시스템 타입입니다.'
  }),
  description: Joi.string().max(1000).allow('').messages({
    'string.max': '설명은 최대 1000자 이하여야 합니다.'
  }),
  connectionInfo: Joi.object().required().messages({
    'any.required': '연결 정보는 필수입니다.',
    'object.base': '연결 정보는 객체 형태여야 합니다.'
  }),
  isActive: Joi.boolean().default(true)
});

class SystemValidator {
  /**
   * 시스템 생성/수정 데이터를 검증합니다.
   * @param {Object} data - 검증할 데이터
   * @param {boolean} isUpdate - 수정 작업인지 여부
   * @returns {Promise<Object>} - 검증된 데이터
   */
  static async validateSystem(data, isUpdate = false) {
    // 기본 시스템 정보 검증
    const baseSchema = isUpdate ? systemSchema.fork(['name', 'type'], (schema) => schema.optional()) : systemSchema;
    const { error: baseError, value: baseValue } = baseSchema.validate(data, { abortEarly: false });
    
    if (baseError) {
      throw new Error(`기본 정보 검증 실패: ${baseError.details.map(d => d.message).join(', ')}`);
    }

    // 연결 정보 검증
    if (baseValue.connectionInfo && baseValue.type) {
      const connectionSchema = connectionSchemas[baseValue.type];
      if (!connectionSchema) {
        throw new Error(`지원되지 않는 시스템 타입입니다: ${baseValue.type}`);
      }

      const { error: connectionError, value: connectionValue } = connectionSchema.validate(baseValue.connectionInfo, { abortEarly: false });
      if (connectionError) {
        throw new Error(`연결 정보 검증 실패: ${connectionError.details.map(d => d.message).join(', ')}`);
      }

      baseValue.connectionInfo = connectionValue;
    }

    return baseValue;
  }

  /**
   * 시스템 타입별 필수 필드를 반환합니다.
   * @param {string} type - 시스템 타입
   * @returns {Array} - 필수 필드 목록
   */
  static getRequiredFields(type) {
    const schema = connectionSchemas[type];
    if (!schema) {
      return [];
    }

    const requiredFields = [];
    const schemaDescription = schema.describe();
    
    for (const [key, field] of Object.entries(schemaDescription.keys)) {
      if (field.flags && field.flags.presence === 'required') {
        requiredFields.push(key);
      }
    }

    return requiredFields;
  }

  /**
   * 시스템 타입별 기본값을 반환합니다.
   * @param {string} type - 시스템 타입
   * @returns {Object} - 기본값 객체
   */
  static getDefaultValues(type) {
    const schema = connectionSchemas[type];
    if (!schema) {
      return {};
    }

    const { value } = schema.validate({}, { allowUnknown: true });
    return value;
  }

  /**
   * 연결 정보에서 민감한 정보를 마스킹합니다.
   * @param {Object} connectionInfo - 연결 정보
   * @param {string} type - 시스템 타입
   * @returns {Object} - 마스킹된 연결 정보
   */
  static maskSensitiveInfo(connectionInfo, type) {
    const crypto = require('./crypto');
    const sensitiveFields = ['password', 'secretAccessKey', 'accountKey', 'token', 'apiKey', 'privateKey'];
    
    const masked = { ...connectionInfo };
    
    for (const field of sensitiveFields) {
      if (masked[field]) {
        masked[field] = crypto.maskSensitiveData(masked[field]);
      }
    }

    // 중첩된 객체 처리
    if (masked.authentication) {
      for (const field of sensitiveFields) {
        if (masked.authentication[field]) {
          masked.authentication[field] = crypto.maskSensitiveData(masked.authentication[field]);
        }
      }
    }

    return masked;
  }
}

module.exports = {
  SystemValidator,
  connectionSchemas,
  systemSchema
};