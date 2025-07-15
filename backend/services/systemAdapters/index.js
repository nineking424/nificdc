/**
 * System Adapters Module
 * Export all system adapter related classes
 */

const BaseSystemAdapter = require('./base/BaseAdapter');
const PostgreSQLAdapter = require('./databases/PostgreSQLAdapter');

module.exports = {
  BaseSystemAdapter,
  PostgreSQLAdapter
};