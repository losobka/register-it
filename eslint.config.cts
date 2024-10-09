const globals = require('globals')
const stylistic = require('@stylistic/eslint-plugin')
const eslint = require("@eslint/js");
import type { Linter } from "eslint";

const config: Linter.Config[] = [
    eslint.configs.recommended,
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        plugins: {
            '@stylistic': stylistic
        },
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            parserOptions: {
                project: './tsconfig.json',
                sourceType: 'commonjs',
            },
        },
        rules: {
            'no-unused-vars': 'off',
            'no-redeclare': 'off',
            '@stylistic/indent': ['error', 4],
            '@stylistic/block-spacing': ['error', 'always'],
            '@stylistic/max-statements-per-line': ['error', {max: 2}],
            '@stylistic/multiline-ternary': ['error', 'always'],
            '@stylistic/no-multiple-empty-lines': ['error', {max: 1}],
            '@stylistic/comma-dangle': ['error', 'never'],
            '@stylistic/no-extra-semi': ['off'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/function-paren-newline': ['error', { minItems: 4 }],
            '@stylistic/arrow-parens': ['error', "as-needed", { "requireForBlockBody": true }],
            '@stylistic/member-delimiter-style': ['error'],
            '@stylistic/newline-per-chained-call': ["error", { "ignoreChainWithDepth": 2 }],
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/quote-props': ['error', 'as-needed'],
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/type-generic-spacing': ['error']
        }
    }
];

module.exports = config;
