import { describe, it, expect } from 'vitest';
import { _isAllowedNavigation } from '../../electron/security';

describe('electron/security param guard placeholders', () => {
  it('_isAllowedNavigation allows app:// and file:// and localhost', () => {
    expect(_isAllowedNavigation('app://bundle/index.html')).toBe(true);
    expect(_isAllowedNavigation('file://C:/app/index.html')).toBe(true);
    expect(_isAllowedNavigation('https://localhost/app')).toBe(true);
    expect(_isAllowedNavigation('https://127.0.0.1/app')).toBe(true);
  });
  it('_isAllowedNavigation blocks external by default', () => {
    expect(_isAllowedNavigation('https://example.com')).toBe(false);
  });
});
