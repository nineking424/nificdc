const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    
    // 기본 사용자 계정들
    const users = [
      {
        id: uuidv4(),
        username: 'admin',
        email: 'admin@nificdc.local',
        password_hash: await bcrypt.hash('admin123', 10),
        role: 'admin',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        username: 'user',
        email: 'user@nificdc.local',
        password_hash: await bcrypt.hash('user123', 10),
        role: 'user',
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        username: 'demo',
        email: 'demo@nificdc.local',
        password_hash: await bcrypt.hash('demo123', 10),
        role: 'user',
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ];

    await queryInterface.bulkInsert('users', users);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', {
      username: {
        [Sequelize.Op.in]: ['admin', 'user', 'demo']
      }
    });
  }
};