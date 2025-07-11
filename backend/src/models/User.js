const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../database/connection');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [3, 50],
      isAlphanumeric: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      isEmail: true,
      len: [1, 100]
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'user',
    validate: {
      isIn: [['admin', 'user']]
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login_at'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deleted_at'
  }
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.passwordHash = await bcrypt.hash(user.password, 10);
        delete user.password;
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.passwordHash = await bcrypt.hash(user.password, 10);
        delete user.password;
      }
    }
  },
  indexes: [
    {
      fields: ['username']
    },
    {
      fields: ['email']
    },
    {
      fields: ['is_active']
    }
  ]
});

// 모델 연관관계 정의
User.associate = (models) => {
  User.hasMany(models.AuditLog, {
    foreignKey: 'userId',
    as: 'auditLogs',
    onDelete: 'SET NULL'
  });
};

// 인스턴스 메서드
User.prototype.checkPassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

User.prototype.updatePassword = async function(newPassword) {
  this.passwordHash = await bcrypt.hash(newPassword, 10);
  return this.save();
};

User.prototype.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  return this.save();
};

User.prototype.isAdmin = function() {
  return this.role === 'admin';
};

User.prototype.isUser = function() {
  return this.role === 'user';
};

User.prototype.canAccess = function(resource, action) {
  // 기본 권한 체크 로직
  if (this.role === 'admin') {
    return true; // 관리자는 모든 권한
  }
  
  // 사용자별 권한 체크
  const userPermissions = {
    'systems': ['read'],
    'data': ['read'],
    'mappings': ['read'],
    'jobs': ['read'],
    'job_executions': ['read']
  };
  
  const allowedActions = userPermissions[resource] || [];
  return allowedActions.includes(action);
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.passwordHash; // 비밀번호 해시는 응답에서 제외
  return values;
};

User.prototype.toSafeJSON = function() {
  const values = this.toJSON();
  delete values.email; // 이메일도 제외하는 안전한 버전
  return {
    id: values.id,
    username: values.username,
    role: values.role,
    isActive: values.isActive,
    lastLoginAt: values.lastLoginAt,
    createdAt: values.createdAt
  };
};

// 정적 메서드
User.findByUsername = function(username) {
  return this.findOne({
    where: {
      username: username
    }
  });
};

User.findByEmail = function(email) {
  return this.findOne({
    where: {
      email: email
    }
  });
};

User.findActive = function() {
  return this.findAll({
    where: {
      isActive: true
    },
    order: [['createdAt', 'DESC']]
  });
};

User.findByRole = function(role) {
  return this.findAll({
    where: {
      role: role,
      isActive: true
    },
    order: [['username', 'ASC']]
  });
};

User.createUser = async function(userData) {
  const { username, email, password, role = 'user' } = userData;
  
  // 중복 체크
  const existingUser = await this.findOne({
    where: {
      [sequelize.Op.or]: [
        { username: username },
        { email: email }
      ]
    }
  });
  
  if (existingUser) {
    if (existingUser.username === username) {
      throw new Error('Username already exists');
    }
    if (existingUser.email === email) {
      throw new Error('Email already exists');
    }
  }
  
  return this.create({
    username,
    email,
    password, // 훅에서 해시 처리
    role
  });
};

User.authenticate = async function(username, password) {
  const user = await this.findOne({
    where: {
      username: username,
      isActive: true
    }
  });
  
  if (!user) {
    return null;
  }
  
  const isValid = await user.checkPassword(password);
  if (!isValid) {
    return null;
  }
  
  // 마지막 로그인 시간 업데이트
  await user.updateLastLogin();
  
  return user;
};

User.getActiveCount = async function() {
  return this.count({
    where: {
      isActive: true
    }
  });
};

User.getAdminCount = async function() {
  return this.count({
    where: {
      role: 'admin',
      isActive: true
    }
  });
};

User.getRecentLogins = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.findAll({
    where: {
      lastLoginAt: {
        [sequelize.Op.gte]: startDate
      }
    },
    order: [['lastLoginAt', 'DESC']],
    attributes: ['id', 'username', 'role', 'lastLoginAt']
  });
};

User.cleanupInactiveUsers = async function(inactiveDays = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
  
  const inactiveUsers = await this.findAll({
    where: {
      [sequelize.Op.or]: [
        { lastLoginAt: { [sequelize.Op.lt]: cutoffDate } },
        { lastLoginAt: { [sequelize.Op.is]: null } }
      ],
      role: 'user' // 관리자는 제외
    }
  });
  
  // 실제 삭제 대신 비활성화
  await Promise.all(
    inactiveUsers.map(user => 
      user.update({ isActive: false })
    )
  );
  
  return inactiveUsers.length;
};

module.exports = User;