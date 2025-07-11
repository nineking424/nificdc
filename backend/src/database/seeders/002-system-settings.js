const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    
    // 기본 시스템 설정
    const settings = [
      {
        id: uuidv4(),
        key: 'nifi_connection_timeout',
        value: JSON.stringify(30000),
        description: 'NiFi API 연결 타임아웃 (밀리초)',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'max_concurrent_jobs',
        value: JSON.stringify(10),
        description: '동시 실행 가능한 최대 작업 수',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'log_retention_days',
        value: JSON.stringify(30),
        description: '로그 보관 기간 (일)',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'encryption_key_rotation_days',
        value: JSON.stringify(90),
        description: '암호화 키 로테이션 주기 (일)',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'api_rate_limit_per_minute',
        value: JSON.stringify(1000),
        description: '분당 API 요청 제한',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'backup_retention_days',
        value: JSON.stringify(7),
        description: '백업 보관 기간 (일)',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'job_execution_timeout',
        value: JSON.stringify(3600),
        description: '작업 실행 타임아웃 (초)',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'health_check_interval',
        value: JSON.stringify(60),
        description: '헬스체크 간격 (초)',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'notification_enabled',
        value: JSON.stringify(true),
        description: '알림 기능 활성화 여부',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        key: 'default_job_priority',
        value: JSON.stringify(5),
        description: '기본 작업 우선순위',
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('system_settings', settings);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('system_settings', {
      key: {
        [Sequelize.Op.in]: [
          'nifi_connection_timeout',
          'max_concurrent_jobs',
          'log_retention_days',
          'encryption_key_rotation_days',
          'api_rate_limit_per_minute',
          'backup_retention_days',
          'job_execution_timeout',
          'health_check_interval',
          'notification_enabled',
          'default_job_priority'
        ]
      }
    });
  }
};