/* Electronegativity安全扫描配置 */
module.exports = {
  // 输出格式
  output: {
    json: 'security-scan-results.json',
    html: 'security-scan-report.html',
  },

  // 严重性过滤
  severity: {
    low: true,
    medium: true,
    high: true,
    critical: true,
  },

  // 自定义规则配置
  rules: {
    // 禁用危险配置检查
    SECURITY_WARNINGS_DISABLED_JS_CHECK: 'error',
    CSP_GLOBAL_CHECK: 'error',
    NODE_INTEGRATION_JS_CHECK: 'error',
    CONTEXT_ISOLATION_JS_CHECK: 'error',
    WEB_SECURITY_JS_CHECK: 'error',
    SANDBOX_JS_CHECK: 'error',
  },

  // 扫描路径
  input: [
    './electron/**/*.js',
    './electron/**/*.ts',
    './src/**/*.js',
    './src/**/*.ts',
    './dist-electron/**/*.js',
  ],

  // 排除路径
  exclude: ['node_modules/**', 'dist/**', '**/*.test.js', '**/*.spec.js'],

  // CI模式配置
  ci: {
    failOnError: true,
    maxWarnings: 0,
  },
};
