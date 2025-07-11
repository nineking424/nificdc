const path = require('path');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('./connection');
const logger = require('../utils/logger');

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, 'seeders/*.js'),
    resolve: ({ name, path: filepath }) => {
      // eslint-disable-next-line import/no-dynamic-require
      const seeder = require(filepath);
      return {
        name,
        up: async () => seeder.up(sequelize.getQueryInterface(), Sequelize),
        down: async () => seeder.down(sequelize.getQueryInterface(), Sequelize)
      };
    }
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ 
    sequelize,
    tableName: 'SequelizeSeederMeta'
  }),
  logger: {
    info: (message) => logger.info(`[Seeder] ${message}`),
    warn: (message) => logger.warn(`[Seeder] ${message}`),
    error: (message) => logger.error(`[Seeder] ${message}`)
  }
});

const seed = async () => {
  try {
    logger.info('Starting database seeding...');
    
    // 데이터베이스 연결 확인
    await sequelize.authenticate();
    logger.info('Database connection established');

    // 시드 데이터 실행
    const seeders = await umzug.up();
    
    if (seeders.length === 0) {
      logger.info('No seeders to execute');
    } else {
      logger.info(`Executed ${seeders.length} seeders:`);
      seeders.forEach(seeder => {
        logger.info(`- ${seeder.name}`);
      });
    }

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  }
};

const unseed = async (to) => {
  try {
    logger.info('Starting database unseeding...');
    
    if (to) {
      await umzug.down({ to });
      logger.info(`Rolled back to seeder: ${to}`);
    } else {
      await umzug.down();
      logger.info('Rolled back last seeder');
    }
  } catch (error) {
    logger.error('Unseeding failed:', error);
    throw error;
  }
};

const status = async () => {
  try {
    const executed = await umzug.executed();
    const pending = await umzug.pending();
    
    logger.info('Seeder Status:');
    logger.info(`Executed: ${executed.length}`);
    executed.forEach(seeder => {
      logger.info(`- ${seeder.name}`);
    });
    
    logger.info(`Pending: ${pending.length}`);
    pending.forEach(seeder => {
      logger.info(`- ${seeder.name}`);
    });
    
    return { executed, pending };
  } catch (error) {
    logger.error('Status check failed:', error);
    throw error;
  }
};

const reset = async () => {
  try {
    logger.info('Resetting seed data...');
    
    // 모든 시드 데이터 롤백
    await umzug.down({ to: 0 });
    
    // 다시 모든 시드 데이터 실행
    await umzug.up();
    
    logger.info('Seed data reset completed');
  } catch (error) {
    logger.error('Reset failed:', error);
    throw error;
  }
};

// CLI에서 직접 실행되는 경우
if (require.main === module) {
  const command = process.argv[2];
  
  (async () => {
    try {
      switch (command) {
        case 'up':
          await seed();
          break;
        case 'down':
          await unseed(process.argv[3]);
          break;
        case 'status':
          await status();
          break;
        case 'reset':
          await reset();
          break;
        default:
          logger.info('Usage: node seed.js [up|down|status|reset]');
          logger.info('  up     - Run pending seeders');
          logger.info('  down   - Rollback last seeder (or to specific seeder)');
          logger.info('  status - Show seeder status');
          logger.info('  reset  - Reset seed data (down all, then up all)');
      }
    } catch (error) {
      logger.error('Seeder command failed:', error);
      process.exit(1);
    } finally {
      await sequelize.close();
    }
  })();
}

module.exports = {
  seed,
  unseed,
  status,
  reset,
  umzug
};