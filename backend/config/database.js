// Re-export sequelize instance from the actual database connection module
const { sequelize } = require('../src/database/connection');

module.exports = sequelize;