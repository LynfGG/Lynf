import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        plugins: { unicorn },
        rules: {
            // See docs/conventions/typescript.md — these encode conventions so that
            // review never has to raise them.
            'no-console': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TSEnumDeclaration',
                    message:
                        'Do not use TypeScript enums. Use a `const` object prefixed with `E`. See docs/conventions/typescript.md',
                },
            ],
            'unicorn/filename-case': ['error', { case: 'kebabCase' }],
            // Backslashes written once, as they are read: String.raw`\d+` rather than '\\d+'.
            'unicorn/prefer-string-raw': 'error',
        },
    },
    {
        // Files Node runs outside the applications: tooling, configuration, scripts.
        // A command-line script has to be able to write to standard output — it is
        // the only way it has to talk.
        files: ['scripts/**', '**/*.config.{js,mjs,cjs}', 'eslint.config.js'],
        languageOptions: { globals: globals.node },
        rules: { 'no-console': 'off' },
    },
    prettier,
);
