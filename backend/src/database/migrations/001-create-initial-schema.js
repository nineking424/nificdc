const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // UUID 확장 활성화
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // 사용자 테이블
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'user'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // 시스템 테이블
    await queryInterface.createTable('systems', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      connection_info: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // 데이터 스키마 테이블
    await queryInterface.createTable('data_schemas', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      system_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'systems',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      version: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      schema_definition: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // 매핑 테이블
    await queryInterface.createTable('mappings', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      source_schema_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'data_schemas',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      target_schema_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'data_schemas',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      mapping_rules: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      transformation_script: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // 작업 테이블
    await queryInterface.createTable('jobs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      mapping_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'mappings',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      schedule_config: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 5
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // 작업 실행 테이블
    await queryInterface.createTable('job_executions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      job_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'jobs',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metrics: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    // 감사 로그 테이블
    await queryInterface.createTable('audit_logs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      table_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      record_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      old_values: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      new_values: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      ip_address: {
        type: DataTypes.INET,
        allowNull: true
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    // 시스템 설정 테이블
    await queryInterface.createTable('system_settings', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      value: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    // 인덱스 생성
    await queryInterface.addIndex('users', ['username']);
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['is_active']);

    await queryInterface.addIndex('systems', ['type']);
    await queryInterface.addIndex('systems', ['is_active']);
    await queryInterface.addIndex('systems', ['created_at']);

    await queryInterface.addIndex('data_schemas', ['system_id']);
    await queryInterface.addIndex('data_schemas', ['name']);
    await queryInterface.addIndex('data_schemas', ['version']);
    await queryInterface.addIndex('data_schemas', ['system_id', 'name', 'version'], { unique: true });

    await queryInterface.addIndex('mappings', ['source_schema_id']);
    await queryInterface.addIndex('mappings', ['target_schema_id']);

    await queryInterface.addIndex('jobs', ['mapping_id']);
    await queryInterface.addIndex('jobs', ['is_active']);
    await queryInterface.addIndex('jobs', ['priority']);

    await queryInterface.addIndex('job_executions', ['job_id']);
    await queryInterface.addIndex('job_executions', ['status']);
    await queryInterface.addIndex('job_executions', ['started_at']);
    await queryInterface.addIndex('job_executions', ['completed_at']);

    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['table_name']);
    await queryInterface.addIndex('audit_logs', ['created_at']);

    // 제약 조건 추가
    await queryInterface.addConstraint('systems', {
      fields: ['type'],
      type: 'check',
      where: {
        type: {
          [Sequelize.Op.in]: ['oracle', 'postgresql', 'sqlite', 'mysql', 'mssql', 'ftp', 'sftp', 'local_fs', 'aws_s3', 'azure_blob']
        }
      },
      name: 'systems_type_check'
    });

    await queryInterface.addConstraint('users', {
      fields: ['role'],
      type: 'check',
      where: {
        role: {
          [Sequelize.Op.in]: ['admin', 'user']
        }
      },
      name: 'users_role_check'
    });

    await queryInterface.addConstraint('job_executions', {
      fields: ['status'],
      type: 'check',
      where: {
        status: {
          [Sequelize.Op.in]: ['pending', 'running', 'completed', 'failed', 'cancelled']
        }
      },
      name: 'job_executions_status_check'
    });

    await queryInterface.addConstraint('jobs', {
      fields: ['priority'],
      type: 'check',
      where: {
        priority: {
          [Sequelize.Op.between]: [1, 10]
        }
      },
      name: 'jobs_priority_check'
    });

    // 데이터 스키마 유니크 제약 조건
    await queryInterface.addConstraint('data_schemas', {
      fields: ['system_id', 'name', 'version'],
      type: 'unique',
      name: 'data_schemas_system_name_version_unique'
    });

    // 매핑 서로 다른 스키마 제약 조건
    await queryInterface.sequelize.query(`
      ALTER TABLE mappings 
      ADD CONSTRAINT mappings_different_schemas_check 
      CHECK (source_schema_id != target_schema_id)
    `);

    // 작업 실행 시간 제약 조건
    await queryInterface.sequelize.query(`
      ALTER TABLE job_executions 
      ADD CONSTRAINT job_executions_start_end_check 
      CHECK (completed_at IS NULL OR started_at <= completed_at)
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // 역순으로 테이블 삭제
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('system_settings');
    await queryInterface.dropTable('job_executions');
    await queryInterface.dropTable('jobs');
    await queryInterface.dropTable('mappings');
    await queryInterface.dropTable('data_schemas');
    await queryInterface.dropTable('systems');
    await queryInterface.dropTable('users');
    
    // UUID 확장 제거
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS "uuid-ossp";');
  }
};