const {
  ValidationFramework,
  ValidationResult,
  SchemaValidator,
  TypeValidator,
  BusinessRuleValidator,
  CustomValidator,
  CompositeValidator,
  FieldMappingValidator,
  DataQualityValidator,
  createValidationFramework,
  createValidationConfig,
  validateMapping,
  validateData,
  ValidationHelpers,
  ValidationError
} = require('../../../services/mappingEngine/validation');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Validation Framework Tests', () => {
  describe('ValidationResult', () => {
    it('should create valid result by default', () => {
      const result = new ValidationResult();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it('should add errors and update validity', () => {
      const result = new ValidationResult();
      result.addError('field1', 'Error message', { code: 'E001' });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        field: 'field1',
        message: 'Error message',
        details: { code: 'E001' },
        severity: 'error'
      });
    });

    it('should add warnings without affecting validity', () => {
      const result = new ValidationResult();
      result.addWarning('field1', 'Warning message');
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });

    it('should merge validation results', () => {
      const result1 = new ValidationResult();
      result1.addError('field1', 'Error 1');
      result1.addWarning('field2', 'Warning 1');
      
      const result2 = new ValidationResult();
      result2.addError('field3', 'Error 2');
      result2.addSuggestion('field4', 'Suggestion 1');
      
      result1.merge(result2);
      
      expect(result1.valid).toBe(false);
      expect(result1.errors).toHaveLength(2);
      expect(result1.warnings).toHaveLength(1);
      expect(result1.suggestions).toHaveLength(1);
    });

    it('should provide summary', () => {
      const result = new ValidationResult();
      result.addError('field1', 'Error');
      result.addWarning('field2', 'Warning');
      
      const summary = result.getSummary();
      expect(summary.valid).toBe(false);
      expect(summary.errorCount).toBe(1);
      expect(summary.warningCount).toBe(1);
      expect(summary.suggestionCount).toBe(0);
    });
  });

  describe('SchemaValidator', () => {
    let validator;

    beforeEach(() => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string', minLength: 2 },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          email: { type: 'string', format: 'email' },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            uniqueItems: true
          }
        }
      };
      validator = new SchemaValidator(schema);
    });

    it('should validate valid data', async () => {
      const data = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['user', 'admin']
      };
      
      const result = await validator.validate(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const data = {
        name: 'John Doe'
        // Missing age
      };
      
      const result = await validator.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === '.age')).toBe(true);
    });

    it('should validate string constraints', async () => {
      const data = {
        name: 'J', // Too short
        age: 30
      };
      
      const result = await validator.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('minimum'))).toBe(true);
    });

    it('should validate number constraints', async () => {
      const data = {
        name: 'John',
        age: 200 // Exceeds maximum
      };
      
      const result = await validator.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('exceeds maximum'))).toBe(true);
    });

    it('should validate email format', async () => {
      const data = {
        name: 'John',
        age: 30,
        email: 'invalid-email'
      };
      
      const result = await validator.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('format'))).toBe(true);
    });

    it('should validate array uniqueness', async () => {
      const data = {
        name: 'John',
        age: 30,
        tags: ['user', 'admin', 'user'] // Duplicate
      };
      
      const result = await validator.validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('unique'))).toBe(true);
    });

    it('should coerce types when enabled', async () => {
      const coercingValidator = new SchemaValidator(validator.schema, { coerceTypes: true });
      const data = {
        name: 'John',
        age: '30' // String instead of number
      };
      
      const result = await coercingValidator.validate(data);
      expect(result.valid).toBe(true);
    });
  });

  describe('TypeValidator', () => {
    it('should validate single type', async () => {
      const validator = new TypeValidator('string');
      
      const validResult = await validator.validate('hello');
      expect(validResult.valid).toBe(true);
      
      const invalidResult = await validator.validate(123);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate multiple types', async () => {
      const validator = new TypeValidator(['string', 'number']);
      
      const stringResult = await validator.validate('hello');
      expect(stringResult.valid).toBe(true);
      
      const numberResult = await validator.validate(123);
      expect(numberResult.valid).toBe(true);
      
      const booleanResult = await validator.validate(true);
      expect(booleanResult.valid).toBe(false);
    });

    it('should handle null and undefined options', async () => {
      const validator = new TypeValidator('string', { 
        allowNull: true, 
        allowUndefined: true 
      });
      
      const nullResult = await validator.validate(null);
      expect(nullResult.valid).toBe(true);
      
      const undefinedResult = await validator.validate(undefined);
      expect(undefinedResult.valid).toBe(true);
    });

    it('should detect array type correctly', async () => {
      const validator = new TypeValidator('array');
      
      const arrayResult = await validator.validate([1, 2, 3]);
      expect(arrayResult.valid).toBe(true);
      
      const objectResult = await validator.validate({ a: 1 });
      expect(objectResult.valid).toBe(false);
    });
  });

  describe('BusinessRuleValidator', () => {
    it('should validate simple rules', async () => {
      const rules = [
        {
          name: 'ageLimit',
          field: 'age',
          validate: (data) => data.age >= 18,
          message: 'Must be 18 or older',
          severity: 'error'
        }
      ];
      
      const validator = new BusinessRuleValidator(rules);
      
      const validResult = await validator.validate({ age: 25 });
      expect(validResult.valid).toBe(true);
      
      const invalidResult = await validator.validate({ age: 16 });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0].message).toBe('Must be 18 or older');
    });

    it('should handle conditional rules', async () => {
      const rules = [
        {
          name: 'conditionalRequired',
          field: 'phoneNumber',
          condition: { contactByPhone: true },
          validate: (data) => !!data.phoneNumber,
          message: 'Phone number required when contact by phone is selected'
        }
      ];
      
      const validator = new BusinessRuleValidator(rules);
      
      // Condition not met - should pass
      const result1 = await validator.validate({ contactByPhone: false });
      expect(result1.valid).toBe(true);
      
      // Condition met but validation fails
      const result2 = await validator.validate({ contactByPhone: true });
      expect(result2.valid).toBe(false);
      
      // Condition met and validation passes
      const result3 = await validator.validate({ 
        contactByPhone: true, 
        phoneNumber: '123-456-7890' 
      });
      expect(result3.valid).toBe(true);
    });

    it('should evaluate complex conditions', async () => {
      const rules = [
        {
          name: 'complexCondition',
          condition: {
            $and: [
              { age: { $gte: 18 } },
              { country: { $in: ['US', 'CA'] } }
            ]
          },
          validate: (data) => !!data.ssn,
          message: 'SSN required for adults in US/CA'
        }
      ];
      
      const validator = new BusinessRuleValidator(rules);
      
      // Condition not met
      const result1 = await validator.validate({ age: 16, country: 'US' });
      expect(result1.valid).toBe(true);
      
      // Condition met
      const result2 = await validator.validate({ age: 25, country: 'US' });
      expect(result2.valid).toBe(false);
    });

    it('should handle async validation', async () => {
      const rules = [
        {
          name: 'asyncRule',
          validate: async (data) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return data.value > 10;
          },
          message: 'Value must be greater than 10'
        }
      ];
      
      const validator = new BusinessRuleValidator(rules);
      const result = await validator.validate({ value: 5 });
      
      expect(result.valid).toBe(false);
    });
  });

  describe('CustomValidator', () => {
    it('should handle boolean return', async () => {
      const validator = new CustomValidator(
        (data) => data.isValid === true,
        { message: 'Data is not valid' }
      );
      
      const validResult = await validator.validate({ isValid: true });
      expect(validResult.valid).toBe(true);
      
      const invalidResult = await validator.validate({ isValid: false });
      expect(invalidResult.valid).toBe(false);
    });

    it('should handle ValidationResult return', async () => {
      const validator = new CustomValidator((data) => {
        const result = new ValidationResult();
        if (!data.name) {
          result.addError('name', 'Name is required');
        }
        if (data.age && data.age < 0) {
          result.addWarning('age', 'Age should not be negative');
        }
        return result;
      });
      
      const result = await validator.validate({ age: -5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
    });

    it('should handle errors gracefully', async () => {
      const validator = new CustomValidator(() => {
        throw new Error('Validation logic error');
      });
      
      const result = await validator.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Validation logic error');
    });
  });

  describe('CompositeValidator', () => {
    it('should validate all validators in "all" mode', async () => {
      const validators = [
        new TypeValidator('object'),
        new CustomValidator((data) => data.value > 0)
      ];
      
      const composite = new CompositeValidator(validators, { mode: 'all' });
      
      const validResult = await composite.validate({ value: 10 });
      expect(validResult.valid).toBe(true);
      
      const invalidResult = await composite.validate({ value: -5 });
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate any validator in "any" mode', async () => {
      const validators = [
        new TypeValidator('string'),
        new TypeValidator('number')
      ];
      
      const composite = new CompositeValidator(validators, { mode: 'any' });
      
      const stringResult = await composite.validate('hello');
      expect(stringResult.valid).toBe(true);
      
      const numberResult = await composite.validate(123);
      expect(numberResult.valid).toBe(true);
      
      const booleanResult = await composite.validate(true);
      expect(booleanResult.valid).toBe(false);
    });

    it('should validate sequentially with stopOnError', async () => {
      let secondValidatorCalled = false;
      
      const validators = [
        new CustomValidator(() => false),
        new CustomValidator(() => {
          secondValidatorCalled = true;
          return true;
        })
      ];
      
      const composite = new CompositeValidator(validators, { 
        mode: 'sequential',
        stopOnError: true 
      });
      
      await composite.validate({});
      expect(secondValidatorCalled).toBe(false);
    });
  });

  describe('FieldMappingValidator', () => {
    let validator;

    beforeEach(() => {
      const sourceSchema = {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string' }
        }
      };
      
      const targetSchema = {
        type: 'object',
        required: ['fullName', 'emailAddress'],
        properties: {
          fullName: { type: 'string' },
          emailAddress: { type: 'string' }
        }
      };
      
      validator = new FieldMappingValidator({
        sourceSchema,
        targetSchema,
        strictMode: true
      });
    });

    it('should validate valid mapping rules', async () => {
      const mappingRules = [
        {
          type: 'concat',
          sourceFields: ['firstName', 'lastName'],
          targetField: 'fullName',
          separator: ' '
        },
        {
          type: 'direct',
          sourceField: 'email',
          targetField: 'emailAddress'
        }
      ];
      
      const result = await validator.validate(mappingRules);
      expect(result.valid).toBe(true);
    });

    it('should detect missing required target fields', async () => {
      const mappingRules = [
        {
          type: 'concat',
          sourceFields: ['firstName', 'lastName'],
          targetField: 'fullName',
          separator: ' '
        }
        // Missing emailAddress mapping
      ];
      
      const result = await validator.validate(mappingRules);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('emailAddress'))).toBe(true);
    });

    it('should detect invalid source fields', async () => {
      const mappingRules = [
        {
          type: 'direct',
          sourceField: 'nonExistentField',
          targetField: 'fullName'
        }
      ];
      
      const result = await validator.validate(mappingRules);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true);
    });

    it('should validate different mapping types', async () => {
      const mappingRules = [
        {
          type: 'unknown_type',
          targetField: 'fullName'
        }
      ];
      
      const result = await validator.validate(mappingRules);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unknown mapping type'))).toBe(true);
    });
  });

  describe('DataQualityValidator', () => {
    it('should calculate quality metrics', async () => {
      const qualityRules = [
        {
          name: 'completeness',
          type: 'completeness',
          dimension: 'completeness',
          field: 'name',
          weight: 0.5
        },
        {
          name: 'emailFormat',
          type: 'format',
          dimension: 'accuracy',
          field: 'email',
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
          weight: 0.3
        }
      ];
      
      const validator = new DataQualityValidator(qualityRules, { threshold: 0.7 });
      
      const goodData = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      const result = await validator.validate(goodData);
      expect(result.valid).toBe(true);
      expect(result.metadata.qualityScore).toBeGreaterThan(0.7);
    });

    it('should fail when quality is below threshold', async () => {
      const qualityRules = [
        {
          name: 'completeness',
          type: 'completeness',
          dimension: 'completeness',
          field: 'name',
          weight: 1.0
        }
      ];
      
      const validator = new DataQualityValidator(qualityRules, { threshold: 0.8 });
      
      const poorData = {
        name: '' // Empty name
      };
      
      const result = await validator.validate(poorData);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('below threshold');
    });

    it('should validate data arrays', async () => {
      const qualityRules = [
        {
          name: 'completeness',
          type: 'completeness',
          dimension: 'completeness',
          field: 'id',
          weight: 1.0
        }
      ];
      
      const validator = new DataQualityValidator(qualityRules, { threshold: 0.5 });
      
      const dataArray = [
        { id: 1, name: 'Item 1' },
        { id: null, name: 'Item 2' }, // Missing ID
        { id: 3, name: 'Item 3' }
      ];
      
      const result = await validator.validate(dataArray);
      expect(result.metadata.qualityScore).toBeCloseTo(0.67, 1);
    });
  });

  describe('ValidationFramework', () => {
    let framework;

    beforeEach(() => {
      framework = new ValidationFramework();
    });

    it('should register and use validators', async () => {
      const customValidator = new CustomValidator((data) => data.isValid);
      framework.registerValidator('custom', customValidator);
      
      const result = await framework.validate({ isValid: true }, {
        validators: ['custom']
      });
      
      expect(result.valid).toBe(true);
    });

    it('should register and use schemas', async () => {
      const userSchema = {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string' }
        }
      };
      
      framework.registerSchema('user', userSchema);
      
      const result = await framework.validate({ username: 'john' }, {
        schema: 'user'
      });
      
      expect(result.valid).toBe(true);
    });

    it('should cache validation results', async () => {
      const data = { value: 10 };
      const options = { 
        type: 'object',
        useCache: true 
      };
      
      // First call - cache miss
      await framework.validate(data, options);
      expect(framework.metrics.cacheMisses).toBe(1);
      
      // Second call - cache hit
      await framework.validate(data, options);
      expect(framework.metrics.cacheHits).toBe(1);
    });

    it('should validate batch data', async () => {
      const dataArray = [
        { value: 10 },
        { value: 'invalid' },
        { value: 20 }
      ];
      
      const results = await framework.validateBatch(dataArray, {
        type: 'object',
        custom: (data) => typeof data.value === 'number'
      });
      
      expect(results).toHaveLength(3);
      expect(results[0].result.valid).toBe(true);
      expect(results[1].result.valid).toBe(false);
      expect(results[2].result.valid).toBe(true);
    });

    it('should emit validation events', async () => {
      const events = [];
      
      framework.on('validationComplete', (event) => events.push(event));
      framework.on('validationError', (event) => events.push(event));
      
      await framework.validate({ value: 10 }, { type: 'object' });
      
      expect(events).toHaveLength(1);
      expect(events[0].valid).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    it('should create framework with defaults', () => {
      const framework = createValidationFramework({ registerDefaults: true });
      
      expect(framework.schemas.has('type:email')).toBe(true);
      expect(framework.schemas.has('entity:user')).toBe(true);
      expect(framework.validators.has('fieldMapping')).toBe(true);
    });

    it('should create validation config from preset', () => {
      const config = createValidationConfig('strict', {
        schema: { type: 'object' }
      });
      
      expect(config.strictMode).toBe(true);
      expect(config.coerceTypes).toBe(false);
      expect(config.schema).toBeDefined();
    });

    it('should validate mapping', async () => {
      const mapping = {
        id: 'test-mapping',
        rules: [
          {
            type: 'direct',
            sourceField: 'name',
            targetField: 'fullName'
          }
        ],
        sourceSchema: {
          properties: { name: { type: 'string' } }
        },
        targetSchema: {
          properties: { fullName: { type: 'string' } }
        }
      };
      
      const result = await validateMapping(mapping);
      expect(result.valid).toBe(true);
    });

    it('should validate data against mapping', async () => {
      const data = { fullName: 'John Doe' };
      const mapping = {
        targetSchema: {
          type: 'object',
          required: ['fullName'],
          properties: {
            fullName: { type: 'string' }
          }
        }
      };
      
      const result = await validateData(data, mapping);
      expect(result.valid).toBe(true);
    });
  });

  describe('ValidationHelpers', () => {
    it('should check empty values', () => {
      expect(ValidationHelpers.isEmpty(null)).toBe(true);
      expect(ValidationHelpers.isEmpty(undefined)).toBe(true);
      expect(ValidationHelpers.isEmpty('')).toBe(true);
      expect(ValidationHelpers.isEmpty([])).toBe(true);
      expect(ValidationHelpers.isEmpty({})).toBe(true);
      expect(ValidationHelpers.isEmpty(0)).toBe(false);
      expect(ValidationHelpers.isEmpty(false)).toBe(false);
    });

    it('should match patterns', () => {
      expect(ValidationHelpers.matchesPattern('test@example.com', /^[^@]+@[^@]+$/)).toBe(true);
      expect(ValidationHelpers.matchesPattern('invalid', /^[^@]+@[^@]+$/)).toBe(false);
    });

    it('should check ranges', () => {
      expect(ValidationHelpers.isInRange(5, 0, 10)).toBe(true);
      expect(ValidationHelpers.isInRange(15, 0, 10)).toBe(false);
      expect(ValidationHelpers.isInRange('5', 0, 10)).toBe(true);
    });

    it('should validate dates', () => {
      expect(ValidationHelpers.isValidDate('2023-01-01')).toBe(true);
      expect(ValidationHelpers.isValidDate('invalid date')).toBe(false);
    });

    it('should sanitize strings', () => {
      expect(ValidationHelpers.sanitizeString('  test  ')).toBe('test');
      expect(ValidationHelpers.sanitizeString('TEST', { lowercase: true })).toBe('test');
      expect(ValidationHelpers.sanitizeString('test', { uppercase: true })).toBe('TEST');
      expect(ValidationHelpers.sanitizeString('a b c', { removeSpaces: true })).toBe('abc');
      expect(ValidationHelpers.sanitizeString('abc123!@#', { alphanumeric: true })).toBe('abc123');
    });
  });

  describe('ValidationError', () => {
    it('should create error with result', () => {
      const result = new ValidationResult();
      result.addError('field', 'Error message');
      result.addWarning('field2', 'Warning message');
      
      const error = new ValidationError('Validation failed', result);
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toHaveLength(1);
      expect(error.warnings).toHaveLength(1);
    });
  });
});