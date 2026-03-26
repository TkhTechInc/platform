module.exports = {
  projects: [
    '<rootDir>/packages/*/jest.config.js'
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.spec.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
