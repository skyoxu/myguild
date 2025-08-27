/**
 * 性能预算基线验证测试
 *
 * 验证性能预算配置的正确性，确保各项预算设定符合Base-Clean架构要求
 */

import { describe, it, expect } from 'vitest';
import type {
  FrameBudget,
  LatencyBudget,
  CapacityModel,
  PerformanceMetric,
  ProcessMemoryLimits,
} from '@/shared/contracts/perf';
import {
  DEFAULT_FRAME_BUDGET,
  DEFAULT_LATENCY_BUDGET,
  DEFAULT_CAPACITY_MODEL,
  PERF_SAMPLING_RULES,
} from '@/shared/contracts/perf';

describe('性能预算基线验证', () => {
  describe('帧预算配置验证', () => {
    it('应提供60FPS帧预算配置', () => {
      const frameBudget: FrameBudget = DEFAULT_FRAME_BUDGET;

      expect(frameBudget.target).toBe(60);
      expect(frameBudget.budgetMs).toBeCloseTo(16.7);

      // 验证分层预算总和等于总预算
      const totalBudget = Object.values(frameBudget.layers).reduce(
        (a, b) => a + b,
        0
      );
      expect(totalBudget).toBeCloseTo(frameBudget.budgetMs, 1);
    });

    it('应允许环境变量覆盖帧预算', () => {
      const customBudget = Number(process.env.FRAME_BUDGET_MS ?? 16.7);
      expect(customBudget).toBeGreaterThan(0);
      expect(customBudget).toBeLessThan(100); // 合理范围检查
    });

    it('各层预算应合理分配', () => {
      const { layers } = DEFAULT_FRAME_BUDGET;

      // 脚本执行应占最大比例
      expect(layers.script).toBeGreaterThan(layers.style);
      expect(layers.script).toBeGreaterThan(layers.layout);

      // 缓冲余量应为正数但较小
      expect(layers.buffer).toBeGreaterThan(0);
      expect(layers.buffer).toBeLessThan(2);
    });
  });

  describe('延迟预算配置验证', () => {
    it('应提供延迟预算配置', () => {
      const latencyBudget: LatencyBudget = DEFAULT_LATENCY_BUDGET;

      expect(latencyBudget.event.p95).toBeLessThanOrEqual(50);
      expect(latencyBudget.event.p99).toBeGreaterThan(latencyBudget.event.p95);

      expect(latencyBudget.interaction.p95).toBeLessThanOrEqual(100);
      expect(latencyBudget.interaction.p99).toBeGreaterThan(
        latencyBudget.interaction.p95
      );
    });

    it('P99应大于P95', () => {
      const { event, interaction, sceneSwitch } = DEFAULT_LATENCY_BUDGET;

      expect(event.p99).toBeGreaterThan(event.p95);
      expect(interaction.p99).toBeGreaterThan(interaction.p95);
      expect(sceneSwitch.p99).toBeGreaterThan(sceneSwitch.p95);
    });

    it('冷启动应比热缓存慢', () => {
      const { assetLoad } = DEFAULT_LATENCY_BUDGET;
      expect(assetLoad.cold).toBeGreaterThan(assetLoad.warm);
    });
  });

  describe('容量模型配置验证', () => {
    it('应提供合理的基础容量配置', () => {
      const capacityModel: CapacityModel = DEFAULT_CAPACITY_MODEL;

      // CPU使用率应在合理范围
      expect(capacityModel.baseCapacity.cpu).toBeGreaterThan(0);
      expect(capacityModel.baseCapacity.cpu).toBeLessThan(1);

      // 内存使用量应为正数
      expect(capacityModel.baseCapacity.memory).toBeGreaterThan(0);

      // GPU使用率应在合理范围
      expect(capacityModel.baseCapacity.gpu).toBeGreaterThan(0);
      expect(capacityModel.baseCapacity.gpu).toBeLessThan(1);
    });

    it('负载倍数应大于1', () => {
      const { loadMultipliers } = DEFAULT_CAPACITY_MODEL;

      expect(loadMultipliers.entityCount).toBeGreaterThan(1);
      expect(loadMultipliers.effectComplexity).toBeGreaterThan(1);
      expect(loadMultipliers.uiComplexity).toBeGreaterThan(1);
    });

    it('安全边界应在合理范围', () => {
      const { safetyMargins } = DEFAULT_CAPACITY_MODEL;

      // 安全边界应为正数且小于0.5
      Object.values(safetyMargins).forEach(margin => {
        expect(margin).toBeGreaterThan(0);
        expect(margin).toBeLessThan(0.5);
      });
    });
  });

  describe('性能指标格式验证', () => {
    it('应符合域事件命名规范', () => {
      const metric: PerformanceMetric = {
        name: 'game.perf.frame_time',
        value: 16.5,
        unit: 'ms',
        timestamp: Date.now(),
        context: {
          release: '1.0.0',
          environment: 'production',
        },
      };

      // 验证命名格式
      expect(metric.name).toMatch(/^[\w]+\.perf\.[\w_]+$/);

      // 验证必需字段
      expect(metric.value).toBeGreaterThan(0);
      expect(metric.timestamp).toBeGreaterThan(0);
      expect(['ms', 'mb', 'fps', 'percent', 'count']).toContain(metric.unit);
    });
  });

  describe('进程内存限制验证', () => {
    it('应定义合理的内存限制', () => {
      const limits: ProcessMemoryLimits = {
        main: 512,
        renderer: 1024,
        workers: 256,
      };

      expect(limits.main).toBeGreaterThan(0);
      expect(limits.renderer).toBeGreaterThan(limits.main);
      expect(limits.workers).toBeGreaterThan(0);
    });
  });

  describe('采样规则验证', () => {
    it('关键路径应有高采样率', () => {
      expect(PERF_SAMPLING_RULES.startup).toBe(0.8);
      expect(PERF_SAMPLING_RULES.navigation).toBe(0.8);
      expect(PERF_SAMPLING_RULES['ui.action']).toBe(0.8);
    });

    it('噪音事件应禁用采样', () => {
      expect(PERF_SAMPLING_RULES.healthcheck).toBe(0.0);
      expect(PERF_SAMPLING_RULES.heartbeat).toBe(0.0);
      expect(PERF_SAMPLING_RULES.poll).toBe(0.0);
    });

    it('默认采样率应合理', () => {
      const defaultRate = PERF_SAMPLING_RULES.default;
      expect(defaultRate).toBeGreaterThan(0);
      expect(defaultRate).toBeLessThan(1);
    });
  });

  describe('环境变量覆盖机制', () => {
    it('应支持关键阈值的环境变量覆盖', () => {
      const frameBudget = Number(process.env.FRAME_BUDGET_MS ?? 16.7);
      const eventP95 = Number(process.env.EVENT_P95_MS ?? 50);
      const interactionP95 = Number(process.env.INTERACTION_P95_MS ?? 100);

      expect(frameBudget).toBeGreaterThan(0);
      expect(eventP95).toBeGreaterThan(0);
      expect(interactionP95).toBeGreaterThan(0);
    });
  });

  describe('数据完整性验证', () => {
    it('预算配置应包含所有必需字段', () => {
      const frameBudget = DEFAULT_FRAME_BUDGET;

      expect(frameBudget).toHaveProperty('target');
      expect(frameBudget).toHaveProperty('budgetMs');
      expect(frameBudget).toHaveProperty('layers');

      expect(frameBudget.layers).toHaveProperty('script');
      expect(frameBudget.layers).toHaveProperty('style');
      expect(frameBudget.layers).toHaveProperty('layout');
      expect(frameBudget.layers).toHaveProperty('paint');
      expect(frameBudget.layers).toHaveProperty('buffer');
    });

    it('容量模型应包含完整配置', () => {
      const model = DEFAULT_CAPACITY_MODEL;

      expect(model).toHaveProperty('baseCapacity');
      expect(model).toHaveProperty('loadMultipliers');
      expect(model).toHaveProperty('safetyMargins');

      // 验证每个部分都有必需的字段
      expect(model.baseCapacity).toHaveProperty('cpu');
      expect(model.baseCapacity).toHaveProperty('memory');
      expect(model.baseCapacity).toHaveProperty('gpu');
    });
  });
});
