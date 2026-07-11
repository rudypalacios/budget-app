/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore.*.test.ts'],
  transform: {
    '\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};
