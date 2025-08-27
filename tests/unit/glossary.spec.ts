/**
 * Glossary SSoT Unit Tests
 *
 * Comprehensive test suite for the glossary contracts, validating
 * term structure, translations, event naming, and SSoT integrity.
 *
 * @see docs/architecture/base/12-glossary-v2.md
 * @see src/shared/contracts/glossary.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateGlossaryTerm,
  validateEventNaming,
  validateTranslationUniqueness,
  GlossaryTerms,
  GlossaryValidators,
  GlossaryUtils,
  isGlossaryTermKey,
  getTermTranslation,
  searchTerms,
  EVENT_NAMING_EXAMPLES,
  type GlossaryTerm,
  type GlossaryTermKey,
  type TermType,
} from '../../src/shared/contracts/glossary';

describe('Glossary SSoT Contract', () => {
  describe('Core Term Validation', () => {
    it('should validate a complete and valid term', () => {
      const validTerm: GlossaryTerm = {
        term: 'CSP',
        definition: 'Content Security Policy - web security standard',
        type: 'abbr',
        zhCN: '内容安全策略',
        enUS: 'Content Security Policy',
        source: 'ADR-0002',
        owner: 'Security',
      };

      const result = validateGlossaryTerm(validTerm);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject terms with missing required fields', () => {
      const invalidTerm: GlossaryTerm = {
        term: '',
        definition: '',
        type: 'tech',
        zhCN: '',
        enUS: '',
        source: 'test',
        owner: 'test',
      };

      const result = validateGlossaryTerm(invalidTerm);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Term name is required and cannot be empty'
      );
      expect(result.errors).toContain(
        'Definition is required and cannot be empty'
      );
      expect(result.errors).toContain('Chinese translation (zhCN) is required');
      expect(result.errors).toContain('English translation (enUS) is required');
    });

    it('should reject invalid term types', () => {
      const invalidTypeTerm = {
        term: 'TestTerm',
        definition: 'Test Definition',
        type: 'invalid' as any,
        zhCN: '测试术语',
        enUS: 'Test Term',
        source: 'test',
        owner: 'test',
      };

      const result = validateGlossaryTerm(invalidTypeTerm);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Type must be one of: domain, tech, abbr'
      );
    });

    it('should warn about missing optional fields', () => {
      const termWithoutOptionals: GlossaryTerm = {
        term: 'ValidTerm',
        definition: 'A valid definition',
        type: 'domain',
        zhCN: '有效术语',
        enUS: 'Valid Term',
        source: '',
        owner: '',
      };

      const result = validateGlossaryTerm(termWithoutOptionals);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Source reference is recommended for traceability'
      );
      expect(result.warnings).toContain(
        'Owner assignment is recommended for maintenance'
      );
    });

    it('should warn about special characters in term names', () => {
      const termWithSpecialChars: GlossaryTerm = {
        term: 'Term@#$%',
        definition: 'Term with special characters',
        type: 'tech',
        zhCN: '特殊字符术语',
        enUS: 'Special Char Term',
        source: 'test',
        owner: 'test',
      };

      const result = validateGlossaryTerm(termWithSpecialChars);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Term contains special characters that may cause issues'
      );
    });

    it('should warn about very long definitions', () => {
      const longDefinition = 'A'.repeat(201); // 201 characters
      const termWithLongDef: GlossaryTerm = {
        term: 'LongTerm',
        definition: longDefinition,
        type: 'domain',
        zhCN: '长定义术语',
        enUS: 'Long Definition Term',
        source: 'test',
        owner: 'test',
      };

      const result = validateGlossaryTerm(termWithLongDef);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Definition is very long (>200 chars) - consider simplifying'
      );
    });
  });

  describe('Glossary Terms Dictionary', () => {
    it('should contain essential architectural terms', () => {
      const essentialTerms: GlossaryTermKey[] = [
        'contentSecurityPolicy',
        'ipc',
        'nfr',
        'slo',
        'crashFreeSessions',
        'architectureDecisionRecord',
        'eventBus',
        'domainEvent',
      ];

      essentialTerms.forEach(term => {
        expect(Object.keys(GlossaryTerms)).toContain(term);
        expect(GlossaryTerms[term]['en-US']).toBeTruthy();
        expect(GlossaryTerms[term]['zh-CN']).toBeTruthy();
      });
    });

    it('should have all terms with both language translations', () => {
      Object.entries(GlossaryTerms).forEach(([key, translations]) => {
        expect(translations['en-US']).toBeTruthy();
        expect(translations['zh-CN']).toBeTruthy();
        expect(typeof translations['en-US']).toBe('string');
        expect(typeof translations['zh-CN']).toBe('string');
        expect(translations['en-US'].trim()).not.toBe('');
        expect(translations['zh-CN'].trim()).not.toBe('');
      });
    });

    it('should maintain reasonable term counts', () => {
      const termCount = Object.keys(GlossaryTerms).length;
      expect(termCount).toBeGreaterThan(15); // At least 15 terms
      expect(termCount).toBeLessThan(100); // Not overwhelmingly large
    });
  });

  describe('Translation Uniqueness', () => {
    it('should not have duplicate English translations', () => {
      const result = validateTranslationUniqueness(GlossaryTerms);

      expect(result.isValid).toBe(true);
      expect(result.errors).not.toContain(
        'Duplicate English translations detected'
      );
    });

    it('should not have duplicate Chinese translations', () => {
      const result = validateTranslationUniqueness(GlossaryTerms);

      expect(result.isValid).toBe(true);
      expect(result.errors).not.toContain(
        'Duplicate Chinese translations detected'
      );
    });

    it('should detect duplicate translations when they exist', () => {
      const duplicateTerms = {
        term1: { 'en-US': 'Same Translation', 'zh-CN': '相同翻译' },
        term2: { 'en-US': 'Same Translation', 'zh-CN': '不同翻译' },
        term3: { 'en-US': 'Different Translation', 'zh-CN': '相同翻译' },
      } as const;

      const result = validateTranslationUniqueness(duplicateTerms);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Duplicate English translations detected'
      );
      expect(result.errors).toContain(
        'Duplicate Chinese translations detected'
      );
    });
  });

  describe('Event Naming Validation', () => {
    it('should validate correct event naming patterns', () => {
      const validEventNames = [
        '${DOMAIN_PREFIX}.game.scene_loaded',
        '${DOMAIN_PREFIX}.player.action_executed',
        '${DOMAIN_PREFIX}.system.error_occurred',
        'domain.entity.action',
        'app.window.created',
      ];

      validEventNames.forEach(eventName => {
        expect(validateEventNaming(eventName)).toBe(true);
      });
    });

    it('should reject invalid event naming patterns', () => {
      const invalidEventNames = [
        'invalid.format', // Only 2 segments
        'too.many.segments.here', // Too many segments
        'InvalidCase.Entity.Action', // Contains uppercase
        'domain.entity.action.extra', // Too many segments
        'domain..action', // Empty entity
        '.entity.action', // Empty domain
        'domain.entity.', // Empty action
        'domain-entity-action', // Wrong separator
        'domain entity action', // Spaces instead of dots
      ];

      invalidEventNames.forEach(eventName => {
        expect(validateEventNaming(eventName)).toBe(false);
      });
    });

    it('should validate all example event names', () => {
      Object.values(EVENT_NAMING_EXAMPLES).forEach(eventName => {
        expect(validateEventNaming(eventName)).toBe(true);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getTermTranslation', () => {
      it('should return correct translations for existing terms', () => {
        expect(getTermTranslation('contentSecurityPolicy', 'en-US')).toBe(
          'Content Security Policy'
        );
        expect(getTermTranslation('contentSecurityPolicy', 'zh-CN')).toBe(
          '内容安全策略'
        );
        expect(getTermTranslation('ipc', 'en-US')).toBe(
          'Inter-Process Communication'
        );
        expect(getTermTranslation('ipc', 'zh-CN')).toBe('进程间通信');
      });

      it('should return undefined for non-existent terms', () => {
        expect(
          getTermTranslation('nonExistentTerm' as any, 'en-US')
        ).toBeUndefined();
        expect(
          getTermTranslation('nonExistentTerm' as any, 'zh-CN')
        ).toBeUndefined();
      });
    });

    describe('searchTerms', () => {
      it('should find terms by partial English text', () => {
        const results = searchTerms('security', 'en-US');
        expect(results).toContain('contentSecurityPolicy');
      });

      it('should find terms by partial Chinese text', () => {
        const results = searchTerms('安全', 'zh-CN');
        expect(results).toContain('contentSecurityPolicy');
      });

      it('should find terms by key name', () => {
        const results = searchTerms('ipc', 'en-US');
        expect(results).toContain('ipc');
      });

      it('should be case insensitive', () => {
        const results = searchTerms('SECURITY', 'en-US');
        expect(results).toContain('contentSecurityPolicy');
      });

      it('should return empty array for no matches', () => {
        const results = searchTerms('nonexistentterm');
        expect(results).toHaveLength(0);
      });
    });

    describe('isGlossaryTermKey', () => {
      it('should return true for valid term keys', () => {
        expect(isGlossaryTermKey('contentSecurityPolicy')).toBe(true);
        expect(isGlossaryTermKey('ipc')).toBe(true);
        expect(isGlossaryTermKey('nfr')).toBe(true);
      });

      it('should return false for invalid term keys', () => {
        expect(isGlossaryTermKey('invalidKey')).toBe(false);
        expect(isGlossaryTermKey('')).toBe(false);
        expect(isGlossaryTermKey('123')).toBe(false);
      });
    });
  });

  describe('Validator Collection', () => {
    it('should export all validation functions in GlossaryValidators', () => {
      expect(GlossaryValidators.validateGlossaryTerm).toBe(
        validateGlossaryTerm
      );
      expect(GlossaryValidators.validateEventNaming).toBe(validateEventNaming);
      expect(GlossaryValidators.validateTranslationUniqueness).toBe(
        validateTranslationUniqueness
      );
    });

    it('should export all utility functions in GlossaryUtils', () => {
      expect(GlossaryUtils.getTermTranslation).toBe(getTermTranslation);
      expect(GlossaryUtils.searchTerms).toBe(searchTerms);
    });
  });

  describe('SSoT Integrity', () => {
    it('should maintain non-empty glossary', () => {
      const glossaryKeys = Object.keys(GlossaryTerms);
      expect(glossaryKeys.length).toBeGreaterThan(0);
    });

    it('should have consistent term key naming', () => {
      const glossaryKeys = Object.keys(GlossaryTerms);

      glossaryKeys.forEach(key => {
        // Keys should be camelCase
        expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/);
        // Keys should not contain spaces or special characters
        expect(key).not.toMatch(/[\s\-_]/);
      });
    });

    it('should maintain architectural terms coverage', () => {
      const architecturalCategories = {
        security: [
          'contentSecurityPolicy',
          'contextBridge',
          'contextIsolation',
          'sandboxMode',
          'ipc',
        ],
        quality: ['nfr', 'slo', 'crashFreeSessions', 'crashFreeUsers', 'tp95'],
        architecture: [
          'architectureDecisionRecord',
          'domainEvent',
          'eventBus',
          'repositoryPattern',
        ],
        development: ['hmr', 'esm', 'e2e', 'dto'],
      };

      Object.entries(architecturalCategories).forEach(([category, terms]) => {
        terms.forEach(term => {
          expect(Object.keys(GlossaryTerms)).toContain(term);
        });
      });
    });

    it('should provide SSoT functionality for event naming', () => {
      // Verify that glossary supports event naming requirements
      expect(typeof validateEventNaming).toBe('function');
      expect(EVENT_NAMING_EXAMPLES).toBeDefined();
      expect(Object.keys(EVENT_NAMING_EXAMPLES).length).toBeGreaterThan(0);
    });

    it('should support i18n requirements', () => {
      // Verify that all terms have both language variants
      Object.values(GlossaryTerms).forEach(term => {
        expect(term['en-US']).toBeDefined();
        expect(term['zh-CN']).toBeDefined();
        expect(typeof term['en-US']).toBe('string');
        expect(typeof term['zh-CN']).toBe('string');
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle glossary operations efficiently', () => {
      const startTime = performance.now();

      // Perform multiple operations
      Object.keys(GlossaryTerms).forEach(key => {
        getTermTranslation(key as GlossaryTermKey, 'en-US');
        getTermTranslation(key as GlossaryTermKey, 'zh-CN');
        isGlossaryTermKey(key);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete all operations in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle search operations efficiently', () => {
      const startTime = performance.now();

      // Perform search operations
      searchTerms('test');
      searchTerms('security');
      searchTerms('event');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete searches in reasonable time (< 50ms)
      expect(duration).toBeLessThan(50);
    });
  });
});

describe('Glossary Integration Tests', () => {
  describe('i18n Integration', () => {
    it('should provide consistent translation mapping', () => {
      Object.entries(GlossaryTerms).forEach(([key, translations]) => {
        expect(translations['en-US']).toBeTruthy();
        expect(translations['zh-CN']).toBeTruthy();
        expect(typeof translations['en-US']).toBe('string');
        expect(typeof translations['zh-CN']).toBe('string');
        expect(translations['en-US'].trim().length).toBeGreaterThan(0);
        expect(translations['zh-CN'].trim().length).toBeGreaterThan(0);
      });
    });

    it('should support reverse translation lookup', () => {
      // Test that we can find terms by their translations
      const securityPolicyKey = searchTerms('Content Security Policy', 'en-US');
      expect(securityPolicyKey).toContain('contentSecurityPolicy');

      const securityPolicyKeyZh = searchTerms('内容安全策略', 'zh-CN');
      expect(securityPolicyKeyZh).toContain('contentSecurityPolicy');
    });
  });

  describe('Event System Integration', () => {
    it('should validate event naming patterns used in the system', () => {
      const systemEventPatterns = [
        '${DOMAIN_PREFIX}.game.scene_loaded',
        '${DOMAIN_PREFIX}.player.action_executed',
        '${DOMAIN_PREFIX}.system.error_occurred',
        '${DOMAIN_PREFIX}.security.csp_violation',
        '${DOMAIN_PREFIX}.telemetry.data_sent',
      ];

      systemEventPatterns.forEach(pattern => {
        expect(validateEventNaming(pattern)).toBe(true);
      });
    });

    it('should support domain prefix placeholder validation', () => {
      // Events with domain prefix placeholders should validate
      const placeholderEvents = Object.values(EVENT_NAMING_EXAMPLES);
      placeholderEvents.forEach(eventName => {
        expect(eventName.startsWith('${DOMAIN_PREFIX}.')).toBe(true);
        expect(validateEventNaming(eventName)).toBe(true);
      });
    });
  });

  describe('Architecture Documentation Integration', () => {
    it('should align with security baseline terms (Chapter 02)', () => {
      const securityTerms = [
        'contentSecurityPolicy',
        'contextBridge',
        'contextIsolation',
        'nodeIntegration',
        'sandboxMode',
        'ipc',
      ];

      securityTerms.forEach(term => {
        expect(Object.keys(GlossaryTerms)).toContain(term);
        expect(GlossaryTerms[term as GlossaryTermKey]['en-US']).toBeTruthy();
      });
    });

    it('should align with quality goals terms (Chapter 01)', () => {
      const qualityTerms = [
        'nfr',
        'slo',
        'crashFreeSessions',
        'crashFreeUsers',
        'tp95',
        'releaseHealth',
      ];

      qualityTerms.forEach(term => {
        expect(Object.keys(GlossaryTerms)).toContain(term);
        expect(GlossaryTerms[term as GlossaryTermKey]['en-US']).toBeTruthy();
      });
    });

    it('should support Base-Clean placeholder pattern', () => {
      // All example events should use placeholder patterns
      Object.values(EVENT_NAMING_EXAMPLES).forEach(eventName => {
        expect(eventName).toMatch(/\$\{[A-Z_]+\}/);
      });
    });
  });
});
