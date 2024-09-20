import globals from 'globals'
import * as tseslint from 'typescript-eslint'
import typescriptParser from '@typescript-eslint/parser'
import TSESTree from '@typescript-eslint/typescript-estree'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import stylisticTs from '@stylistic/eslint-plugin-ts'
import stylistic from '@stylistic/eslint-plugin'
import StylisticPlugin from '@stylistic/eslint-plugin'
import unusedImports from 'eslint-plugin-unused-imports'

// export default tseslint.config(
export default stylistic.configs.customize(
  {
    files: ['*src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['dist', '**/*.js', '**/*.jsx', 'eslint.config.js', '*.d.ts'],
    plugins: {
      'unicorn': eslintPluginUnicorn,
      '@stylistic/ts': stylisticTs,
      'unused-imports': unusedImports,
    },
    extends: [
      ...tseslint.configs.stylisticTypeChecked,
      eslintPluginUnicorn.configs['flat/recommended'],
      stylistic.configs['recommended-flat'],
      stylistic.configs['migrate'],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: typescriptParser,
      parserOptions: {
        // programs: [TSESTree.createProgram('tsconfig.json')],
        extraFileExtensions: '**/*.ts',
        project: './tsconfig.json',
        sourceType: 'module',
        tsconfigRootDir: './',
      },
    },
    rules: {
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/prefer-find': 'off',
      '@typescript-eslint/prefer-includes': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': ['off', { treatMethodsAsReadonly: true }],
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      // 'comma-dangle': ['error', 'always-multiline'],
      'id-length': 'off',
      // "indent": "off",
      // "indent": ["error", "tab", { "SwitchCase": 1, "VariableDeclarator": 4 }],
      'linebreak-style': ['error', 'unix'],
      'no-await-in-loop': 'off',
      'no-magic-numbers': 'off',
      'no-plusplus': 'off',
      'no-return-assign': 'off',
      'one-var': 'off',
      // 'quotes': ['error', 'single'],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'unicorn/no-useless-promise-resolve-reject': 'off',
      'unicorn/no-for-loop': 'off',
      'unicorn/prevent-abbreviations': 'off',
      '@stylistic/ts/indent': ['error', 4],
      '@stylistic/block-spacing': ['error', 'always'],
      '@stylistic/max-statements-per-line': ['error', { max: 2 }],
      '@stylistic/multiline-ternary': ['error', 'always'],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
      '@stylistic/comma-dangle': ['error', 'always'],
      '@stylisticts/no-extra-semi': ['error', 'never'],
      '@stylisticts/ts/quotes': ['error', 'single'],
    },
  },
)
