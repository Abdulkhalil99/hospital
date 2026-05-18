const baseConfig = require('./jest.base.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  globalSetup: undefined,
  globalTeardown: undefined,
  setupFilesAfterEnv: [],
};
