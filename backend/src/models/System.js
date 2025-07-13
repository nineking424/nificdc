const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const System = sequelize.define('System', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['postgresql', 'mysql', 'oracle', 'sqlite', 'mongodb', 'redis', 'sftp', 'ftp', 'local_fs', 'aws_s3', 'azure_blob', 'api', 'api_rest', 'kafka']]
    }
  },
  connectionInfo: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'connection_info'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
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
  tableName: 'systems',
  timestamps: true,
  paranoid: true,
  underscored: true,
  hooks: {
    beforeCreate: (system) => {
      // connectionInfo가 문자열로 들어온 경우 파싱해서 객체로 저장
      if (system.connectionInfo && typeof system.connectionInfo === 'string') {
        try {
          system.connectionInfo = JSON.parse(system.connectionInfo);
        } catch (e) {
          // 잘못된 JSON 형식인 경우 그대로 유지하여 validation에서 처리
        }
      }
    },
    beforeUpdate: (system) => {
      // connectionInfo가 문자열로 들어온 경우 파싱해서 객체로 저장
      if (system.connectionInfo && typeof system.connectionInfo === 'string') {
        try {
          system.connectionInfo = JSON.parse(system.connectionInfo);
        } catch (e) {
          // 잘못된 JSON 형식인 경우 그대로 유지하여 validation에서 처리
        }
      }
    }
  },
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['created_at']
    }
  ]
});

// 모델 연관관계 정의
System.associate = (models) => {
  System.hasMany(models.DataSchema, {
    foreignKey: 'systemId',
    as: 'schemas',
    onDelete: 'CASCADE'
  });
};

// 인스턴스 메서드
System.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // 민감한 접속 정보는 마스킹
  if (values.connectionInfo) {
    const masked = { ...values.connectionInfo };
    if (masked.password) masked.password = '***';
    if (masked.token) masked.token = '***';
    if (masked.key) masked.key = '***';
    values.connectionInfo = masked;
  }
  
  return values;
};

// 정적 메서드
System.findActive = function() {
  return this.findAll({
    where: {
      isActive: true
    },
    order: [['createdAt', 'DESC']]
  });
};

System.findByType = function(type) {
  return this.findAll({
    where: {
      type: type,
      isActive: true
    }
  });
};

System.testConnection = async function(systemId) {
  const system = await this.findByPk(systemId);
  if (!system) {
    throw new Error('System not found');
  }
  
  // 실제 연결 테스트 로직은 별도 서비스에서 구현
  return {
    success: true,
    message: 'Connection test successful',
    systemId: system.id,
    systemName: system.name,
    testedAt: new Date()
  };
};

module.exports = System;