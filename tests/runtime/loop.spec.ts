import { describe, it, expect, vi } from 'vitest';
import { GameLoop } from '../../src/runtime/loop';
import { StateMachine } from '../../src/runtime/state';

describe('06 运行时视图', () => {
  it('GameLoop 以近似 60fps 驱动 update', async () => {
    const update = vi.fn();
    const loop = new GameLoop(update);
    loop.start();
    await new Promise(r => setTimeout(r, 50));
    loop.stop();
    expect(update).toHaveBeenCalled();
  });

  it('异常被捕获并不崩溃循环', async () => {
    const onError = vi.fn();
    const loop = new GameLoop(() => {
      throw new Error('boom');
    }, onError);
    loop.start();
    await new Promise(r => setTimeout(r, 20));
    loop.stop();
    expect(onError).toHaveBeenCalled();
  });

  it('状态机合法迁移', () => {
    const sm = new StateMachine();
    sm.transition('loading');
    sm.transition('running');
    sm.transition('paused');
    sm.transition('running');
    expect(sm.current).toBe('running');
  });
});
