'use strict';
/**
 * 轻量参数校验与类型守卫（占位）
 * 符合 ADR-0002/0005：仅用于最小必要的运行时校验与测试。
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.ensureString = ensureString;
exports.ensureBoolean = ensureBoolean;
exports.ensurePlainObject = ensurePlainObject;
exports.sanitizeChannel = sanitizeChannel;
function ensureString(v, name) {
  if (typeof v !== 'string') throw new TypeError(`${name} must be a string`);
  return v;
}
function ensureBoolean(v, name) {
  if (typeof v !== 'boolean') throw new TypeError(`${name} must be a boolean`);
  return v;
}
function ensurePlainObject(v, name) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return v;
}
/** 限制 IPC/频道名（占位） */
function sanitizeChannel(name) {
  const n = ensureString(name, 'channel');
  if (!/^[a-z][a-z0-9:_-]{2,63}$/i.test(n)) {
    throw new TypeError('channel contains invalid characters');
  }
  return n;
}
