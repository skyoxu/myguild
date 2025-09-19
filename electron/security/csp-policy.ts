/**
 * CSP统一策略管理器
 *
 * 功能：
 * - 统一管理开发/生产环境的CSP策略
 * - 支持nonce机制增强安全性
 * - 提供策略验证和一致性检查
 * - 与现有安全基础设施集成
 */

interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'connect-src': string[];
  'font-src': string[];
  'object-src': string[];
  'frame-ancestors': string[];
  'base-uri': string[];
  'form-action': string[];
}

interface CSPConfig {
  environment: 'development' | 'production';
  nonce?: string;
  sentryDsn?: string;
}

export class CSPManager {
  private static readonly BASE_POLICY: CSPDirectives = {
    'default-src': ["'none'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'"],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
  };

  private static readonly REQUIRED_DIRECTIVES = [
    'default-src',
    'script-src',
    'object-src',
    'frame-ancestors',
    'base-uri',
  ];

  /**
   * 生成环境特定的CSP策略
   */
  static generateCSP(config: CSPConfig): string {
    const policy = { ...this.BASE_POLICY };

    // 开发环境配置
    if (config.environment === 'development') {
      policy['script-src'] = [
        "'self'",
        "'unsafe-inline'", // 开发时需要，生产环境通过nonce替代
        'localhost:*',
        '127.0.0.1:*',
      ];
      policy['connect-src'] = [
        "'self'",
        'localhost:*',
        '127.0.0.1:*',
        'ws:',
        'wss:', // Vite HMR
      ];
    }

    // Nonce支持（生产环境推荐）
    if (config.nonce) {
      policy['script-src'] = policy['script-src']
        .filter(src => src !== "'unsafe-inline'")
        .concat([`'nonce-${config.nonce}'`]);
    }

    // Sentry集成
    if (config.sentryDsn) {
      const sentryDomain = new URL(config.sentryDsn).origin;
      policy['connect-src'].push(sentryDomain, `${sentryDomain}/*`);
    }

    return this.formatPolicy(policy);
  }

  /**
   * 生成开发环境CSP（通过响应头注入）
   */
  static generateDevelopmentCSP(nonce?: string): string {
    return this.generateCSP({
      environment: 'development',
      nonce,
      sentryDsn: process.env.SENTRY_DSN,
    });
  }

  /**
   * 生成生产环境CSP（用于index.html meta标签）
   */
  static generateProductionCSP(): string {
    return this.generateCSP({
      environment: 'production',
      sentryDsn: process.env.SENTRY_DSN,
    });
  }

  /**
   * 验证CSP策略完整性
   */
  static validateCSP(csp: string): {
    isValid: boolean;
    missingDirectives: string[];
    risks: string[];
  } {
    const missingDirectives = this.REQUIRED_DIRECTIVES.filter(
      directive => !csp.includes(directive)
    );

    const risks: string[] = [];

    // 检查危险值
    if (csp.includes("'unsafe-inline'") && !csp.includes('nonce-')) {
      risks.push("使用'unsafe-inline'但未配置nonce，存在XSS风险");
    }

    if (csp.includes("'unsafe-eval'")) {
      risks.push("使用'unsafe-eval'存在代码注入风险");
    }

    if (csp.includes('*') && !csp.includes('data:')) {
      risks.push("使用通配符'*'可能过于宽松");
    }

    return {
      isValid: missingDirectives.length === 0,
      missingDirectives,
      risks,
    };
  }

  /**
   * 检查两个CSP策略的兼容性
   */
  static checkPolicyCompatibility(
    policy1: string,
    policy2: string
  ): {
    compatible: boolean;
    conflicts: string[];
    suggestions: string[];
  } {
    const conflicts: string[] = [];
    const suggestions: string[] = [];

    // 解析策略差异
    const directives1 = this.parsePolicy(policy1);
    const directives2 = this.parsePolicy(policy2);

    for (const directive of this.REQUIRED_DIRECTIVES) {
      const values1 = directives1[directive] || [];
      const values2 = directives2[directive] || [];

      if (
        values1.length !== values2.length ||
        !values1.every(val => values2.includes(val))
      ) {
        conflicts.push(
          `${directive}指令不一致: [${values1.join(', ')}] vs [${values2.join(', ')}]`
        );
      }
    }

    if (conflicts.length > 0) {
      suggestions.push('建议使用CSPManager.generateCSP()统一生成策略');
      suggestions.push('检查环境变量配置是否一致');
    }

    return {
      compatible: conflicts.length === 0,
      conflicts,
      suggestions,
    };
  }

  /**
   * 为测试环境生成最小化配置
   */
  static generateTestingConfig(): {
    cspEnabled: boolean;
    policies: string[];
    nonceGeneration: boolean;
  } {
    return {
      cspEnabled: true,
      policies: [
        "default-src 'none'",
        "script-src 'self' 'nonce-*'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ],
      nonceGeneration: true,
    };
  }

  /**
   * 格式化策略为字符串
   */
  private static formatPolicy(policy: CSPDirectives): string {
    return Object.entries(policy)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  /**
   * 解析CSP策略字符串
   */
  private static parsePolicy(csp: string): Record<string, string[]> {
    const directives: Record<string, string[]> = {};

    csp.split(';').forEach(directive => {
      const trimmed = directive.trim();
      if (trimmed) {
        const [key, ...values] = trimmed.split(' ');
        directives[key] = values;
      }
    });

    return directives;
  }
}

/**
 * CSP管理器单例
 */
export const cspManager = new CSPManager();
