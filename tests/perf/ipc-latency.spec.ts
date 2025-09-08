import { launchApp } from '../helpers/launch';

test('IPC 往返基线（开发机）', async () => {
  const { app: app, page: win } = await launchApp();
  const samples: number[] = [];
  for (let i = 0; i < 200; i++) {
    const t0 = Date.now();
    await win.evaluate(() => (window as any).api?.ping?.());
    samples.push(Date.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p95).toBeLessThan(10);
  expect(p99).toBeLessThan(20);
  await app.close();
});
