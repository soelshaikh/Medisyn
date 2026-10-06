// @ts-check
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Block superAdminDb import from outside src/core/super-admin/
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../db',
              importNames: ['superAdminDb'],
              message: 'superAdminDb may only be imported from src/core/super-admin/',
            },
            {
              name: '../../db',
              importNames: ['superAdminDb'],
              message: 'superAdminDb may only be imported from src/core/super-admin/',
            },
            {
              name: '../../../db',
              importNames: ['superAdminDb'],
              message: 'superAdminDb may only be imported from src/core/super-admin/',
            },
            {
              name: '@/db',
              importNames: ['superAdminDb'],
              message: 'superAdminDb may only be imported from src/core/super-admin/',
            },
          ],
        },
      ],
    },
  },
  // ALLOW superAdminDb import inside src/core/super-admin/
  {
    files: ['src/core/super-admin/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
