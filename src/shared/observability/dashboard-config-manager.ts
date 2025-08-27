/**
 * Sentry Dashboard配置管理器
 *
 * 建议2实施：将8.4发布后监控指标映射到仪表盘
 * 支持5个核心Dashboard：活跃/留存/错误率/性能/功能热点
 */

import type { SystemHealth } from './resilience-manager';

// PRD模块定义（与建议1对齐）
export type PRDModule =
  | 'guild'
  | 'battle'
  | 'forum'
  | 'auction'
  | 'members'
  | 'mail';

// Dashboard类型定义
export type DashboardType =
  | 'activity'
  | 'retention'
  | 'error_rate'
  | 'performance'
  | 'feature_hotspot';

// Dashboard配置接口
export interface DashboardConfig {
  id: string;
  name: string;
  type: DashboardType;
  description: string;
  widgets: DashboardWidget[];
  refreshInterval: number; // 秒
  dataRetention: number; // 天
}

// Dashboard组件配置
export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'heatmap';
  query: SentryQuery;
  visualization: VisualizationConfig;
  thresholds?: AlertThreshold[];
}

// Sentry查询配置
export interface SentryQuery {
  environment: string[];
  timeRange: string;
  filters: QueryFilter[];
  aggregation: AggregationType;
  groupBy: string[];
}

// 查询过滤器
export interface QueryFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number;
}

// 聚合类型
export type AggregationType =
  | 'count'
  | 'avg'
  | 'sum'
  | 'p50'
  | 'p95'
  | 'p99'
  | 'rate';

// 可视化配置
export interface VisualizationConfig {
  chartType: 'line' | 'bar' | 'pie' | 'heatmap' | 'table';
  xAxis?: string;
  yAxis?: string;
  colors?: string[];
  legend?: boolean;
}

// 告警阈值配置
export interface AlertThreshold {
  level: 'warning' | 'critical';
  condition: 'greater_than' | 'less_than';
  value: number;
  unit: string;
}

/**
 * Dashboard配置管理器类
 */
export class DashboardConfigManager {
  private dashboards: Map<string, DashboardConfig> = new Map();
  private prdModules: PRDModule[] = [
    'guild',
    'battle',
    'forum',
    'auction',
    'members',
    'mail',
  ];

  constructor() {
    this.initializeDefaultDashboards();
  }

  /**
   * 初始化默认Dashboard配置
   */
  private initializeDefaultDashboards(): void {
    // 1. 活跃度Dashboard
    this.dashboards.set('activity', this.createActivityDashboard());

    // 2. 留存率Dashboard
    this.dashboards.set('retention', this.createRetentionDashboard());

    // 3. 错误率Dashboard
    this.dashboards.set('error_rate', this.createErrorRateDashboard());

    // 4. 性能Dashboard
    this.dashboards.set('performance', this.createPerformanceDashboard());

    // 5. 功能热点Dashboard
    this.dashboards.set(
      'feature_hotspot',
      this.createFeatureHotspotDashboard()
    );
  }

  /**
   * 创建活跃度Dashboard配置
   */
  private createActivityDashboard(): DashboardConfig {
    return {
      id: 'activity_dashboard',
      name: '用户活跃度监控',
      type: 'activity',
      description: '监控各PRD模块的用户活跃度和会话质量',
      refreshInterval: 300, // 5分钟
      dataRetention: 30, // 30天
      widgets: [
        {
          id: 'active_sessions',
          title: '活跃会话数',
          type: 'metric',
          query: {
            environment: ['production', 'staging'],
            timeRange: '24h',
            filters: [
              {
                field: 'event.type',
                operator: 'equals',
                value: 'session_start',
              },
            ],
            aggregation: 'count',
            groupBy: ['module', 'hour'],
          },
          visualization: {
            chartType: 'line',
            xAxis: 'hour',
            yAxis: 'session_count',
            legend: true,
          },
          thresholds: [
            {
              level: 'warning',
              condition: 'less_than',
              value: 100,
              unit: 'sessions/hour',
            },
            {
              level: 'critical',
              condition: 'less_than',
              value: 50,
              unit: 'sessions/hour',
            },
          ],
        },
        {
          id: 'module_activity_heatmap',
          title: 'PRD模块活跃度热力图',
          type: 'heatmap',
          query: {
            environment: ['production'],
            timeRange: '7d',
            filters: [
              { field: 'tags.module', operator: 'contains', value: '' },
            ],
            aggregation: 'count',
            groupBy: ['module', 'day'],
          },
          visualization: {
            chartType: 'heatmap',
            colors: ['#green', '#yellow', '#red'],
          },
        },
      ],
    };
  }

  /**
   * 创建留存率Dashboard配置
   */
  private createRetentionDashboard(): DashboardConfig {
    return {
      id: 'retention_dashboard',
      name: '用户留存率分析',
      type: 'retention',
      description: '监控用户留存率与崩溃率的相关性',
      refreshInterval: 3600, // 1小时
      dataRetention: 90, // 90天
      widgets: [
        {
          id: 'retention_vs_crashes',
          title: '留存率 vs 崩溃率相关性',
          type: 'chart',
          query: {
            environment: ['production'],
            timeRange: '30d',
            filters: [
              {
                field: 'event.type',
                operator: 'equals',
                value: 'session_crash',
              },
            ],
            aggregation: 'rate',
            groupBy: ['week', 'module'],
          },
          visualization: {
            chartType: 'line',
            xAxis: 'week',
            yAxis: 'crash_rate',
            legend: true,
          },
          thresholds: [
            {
              level: 'warning',
              condition: 'greater_than',
              value: 0.5,
              unit: '%',
            },
            {
              level: 'critical',
              condition: 'greater_than',
              value: 2.0,
              unit: '%',
            },
          ],
        },
        {
          id: 'cohort_retention',
          title: '队列留存分析',
          type: 'table',
          query: {
            environment: ['production'],
            timeRange: '30d',
            filters: [],
            aggregation: 'count',
            groupBy: ['user_cohort', 'retention_day'],
          },
          visualization: {
            chartType: 'table',
          },
        },
      ],
    };
  }

  /**
   * 创建错误率Dashboard配置
   */
  private createErrorRateDashboard(): DashboardConfig {
    return {
      id: 'error_rate_dashboard',
      name: '错误率监控',
      type: 'error_rate',
      description: '按PRD模块分类的错误率监控和趋势分析',
      refreshInterval: 180, // 3分钟
      dataRetention: 30, // 30天
      widgets: [
        {
          id: 'error_rate_by_module',
          title: '各模块错误率',
          type: 'chart',
          query: {
            environment: ['production', 'staging'],
            timeRange: '24h',
            filters: [{ field: 'level', operator: 'equals', value: 'error' }],
            aggregation: 'rate',
            groupBy: ['module', 'hour'],
          },
          visualization: {
            chartType: 'bar',
            xAxis: 'module',
            yAxis: 'error_rate',
            legend: false,
          },
          thresholds: [
            {
              level: 'warning',
              condition: 'greater_than',
              value: 1.0,
              unit: '%',
            },
            {
              level: 'critical',
              condition: 'greater_than',
              value: 5.0,
              unit: '%',
            },
          ],
        },
        {
          id: 'top_errors',
          title: '高频错误排行',
          type: 'table',
          query: {
            environment: ['production'],
            timeRange: '24h',
            filters: [{ field: 'level', operator: 'equals', value: 'error' }],
            aggregation: 'count',
            groupBy: ['error.type', 'error.value'],
          },
          visualization: {
            chartType: 'table',
          },
        },
      ],
    };
  }

  /**
   * 创建性能Dashboard配置
   */
  private createPerformanceDashboard(): DashboardConfig {
    return {
      id: 'performance_dashboard',
      name: '性能监控',
      type: 'performance',
      description: '监控关键性能指标：延迟、FPS、内存、CPU',
      refreshInterval: 120, // 2分钟
      dataRetention: 7, // 7天
      widgets: [
        {
          id: 'response_time_p95',
          title: 'UI响应时间 P95',
          type: 'metric',
          query: {
            environment: ['production'],
            timeRange: '4h',
            filters: [
              { field: 'transaction', operator: 'contains', value: 'ui.' },
            ],
            aggregation: 'p95',
            groupBy: ['module'],
          },
          visualization: {
            chartType: 'line',
            xAxis: 'time',
            yAxis: 'response_time_ms',
            legend: true,
          },
          thresholds: [
            {
              level: 'warning',
              condition: 'greater_than',
              value: 16,
              unit: 'ms',
            },
            {
              level: 'critical',
              condition: 'greater_than',
              value: 50,
              unit: 'ms',
            },
          ],
        },
        {
          id: 'memory_usage',
          title: '内存使用趋势',
          type: 'chart',
          query: {
            environment: ['production'],
            timeRange: '24h',
            filters: [
              {
                field: 'measurement',
                operator: 'equals',
                value: 'memory_usage',
              },
            ],
            aggregation: 'avg',
            groupBy: ['hour'],
          },
          visualization: {
            chartType: 'line',
            xAxis: 'hour',
            yAxis: 'memory_mb',
            legend: false,
          },
          thresholds: [
            {
              level: 'warning',
              condition: 'greater_than',
              value: 300,
              unit: 'MB',
            },
            {
              level: 'critical',
              condition: 'greater_than',
              value: 400,
              unit: 'MB',
            },
          ],
        },
      ],
    };
  }

  /**
   * 创建功能热点Dashboard配置
   */
  private createFeatureHotspotDashboard(): DashboardConfig {
    return {
      id: 'feature_hotspot_dashboard',
      name: '功能热点分析',
      type: 'feature_hotspot',
      description: '分析各PRD模块使用频率和性能热点',
      refreshInterval: 600, // 10分钟
      dataRetention: 14, // 14天
      widgets: [
        {
          id: 'module_usage_frequency',
          title: '模块使用频率',
          type: 'chart',
          query: {
            environment: ['production'],
            timeRange: '7d',
            filters: [
              { field: 'event.type', operator: 'equals', value: 'user_action' },
            ],
            aggregation: 'count',
            groupBy: ['module'],
          },
          visualization: {
            chartType: 'pie',
            legend: true,
          },
        },
        {
          id: 'performance_hotspots',
          title: '性能热点分析',
          type: 'table',
          query: {
            environment: ['production'],
            timeRange: '24h',
            filters: [
              { field: 'duration', operator: 'greater_than', value: 100 },
            ],
            aggregation: 'avg',
            groupBy: ['transaction', 'module'],
          },
          visualization: {
            chartType: 'table',
          },
          thresholds: [
            {
              level: 'warning',
              condition: 'greater_than',
              value: 100,
              unit: 'ms',
            },
            {
              level: 'critical',
              condition: 'greater_than',
              value: 500,
              unit: 'ms',
            },
          ],
        },
      ],
    };
  }

  /**
   * 获取Dashboard配置
   */
  getDashboard(id: string): DashboardConfig | undefined {
    return this.dashboards.get(id);
  }

  /**
   * 获取所有Dashboard配置
   */
  getAllDashboards(): DashboardConfig[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * 按类型获取Dashboard
   */
  getDashboardsByType(type: DashboardType): DashboardConfig[] {
    return Array.from(this.dashboards.values()).filter(d => d.type === type);
  }

  /**
   * 生成Sentry Dashboard JSON配置
   */
  generateSentryDashboardConfig(dashboardId: string): object {
    const dashboard = this.getDashboard(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    return {
      title: dashboard.name,
      widgets: dashboard.widgets.map(widget => ({
        title: widget.title,
        displayType: this.mapVisualizationType(widget.visualization.chartType),
        queries: [
          {
            name: widget.title,
            query: this.buildSentryQuery(widget.query),
            aggregates: [widget.query.aggregation],
            fields: widget.query.groupBy,
            orderby: widget.query.groupBy[0],
          },
        ],
        layout: { x: 0, y: 0, w: 1, h: 1, minH: 1 },
      })),
      projects: [-1], // 所有项目
      environment: dashboard.widgets[0]?.query.environment || ['production'],
    };
  }

  /**
   * 映射可视化类型到Sentry格式
   */
  private mapVisualizationType(chartType: string): string {
    const mapping: Record<string, string> = {
      line: 'line',
      bar: 'bar',
      pie: 'world_map', // Sentry使用world_map表示饼图
      heatmap: 'table',
      table: 'table',
    };
    return mapping[chartType] || 'line';
  }

  /**
   * 构建Sentry查询字符串
   */
  private buildSentryQuery(query: SentryQuery): string {
    let queryStr = '';

    // 添加过滤条件
    query.filters.forEach(filter => {
      if (queryStr) queryStr += ' ';
      queryStr += `${filter.field}:${filter.value}`;
    });

    return queryStr;
  }

  /**
   * 更新Dashboard配置
   */
  updateDashboard(id: string, config: Partial<DashboardConfig>): void {
    const existing = this.dashboards.get(id);
    if (existing) {
      this.dashboards.set(id, { ...existing, ...config });
    }
  }

  /**
   * 从SystemHealth生成实时监控数据
   */
  generateMetricsFromSystemHealth(health: SystemHealth): Record<string, any> {
    return {
      timestamp: health.timestamp,
      overall_health: health.overall,
      active_failures: health.activeFailures.length,
      degradation_level: health.degradationLevel,
      component_status: {
        sentry: health.components.sentry.status,
        logging: health.components.logging.status,
        storage: health.components.storage.status,
        network: health.components.network.status,
        memory: health.components.memory.status,
      },
      error_counts: {
        sentry: health.components.sentry.errorCount,
        logging: health.components.logging.errorCount,
        storage: health.components.storage.errorCount,
        network: health.components.network.errorCount,
        memory: health.components.memory.errorCount,
      },
    };
  }
}

// 导出默认实例
export const dashboardConfigManager = new DashboardConfigManager();

// 便捷函数
export function getDashboardConfig(type: DashboardType): DashboardConfig[] {
  return dashboardConfigManager.getDashboardsByType(type);
}

export function generateSentryDashboard(dashboardId: string): object {
  return dashboardConfigManager.generateSentryDashboardConfig(dashboardId);
}
