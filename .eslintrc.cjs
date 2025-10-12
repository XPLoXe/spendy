module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-console': 'warn',
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
    'no-trailing-spaces': 'error',
    'indent': ['error', 2, { SwitchCase: 1 }],
    'vue/valid-define-props': 'off',
  },
  globals: {
    defineNuxtConfig: 'readonly',
    defineNuxtPlugin: 'readonly',
    useAuth: 'readonly',
    useHead: 'readonly',
    useRuntimeConfig: 'readonly'
  },
}
