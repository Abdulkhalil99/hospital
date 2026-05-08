import type { Config } from 'jest';

const config: Config = {
  preset:              'ts-jest',
  testEnvironment:     'node',
  rootDir:             '.',
  testMatch:           ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterFramework: ['<rootDir>/src/__tests__/setup.ts'],
  setupFilesAfterFramework: undefined,
  setupFiles:          [],
  globalSetup:         '<rootDir>/src/__tests__/global-setup.ts',
  globalTeardown:      '<rootDir>/src/__tests__/global-teardown.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/infrastructure/database/migrations/**',
  ],
  coverageThresholds: {
    global: { lines: 70, functions: 70, branches: 60, statements: 70 },
  },
  testTimeout: 30000,
  verbose:     true,
};

export default config;
