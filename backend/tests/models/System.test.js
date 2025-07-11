const { System } = require('../../src/models');
const { sequelize } = require('../../src/database/connection');

describe('System Model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await System.destroy({ where: {}, force: true });
  });

  describe('System Creation', () => {
    it('should create a system with valid data', async () => {
      const systemData = {
        name: 'Test Oracle DB',
        type: 'oracle',
        connectionInfo: {
          host: 'localhost',
          port: 1521,
          serviceName: 'TESTDB'
        },
        description: 'Test Oracle database'
      };

      const system = await System.create(systemData);

      expect(system.id).toBeDefined();
      expect(system.name).toBe('Test Oracle DB');
      expect(system.type).toBe('oracle');
      expect(system.isActive).toBe(true);
      expect(system.description).toBe('Test Oracle database');
      expect(system.connectionInfo).toBeDefined();
    });

    it('should create system with different types', async () => {
      const types = ['oracle', 'postgresql', 'sqlite', 'mysql', 'mssql', 'ftp', 'sftp', 'local_fs', 'aws_s3', 'azure_blob'];

      for (const type of types) {
        const system = await System.create({
          name: `Test ${type} System`,
          type: type,
          connectionInfo: { test: 'config' }
        });

        expect(system.type).toBe(type);
      }
    });

    it('should default isActive to true', async () => {
      const system = await System.create({
        name: 'Test System',
        type: 'postgresql',
        connectionInfo: { host: 'localhost' }
      });

      expect(system.isActive).toBe(true);
    });
  });

  describe('System Validation', () => {
    it('should require name', async () => {
      const systemData = {
        type: 'oracle',
        connectionInfo: { host: 'localhost' }
      };

      await expect(System.create(systemData)).rejects.toThrow();
    });

    it('should require type', async () => {
      const systemData = {
        name: 'Test System',
        connectionInfo: { host: 'localhost' }
      };

      await expect(System.create(systemData)).rejects.toThrow();
    });

    it('should require connectionInfo', async () => {
      const systemData = {
        name: 'Test System',
        type: 'oracle'
      };

      await expect(System.create(systemData)).rejects.toThrow();
    });

    it('should require unique name', async () => {
      const systemData1 = {
        name: 'Test System',
        type: 'oracle',
        connectionInfo: { host: 'localhost' }
      };

      const systemData2 = {
        name: 'Test System',
        type: 'postgresql',
        connectionInfo: { host: 'localhost' }
      };

      await System.create(systemData1);
      await expect(System.create(systemData2)).rejects.toThrow();
    });

    it('should validate system type', async () => {
      const systemData = {
        name: 'Test System',
        type: 'invalid_type',
        connectionInfo: { host: 'localhost' }
      };

      await expect(System.create(systemData)).rejects.toThrow();
    });

    it('should validate name length', async () => {
      const systemData = {
        name: '',
        type: 'oracle',
        connectionInfo: { host: 'localhost' }
      };

      await expect(System.create(systemData)).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await System.bulkCreate([
        {
          name: 'Active Oracle',
          type: 'oracle',
          connectionInfo: { host: 'oracle.example.com' },
          isActive: true
        },
        {
          name: 'Active PostgreSQL',
          type: 'postgresql',
          connectionInfo: { host: 'postgres.example.com' },
          isActive: true
        },
        {
          name: 'Inactive MySQL',
          type: 'mysql',
          connectionInfo: { host: 'mysql.example.com' },
          isActive: false
        }
      ]);
    });

    it('should find active systems only', async () => {
      const systems = await System.findActive();

      expect(systems.length).toBe(2);
      systems.forEach(system => {
        expect(system.isActive).toBe(true);
      });
    });

    it('should find systems by type', async () => {
      const oracleSystems = await System.findByType('oracle');
      const postgresqlSystems = await System.findByType('postgresql');
      const mysqlSystems = await System.findByType('mysql');

      expect(oracleSystems.length).toBe(1);
      expect(oracleSystems[0].type).toBe('oracle');
      expect(oracleSystems[0].isActive).toBe(true);

      expect(postgresqlSystems.length).toBe(1);
      expect(postgresqlSystems[0].type).toBe('postgresql');

      expect(mysqlSystems.length).toBe(0); // Inactive system should not be returned
    });

    it('should test connection', async () => {
      const system = await System.create({
        name: 'Test Connection System',
        type: 'postgresql',
        connectionInfo: { host: 'localhost', port: 5432 }
      });

      const result = await System.testConnection(system.id);

      expect(result.success).toBe(true);
      expect(result.systemId).toBe(system.id);
      expect(result.systemName).toBe(system.name);
      expect(result.testedAt).toBeInstanceOf(Date);
    });

    it('should throw error when testing non-existent system', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(System.testConnection(fakeId)).rejects.toThrow('System not found');
    });
  });

  describe('Instance Methods', () => {
    let system;

    beforeEach(async () => {
      system = await System.create({
        name: 'Test System',
        type: 'postgresql',
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          username: 'testuser',
          password: 'testpassword'
        },
        description: 'Test system'
      });
    });

    it('should mask sensitive data in JSON output', () => {
      const json = system.toJSON();

      expect(json.connectionInfo.host).toBe('localhost');
      expect(json.connectionInfo.port).toBe(5432);
      expect(json.connectionInfo.username).toBe('testuser');
      expect(json.connectionInfo.password).toBe('***'); // Should be masked
    });

    it('should mask multiple sensitive fields', async () => {
      const systemWithSecrets = await System.create({
        name: 'Secure System',
        type: 'aws_s3',
        connectionInfo: {
          region: 'us-east-1',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          token: 'temporary-token',
          key: 'encryption-key'
        }
      });

      const json = systemWithSecrets.toJSON();

      expect(json.connectionInfo.region).toBe('us-east-1');
      expect(json.connectionInfo.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(json.connectionInfo.secretAccessKey).toBe('***');
      expect(json.connectionInfo.token).toBe('***');
      expect(json.connectionInfo.key).toBe('***');
    });

    it('should handle empty connection info', async () => {
      const minimalSystem = await System.create({
        name: 'Minimal System',
        type: 'local_fs',
        connectionInfo: {}
      });

      const json = minimalSystem.toJSON();

      expect(json.connectionInfo).toEqual({});
    });
  });

  describe('Connection Info Handling', () => {
    it('should store complex connection info', async () => {
      const complexConnectionInfo = {
        primary: {
          host: 'primary.example.com',
          port: 5432,
          username: 'primary_user',
          password: 'primary_pass'
        },
        secondary: {
          host: 'secondary.example.com',
          port: 5432,
          username: 'secondary_user',
          password: 'secondary_pass'
        },
        poolConfig: {
          min: 1,
          max: 10,
          idle: 30000
        },
        ssl: {
          enabled: true,
          cert: '/path/to/cert',
          key: '/path/to/key'
        }
      };

      const system = await System.create({
        name: 'Complex System',
        type: 'postgresql',
        connectionInfo: complexConnectionInfo
      });

      expect(system.connectionInfo).toBeDefined();
      expect(system.connectionInfo.primary).toBeDefined();
      expect(system.connectionInfo.secondary).toBeDefined();
      expect(system.connectionInfo.poolConfig).toBeDefined();
      expect(system.connectionInfo.ssl).toBeDefined();
    });

    it('should handle JSON serialization of connection info', async () => {
      const connectionInfo = {
        host: 'test.example.com',
        options: {
          timeout: 30000,
          retries: 3
        }
      };

      const system = await System.create({
        name: 'JSON Test System',
        type: 'postgresql',
        connectionInfo: connectionInfo
      });

      // Retrieve from database
      const retrieved = await System.findByPk(system.id);

      expect(retrieved.connectionInfo.host).toBe('test.example.com');
      expect(retrieved.connectionInfo.options.timeout).toBe(30000);
      expect(retrieved.connectionInfo.options.retries).toBe(3);
    });
  });
});