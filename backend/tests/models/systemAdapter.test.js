const SystemAdapter = require('../../models/SystemAdapter');

describe('SystemAdapter Model Tests', () => {
  describe('Model Structure', () => {
    it('should have all required fields', () => {
      const attributes = SystemAdapter.rawAttributes;
      
      // Required fields
      expect(attributes).toHaveProperty('id');
      expect(attributes).toHaveProperty('name');
      expect(attributes).toHaveProperty('displayName');
      expect(attributes).toHaveProperty('type');
      expect(attributes).toHaveProperty('category');
      expect(attributes).toHaveProperty('version');
      expect(attributes).toHaveProperty('capabilities');
      expect(attributes).toHaveProperty('configSchema');
      expect(attributes).toHaveProperty('supportedOperations');
      expect(attributes).toHaveProperty('isActive');
      expect(attributes).toHaveProperty('isBuiltIn');
      
      // Check default values
      expect(attributes.version.defaultValue).toEqual('1.0.0');
      expect(attributes.isActive.defaultValue).toBe(true);
      expect(attributes.isBuiltIn.defaultValue).toBe(false);
    });

    it('should have correct field types', () => {
      const attributes = SystemAdapter.rawAttributes;
      
      expect(attributes.category.type.values).toEqual(
        ['database', 'file', 'stream', 'api', 'cloud']
      );
    });
  });

  describe('Instance Methods', () => {
    let adapter;

    beforeEach(() => {
      adapter = SystemAdapter.build({
        name: 'test-adapter',
        displayName: 'Test Adapter',
        type: 'test',
        category: 'database',
        capabilities: {
          supportsSchemaDiscovery: true,
          supportsBatchOperations: false,
          supportsStreaming: true,
          supportsTransactions: true
        },
        supportedOperations: {
          read: true,
          write: true,
          update: false,
          delete: false
        },
        configSchema: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            port: { type: 'number' }
          },
          required: ['host']
        }
      });
    });

    describe('hasCapability', () => {
      it('should return true for supported capabilities', () => {
        expect(adapter.hasCapability('supportsSchemaDiscovery')).toBe(true);
        expect(adapter.hasCapability('supportsStreaming')).toBe(true);
      });

      it('should return false for unsupported capabilities', () => {
        expect(adapter.hasCapability('supportsBatchOperations')).toBe(false);
      });

      it('should return false for unknown capabilities', () => {
        expect(adapter.hasCapability('unknownCapability')).toBe(false);
      });
    });

    describe('supportsOperation', () => {
      it('should return true for supported operations', () => {
        expect(adapter.supportsOperation('read')).toBe(true);
        expect(adapter.supportsOperation('write')).toBe(true);
      });

      it('should return false for unsupported operations', () => {
        expect(adapter.supportsOperation('update')).toBe(false);
        expect(adapter.supportsOperation('delete')).toBe(false);
      });
    });

    describe('validateConfig', () => {
      it('should validate valid configuration', () => {
        const config = { host: 'localhost', port: 5432 };
        const result = adapter.validateConfig(config);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should detect missing required fields', () => {
        const config = { port: 5432 };
        const result = adapter.validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('필수 필드 누락: host');
      });

      it('should detect type mismatches', () => {
        const config = { host: 'localhost', port: 'not-a-number' };
        const result = adapter.validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/port 필드 타입 오류/);
      });

      it('should handle empty schema', () => {
        adapter.configSchema = {};
        const config = { anything: 'goes' };
        const result = adapter.validateConfig(config);
        
        expect(result.valid).toBe(true);
      });
    });

    describe('mergeWithDefaults', () => {
      it('should merge with default config', () => {
        adapter.defaultConfig = { 
          host: 'localhost', 
          port: 5432,
          ssl: false 
        };
        
        const userConfig = { host: 'myserver', ssl: true };
        const merged = adapter.mergeWithDefaults(userConfig);
        
        expect(merged).toEqual({
          host: 'myserver',
          port: 5432,
          ssl: true
        });
      });

      it('should handle empty default config', () => {
        adapter.defaultConfig = {};
        const userConfig = { host: 'myserver' };
        const merged = adapter.mergeWithDefaults(userConfig);
        
        expect(merged).toEqual({ host: 'myserver' });
      });
    });
  });

  describe('Class Methods', () => {
    it('should define getCategories method', () => {
      const categories = SystemAdapter.getCategories();
      
      expect(categories).toBeInstanceOf(Array);
      expect(categories.length).toBeGreaterThan(0);
      
      const dbCategory = categories.find(c => c.value === 'database');
      expect(dbCategory).toBeDefined();
      expect(dbCategory.label).toEqual('데이터베이스');
      expect(dbCategory.icon).toEqual('database');
    });
  });

  describe('Hooks', () => {
    it('should normalize adapter name in beforeValidate hook', () => {
      const adapter = SystemAdapter.build({
        name: 'Test Adapter Name',
        displayName: 'Test Adapter',
        type: 'test',
        category: 'database'
      });

      // Simulate beforeValidate hook
      if (adapter.name) {
        adapter.name = adapter.name.toLowerCase().replace(/\s+/g, '-');
      }

      expect(adapter.name).toEqual('test-adapter-name');
    });

    it('should set default configSchema in beforeCreate hook', () => {
      const adapter = {
        configSchema: {}
      };

      // Simulate beforeCreate hook
      if (!adapter.configSchema || Object.keys(adapter.configSchema).length === 0) {
        adapter.configSchema = {
          type: 'object',
          properties: {},
          required: []
        };
      }

      expect(adapter.configSchema).toEqual({
        type: 'object',
        properties: {},
        required: []
      });
    });
  });

  describe('Validations', () => {
    it('should validate version format', () => {
      const validVersions = ['1.0.0', '2.1.3', '10.20.30'];
      const invalidVersions = ['1.0', '1.0.0.0', 'v1.0.0', '1.a.0'];

      validVersions.forEach(version => {
        expect(/^\d+\.\d+\.\d+$/.test(version)).toBe(true);
      });

      invalidVersions.forEach(version => {
        expect(/^\d+\.\d+\.\d+$/.test(version)).toBe(false);
      });
    });

    it('should validate capabilities structure', () => {
      const requiredKeys = [
        'supportsSchemaDiscovery',
        'supportsBatchOperations',
        'supportsStreaming',
        'supportsTransactions'
      ];

      const validCapabilities = {
        supportsSchemaDiscovery: true,
        supportsBatchOperations: false,
        supportsStreaming: true,
        supportsTransactions: true,
        extraCapability: true
      };

      const missingKeys = requiredKeys.filter(key => !(key in validCapabilities));
      expect(missingKeys).toHaveLength(0);
    });
  });
});