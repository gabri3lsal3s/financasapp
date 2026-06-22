module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true, allowExportNames: ['useAuth', 'buttonVariants', 'badgeVariants'] },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      files: [
        'src/components/investments/AssetConfigModal.tsx',
        'src/components/investments/InvestmentReconciliationModal.tsx',
        'src/components/investments/PortfolioTransactionFormModal.tsx',
        'src/services/portfolioHistoricalRecalc.test.ts',
        'src/services/portfolioHistoricalRecalc.ts',
        'supabase/functions/daily-close/index.ts'
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'react-hooks/exhaustive-deps': 'off'
      }
    }
  ]
}





