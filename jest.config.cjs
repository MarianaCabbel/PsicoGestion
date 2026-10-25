module.exports = {
  roots: ['<rootDir>/tests'],
  testEnvironment: 'node',
  testTimeout: 10000,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: '<rootDir>/coverage/backend',
  coverageReporters: ['text', 'json-summary', 'html'],
  coverageThreshold: {
    global: {
      statements: 85,
      lines: 85,
    },
    './src/lib/curp.js': {
      statements: 95,
      lines: 95,
    },
    './src/lib/slots.js': {
      statements: 95,
      lines: 95,
    },
    './src/modules/citas/citas.service.js': {
      statements: 95,
      lines: 95,
    },
  },
};
