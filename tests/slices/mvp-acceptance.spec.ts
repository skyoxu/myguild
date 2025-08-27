import { describe, it, expect } from 'vitest';
import { createGuildFlow } from '../../src/slices/mvp/flow';

describe('08 MVP 纵切', () => {
  it('创建公会', async () => {
    const g = await createGuildFlow('Alpha');
    expect(g.name).toBe('Alpha');
    expect(g.id).toBeTruthy();
  });
});
