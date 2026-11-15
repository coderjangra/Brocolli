// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'drizzle/*'],
  },
  {
    // CONTRIBUTING.md hard rule: money is integer paise, never parseFloat a rupee amount.
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'parseFloat', message: 'Money is integer paise. Use src/domain/money.ts.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Number',
          property: 'parseFloat',
          message: 'Money is integer paise. Use src/domain/money.ts.',
        },
      ],
    },
  },
]);
