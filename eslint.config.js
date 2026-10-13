import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      'apps/api/src/generated/**',
      'apps/web/src/api/schema.d.ts',
      'apps/web/src/routeTree.gen.ts',
      'apps/web/src/components/ui/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Open-core boundary (D-011): core code must never depend on ee/.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ee/**', '@flowbit/ee*'],
              message: 'Core code must not import from ee/ (see docs/DECISIONS.md D-011).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
