/** @type {import('jest').Config} */
module.exports = {
    rootDir: '.',
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: String.raw`.*\.spec\.ts$`,
    roots: ['<rootDir>/src', '<rootDir>/../../packages/shared/src'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    },
    moduleNameMapper: {
        '^@lynf/shared$': '<rootDir>/../../packages/shared/src/index.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    collectCoverageFrom: ['src/**/services/**/*.ts', 'src/**/repositories/**/*.ts'],
    coverageThreshold: {
        global: { branches: 85, functions: 85, lines: 85, statements: 85 },
    },
};
