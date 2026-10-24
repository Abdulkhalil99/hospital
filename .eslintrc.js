module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    // The project is being incrementally migrated from database-shaped objects
    // to explicit DTOs. Keep unsafe types visible without blocking production
    // builds while that migration is in progress.
    '@typescript-eslint/no-explicit-any':          'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-var-requires':               'warn',
    '@typescript-eslint/no-namespace':                  'off',
    'prefer-const':                                     'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  env: { node: true, es2022: true },
};
