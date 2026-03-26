module.exports = {
  displayName: 'ai',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
  ],
  moduleNameMapper: {
    '^@tkhtechinc/domain-errors$': '<rootDir>/../domain-errors/src/index.ts',
  },
};
