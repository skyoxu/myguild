import { describe, it, expect } from 'vitest';
import {
  ensureString,
  ensureBoolean,
  ensurePlainObject,
  sanitizeChannel,
} from '../../src/shared/contracts/validation';

describe('validation (lightweight placeholders)', () => {
  it('ensureString works', () => {
    expect(ensureString('ok', 'x')).toBe('ok');
    expect(() => ensureString(123 as any, 'x')).toThrow();
  });
  it('ensureBoolean works', () => {
    expect(ensureBoolean(true, 'b')).toBe(true);
    expect(() => ensureBoolean('no' as any, 'b')).toThrow();
  });
  it('ensurePlainObject works', () => {
    expect(ensurePlainObject({ a: 1 }, 'o')).toEqual({ a: 1 });
    expect(() => ensurePlainObject(null as any, 'o')).toThrow();
    expect(() => ensurePlainObject([] as any, 'o')).toThrow();
  });
  it('sanitizeChannel enforces pattern', () => {
    expect(sanitizeChannel('app:window:bring-to-front')).toBe(
      'app:window:bring-to-front'
    );
    expect(() => sanitizeChannel('Bad Space')).toThrow();
  });
});
