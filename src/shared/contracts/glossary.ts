/**
 * Glossary SSoT (Single Source of Truth) Contract
 *
 * This file provides TypeScript contracts for the project glossary,
 * serving as the authoritative source for terminology definitions,
 * translations, and validation logic.
 *
 * @see docs/architecture/base/12-glossary-v2.md
 */

// =============================================================================
// Core Types
// =============================================================================

export type TermType = 'domain' | 'tech' | 'abbr';

export interface GlossaryTerm {
  readonly term: string;
  readonly definition: string;
  readonly type: TermType;
  readonly zhCN: string;
  readonly enUS: string;
  readonly source: string;
  readonly owner: string;
}

export interface GlossaryValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// =============================================================================
// Glossary Terms Definition (SSoT)
// =============================================================================

/**
 * Central glossary terms with translations
 *
 * Each key represents a camelCase/PascalCase version of the term,
 * with values containing English and Chinese translations.
 */
export const GlossaryTerms = {
  // Technical Terms (tech)
  architectureDecisionRecord: {
    'en-US': 'Architecture Decision Record',
    'zh-CN': '架构决策记录',
  },
  contentSecurityPolicy: {
    'en-US': 'Content Security Policy',
    'zh-CN': '内容安全策略',
  },
  contextBridge: {
    'en-US': 'Context Bridge',
    'zh-CN': '上下文桥接',
  },
  contextIsolation: {
    'en-US': 'Context Isolation',
    'zh-CN': '上下文隔离',
  },
  nodeIntegration: {
    'en-US': 'Node Integration',
    'zh-CN': 'Node集成',
  },
  sandboxMode: {
    'en-US': 'Sandbox Mode',
    'zh-CN': '沙箱模式',
  },
  sentryPlatform: {
    'en-US': 'Sentry Platform',
    'zh-CN': 'Sentry平台',
  },
  traceIdentifier: {
    'en-US': 'Trace Identifier',
    'zh-CN': '追踪标识',
  },
  webView: {
    'en-US': 'Web View',
    'zh-CN': 'Web视图',
  },

  // Domain Terms (domain)
  crashFreeSessions: {
    'en-US': 'Crash-Free Sessions',
    'zh-CN': '无崩溃会话率',
  },
  crashFreeUsers: {
    'en-US': 'Crash-Free Users',
    'zh-CN': '无崩溃用户率',
  },
  domainEvent: {
    'en-US': 'Domain Event',
    'zh-CN': '领域事件',
  },
  eventBus: {
    'en-US': 'Event Bus',
    'zh-CN': '事件总线',
  },
  gameLoop: {
    'en-US': 'Game Loop',
    'zh-CN': '游戏循环',
  },
  releaseHealth: {
    'en-US': 'Release Health',
    'zh-CN': '发布健康度',
  },
  repositoryPattern: {
    'en-US': 'Repository Pattern',
    'zh-CN': '仓储模式',
  },

  // Abbreviations (abbr)
  adr: {
    'en-US': 'ADR',
    'zh-CN': 'ADR',
  },
  csp: {
    'en-US': 'CSP',
    'zh-CN': 'CSP',
  },
  dto: {
    'en-US': 'Data Transfer Object',
    'zh-CN': '数据传输对象',
  },
  e2e: {
    'en-US': 'End-to-End Testing',
    'zh-CN': '端到端测试',
  },
  esm: {
    'en-US': 'ECMAScript Modules',
    'zh-CN': 'ES模块',
  },
  hmr: {
    'en-US': 'Hot Module Replacement',
    'zh-CN': '热模块替换',
  },
  ipc: {
    'en-US': 'Inter-Process Communication',
    'zh-CN': '进程间通信',
  },
  nfr: {
    'en-US': 'Non-Functional Requirement',
    'zh-CN': '非功能性需求',
  },
  slo: {
    'en-US': 'Service Level Objective',
    'zh-CN': '服务级别目标',
  },
  ssot: {
    'en-US': 'Single Source of Truth',
    'zh-CN': '单一可信来源',
  },
  tp95: {
    'en-US': '95th Percentile',
    'zh-CN': '95百分位',
  },
} as const;

export type GlossaryTermKey = keyof typeof GlossaryTerms;

// =============================================================================
// Event Naming Constants
// =============================================================================

/**
 * Event naming pattern validation
 * Format: ${DOMAIN_PREFIX}.${entity}.${action}
 */
export const EVENT_NAMING_PATTERN = /^[a-z_]+\.[a-z_]+\.[a-z_]+$/;

/**
 * Example event names for validation and documentation
 */
export const EVENT_NAMING_EXAMPLES = {
  // Game domain events
  gameSceneLoadStart: '${DOMAIN_PREFIX}.game.scene_load_start',
  gameSceneLoadComplete: '${DOMAIN_PREFIX}.game.scene_load_complete',
  playerActionExecuted: '${DOMAIN_PREFIX}.player.action_executed',

  // System domain events
  systemErrorOccurred: '${DOMAIN_PREFIX}.system.error_occurred',
  systemTelemetrySent: '${DOMAIN_PREFIX}.system.telemetry_sent',
  appWindowCreated: '${DOMAIN_PREFIX}.app.window_created',

  // Security domain events
  securityCspViolation: '${DOMAIN_PREFIX}.security.csp_violation',
  securityIpcBlocked: '${DOMAIN_PREFIX}.security.ipc_blocked',
} as const;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates a glossary term structure and content
 *
 * @param term - The glossary term to validate
 * @returns Validation result with errors and warnings
 */
export function validateGlossaryTerm(
  term: GlossaryTerm
): GlossaryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (!term.term?.trim()) {
    errors.push('Term name is required and cannot be empty');
  }

  if (!term.definition?.trim()) {
    errors.push('Definition is required and cannot be empty');
  }

  if (!['domain', 'tech', 'abbr'].includes(term.type)) {
    errors.push('Type must be one of: domain, tech, abbr');
  }

  if (!term.zhCN?.trim()) {
    errors.push('Chinese translation (zhCN) is required');
  }

  if (!term.enUS?.trim()) {
    errors.push('English translation (enUS) is required');
  }

  // Optional field warnings
  if (!term.source?.trim()) {
    warnings.push('Source reference is recommended for traceability');
  }

  if (!term.owner?.trim()) {
    warnings.push('Owner assignment is recommended for maintenance');
  }

  // Format validation
  if (term.term && !/^[A-Za-z0-9\s\-_]+$/.test(term.term)) {
    warnings.push('Term contains special characters that may cause issues');
  }

  // Length validation
  if (term.definition && term.definition.length > 200) {
    warnings.push(
      'Definition is very long (>200 chars) - consider simplifying'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates event naming against the standard pattern
 *
 * @param eventName - The event name to validate
 * @returns True if the event name follows the correct pattern
 */
export function validateEventNaming(eventName: string): boolean {
  // Handle placeholder patterns by replacing ${DOMAIN_PREFIX} with a valid placeholder
  const normalizedName = eventName.replace(
    /\$\{DOMAIN_PREFIX\}/g,
    'app_domain'
  );
  return EVENT_NAMING_PATTERN.test(normalizedName);
}

/**
 * Validates that all glossary terms have unique translations
 *
 * @param terms - The glossary terms object to validate
 * @returns Validation result indicating uniqueness
 */
export function validateTranslationUniqueness(
  terms: typeof GlossaryTerms
): GlossaryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const englishValues = Object.values(terms).map(t => t['en-US']);
  const chineseValues = Object.values(terms).map(t => t['zh-CN']);

  const uniqueEnglish = new Set(englishValues);
  const uniqueChinese = new Set(chineseValues);

  if (englishValues.length !== uniqueEnglish.size) {
    errors.push('Duplicate English translations detected');
  }

  if (chineseValues.length !== uniqueChinese.size) {
    errors.push('Duplicate Chinese translations detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Gets a term translation by key and language
 *
 * @param key - The glossary term key
 * @param language - The target language
 * @returns The translation or undefined if not found
 */
export function getTermTranslation(
  key: GlossaryTermKey,
  language: 'en-US' | 'zh-CN'
): string | undefined {
  return GlossaryTerms[key]?.[language];
}

/**
 * Searches for terms by partial text match
 *
 * @param query - The search query
 * @param language - The language to search in
 * @returns Array of matching term keys
 */
export function searchTerms(
  query: string,
  language: 'en-US' | 'zh-CN' = 'en-US'
): GlossaryTermKey[] {
  const lowerQuery = query.toLowerCase();

  return (Object.keys(GlossaryTerms) as GlossaryTermKey[]).filter(key => {
    const translation = GlossaryTerms[key][language].toLowerCase();
    return (
      translation.includes(lowerQuery) || key.toLowerCase().includes(lowerQuery)
    );
  });
}

// =============================================================================
// Export Collections
// =============================================================================

/**
 * All validation functions for external use
 */
export const GlossaryValidators = {
  validateGlossaryTerm,
  validateEventNaming,
  validateTranslationUniqueness,
} as const;

/**
 * All utility functions for external use
 */
export const GlossaryUtils = {
  getTermTranslation,
  searchTerms,
} as const;

/**
 * Type guard to check if a string is a valid glossary term key
 */
export function isGlossaryTermKey(key: string): key is GlossaryTermKey {
  return key in GlossaryTerms;
}

/**
 * Get all term keys by type
 */
export function getTermKeysByType(type: TermType): GlossaryTermKey[] {
  // This would require additional metadata structure in a real implementation
  // For now, return all keys as this requires manual categorization
  return Object.keys(GlossaryTerms) as GlossaryTermKey[];
}
