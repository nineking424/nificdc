const path = require('path');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('./connection');
const logger = require('../utils/logger');

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, 'migrations/*.js'),
    resolve: ({ name, path: filepath }) => {
      // eslint-disable-next-line import/no-dynamic-require
      const migration = require(filepath);
      return {
        name,
        up: async () => migration.up(sequelize.getQueryInterface(), Sequelize),
        down: async () => migration.down(sequelize.getQueryInterface(), Sequelize)
      };
    }
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ 
    sequelize,
    tableName: 'SequelizeMeta'
  }),
  logger: {
    info: (message) => logger.info(`[Migration] ${message}`),
    warn: (message) => logger.warn(`[Migration] ${message}`),
    error: (message) => logger.error(`[Migration] ${message}`)
  }
});

const migrate = async () => {
  try {
    logger.info('Starting database migrations...');
    
    // 데이터베이스 연결 확인
    await sequelize.authenticate();
    logger.info('Database connection established');

    // 마이그레이션 실행
    const migrations = await umzug.up();
    
    if (migrations.length === 0) {
      logger.info('No migrations to execute');
    } else {
      logger.info(`Executed ${migrations.length} migrations:`);
      migrations.forEach(migration => {
        logger.info(`- ${migration.name}`);
      });
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

const rollback = async (to) => {
  try {
    logger.info('Starting database rollback...');
    
    if (to) {
      await umzug.down({ to });
      logger.info(`Rolled back to migration: ${to}`);
    } else {
      await umzug.down();
      logger.info('Rolled back last migration');
    }
  } catch (error) {
    logger.error('Rollback failed:', error);
    throw error;
  }
};

const status = async () => {
  try {
    const executed = await umzug.executed();
    const pending = await umzug.pending();
    
    logger.info('Migration Status:');
    logger.info(`Executed: ${executed.length}`);
    executed.forEach(migration => {
      logger.info(`- ${migration.name}`);
    });
    
    logger.info(`Pending: ${pending.length}`);
    pending.forEach(migration => {
      logger.info(`- ${migration.name}`);
    });
    
    return { executed, pending };
  } catch (error) {
    logger.error('Status check failed:', error);
    throw error;
  }
};

const reset = async () => {
  try {
    logger.info('Resetting database...');
    
    // 모든 마이그레이션 롤백
    await umzug.down({ to: 0 });
    
    // 다시 모든 마이그레이션 실행
    await umzug.up();
    
    logger.info('Database reset completed');
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
          await migrate();
          break;
        case 'down':
          await rollback(process.argv[3]);
          break;
        case 'status':
          await status();
          break;
        case 'reset':
          await reset();
          break;
        default:
          logger.info('Usage: node migrate.js [up|down|status|reset]');
          logger.info('  up     - Run pending migrations');
          logger.info('  down   - Rollback last migration (or to specific migration)');
          logger.info('  status - Show migration status');
          logger.info('  reset  - Reset database (down all, then up all)');
      }
    } catch (error) {
      logger.error('Migration command failed:', error);
      process.exit(1);
    } finally {
      await sequelize.close();
    }
  })();
}

module.exports = {
  migrate,
  rollback,
  status,
  reset,
  umzug
};