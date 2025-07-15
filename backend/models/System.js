const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const System = sequelize.define('System', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: { msg: '시스템 이름은 필수입니다.' },
      len: { args: [1, 100], msg: '시스템 이름은 1-100자 사이여야 합니다.' }
    }
  },
  type: {
    type: DataTypes.ENUM(
      'oracle',
      'postgresql', 
      'mysql',
      'mssql',
      'sqlite',
      'ftp',
      'sftp',
      'local_fs',
      'aws_s3',
      'azure_blob',
      'api_rest',
      'api_soap',
      'kafka',
      'redis',
      'mongodb',
      'elasticsearch',
      'hdfs',
      'cassandra'
    ),
    allowNull: false,
    validate: {
      notEmpty: { msg: '시스템 타입은 필수입니다.' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  connectionInfo: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '암호화된 접속 정보 JSON'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  lastConnectionTest: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastConnectionStatus: {
    type: DataTypes.ENUM('success', 'failed', 'pending'),
    allowNull: true
  },
  lastConnectionError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '추가 메타데이터 (스키마 정보, 통계 등)'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  adapterId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'SystemAdapters',
      key: 'id'
    },
    comment: '사용하는 시스템 어댑터 ID'
  }
}, {
  tableName: 'systems',
  timestamps: true,
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['type']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['createdBy']
    }
  ]
});

// 연관 관계 정의
System.associate = (models) => {
  System.belongsTo(models.User, {
    foreignKey: 'createdBy',
    as: 'creator'
  });
  
  System.belongsTo(models.User, {
    foreignKey: 'updatedBy',
    as: 'updater'
  });
  
  // 시스템은 여러 데이터 스키마를 가질 수 있음
  System.hasMany(models.DataSchema, {
    foreignKey: 'systemId',
    as: 'schemas'
  });
  
  // 시스템은 여러 매핑의 소스나 타겟이 될 수 있음
  System.hasMany(models.Mapping, {
    foreignKey: 'sourceSystemId',
    as: 'sourceMappings'
  });
  
  System.hasMany(models.Mapping, {
    foreignKey: 'targetSystemId',
    as: 'targetMappings'
  });
  
  // 시스템은 어댑터를 참조함
  System.belongsTo(models.SystemAdapter, {
    foreignKey: 'adapterId',
    as: 'adapter'
  });
};

// 인스턴스 메서드
System.prototype.getDecryptedConnectionInfo = function() {
  const crypto = require('../utils/crypto');
  try {
    const decrypted = crypto.decrypt(this.connectionInfo);
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('접속 정보 복호화 실패');
  }
};

System.prototype.setConnectionInfo = function(connectionInfo) {
  const crypto = require('../utils/crypto');
  try {
    const encrypted = crypto.encrypt(JSON.stringify(connectionInfo));
    this.connectionInfo = encrypted;
  } catch (error) {
    throw new Error('접속 정보 암호화 실패');
  }
};

// 클래스 메서드
System.getSystemTypes = function() {
  return [
    { value: 'oracle', label: 'Oracle Database', category: 'database' },
    { value: 'postgresql', label: 'PostgreSQL', category: 'database' },
    { value: 'mysql', label: 'MySQL', category: 'database' },
    { value: 'mssql', label: 'SQL Server', category: 'database' },
    { value: 'sqlite', label: 'SQLite', category: 'database' },
    { value: 'mongodb', label: 'MongoDB', category: 'database' },
    { value: 'redis', label: 'Redis', category: 'database' },
    { value: 'cassandra', label: 'Cassandra', category: 'database' },
    { value: 'elasticsearch', label: 'Elasticsearch', category: 'database' },
    { value: 'ftp', label: 'FTP Server', category: 'file' },
    { value: 'sftp', label: 'SFTP Server', category: 'file' },
    { value: 'local_fs', label: 'Local File System', category: 'file' },
    { value: 'aws_s3', label: 'Amazon S3', category: 'file' },
    { value: 'azure_blob', label: 'Azure Blob Storage', category: 'file' },
    { value: 'hdfs', label: 'Hadoop HDFS', category: 'file' },
    { value: 'api_rest', label: 'REST API', category: 'api' },
    { value: 'api_soap', label: 'SOAP API', category: 'api' },
    { value: 'kafka', label: 'Apache Kafka', category: 'streaming' }
  ];
};

module.exports = System;