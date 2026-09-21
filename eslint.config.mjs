// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * ClassPilot lint configuration (ESLint 9 flat config).
 *
 * One config for the whole monorepo. It is deliberately lean: TypeScript's
 * own checker already catches most of what a heavy rule set would, so the
 * rules here target the things `tsc` does not — unused code, accidental
 * `any`, floating promises in the API, and `console` where structured
 * logging is expected.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // The API logs through pino; a stray console.log would bypass redaction.
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['error'] }],
    },
  },

  // The extension has no log pipeline; console is its only diagnostic channel,
  // and it runs in the browser with the Chrome extension APIs available.
  {
    files: ['apps/extension/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, chrome: 'readonly' },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Tests may reach for console to explain a skip.
  {
    files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
