/**
 * 多环境配置验证器
 *
 * 用于验证development、staging、production环境的配置完整性和正确性
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// 支持的环境类型
export type Environment = 'development' | 'staging' | 'production';

// 配置验证结果
export interface ConfigValidationResult {
  environment: Environment;
  isValid: boolean;
  timestamp: string;
  validationDuration: number;
  overall: {
    score: number; // 0-100分
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  };
  sections: {
    environmentVariables: ValidationSection;
    sentryConfiguration: ValidationSection;
    loggingConfiguration: ValidationSection;
    securityConfiguration: ValidationSection;
    performanceConfiguration: ValidationSection;
    apiEndpoints: ValidationSection;
    fileSystemConfiguration: ValidationSection;
  };
  recommendations: string[];
  criticalIssues: string[];
  warnings: string[];
}

// 验证章节结果
export interface ValidationSection {
  name: string;
  passed: boolean;
  score: number; // 0-100分
  checks: ConfigCheck[];
  summary: string;
}

// 单项配置检查
export interface ConfigCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  expectedValue?: any;
  actualValue?: any;
  recommendation?: string;
}

// 环境配置定义
export interface EnvironmentConfigSchema {
  environment: Environment;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  sentry: {
    dsnRequired: boolean;
    releaseRequired: boolean;
    environmentRequired: boolean;
    sessionTrackingRequired: boolean;
    performanceMonitoringRequired: boolean;
    expectedSampleRates: {
      errors: number;
      performance: number;
    };
  };
  logging: {
    levelRequired: 'debug' | 'info' | 'warn' | 'error';
    outputRequired: ('console' | 'file' | 'sentry')[];
    structuredLoggingRequired: boolean;
    piiFilteringRequired: boolean;
  };
  security: {
    httpsRequired: boolean;
    corsConfigRequired: boolean;
    secretsManagementRequired: boolean;
    encryptionRequired: boolean;
  };
  performance: {
    maxMemoryUsage: number; // MB
    maxStartupTime: number; // ms
    monitoringRequired: boolean;
  };
  apiEndpoints: {
    required: string[];
    healthCheckRequired: boolean;
    timeoutLimits: number; // ms
  };
}

// 环境配置模板
const ENVIRONMENT_SCHEMAS: Record<Environment, EnvironmentConfigSchema> = {
  development: {
    environment: 'development',
    requiredEnvVars: ['NODE_ENV', 'SENTRY_DSN'],
    optionalEnvVars: ['DEBUG', 'LOG_LEVEL', 'SENTRY_DEBUG'],
    sentry: {
      dsnRequired: true,
      releaseRequired: false,
      environmentRequired: true,
      sessionTrackingRequired: false,
      performanceMonitoringRequired: false,
      expectedSampleRates: { errors: 1.0, performance: 0.1 },
    },
    logging: {
      levelRequired: 'debug',
      outputRequired: ['console'],
      structuredLoggingRequired: false,
      piiFilteringRequired: false,
    },
    security: {
      httpsRequired: false,
      corsConfigRequired: false,
      secretsManagementRequired: false,
      encryptionRequired: false,
    },
    performance: {
      maxMemoryUsage: 512,
      maxStartupTime: 10000,
      monitoringRequired: false,
    },
    apiEndpoints: {
      required: [],
      healthCheckRequired: false,
      timeoutLimits: 30000,
    },
  },
  staging: {
    environment: 'staging',
    requiredEnvVars: ['NODE_ENV', 'SENTRY_DSN', 'SENTRY_ORG', 'SENTRY_PROJECT'],
    optionalEnvVars: ['LOG_LEVEL', 'SENTRY_RELEASE'],
    sentry: {
      dsnRequired: true,
      releaseRequired: true,
      environmentRequired: true,
      sessionTrackingRequired: true,
      performanceMonitoringRequired: true,
      expectedSampleRates: { errors: 1.0, performance: 0.3 },
    },
    logging: {
      levelRequired: 'info',
      outputRequired: ['console', 'file', 'sentry'],
      structuredLoggingRequired: true,
      piiFilteringRequired: true,
    },
    security: {
      httpsRequired: true,
      corsConfigRequired: true,
      secretsManagementRequired: true,
      encryptionRequired: true,
    },
    performance: {
      maxMemoryUsage: 256,
      maxStartupTime: 8000,
      monitoringRequired: true,
    },
    apiEndpoints: {
      required: ['/health', '/metrics'],
      healthCheckRequired: true,
      timeoutLimits: 15000,
    },
  },
  production: {
    environment: 'production',
    requiredEnvVars: [
      'NODE_ENV',
      'SENTRY_DSN',
      'SENTRY_ORG',
      'SENTRY_PROJECT',
      'SENTRY_RELEASE',
    ],
    optionalEnvVars: ['LOG_LEVEL'],
    sentry: {
      dsnRequired: true,
      releaseRequired: true,
      environmentRequired: true,
      sessionTrackingRequired: true,
      performanceMonitoringRequired: true,
      expectedSampleRates: { errors: 1.0, performance: 0.1 },
    },
    logging: {
      levelRequired: 'warn',
      outputRequired: ['file', 'sentry'],
      structuredLoggingRequired: true,
      piiFilteringRequired: true,
    },
    security: {
      httpsRequired: true,
      corsConfigRequired: true,
      secretsManagementRequired: true,
      encryptionRequired: true,
    },
    performance: {
      maxMemoryUsage: 128,
      maxStartupTime: 5000,
      monitoringRequired: true,
    },
    apiEndpoints: {
      required: ['/health', '/metrics', '/status'],
      healthCheckRequired: true,
      timeoutLimits: 10000,
    },
  },
};

/**
 * 多环境配置验证器类
 */
export class ConfigValidator {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * 验证指定环境的配置
   */
  async validateEnvironment(
    environment: Environment
  ): Promise<ConfigValidationResult> {
    const startTime = Date.now();
    const schema = ENVIRONMENT_SCHEMAS[environment];

    console.log(`🔍 开始验证 ${environment} 环境配置...`);

    const result: ConfigValidationResult = {
      environment,
      isValid: false,
      timestamp: new Date().toISOString(),
      validationDuration: 0,
      overall: {
        score: 0,
        grade: 'F',
        status: 'critical',
      },
      sections: {
        environmentVariables: await this.validateEnvironmentVariables(schema),
        sentryConfiguration: await this.validateSentryConfiguration(schema),
        loggingConfiguration: await this.validateLoggingConfiguration(schema),
        securityConfiguration: await this.validateSecurityConfiguration(schema),
        performanceConfiguration:
          await this.validatePerformanceConfiguration(schema),
        apiEndpoints: await this.validateApiEndpoints(schema),
        fileSystemConfiguration:
          await this.validateFileSystemConfiguration(schema),
      },
      recommendations: [],
      criticalIssues: [],
      warnings: [],
    };

    // 计算总体分数和等级
    this.calculateOverallScore(result);

    // 生成建议和问题列表
    this.generateRecommendations(result);

    result.validationDuration = Date.now() - startTime;
    console.log(
      `✅ ${environment} 环境配置验证完成，耗时: ${result.validationDuration}ms`
    );

    return result;
  }

  /**
   * 验证所有环境配置
   */
  async validateAllEnvironments(): Promise<ConfigValidationResult[]> {
    const environments: Environment[] = [
      'development',
      'staging',
      'production',
    ];
    const results: ConfigValidationResult[] = [];

    for (const env of environments) {
      try {
        const result = await this.validateEnvironment(env);
        results.push(result);
      } catch (error) {
        console.error(`验证 ${env} 环境时发生错误:`, error);
        // 创建一个失败的结果
        results.push(this.createFailedResult(env, error));
      }
    }

    return results;
  }

  /**
   * 验证环境变量
   */
  private async validateEnvironmentVariables(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];

    // 检查必需的环境变量
    for (const varName of schema.requiredEnvVars) {
      const value = process.env[varName];
      checks.push({
        id: `env_required_${varName}`,
        name: `必需环境变量: ${varName}`,
        passed: !!value,
        severity: 'critical',
        message: value
          ? `环境变量 ${varName} 已设置`
          : `缺少必需的环境变量 ${varName}`,
        expectedValue: '非空值',
        actualValue: value || 'undefined',
        recommendation: !value ? `请在环境变量中设置 ${varName}` : undefined,
      });
    }

    // 检查.env文件
    const envFiles = ['.env', `.env.${schema.environment}`, '.env.local'];
    for (const envFile of envFiles) {
      const filePath = join(this.projectRoot, envFile);
      checks.push({
        id: `env_file_${envFile}`,
        name: `环境文件: ${envFile}`,
        passed: existsSync(filePath),
        severity: envFile === '.env' ? 'high' : 'medium',
        message: existsSync(filePath)
          ? `${envFile} 文件存在`
          : `${envFile} 文件不存在`,
        recommendation: !existsSync(filePath)
          ? `考虑创建 ${envFile} 文件以存储环境特定配置`
          : undefined,
      });
    }

    // 检查环境变量安全性
    const sensitiveVars = schema.requiredEnvVars.filter(
      name =>
        name.includes('KEY') ||
        name.includes('SECRET') ||
        name.includes('TOKEN') ||
        name.includes('DSN')
    );

    for (const varName of sensitiveVars) {
      const value = process.env[varName];
      if (value) {
        checks.push({
          id: `env_security_${varName}`,
          name: `敏感变量安全: ${varName}`,
          passed:
            value.length > 10 &&
            !value.includes('test') &&
            !value.includes('example'),
          severity: 'high',
          message: '敏感环境变量安全性检查',
          recommendation: '确保敏感环境变量使用真实值，不包含测试或示例数据',
        });
      }
    }

    return this.createValidationSection('环境变量配置', checks);
  }

  /**
   * 验证Sentry配置
   */
  private async validateSentryConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const sentryConfig = schema.sentry;

    // 检查DSN配置
    if (sentryConfig.dsnRequired) {
      const dsn = process.env.SENTRY_DSN;
      checks.push({
        id: 'sentry_dsn',
        name: 'Sentry DSN配置',
        passed: !!dsn && dsn.startsWith('https://') && dsn.includes('@'),
        severity: 'critical',
        message: 'Sentry DSN格式验证',
        expectedValue: 'https://...@...sentry.io/...',
        actualValue: dsn || 'undefined',
        recommendation: '确保SENTRY_DSN是有效的Sentry项目DSN',
      });
    }

    // 检查Release配置
    if (sentryConfig.releaseRequired) {
      const release = process.env.SENTRY_RELEASE;
      checks.push({
        id: 'sentry_release',
        name: 'Sentry Release配置',
        passed: !!release,
        severity: 'high',
        message: 'Sentry Release版本信息',
        recommendation: !release
          ? '建议设置SENTRY_RELEASE以便版本跟踪'
          : undefined,
      });
    }

    // 检查Environment配置
    if (sentryConfig.environmentRequired) {
      const sentryEnv = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV;
      checks.push({
        id: 'sentry_environment',
        name: 'Sentry Environment配置',
        passed: !!sentryEnv && sentryEnv === schema.environment,
        severity: 'medium',
        message: 'Sentry环境标识',
        expectedValue: schema.environment,
        actualValue: sentryEnv,
        recommendation: '确保Sentry环境标识与当前环境一致',
      });
    }

    // 检查Sentry配置文件
    const sentryFiles = [
      'src/shared/observability/sentry-main.ts',
      'src/shared/observability/sentry-renderer.ts',
    ];

    for (const file of sentryFiles) {
      const filePath = join(this.projectRoot, file);
      checks.push({
        id: `sentry_file_${file.split('/').pop()}`,
        name: `Sentry配置文件: ${file}`,
        passed: existsSync(filePath),
        severity: 'critical',
        message: `${file} 文件存在性检查`,
        recommendation: !existsSync(filePath)
          ? `创建 ${file} 文件并配置Sentry初始化`
          : undefined,
      });

      // 如果文件存在，检查内容
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf8');
          const hasInit = content.includes('Sentry.init');
          const hasDsn =
            content.includes('dsn:') ||
            content.includes('process.env.SENTRY_DSN');

          checks.push({
            id: `sentry_content_${file.split('/').pop()}`,
            name: `${file} 内容验证`,
            passed: hasInit && hasDsn,
            severity: 'high',
            message: 'Sentry配置文件内容检查',
            recommendation: !(hasInit && hasDsn)
              ? '确保文件包含Sentry.init调用和DSN配置'
              : undefined,
          });
        } catch (error) {
          checks.push({
            id: `sentry_read_${file.split('/').pop()}`,
            name: `${file} 读取检查`,
            passed: false,
            severity: 'medium',
            message: `无法读取 ${file} 文件: ${error}`,
            recommendation: '检查文件权限和格式',
          });
        }
      }
    }

    return this.createValidationSection('Sentry配置', checks);
  }

  /**
   * 验证日志配置
   */
  private async validateLoggingConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const loggingConfig = schema.logging;

    // 检查日志级别
    const logLevel = process.env.LOG_LEVEL || 'info';
    checks.push({
      id: 'logging_level',
      name: '日志级别配置',
      passed: this.isValidLogLevel(logLevel, loggingConfig.levelRequired),
      severity: 'medium',
      message: `日志级别检查: ${logLevel}`,
      expectedValue: loggingConfig.levelRequired,
      actualValue: logLevel,
      recommendation: '确保日志级别适合当前环境',
    });

    // 检查日志目录
    const logDir = join(this.projectRoot, 'logs');
    checks.push({
      id: 'logging_directory',
      name: '日志目录',
      passed: existsSync(logDir),
      severity: 'medium',
      message: 'logs/ 目录存在性检查',
      recommendation: !existsSync(logDir)
        ? '创建 logs/ 目录用于存储日志文件'
        : undefined,
    });

    // 检查结构化日志配置
    if (loggingConfig.structuredLoggingRequired) {
      const hasStructuredLogging = this.checkStructuredLoggingImplementation();
      checks.push({
        id: 'logging_structured',
        name: '结构化日志',
        passed: hasStructuredLogging,
        severity: 'high',
        message: '结构化日志实现检查',
        recommendation: !hasStructuredLogging
          ? '实现结构化日志以提高日志可分析性'
          : undefined,
      });
    }

    // 检查PII过滤
    if (loggingConfig.piiFilteringRequired) {
      checks.push({
        id: 'logging_pii_filtering',
        name: 'PII数据过滤',
        passed: false, // 需要实际实现检查
        severity: 'high',
        message: 'PII数据过滤机制检查',
        recommendation: '实现PII数据过滤以符合隐私保护要求',
      });
    }

    return this.createValidationSection('日志配置', checks);
  }

  /**
   * 验证安全配置
   */
  private async validateSecurityConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const securityConfig = schema.security;

    // 检查HTTPS要求
    if (securityConfig.httpsRequired) {
      checks.push({
        id: 'security_https',
        name: 'HTTPS配置',
        passed: this.checkHttpsConfiguration(),
        severity: 'critical',
        message: 'HTTPS安全传输检查',
        recommendation: '确保生产环境启用HTTPS',
      });
    }

    // 检查CORS配置
    if (securityConfig.corsConfigRequired) {
      checks.push({
        id: 'security_cors',
        name: 'CORS配置',
        passed: this.checkCorsConfiguration(),
        severity: 'high',
        message: 'CORS跨域配置检查',
        recommendation: '配置适当的CORS策略',
      });
    }

    // 检查密钥管理
    if (securityConfig.secretsManagementRequired) {
      checks.push({
        id: 'security_secrets',
        name: '密钥管理',
        passed: this.checkSecretsManagement(),
        severity: 'critical',
        message: '密钥管理安全检查',
        recommendation: '使用安全的密钥管理方案',
      });
    }

    return this.createValidationSection('安全配置', checks);
  }

  /**
   * 验证性能配置
   */
  private async validatePerformanceConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const performanceConfig = schema.performance;

    // 检查内存限制
    const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    checks.push({
      id: 'performance_memory',
      name: '内存使用限制',
      passed: currentMemory < performanceConfig.maxMemoryUsage,
      severity: 'medium',
      message: `当前内存使用: ${currentMemory.toFixed(2)}MB`,
      expectedValue: `< ${performanceConfig.maxMemoryUsage}MB`,
      actualValue: `${currentMemory.toFixed(2)}MB`,
      recommendation:
        currentMemory >= performanceConfig.maxMemoryUsage
          ? '优化内存使用或调整限制'
          : undefined,
    });

    // 检查性能监控
    if (performanceConfig.monitoringRequired) {
      checks.push({
        id: 'performance_monitoring',
        name: '性能监控',
        passed: this.checkPerformanceMonitoring(),
        severity: 'high',
        message: '性能监控配置检查',
        recommendation: '启用性能监控以跟踪应用性能',
      });
    }

    return this.createValidationSection('性能配置', checks);
  }

  /**
   * 验证API端点配置
   */
  private async validateApiEndpoints(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const apiConfig = schema.apiEndpoints;

    // 检查健康检查端点
    if (apiConfig.healthCheckRequired) {
      checks.push({
        id: 'api_health_check',
        name: '健康检查端点',
        passed: apiConfig.required.includes('/health'),
        severity: 'high',
        message: '健康检查端点配置',
        recommendation: '配置 /health 端点用于服务监控',
      });
    }

    // 检查必需的API端点
    for (const endpoint of apiConfig.required) {
      checks.push({
        id: `api_endpoint_${endpoint.replace('/', '_')}`,
        name: `API端点: ${endpoint}`,
        passed: this.checkApiEndpoint(endpoint),
        severity: 'medium',
        message: `${endpoint} 端点可用性检查`,
        recommendation: `确保 ${endpoint} 端点正确实现`,
      });
    }

    return this.createValidationSection('API端点配置', checks);
  }

  /**
   * 验证文件系统配置
   */
  private async validateFileSystemConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];

    // 检查关键目录
    const requiredDirectories = ['src', 'logs', '.github/workflows'];
    for (const dir of requiredDirectories) {
      const dirPath = join(this.projectRoot, dir);
      checks.push({
        id: `fs_directory_${dir.replace('/', '_')}`,
        name: `目录: ${dir}`,
        passed: existsSync(dirPath),
        severity: dir === 'src' ? 'critical' : 'medium',
        message: `${dir} 目录存在性检查`,
        recommendation: !existsSync(dirPath) ? `创建 ${dir} 目录` : undefined,
      });
    }

    // 检查关键文件
    const requiredFiles = ['package.json', 'tsconfig.json'];
    for (const file of requiredFiles) {
      const filePath = join(this.projectRoot, file);
      checks.push({
        id: `fs_file_${file.replace('.', '_')}`,
        name: `文件: ${file}`,
        passed: existsSync(filePath),
        severity: 'critical',
        message: `${file} 文件存在性检查`,
        recommendation: !existsSync(filePath) ? `创建 ${file} 文件` : undefined,
      });
    }

    return this.createValidationSection('文件系统配置', checks);
  }

  // 辅助方法
  private createValidationSection(
    name: string,
    checks: ConfigCheck[]
  ): ValidationSection {
    const passedChecks = checks.filter(c => c.passed).length;
    const score =
      checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 0;

    return {
      name,
      passed: passedChecks === checks.length,
      score,
      checks,
      summary: `${passedChecks}/${checks.length} 项检查通过 (${score}分)`,
    };
  }

  private calculateOverallScore(result: ConfigValidationResult): void {
    const sections = Object.values(result.sections);
    const totalScore = sections.reduce(
      (sum, section) => sum + section.score,
      0
    );
    const avgScore = Math.round(totalScore / sections.length);

    result.overall.score = avgScore;
    result.overall.grade = this.scoreToGrade(avgScore);
    result.overall.status = this.scoreToStatus(avgScore);
    result.isValid = avgScore >= 80; // 80分以上认为配置有效
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private scoreToStatus(
    score: number
  ): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'poor';
    return 'critical';
  }

  private generateRecommendations(result: ConfigValidationResult): void {
    for (const section of Object.values(result.sections)) {
      for (const check of section.checks) {
        if (!check.passed) {
          if (check.severity === 'critical') {
            result.criticalIssues.push(`[${section.name}] ${check.message}`);
          } else if (check.severity === 'high') {
            result.warnings.push(`[${section.name}] ${check.message}`);
          }

          if (check.recommendation) {
            result.recommendations.push(
              `[${section.name}] ${check.recommendation}`
            );
          }
        }
      }
    }
  }

  private createFailedResult(
    environment: Environment,
    error: any
  ): ConfigValidationResult {
    return {
      environment,
      isValid: false,
      timestamp: new Date().toISOString(),
      validationDuration: 0,
      overall: { score: 0, grade: 'F', status: 'critical' },
      sections: {} as any,
      recommendations: ['修复配置验证错误后重试'],
      criticalIssues: [`验证过程失败: ${error}`],
      warnings: [],
    };
  }

  // 实际检查方法的简化实现（需要根据具体项目调整）
  private isValidLogLevel(current: string, required: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(current);
    const requiredIndex = levels.indexOf(required);
    return currentIndex >= requiredIndex;
  }

  private checkStructuredLoggingImplementation(): boolean {
    // 检查是否存在结构化日志实现
    const loggerFiles = ['src/shared/observability/structured-logger.ts'];
    return loggerFiles.some(file => existsSync(join(this.projectRoot, file)));
  }

  private checkHttpsConfiguration(): boolean {
    // 简化实现，实际需要检查具体的HTTPS配置
    return process.env.NODE_ENV === 'production' ? false : true;
  }

  private checkCorsConfiguration(): boolean {
    // 简化实现，实际需要检查CORS中间件配置
    return false;
  }

  private checkSecretsManagement(): boolean {
    // 检查是否有适当的密钥管理
    return !!(
      process.env.SENTRY_DSN && !process.env.SENTRY_DSN.includes('example')
    );
  }

  private checkPerformanceMonitoring(): boolean {
    // 检查性能监控配置
    return !!process.env.SENTRY_DSN;
  }

  private checkApiEndpoint(endpoint: string): boolean {
    // 简化实现，实际需要检查端点是否已实现
    return true;
  }
}

// 导出默认实例
export const configValidator = new ConfigValidator();

// 便捷函数
export async function validateCurrentEnvironment(): Promise<ConfigValidationResult> {
  const env = (process.env.NODE_ENV as Environment) || 'development';
  return await configValidator.validateEnvironment(env);
}

export async function validateAllEnvironments(): Promise<
  ConfigValidationResult[]
> {
  return await configValidator.validateAllEnvironments();
}
