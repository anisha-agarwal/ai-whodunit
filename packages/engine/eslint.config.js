// Flat ESLint config for @ai-whodunit/engine. Clean at `eslint . --max-warnings 0`.
// This is NOT a threshold-bearing config (vitest.config.ts / stryker.conf.json are the
// test-author's). It only enforces lint hygiene over the source.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'reports/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
);
