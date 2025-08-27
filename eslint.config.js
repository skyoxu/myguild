import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores([
    'dist', 
    'build', 
    'node_modules', 
    'electron-dist',
    'coverage',
    'logs',
    'test-results',
    'tests_08_templates',
    'configs',
    'docs'
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
      },
    },
    plugins: {
      prettier,
      react,
    },
    rules: {
      'prettier/prettier': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      
      // 代码复杂度规则 - 符合CLAUDE.md要求
      'max-lines-per-function': ['error', { 
        max: 50, 
        skipBlankLines: true, 
        skipComments: true,
        IIFEs: true 
      }],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      'max-nested-callbacks': ['error', 3],
      'complexity': ['error', 15], // 认知复杂度限制
      
      // TypeScript 特定复杂度规则
      '@typescript-eslint/unified-signatures': 'error',
      
      // 代码质量规则
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-return': 'error',
      'no-else-return': 'error',
      
      // React 特定规则
      'react/jsx-no-useless-fragment': 'warn',
      'react/self-closing-comp': 'warn',
      'react/jsx-boolean-value': ['warn', 'never'],
      
      // 安全相关规则
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
  },
  // E2E测试特定规则 - 防止架构反模式
  {
    files: ['**/tests/e2e/**/*.{ts,tsx,js,jsx}', '**/e2e/**/*.{ts,tsx,js,jsx}'],
    rules: {
      // 禁止从 'playwright' 导入，强制使用 '@playwright/test'
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['playwright'],
              message: "使用 '@playwright/test' 而不是 'playwright' 来保证导入一致性和测试稳定性"
            }
          ]
        }
      ],
      // 禁止在Electron E2E测试中使用 app:// 导航反模式
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='goto'] > Literal[value=/^app:/]",
          message: "Electron E2E测试中禁止使用 page.goto('app://...') 导航反模式，应在beforeAll中启动应用并使用waitForSelector等待元素就绪"
        }
      ]
    }
  }
])
