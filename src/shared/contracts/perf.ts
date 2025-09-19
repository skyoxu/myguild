/**
 * 性能与容量规划契约定义
 *
 * 基于Base-Clean架构标准，定义性能预算、延迟预算和容量建模的核心接口。
 * 支持跨进程（主/渲染/Worker）的性能监控与容量规划。
 */

/**
 * 帧预算配置
 *
 * 定义60FPS目标下的分层预算分配，确保渲染性能在可控范围内
 */
export interface FrameBudget {
  /** 目标帧率 (FPS) */
  target: number;
  /** 帧预算总时间 (毫秒) */
  budgetMs: number;
  /** 分层预算分配 */
  layers: {
    /** 脚本执行预算 (ms) */
    script: number;
    /** 样式计算预算 (ms) */
    style: number;
    /** 布局重排预算 (ms) */
    layout: number;
    /** 绘制合成预算 (ms) */
    paint: number;
    /** 缓冲余量 (ms) */
    buffer: number;
  };
}

/**
 * 延迟预算配置
 *
 * 定义各类交互和操作的延迟阈值，基于P95/P99统计口径
 */
export interface LatencyBudget {
  /** 事件处理延迟预算 */
  event: {
    /** P95延迟阈值 (ms) */
    p95: number;
    /** P99延迟阈值 (ms) */
    p99: number;
  };
  /** UI交互延迟预算 */
  interaction: {
    /** P95延迟阈值 (ms) */
    p95: number;
    /** P99延迟阈值 (ms) */
    p99: number;
  };
  /** 场景切换延迟预算 */
  sceneSwitch: {
    /** P95延迟阈值 (ms) */
    p95: number;
    /** P99延迟阈值 (ms) */
    p99: number;
  };
  /** 资产加载延迟预算 */
  assetLoad: {
    /** 冷启动延迟阈值 (ms) */
    cold: number;
    /** 热缓存延迟阈值 (ms) */
    warm: number;
  };
}

/**
 * 容量建模配置
 *
 * 定义系统容量的基准值、负载倍数和安全边界
 */
export interface CapacityModel {
  /** 基础容量配置 */
  baseCapacity: {
    /** 基准CPU使用率 (0-1) */
    cpu: number;
    /** 基准内存使用量 (MB) */
    memory: number;
    /** 基准GPU使用率 (0-1) */
    gpu: number;
  };
  /** 负载倍数配置 */
  loadMultipliers: {
    /** 每个游戏实体的资源倍数 */
    entityCount: number;
    /** 特效复杂度倍数 */
    effectComplexity: number;
    /** UI复杂度倍数 */
    uiComplexity: number;
  };
  /** 安全边界配置 */
  safetyMargins: {
    /** CPU安全边界 (0-1) */
    cpu: number;
    /** 内存安全边界 (0-1) */
    memory: number;
    /** GPU安全边界 (0-1) */
    gpu: number;
  };
}

/**
 * 性能指标上报格式
 *
 * 遵循域事件命名规范的性能指标定义
 */
export interface PerformanceMetric {
  /** 指标名称，遵循 ${DOMAIN}.perf.${metric} 格式 */
  name: string;
  /** 指标数值 */
  value: number;
  /** 指标单位 */
  unit: 'ms' | 'mb' | 'fps' | 'percent' | 'count';
  /** 时间戳 */
  timestamp: number;
  /** 上下文信息 */
  context: {
    /** 发布版本 */
    release?: string;
    /** 环境标识 */
    environment?: string;
    /** 用户代理 */
    userAgent?: string;
    /** 会话ID */
    sessionId?: string;
  };
}

/**
 * 性能降级策略配置
 *
 * 定义在性能压力下的自适应降级机制
 */
export interface PerformanceDegradation {
  /** 降级触发条件 */
  triggers: {
    /** 连续掉帧次数阈值 */
    frameDrops: number;
    /** 内存压力阈值 (0-1) */
    memoryPressure: number;
    /** CPU使用率阈值 (0-1) */
    cpuUsage: number;
  };
  /** 降级动作配置 */
  actions: {
    /** 是否减少粒子效果 */
    reduceParticles: boolean;
    /** 是否降低渲染分辨率 */
    lowerResolution: boolean;
    /** 是否禁用非关键特效 */
    disableEffects: boolean;
    /** 是否简化几何体 */
    simplifyGeometry: boolean;
  };
}

/**
 * 进程内存限制配置
 *
 * 定义各进程的内存使用上限
 */
export interface ProcessMemoryLimits {
  /** 主进程内存限制 (MB) */
  main: number;
  /** 渲染进程内存限制 (MB) */
  renderer: number;
  /** Worker进程内存限制 (MB) */
  workers: number;
}

/**
 * 性能风险评估
 *
 * 用于追踪和管理性能相关风险
 */
export interface PerformanceRisk {
  /** 风险唯一标识 */
  id: string;
  /** 风险描述 */
  description: string;
  /** 发生概率 */
  probability: 'low' | 'medium' | 'high';
  /** 影响程度 */
  impact: 'low' | 'medium' | 'high';
  /** 缓解措施 */
  mitigation: string;
  /** 责任人 */
  owner: string;
}

/**
 * 压力测试场景配置
 */
export interface StressTestScenario {
  /** 场景名称 */
  name: string;
  /** 实体数量 */
  entities: number;
  /** 特效数量 */
  effects: number;
  /** 持续时间 */
  duration: string;
}

/**
 * 回归测试矩阵配置
 */
export interface RegressionMatrix {
  /** 测试场景及其阈值 */
  scenarios: {
    [scenarioName: string]: {
      threshold: number;
      unit: string;
    };
  };
  /** 测试环境 */
  environments: string[];
  /** 浏览器支持 */
  browsers: string[];
  /** 平台支持 */
  platforms: string[];
}

/**
 * 默认性能预算配置
 *
 * 提供开箱即用的性能预算设定，可通过环境变量覆盖
 */
export const DEFAULT_FRAME_BUDGET: FrameBudget = {
  target: 60,
  budgetMs: 16.7,
  layers: {
    script: 8,
    style: 2,
    layout: 2,
    paint: 4,
    buffer: 0.7,
  },
};

export const DEFAULT_LATENCY_BUDGET: LatencyBudget = {
  event: { p95: 50, p99: 100 },
  interaction: { p95: 100, p99: 200 },
  sceneSwitch: { p95: 500, p99: 1000 },
  assetLoad: { cold: 3000, warm: 500 },
};

export const DEFAULT_CAPACITY_MODEL: CapacityModel = {
  baseCapacity: {
    cpu: 0.3,
    memory: 512,
    gpu: 0.5,
  },
  loadMultipliers: {
    entityCount: 1.2,
    effectComplexity: 1.5,
    uiComplexity: 1.1,
  },
  safetyMargins: {
    cpu: 0.2,
    memory: 0.15,
    gpu: 0.25,
  },
};

/**
 * 性能采样规则配置
 *
 * 基于03章Sentry集成模式的动态采样策略
 */
export const PERF_SAMPLING_RULES: Record<string, number> = {
  // 强化关键路径采样
  startup: 0.8,
  navigation: 0.8,
  'ui.action': 0.8,
  coldstart: 0.8,
  warmstart: 0.8,

  // 降低噪音事件采样
  healthcheck: 0.0,
  heartbeat: 0.0,
  poll: 0.0,

  // 默认基准采样
  default: Number(process.env.TRACES_SAMPLE_BASE ?? 0.1),
};
