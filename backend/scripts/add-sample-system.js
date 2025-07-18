const { System } = require('../src/models');
const logger = require('../src/utils/logger');

async function addSampleSystem() {
  try {
    // Check if sample system already exists
    const existingSystem = await System.findOne({
      where: { name: 'Sample PostgreSQL Database' }
    });

    if (existingSystem) {
      logger.info('Sample system already exists');
      return;
    }

    // Create sample system
    const sampleSystem = await System.create({
      name: 'Sample PostgreSQL Database',
      type: 'postgresql',
      description: 'Sample database for testing and development',
      connectionInfo: {
        host: 'localhost',
        port: 5432,
        database: 'sampledb',
        username: 'postgres',
        sslMode: 'disable'
      },
      isActive: true,
      lastConnectionStatus: 'success',
      lastConnectionTest: new Date(),
      lastConnectionMessage: 'Connection successful',
      lastConnectionLatency: 25
    });

    logger.info('Sample system created successfully:', {
      id: sampleSystem.id,
      name: sampleSystem.name,
      type: sampleSystem.type
    });

    // Create another sample system
    const sampleSystem2 = await System.create({
      name: 'Sample MySQL Database',
      type: 'mysql',
      description: 'Another sample database for testing',
      connectionInfo: {
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'root'
      },
      isActive: true,
      lastConnectionStatus: 'success',
      lastConnectionTest: new Date(),
      lastConnectionMessage: 'Connection successful',
      lastConnectionLatency: 15
    });

    logger.info('Second sample system created successfully:', {
      id: sampleSystem2.id,
      name: sampleSystem2.name,
      type: sampleSystem2.type
    });

  } catch (error) {
    logger.error('Failed to create sample system:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
addSampleSystem();