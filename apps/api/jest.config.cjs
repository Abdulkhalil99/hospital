const baseConfig = require('./jest.base.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  globalSetup: '<rootDir>/src/__tests__/global-setup.ts',
  globalTeardown: '<rootDir>/src/__tests__/global-teardown.ts',
};
