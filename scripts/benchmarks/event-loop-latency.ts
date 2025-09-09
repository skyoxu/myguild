import { monitorEventLoopDelay } from 'node:perf_hooks';

export interface LagStats {
  mean: number;
  p95: number;
  p99: number;
  max: number;
}

export async function measureEventLoopLag(ms = 200): Promise<LagStats> {
  const h = monitorEventLoopDelay({ resolution: 1 });
  h.enable();
  await new Promise(r => setTimeout(r, ms));
  h.disable();
  return {
    mean: Number(h.mean / 1e6),
    p95: Number(h.percentiles.get(95) / 1e6),
    p99: Number(h.percentiles.get(99) / 1e6),
    max: Number(h.max / 1e6),
  };
}

// 当脚本直接运行时执行基准测试
if (import.meta.url === `file://${process.argv[1]}`) {
  async function runBenchmark() {
    console.log('🔍 开始事件循环延迟基准测试...');

    try {
      const stats = await measureEventLoopLag(1000); // 测试1秒

      console.log('📊 事件循环延迟统计:');
      console.log(`  平均延迟: ${stats.mean.toFixed(2)}ms`);
      console.log(`  P95延迟: ${stats.p95.toFixed(2)}ms`);
      console.log(`  P99延迟: ${stats.p99.toFixed(2)}ms`);
      console.log(`  最大延迟: ${stats.max.toFixed(2)}ms`);

      // 基本性能阈值检查
      if (stats.p95 > 100) {
        console.warn(`⚠️  P95延迟较高: ${stats.p95.toFixed(2)}ms > 100ms`);
      }

      if (stats.p99 > 200) {
        console.warn(`⚠️  P99延迟较高: ${stats.p99.toFixed(2)}ms > 200ms`);
      }

      console.log('✅ 事件循环延迟基准测试完成');
    } catch (error) {
      console.error('❌ 基准测试失败:', error);
      process.exit(1);
    }
  }

  runBenchmark();
}
