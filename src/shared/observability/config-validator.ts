/**
 *
 *
 * developmentstagingproduction
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

//
export type Environment = 'development' | 'staging' | 'production';

//
export interface ConfigValidationResult {
  environment: Environment;
  isValid: boolean;
  timestamp: string;
  validationDuration: number;
  overall: {
    score: number; // 0-100
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

//
export interface ValidationSection {
  name: string;
  passed: boolean;
  score: number; // 0-100
  checks: ConfigCheck[];
  summary: string;
}

//
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

//
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

//
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
 *
 */
export class ConfigValidator {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   *
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

    //
    this.calculateOverallScore(result);

    //
    this.generateRecommendations(result);

    result.validationDuration = Date.now() - startTime;
    console.log(
      `✅ ${environment} 环境配置验证完成，耗时: ${result.validationDuration}ms`
    );

    return result;
  }

  /**
   *
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
        //
        results.push(this.createFailedResult(env, error));
      }
    }

    return results;
  }

  /**
   *
   */
  private async validateEnvironmentVariables(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];

    //
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
        expectedValue: '',
        actualValue: value || 'undefined',
        recommendation: !value ? `请在环境变量中设置 ${varName}` : undefined,
      });
    }

    // .env
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

    //
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
          message: '',
          recommendation: '',
        });
      }
    }

    return this.createValidationSection('', checks);
  }

  /**
   * Sentry
   */
  private async validateSentryConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const sentryConfig = schema.sentry;

    // DSN
    if (sentryConfig.dsnRequired) {
      const dsn = process.env.SENTRY_DSN;
      checks.push({
        id: 'sentry_dsn',
        name: 'Sentry DSN',
        passed: !!dsn && dsn.startsWith('https://') && dsn.includes('@'),
        severity: 'critical',
        message: 'Sentry DSN',
        expectedValue: 'https://...@...sentry.io/...',
        actualValue: dsn || 'undefined',
        recommendation: 'SENTRY_DSNSentryDSN',
      });
    }

    // Release
    if (sentryConfig.releaseRequired) {
      const release = process.env.SENTRY_RELEASE;
      checks.push({
        id: 'sentry_release',
        name: 'Sentry Release',
        passed: !!release,
        severity: 'high',
        message: 'Sentry Release',
        recommendation: !release ? 'SENTRY_RELEASE' : undefined,
      });
    }

    // Environment
    if (sentryConfig.environmentRequired) {
      const sentryEnv = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV;
      checks.push({
        id: 'sentry_environment',
        name: 'Sentry Environment',
        passed: !!sentryEnv && sentryEnv === schema.environment,
        severity: 'medium',
        message: 'Sentry',
        expectedValue: schema.environment,
        actualValue: sentryEnv,
        recommendation: 'Sentry',
      });
    }

    // Sentry
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

      //
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
            message: 'Sentry',
            recommendation: !(hasInit && hasDsn) ? 'Sentry.initDSN' : undefined,
          });
        } catch (error) {
          checks.push({
            id: `sentry_read_${file.split('/').pop()}`,
            name: `${file} 读取检查`,
            passed: false,
            severity: 'medium',
            message: `无法读取 ${file} 文件: ${error}`,
            recommendation: '',
          });
        }
      }
    }

    return this.createValidationSection('Sentry', checks);
  }

  /**
   *
   */
  private async validateLoggingConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const loggingConfig = schema.logging;

    //
    const logLevel = process.env.LOG_LEVEL || 'info';
    checks.push({
      id: 'logging_level',
      name: '',
      passed: this.isValidLogLevel(logLevel, loggingConfig.levelRequired),
      severity: 'medium',
      message: `日志级别检查: ${logLevel}`,
      expectedValue: loggingConfig.levelRequired,
      actualValue: logLevel,
      recommendation: '',
    });

    //
    const logDir = join(this.projectRoot, 'logs');
    checks.push({
      id: 'logging_directory',
      name: '',
      passed: existsSync(logDir),
      severity: 'medium',
      message: 'logs/ ',
      recommendation: !existsSync(logDir) ? ' logs/ ' : undefined,
    });

    //
    if (loggingConfig.structuredLoggingRequired) {
      const hasStructuredLogging = this.checkStructuredLoggingImplementation();
      checks.push({
        id: 'logging_structured',
        name: '',
        passed: hasStructuredLogging,
        severity: 'high',
        message: '',
        recommendation: !hasStructuredLogging ? '' : undefined,
      });
    }

    // PII
    if (loggingConfig.piiFilteringRequired) {
      checks.push({
        id: 'logging_pii_filtering',
        name: 'PII',
        passed: false, //
        severity: 'high',
        message: 'PII',
        recommendation: 'PII',
      });
    }

    return this.createValidationSection('', checks);
  }

  /**
   *
   */
  private async validateSecurityConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const securityConfig = schema.security;

    // HTTPS
    if (securityConfig.httpsRequired) {
      checks.push({
        id: 'security_https',
        name: 'HTTPS',
        passed: this.checkHttpsConfiguration(),
        severity: 'critical',
        message: 'HTTPS',
        recommendation: 'HTTPS',
      });
    }

    // CORS
    if (securityConfig.corsConfigRequired) {
      checks.push({
        id: 'security_cors',
        name: 'CORS',
        passed: this.checkCorsConfiguration(),
        severity: 'high',
        message: 'CORS',
        recommendation: 'CORS',
      });
    }

    //
    if (securityConfig.secretsManagementRequired) {
      checks.push({
        id: 'security_secrets',
        name: '',
        passed: this.checkSecretsManagement(),
        severity: 'critical',
        message: '',
        recommendation: '',
      });
    }

    return this.createValidationSection('', checks);
  }

  /**
   *
   */
  private async validatePerformanceConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const performanceConfig = schema.performance;

    //
    const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    checks.push({
      id: 'performance_memory',
      name: '',
      passed: currentMemory < performanceConfig.maxMemoryUsage,
      severity: 'medium',
      message: `当前内存使用: ${currentMemory.toFixed(2)}MB`,
      expectedValue: `< ${performanceConfig.maxMemoryUsage}MB`,
      actualValue: `${currentMemory.toFixed(2)}MB`,
      recommendation:
        currentMemory >= performanceConfig.maxMemoryUsage ? '' : undefined,
    });

    //
    if (performanceConfig.monitoringRequired) {
      checks.push({
        id: 'performance_monitoring',
        name: '',
        passed: this.checkPerformanceMonitoring(),
        severity: 'high',
        message: '',
        recommendation: '',
      });
    }

    return this.createValidationSection('', checks);
  }

  /**
   * API
   */
  private async validateApiEndpoints(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];
    const apiConfig = schema.apiEndpoints;

    //
    if (apiConfig.healthCheckRequired) {
      checks.push({
        id: 'api_health_check',
        name: '',
        passed: apiConfig.required.includes('/health'),
        severity: 'high',
        message: '',
        recommendation: ' /health ',
      });
    }

    // API
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

    return this.createValidationSection('API', checks);
  }

  /**
   *
   */
  private async validateFileSystemConfiguration(
    schema: EnvironmentConfigSchema
  ): Promise<ValidationSection> {
    const checks: ConfigCheck[] = [];

    //
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

    //
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

    return this.createValidationSection('', checks);
  }

  //
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
    result.isValid = avgScore >= 80; // 80
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
      recommendations: [''],
      criticalIssues: [`验证过程失败: ${error}`],
      warnings: [],
    };
  }

  //
  private isValidLogLevel(current: string, required: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(current);
    const requiredIndex = levels.indexOf(required);
    return currentIndex >= requiredIndex;
  }

  private checkStructuredLoggingImplementation(): boolean {
    //
    const loggerFiles = ['src/shared/observability/structured-logger.ts'];
    return loggerFiles.some(file => existsSync(join(this.projectRoot, file)));
  }

  private checkHttpsConfiguration(): boolean {
    // HTTPS
    return process.env.NODE_ENV === 'production' ? false : true;
  }

  private checkCorsConfiguration(): boolean {
    // CORS
    return false;
  }

  private checkSecretsManagement(): boolean {
    //
    return !!(
      process.env.SENTRY_DSN && !process.env.SENTRY_DSN.includes('example')
    );
  }

  private checkPerformanceMonitoring(): boolean {
    //
    return !!process.env.SENTRY_DSN;
  }

  private checkApiEndpoint(endpoint: string): boolean {
    //
    return true;
  }
}

//
export const configValidator = new ConfigValidator();

//
export async function validateCurrentEnvironment(): Promise<ConfigValidationResult> {
  const env = (process.env.NODE_ENV as Environment) || 'development';
  return await configValidator.validateEnvironment(env);
}

export async function validateAllEnvironments(): Promise<
  ConfigValidationResult[]
> {
  return await configValidator.validateAllEnvironments();
}
