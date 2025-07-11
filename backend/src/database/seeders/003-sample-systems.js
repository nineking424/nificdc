const { v4: uuidv4 } = require('uuid');
const { encryptConnectionInfo } = require('../../utils/encryption');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    
    // 샘플 시스템들 (개발/테스트용)
    const systems = [
      {
        id: uuidv4(),
        name: 'Oracle Production DB',
        type: 'oracle',
        connection_info: JSON.stringify(encryptConnectionInfo({
          host: 'oracle.example.com',
          port: 1521,
          serviceName: 'PROD',
          username: 'nifi_user',
          password: 'secure_password',
          connectionTimeout: 30000
        })),
        is_active: true,
        description: '운영 Oracle 데이터베이스',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'PostgreSQL Data Warehouse',
        type: 'postgresql',
        connection_info: JSON.stringify(encryptConnectionInfo({
          host: 'postgres.example.com',
          port: 5432,
          database: 'warehouse',
          username: 'etl_user',
          password: 'etl_password',
          ssl: true,
          poolSize: 10
        })),
        is_active: true,
        description: '데이터 웨어하우스 PostgreSQL',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'SFTP File Server',
        type: 'sftp',
        connection_info: JSON.stringify(encryptConnectionInfo({
          host: 'sftp.example.com',
          port: 22,
          username: 'file_user',
          password: 'file_password',
          rootPath: '/data/incoming',
          connectionTimeout: 10000
        })),
        is_active: true,
        description: 'SFTP 파일 서버',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'MySQL Analytics DB',
        type: 'mysql',
        connection_info: JSON.stringify(encryptConnectionInfo({
          host: 'mysql.example.com',
          port: 3306,
          database: 'analytics',
          username: 'analytics_user',
          password: 'analytics_password',
          charset: 'utf8mb4',
          timezone: '+00:00'
        })),
        is_active: true,
        description: '분석용 MySQL 데이터베이스',
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Development SQLite',
        type: 'sqlite',
        connection_info: JSON.stringify({
          path: '/tmp/dev.sqlite',
          mode: 'readwrite'
        }),
        is_active: false,
        description: '개발용 SQLite 데이터베이스',
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('systems', systems);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('systems', {
      name: {
        [Sequelize.Op.in]: [
          'Oracle Production DB',
          'PostgreSQL Data Warehouse',
          'SFTP File Server',
          'MySQL Analytics DB',
          'Development SQLite'
        ]
      }
    });
  }
};