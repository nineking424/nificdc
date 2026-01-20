/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'sql-registry/**/*.json',
    'flows/**/*.json',
    'specs/**/*.yaml'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
