const { User } = require('../../src/models');
const { sequelize } = require('../../src/database/connection');

describe('User Model', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await User.destroy({ where: {}, force: true });
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'user'
      };

      const user = await User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('user');
      expect(user.isActive).toBe(true);
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe('password123'); // Should be hashed
    });

    it('should create admin user', async () => {
      const userData = {
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      };

      const user = await User.create(userData);

      expect(user.role).toBe('admin');
      expect(user.isAdmin()).toBe(true);
      expect(user.isUser()).toBe(false);
    });

    it('should default to user role', async () => {
      const userData = {
        username: 'defaultuser',
        email: 'default@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);

      expect(user.role).toBe('user');
    });
  });

  describe('User Validation', () => {
    it('should require username', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should require email', async () => {
      const userData = {
        username: 'testuser',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should require valid email format', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should require unique username', async () => {
      const userData1 = {
        username: 'testuser',
        email: 'test1@example.com',
        password: 'password123'
      };

      const userData2 = {
        username: 'testuser',
        email: 'test2@example.com',
        password: 'password123'
      };

      await User.create(userData1);
      await expect(User.create(userData2)).rejects.toThrow();
    });

    it('should require unique email', async () => {
      const userData1 = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'password123'
      };

      const userData2 = {
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password123'
      };

      await User.create(userData1);
      await expect(User.create(userData2)).rejects.toThrow();
    });

    it('should validate role values', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'invalid_role'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe('Password Management', () => {
    it('should hash password on creation', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);

      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe('password123');
      expect(user.passwordHash.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);
      const isValid = await user.checkPassword('password123');

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);
      const isValid = await user.checkPassword('wrongpassword');

      expect(isValid).toBe(false);
    });

    it('should update password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);
      const oldHash = user.passwordHash;

      await user.updatePassword('newpassword123');

      expect(user.passwordHash).not.toBe(oldHash);
      expect(await user.checkPassword('newpassword123')).toBe(true);
      expect(await user.checkPassword('password123')).toBe(false);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await User.bulkCreate([
        {
          username: 'user1',
          email: 'user1@example.com',
          password: 'password123',
          role: 'user'
        },
        {
          username: 'admin1',
          email: 'admin1@example.com',
          password: 'password123',
          role: 'admin'
        },
        {
          username: 'inactive',
          email: 'inactive@example.com',
          password: 'password123',
          isActive: false
        }
      ]);
    });

    it('should find user by username', async () => {
      const user = await User.findByUsername('user1');

      expect(user).toBeDefined();
      expect(user.username).toBe('user1');
    });

    it('should find user by email', async () => {
      const user = await User.findByEmail('admin1@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('admin1@example.com');
    });

    it('should find active users only', async () => {
      const users = await User.findActive();

      expect(users.length).toBe(2);
      users.forEach(user => {
        expect(user.isActive).toBe(true);
      });
    });

    it('should find users by role', async () => {
      const adminUsers = await User.findByRole('admin');
      const regularUsers = await User.findByRole('user');

      expect(adminUsers.length).toBe(1);
      expect(adminUsers[0].role).toBe('admin');
      expect(regularUsers.length).toBe(1);
      expect(regularUsers[0].role).toBe('user');
    });

    it('should authenticate user with correct credentials', async () => {
      const user = await User.authenticate('user1', 'password123');

      expect(user).toBeDefined();
      expect(user.username).toBe('user1');
      expect(user.lastLoginAt).toBeDefined();
    });

    it('should not authenticate user with incorrect password', async () => {
      const user = await User.authenticate('user1', 'wrongpassword');

      expect(user).toBeNull();
    });

    it('should not authenticate inactive user', async () => {
      const user = await User.authenticate('inactive', 'password123');

      expect(user).toBeNull();
    });

    it('should get active user count', async () => {
      const count = await User.getActiveCount();

      expect(count).toBe(2);
    });

    it('should get admin count', async () => {
      const count = await User.getAdminCount();

      expect(count).toBe(1);
    });
  });

  describe('Instance Methods', () => {
    let user, admin;

    beforeEach(async () => {
      user = await User.create({
        username: 'testuser',
        email: 'user@example.com',
        password: 'password123',
        role: 'user'
      });

      admin = await User.create({
        username: 'testadmin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin'
      });
    });

    it('should identify admin role correctly', () => {
      expect(user.isAdmin()).toBe(false);
      expect(user.isUser()).toBe(true);
      expect(admin.isAdmin()).toBe(true);
      expect(admin.isUser()).toBe(false);
    });

    it('should check access permissions', () => {
      // Admin should have access to everything
      expect(admin.canAccess('systems', 'read')).toBe(true);
      expect(admin.canAccess('systems', 'write')).toBe(true);
      expect(admin.canAccess('systems', 'delete')).toBe(true);

      // User should have limited access
      expect(user.canAccess('systems', 'read')).toBe(true);
      expect(user.canAccess('systems', 'write')).toBe(false);
      expect(user.canAccess('systems', 'delete')).toBe(false);
    });

    it('should update last login time', async () => {
      const initialLoginTime = user.lastLoginAt;
      
      await user.updateLastLogin();
      
      expect(user.lastLoginAt).not.toBe(initialLoginTime);
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should exclude sensitive data in JSON', () => {
      const json = user.toJSON();

      expect(json.passwordHash).toBeUndefined();
      expect(json.username).toBeDefined();
      expect(json.email).toBeDefined();
    });

    it('should provide safe JSON without email', () => {
      const safeJson = user.toSafeJSON();

      expect(safeJson.passwordHash).toBeUndefined();
      expect(safeJson.email).toBeUndefined();
      expect(safeJson.username).toBeDefined();
      expect(safeJson.id).toBeDefined();
      expect(safeJson.role).toBeDefined();
    });
  });
});