/**
 * Electron安全基线契约定义
 * 对应文档：02-安全基线(Electron)-v2.md
 * 引用ADR: ADR-0002 (Electron安全基线), ADR-0005 (质量门禁)
 *
 * 本文件定义了Electron应用安全配置的TypeScript类型和接口，
 * 确保编译时类型安全和运行时配置验证的一致性。
 */

// =============================================================================
// 核心安全配置类型
// =============================================================================

/**
 * Electron安全窗口配置选项
 * 强制执行安全基线要求：nodeIntegration=false, contextIsolation=true, sandbox=true
 */
export interface SafeWindowOptions {
  readonly nodeIntegration: false; // 硬约束：必须为false
  readonly contextIsolation: true; // 硬约束：必须为true
  readonly sandbox: true; // 硬约束：必须为true
  readonly webSecurity: true; // 启用Web安全
  readonly allowRunningInsecureContent: false; // 禁用混合内容
  readonly experimentalFeatures?: false; // 可选：禁用实验性功能
  readonly enableBlinkFeatures?: never; // 禁用Blink特性
  readonly preload?: string; // 可选：预加载脚本路径
  readonly partition?: string; // 可选：会话分区
  readonly session?: never; // 禁用自定义session
  readonly nodeIntegrationInWorker?: false; // Worker中禁用Node集成
  readonly nodeIntegrationInSubFrames?: false; // 子框架中禁用Node集成
}

/**
 * 类型验证器：确保配置符合安全基线
 */
export type SecurityConfigValidator<T> = T extends SafeWindowOptions
  ? T
  : never;

/**
 * 有效的安全配置类型别名
 */
export type ValidSecurityConfig = SecurityConfigValidator<SafeWindowOptions>;

// =============================================================================
// CSP (Content Security Policy) 相关类型
// =============================================================================

/**
 * CSP指令类型定义
 */
export type CspDirectiveName =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'font-src'
  | 'connect-src'
  | 'media-src'
  | 'object-src'
  | 'child-src'
  | 'frame-src'
  | 'worker-src'
  | 'manifest-src'
  | 'base-uri'
  | 'form-action'
  | 'frame-ancestors';

/**
 * CSP值类型
 */
export type CspValue =
  | "'self'"
  | "'none'"
  | "'unsafe-inline'"
  | "'unsafe-eval'"
  | 'data:'
  | 'blob:'
  | 'ws:'
  | 'wss:'
  | string; // 用于域名和URL

/**
 * CSP指令配置
 */
export interface CspDirective {
  readonly name: CspDirectiveName;
  readonly values: readonly CspValue[];
  readonly allowUnsafe?: boolean;
}

/**
 * 完整的CSP策略定义
 */
export interface CSPPolicy {
  readonly directives: readonly CspDirective[];
  readonly environment: 'development' | 'production' | 'test';
  readonly reportUri?: string;
  readonly reportTo?: string;
  readonly upgradeInsecureRequests?: boolean;
  readonly blockAllMixedContent?: boolean;
}

/**
 * 预定义的生产环境CSP策略
 */
export const PRODUCTION_CSP_POLICY: CSPPolicy = {
  environment: 'production',
  reportUri: '/api/csp-report',
  upgradeInsecureRequests: true,
  blockAllMixedContent: true,
  directives: [
    { name: 'default-src', values: ["'self'"] },
    { name: 'script-src', values: ["'self'"] },
    { name: 'style-src', values: ["'self'", "'unsafe-inline'"] }, // Tailwind CSS需要
    { name: 'img-src', values: ["'self'", 'data:', 'blob:'] },
    { name: 'font-src', values: ["'self'", 'data:'] },
    { name: 'connect-src', values: ["'self'", 'wss:'] },
    { name: 'media-src', values: ["'self'", 'blob:'] },
    { name: 'object-src', values: ["'none'"] },
    { name: 'child-src', values: ["'none'"] },
    { name: 'frame-src', values: ["'none'"] },
    { name: 'worker-src', values: ["'self'"] },
    { name: 'base-uri', values: ["'self'"] },
    { name: 'form-action', values: ["'none'"] },
    { name: 'frame-ancestors', values: ["'none'"] },
  ],
} as const;

/**
 * CSP违规报告接口
 */
export interface CspViolationReport {
  readonly documentUri: string;
  readonly referrer: string;
  readonly violatedDirective: string;
  readonly effectiveDirective: string;
  readonly originalPolicy: string;
  readonly disposition: string;
  readonly blockedUri: string;
  readonly statusCode: number;
  readonly timestamp: number;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly sourceFile?: string;
}

// =============================================================================
// IPC (Inter-Process Communication) 安全类型
// =============================================================================

/**
 * IPC通道命名空间
 */
export type IpcChannelNamespace =
  | 'app'
  | 'game'
  | 'telemetry'
  | 'security'
  | 'system';

/**
 * IPC通道动作
 */
export type IpcChannelAction = string;

/**
 * IPC通道名称（强制命名空间:动作格式）
 */
export type IpcChannelName = `${IpcChannelNamespace}:${IpcChannelAction}`;

/**
 * IPC请求接口
 */
export interface IpcRequest<TPayload = unknown> {
  readonly channel: IpcChannelName;
  readonly payload: TPayload;
  readonly requestId?: string;
  readonly timestamp?: number;
}

/**
 * IPC响应接口
 */
export interface IpcResponse<TData = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: string;
  readonly requestId?: string;
  readonly timestamp: number;
}

/**
 * IPC契约定义
 */
export interface IpcContract<TRequest = unknown, TResponse = unknown> {
  readonly channel: IpcChannelName;
  readonly requestSchema?: TRequest;
  readonly responseSchema?: TResponse;
  readonly timeout?: number;
  readonly rateLimit?: {
    readonly maxRequests: number;
    readonly windowMs: number;
  };
}

/**
 * 预加载脚本暴露的API白名单定义
 */
export interface PreloadExportsWhitelist {
  readonly app: {
    readonly getVersion: () => Promise<string>;
    readonly getPlatform: () => Promise<NodeJS.Platform>;
    readonly getLocale: () => Promise<string>;
    readonly getName: () => Promise<string>;
  };

  readonly game: {
    readonly save: (data: unknown) => Promise<IpcResponse<boolean>>;
    readonly load: () => Promise<IpcResponse<unknown>>;
    readonly exportData: (format: 'json' | 'csv') => Promise<IpcResponse<Blob>>;
    readonly importData: (
      data: string,
      format: 'json' | 'csv'
    ) => Promise<IpcResponse<boolean>>;
  };

  readonly telemetry: {
    readonly track: (
      event: string,
      properties?: Record<string, unknown>
    ) => Promise<IpcResponse<void>>;
    readonly flush: () => Promise<IpcResponse<void>>;
    readonly setUserId: (userId: string) => Promise<IpcResponse<void>>;
  };

  readonly security: {
    readonly reportViolation: (
      violation: SecurityViolation
    ) => Promise<IpcResponse<void>>;
    readonly getSecurityStatus: () => Promise<IpcResponse<SecurityStatus>>;
    readonly updateSecurityPolicy: (
      policy: Partial<SecurityPolicy>
    ) => Promise<IpcResponse<boolean>>;
  };
}

// =============================================================================
// 安全违规和监控类型
// =============================================================================

/**
 * 安全违规类型
 */
export type SecurityViolationType =
  | 'csp-violation'
  | 'unauthorized-navigation'
  | 'popup-blocked'
  | 'unsafe-script-execution'
  | 'node-api-access-attempt'
  | 'ipc-rate-limit-exceeded'
  | 'unauthorized-ipc-channel'
  | 'preload-injection-attempt';

/**
 * 安全违规报告
 */
export interface SecurityViolation {
  readonly type: SecurityViolationType;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: number;
  readonly userAgent?: string;
  readonly url?: string;
  readonly stackTrace?: string;
}

/**
 * 安全状态监控
 */
export interface SecurityStatus {
  readonly secure: boolean;
  readonly violations: {
    readonly total: number;
    readonly byType: Record<SecurityViolationType, number>;
    readonly bySeverity: Record<'low' | 'medium' | 'high' | 'critical', number>;
    readonly recent: readonly SecurityViolation[];
  };
  readonly lastCheck: number;
  readonly configurationValid: boolean;
  readonly activePolicies: readonly string[];
}

/**
 * 安全策略配置
 */
export interface SecurityPolicy {
  readonly csp: CSPPolicy;
  readonly windowConfig: SafeWindowOptions;
  readonly ipcWhitelist: readonly IpcChannelName[];
  readonly rateLimits: Record<
    string,
    { maxRequests: number; windowMs: number }
  >;
  readonly logging: {
    readonly enabled: boolean;
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly reportViolations: boolean;
  };
}

// =============================================================================
// 门禁和验证类型
// =============================================================================

/**
 * 安全门禁状态
 */
export type SecurityGateStatus = 'pass' | 'fail' | 'warning' | 'pending';

/**
 * 安全门禁结果
 */
export interface SecurityGateResult {
  readonly name: string;
  readonly status: SecurityGateStatus;
  readonly score?: number;
  readonly details: readonly string[];
  readonly timestamp: number;
  readonly requirement?: string;
}

/**
 * 完整的安全审计结果
 */
export interface SecurityAuditResult {
  readonly overall: SecurityGateStatus;
  readonly gates: readonly SecurityGateResult[];
  readonly summary: {
    readonly passed: number;
    readonly failed: number;
    readonly warnings: number;
    readonly total: number;
  };
  readonly recommendations: readonly string[];
  readonly timestamp: number;
}

// =============================================================================
// 配置验证工具函数类型
// =============================================================================

/**
 * 配置验证函数签名
 */
export type ConfigValidator<T> = (config: T) => {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
};

/**
 * 安全配置验证器
 */
export type SecurityConfigValidator_Fn = ConfigValidator<SafeWindowOptions>;

/**
 * CSP配置验证器
 */
export type CspConfigValidator = ConfigValidator<CSPPolicy>;

/**
 * IPC配置验证器
 */
export type IpcConfigValidator = ConfigValidator<readonly IpcChannelName[]>;

// =============================================================================
// 实用工具类型
// =============================================================================

/**
 * 只读深度类型工具
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 安全配置的深度只读版本
 */
export type ImmutableSecurityConfig = DeepReadonly<SecurityPolicy>;

/**
 * 部分安全配置（用于更新）
 */
export type PartialSecurityConfig = Partial<{
  [K in keyof SecurityPolicy]: Partial<SecurityPolicy[K]>;
}>;

// =============================================================================
// 常量和默认值
// =============================================================================

/**
 * 默认的IPC白名单
 */
export const DEFAULT_IPC_WHITELIST: readonly IpcChannelName[] = [
  'app:getVersion',
  'app:getPlatform',
  'app:getLocale',
  'app:getName',
  'game:save',
  'game:load',
  'game:exportData',
  'game:importData',
  'telemetry:track',
  'telemetry:flush',
  'telemetry:setUserId',
  'security:reportViolation',
  'security:getSecurityStatus',
  'system:ping',
] as const;

/**
 * 默认速率限制配置
 */
export const DEFAULT_RATE_LIMITS: Record<
  string,
  { maxRequests: number; windowMs: number }
> = {
  'app:*': { maxRequests: 10, windowMs: 60000 }, // 应用信息类：每分钟10次
  'game:*': { maxRequests: 30, windowMs: 60000 }, // 游戏数据类：每分钟30次
  'telemetry:*': { maxRequests: 100, windowMs: 60000 }, // 遥测数据：每分钟100次
  'security:*': { maxRequests: 20, windowMs: 60000 }, // 安全相关：每分钟20次
  'system:*': { maxRequests: 5, windowMs: 60000 }, // 系统级别：每分钟5次
} as const;

/**
 * 默认安全策略
 */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  csp: PRODUCTION_CSP_POLICY,
  windowConfig: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
  },
  ipcWhitelist: DEFAULT_IPC_WHITELIST,
  rateLimits: DEFAULT_RATE_LIMITS,
  logging: {
    enabled: true,
    level: 'warn',
    reportViolations: true,
  },
} as const;

// =============================================================================
// 类型导出 (已在上方直接导出，此处仅作文档参考)
// =============================================================================

// 注意：所有类型都已在定义处直接导出，无需重复导出
// 主要导出的类型包括：
// - 核心配置: SafeWindowOptions, ValidSecurityConfig
// - CSP相关: CspDirectiveName, CspValue, CspDirective, CSPPolicy, CspViolationReport
// - IPC相关: IpcChannelNamespace, IpcChannelAction, IpcChannelName, IpcRequest, IpcResponse, IpcContract, PreloadExportsWhitelist
// - 安全监控: SecurityViolationType, SecurityViolation, SecurityStatus, SecurityPolicy
// - 门禁验证: SecurityGateStatus, SecurityGateResult, SecurityAuditResult
// - 验证器: ConfigValidator, SecurityConfigValidator_Fn, CspConfigValidator, IpcConfigValidator
// - 工具类型: DeepReadonly, ImmutableSecurityConfig, PartialSecurityConfig
// - 常量: PRODUCTION_CSP_POLICY, DEFAULT_IPC_WHITELIST, DEFAULT_RATE_LIMITS, DEFAULT_SECURITY_POLICY
