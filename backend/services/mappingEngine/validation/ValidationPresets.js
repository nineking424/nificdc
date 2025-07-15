/**
 * Validation Presets
 * Pre-configured validation schemas and rules for common use cases
 */

const { SchemaValidator, BusinessRuleValidator } = require('./ValidationFramework');

/**
 * Common data type schemas
 */
const DataTypeSchemas = {
  // Basic types
  string: {
    type: 'string',
    minLength: 0,
    maxLength: 255
  },
  
  number: {
    type: 'number'
  },
  
  integer: {
    type: 'integer'
  },
  
  boolean: {
    type: 'boolean'
  },
  
  date: {
    type: 'string',
    format: 'date'
  },
  
  dateTime: {
    type: 'string',
    format: 'date-time'
  },
  
  // Common field types
  email: {
    type: 'string',
    format: 'email',
    maxLength: 255
  },
  
  phone: {
    type: 'string',
    pattern: '^\\+?[1-9]\\d{1,14}$',
    maxLength: 20
  },
  
  url: {
    type: 'string',
    format: 'uri',
    maxLength: 2048
  },
  
  uuid: {
    type: 'string',
    format: 'uuid'
  },
  
  ipAddress: {
    type: 'string',
    oneOf: [
      { format: 'ipv4' },
      { format: 'ipv6' }
    ]
  },
  
  // Numeric types
  percentage: {
    type: 'number',
    minimum: 0,
    maximum: 100
  },
  
  currency: {
    type: 'number',
    multipleOf: 0.01,
    minimum: 0
  },
  
  latitude: {
    type: 'number',
    minimum: -90,
    maximum: 90
  },
  
  longitude: {
    type: 'number',
    minimum: -180,
    maximum: 180
  },
  
  // Text types
  shortText: {
    type: 'string',
    maxLength: 100
  },
  
  longText: {
    type: 'string',
    maxLength: 5000
  },
  
  code: {
    type: 'string',
    pattern: '^[A-Z0-9_]+$',
    maxLength: 50
  },
  
  slug: {
    type: 'string',
    pattern: '^[a-z0-9-]+$',
    maxLength: 100
  }
};

/**
 * Common entity schemas
 */
const EntitySchemas = {
  // User schema
  user: {
    type: 'object',
    required: ['id', 'email', 'username'],
    properties: {
      id: DataTypeSchemas.uuid,
      email: DataTypeSchemas.email,
      username: {
        type: 'string',
        pattern: '^[a-zA-Z0-9_]{3,30}$'
      },
      firstName: DataTypeSchemas.shortText,
      lastName: DataTypeSchemas.shortText,
      phone: DataTypeSchemas.phone,
      birthDate: DataTypeSchemas.date,
      active: DataTypeSchemas.boolean,
      createdAt: DataTypeSchemas.dateTime,
      updatedAt: DataTypeSchemas.dateTime
    }
  },
  
  // Product schema
  product: {
    type: 'object',
    required: ['id', 'name', 'price'],
    properties: {
      id: DataTypeSchemas.uuid,
      sku: DataTypeSchemas.code,
      name: DataTypeSchemas.shortText,
      description: DataTypeSchemas.longText,
      price: DataTypeSchemas.currency,
      category: DataTypeSchemas.shortText,
      tags: {
        type: 'array',
        items: DataTypeSchemas.shortText,
        maxItems: 10
      },
      inStock: DataTypeSchemas.boolean,
      quantity: {
        type: 'integer',
        minimum: 0
      }
    }
  },
  
  // Order schema
  order: {
    type: 'object',
    required: ['id', 'customerId', 'items', 'total'],
    properties: {
      id: DataTypeSchemas.uuid,
      orderNumber: DataTypeSchemas.code,
      customerId: DataTypeSchemas.uuid,
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productId', 'quantity', 'price'],
          properties: {
            productId: DataTypeSchemas.uuid,
            quantity: {
              type: 'integer',
              minimum: 1
            },
            price: DataTypeSchemas.currency
          }
        }
      },
      subtotal: DataTypeSchemas.currency,
      tax: DataTypeSchemas.currency,
      shipping: DataTypeSchemas.currency,
      total: DataTypeSchemas.currency,
      status: {
        type: 'string',
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
      },
      createdAt: DataTypeSchemas.dateTime
    }
  },
  
  // Address schema
  address: {
    type: 'object',
    required: ['street', 'city', 'country', 'postalCode'],
    properties: {
      street: DataTypeSchemas.shortText,
      street2: DataTypeSchemas.shortText,
      city: DataTypeSchemas.shortText,
      state: DataTypeSchemas.shortText,
      country: {
        type: 'string',
        pattern: '^[A-Z]{2}$'
      },
      postalCode: {
        type: 'string',
        maxLength: 20
      },
      latitude: DataTypeSchemas.latitude,
      longitude: DataTypeSchemas.longitude
    }
  }
};

/**
 * Common validation rules
 */
const ValidationRules = {
  // Data quality rules
  dataQuality: {
    highQuality: [
      {
        name: 'completeness',
        type: 'completeness',
        dimension: 'completeness',
        weight: 0.3,
        severity: 'error'
      },
      {
        name: 'emailFormat',
        type: 'format',
        dimension: 'accuracy',
        field: 'email',
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        weight: 0.2,
        severity: 'error'
      },
      {
        name: 'phoneFormat',
        type: 'format',
        dimension: 'accuracy',
        field: 'phone',
        pattern: '^\\+?[1-9]\\d{1,14}$',
        weight: 0.1,
        severity: 'warning'
      },
      {
        name: 'dateRecency',
        type: 'timeliness',
        dimension: 'timeliness',
        field: 'updatedAt',
        maxAgeInDays: 30,
        weight: 0.1,
        severity: 'warning'
      }
    ],
    
    mediumQuality: [
      {
        name: 'completeness',
        type: 'completeness',
        dimension: 'completeness',
        weight: 0.5,
        severity: 'error'
      },
      {
        name: 'basicFormat',
        type: 'custom',
        dimension: 'accuracy',
        weight: 0.3,
        validate: (record) => {
          // Basic format validation
          return { passed: true };
        }
      }
    ]
  },
  
  // Business rules
  businessRules: {
    userValidation: [
      {
        name: 'ageRestriction',
        field: 'birthDate',
        condition: { birthDate: { $exists: true } },
        validate: (data) => {
          const birthDate = new Date(data.birthDate);
          const age = (new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000);
          return age >= 18;
        },
        message: 'User must be at least 18 years old',
        severity: 'error'
      },
      {
        name: 'uniqueEmail',
        field: 'email',
        validate: async (data, context) => {
          // Would check against database
          return true;
        },
        message: 'Email address already exists',
        severity: 'error'
      }
    ],
    
    orderValidation: [
      {
        name: 'minimumOrderAmount',
        field: 'total',
        validate: (data) => data.total >= 10,
        message: 'Minimum order amount is $10',
        severity: 'error'
      },
      {
        name: 'validOrderItems',
        field: 'items',
        validate: (data) => {
          return data.items && data.items.length > 0 &&
            data.items.every(item => item.quantity > 0 && item.price >= 0);
        },
        message: 'Order must contain valid items',
        severity: 'error'
      },
      {
        name: 'totalCalculation',
        validate: (data) => {
          const calculatedTotal = (data.subtotal || 0) + (data.tax || 0) + (data.shipping || 0);
          return Math.abs(calculatedTotal - data.total) < 0.01;
        },
        message: 'Order total does not match calculated amount',
        severity: 'error'
      }
    ]
  },
  
  // Security rules
  securityRules: {
    inputSanitization: [
      {
        name: 'noSqlInjection',
        validate: (data) => {
          const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
            /(--|\/\*|\*\/|xp_|sp_)/i
          ];
          
          const checkValue = (value) => {
            if (typeof value === 'string') {
              return !sqlPatterns.some(pattern => pattern.test(value));
            }
            return true;
          };
          
          const checkObject = (obj) => {
            for (const value of Object.values(obj)) {
              if (typeof value === 'object' && value !== null) {
                if (!checkObject(value)) return false;
              } else if (!checkValue(value)) {
                return false;
              }
            }
            return true;
          };
          
          return checkObject(data);
        },
        message: 'Input contains potentially malicious SQL patterns',
        severity: 'error'
      },
      {
        name: 'noScriptTags',
        validate: (data) => {
          const scriptPattern = /<script[^>]*>[\s\S]*?<\/script>/gi;
          
          const checkValue = (value) => {
            if (typeof value === 'string') {
              return !scriptPattern.test(value);
            }
            return true;
          };
          
          const checkObject = (obj) => {
            for (const value of Object.values(obj)) {
              if (typeof value === 'object' && value !== null) {
                if (!checkObject(value)) return false;
              } else if (!checkValue(value)) {
                return false;
              }
            }
            return true;
          };
          
          return checkObject(data);
        },
        message: 'Input contains script tags',
        severity: 'error'
      }
    ]
  }
};

/**
 * Validation presets for different scenarios
 */
const ValidationPresets = {
  // Strict validation - all checks enabled
  strict: {
    schema: true,
    type: true,
    rules: true,
    stopOnError: true,
    strictMode: true,
    coerceTypes: false,
    validateOutput: true
  },
  
  // Lenient validation - allow type coercion
  lenient: {
    schema: true,
    type: true,
    rules: true,
    stopOnError: false,
    strictMode: false,
    coerceTypes: true,
    validateOutput: true
  },
  
  // Fast validation - skip expensive checks
  fast: {
    schema: true,
    type: false,
    rules: false,
    stopOnError: true,
    strictMode: false,
    coerceTypes: false,
    validateOutput: false
  },
  
  // Development validation - all checks with warnings
  development: {
    schema: true,
    type: true,
    rules: true,
    stopOnError: false,
    strictMode: true,
    coerceTypes: false,
    validateOutput: true,
    includeWarnings: true,
    includeSuggestions: true
  },
  
  // Production validation - essential checks only
  production: {
    schema: true,
    type: true,
    rules: true,
    stopOnError: true,
    strictMode: true,
    coerceTypes: false,
    validateOutput: false,
    includeWarnings: false,
    includeSuggestions: false
  }
};

/**
 * Create validation configuration from preset
 */
function createValidationConfig(preset, customOptions = {}) {
  const baseConfig = ValidationPresets[preset] || ValidationPresets.strict;
  
  return {
    ...baseConfig,
    ...customOptions,
    schemaOptions: {
      strictMode: baseConfig.strictMode,
      coerceTypes: baseConfig.coerceTypes,
      ...customOptions.schemaOptions
    },
    ruleOptions: {
      stopOnError: baseConfig.stopOnError,
      ...customOptions.ruleOptions
    }
  };
}

/**
 * Create schema validator from entity type
 */
function createEntityValidator(entityType, options = {}) {
  const schema = EntitySchemas[entityType];
  
  if (!schema) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  
  return new SchemaValidator(schema, options);
}

/**
 * Create data quality validator
 */
function createDataQualityValidator(level = 'highQuality', options = {}) {
  const rules = ValidationRules.dataQuality[level];
  
  if (!rules) {
    throw new Error(`Unknown quality level: ${level}`);
  }
  
  return new BusinessRuleValidator(rules, options);
}

/**
 * Common validation patterns
 */
const ValidationPatterns = {
  // Korean patterns
  korean: {
    name: /^[가-힣\s]{2,20}$/,
    phone: /^(01[016789]{1}|02|0[3-9]{1}[0-9]{1})-?[0-9]{3,4}-?[0-9]{4}$/,
    businessNumber: /^\d{3}-\d{2}-\d{5}$/,
    residentNumber: /^\d{6}-[1-4]\d{6}$/
  },
  
  // Credit card patterns
  creditCard: {
    visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
    mastercard: /^5[1-5][0-9]{14}$/,
    amex: /^3[47][0-9]{13}$/,
    discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/
  },
  
  // File patterns
  file: {
    image: /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i,
    document: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
    video: /\.(mp4|avi|mov|wmv|flv|webm)$/i,
    audio: /\.(mp3|wav|ogg|m4a|flac)$/i
  }
};

module.exports = {
  DataTypeSchemas,
  EntitySchemas,
  ValidationRules,
  ValidationPresets,
  ValidationPatterns,
  createValidationConfig,
  createEntityValidator,
  createDataQualityValidator
};