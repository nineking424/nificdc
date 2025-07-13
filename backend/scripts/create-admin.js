const bcrypt = require('bcryptjs');
const { sequelize } = require('../src/database/connection');
const { User } = require('../src/models');

async function createAdmin() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      role: 'admin',
      isActive: true
    });

    console.log('Admin user created successfully:', {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    });

    process.exit(0);
  } catch (error) {
    console.error('Failed to create admin user:', error);
    process.exit(1);
  }
}

createAdmin();