/**
 * Sentry Dashboard
 *
 * 28.4
 * 5Dashboard////
 */

import type { SystemHealth } from './resilience-manager.main';

// PRD1
export type PRDModule =
  | 'guild'
  | 'battle'
  | 'forum'
  | 'auction'
  | 'members'
  | 'mail';

// Dashboard
export type DashboardType =
  | 'activity'
  | 'retention'
  | 'error_rate'
  | 'performance'
  | 'feature_hotspot';

// Dashboard
export interface DashboardConfig {
  id: string;
  name: string;
  type: DashboardType;
  description: string;
  widgets: DashboardWidget[];
  refreshInterval: number; //
  dataRetention: number; //
}

// Dashboard
export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'table' | 'heatmap';
  query: SentryQuery;
  visualization: VisualizationConfig;
  thresholds?: AlertThreshold[];
}

// Sentry
export interface SentryQuery {
  environment: string[];
  timeRange: string;
  filters: QueryFilter[];
  aggregation: AggregationType;
  groupBy: string[];
}

//
export interface QueryFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number;
}

//
export type AggregationType =
  | 'count'
  | 'avg'
  | 'sum'
  | 'p50'
  | 'p95'
  | 'p99'
  | 'rate';

//
export interface VisualizationConfig {
  chartType: 'line' | 'bar' | 'pie' | 'heatmap' | 'table';
  xAxis?: string;
  yAxis?: string;
  colors?: string[];
  legend?: boolean;
}

//
export interface AlertThreshold {
  level: 'warning' | 'critical';
  condition: 'greater_than' | 'less_than';
  value: number;
  unit: string;
}

/**
 * Dashboard
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
   * Dashboard
   */
  private initializeDefaultDashboards(): void {
    // 1. Dashboard
    this.dashboards.set('activity', this.createActivityDashboard());

    // 2. Dashboard
    this.dashboards.set('retention', this.createRetentionDashboard());

    // 3. Dashboard
    this.dashboards.set('error_rate', this.createErrorRateDashboard());

    // 4. Dashboard
    this.dashboards.set('performance', this.createPerformanceDashboard());

    // 5. Dashboard
    this.dashboards.set(
      'feature_hotspot',
      this.createFeatureHotspotDashboard()
    );
  }

  /**
   * Dashboard
   */
  private createActivityDashboard(): DashboardConfig {
    return {
      id: 'activity_dashboard',
      name: '',
      type: 'activity',
      description: 'PRD',
      refreshInterval: 300, // 5
      dataRetention: 30, // 30
      widgets: [
        {
          id: 'active_sessions',
          title: '',
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
          title: 'PRD',
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
   * Dashboard
   */
  private createRetentionDashboard(): DashboardConfig {
    return {
      id: 'retention_dashboard',
      name: '',
      type: 'retention',
      description: '',
      refreshInterval: 3600, // 1
      dataRetention: 90, // 90
      widgets: [
        {
          id: 'retention_vs_crashes',
          title: ' vs ',
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
          title: '',
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
   * Dashboard
   */
  private createErrorRateDashboard(): DashboardConfig {
    return {
      id: 'error_rate_dashboard',
      name: '',
      type: 'error_rate',
      description: 'PRD',
      refreshInterval: 180, // 3
      dataRetention: 30, // 30
      widgets: [
        {
          id: 'error_rate_by_module',
          title: '',
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
          title: '',
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
   * Dashboard
   */
  private createPerformanceDashboard(): DashboardConfig {
    return {
      id: 'performance_dashboard',
      name: '',
      type: 'performance',
      description: 'FPSCPU',
      refreshInterval: 120, // 2
      dataRetention: 7, // 7
      widgets: [
        {
          id: 'response_time_p95',
          title: 'UI P95',
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
          title: '',
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
   * Dashboard
   */
  private createFeatureHotspotDashboard(): DashboardConfig {
    return {
      id: 'feature_hotspot_dashboard',
      name: '',
      type: 'feature_hotspot',
      description: 'PRD',
      refreshInterval: 600, // 10
      dataRetention: 14, // 14
      widgets: [
        {
          id: 'module_usage_frequency',
          title: '',
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
          title: '',
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
   * Dashboard
   */
  getDashboard(id: string): DashboardConfig | undefined {
    return this.dashboards.get(id);
  }

  /**
   * Dashboard
   */
  getAllDashboards(): DashboardConfig[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Dashboard
   */
  getDashboardsByType(type: DashboardType): DashboardConfig[] {
    return Array.from(this.dashboards.values()).filter(d => d.type === type);
  }

  /**
   * Sentry Dashboard JSON
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
      projects: [-1], //
      environment: dashboard.widgets[0]?.query.environment || ['production'],
    };
  }

  /**
   * Sentry
   */
  private mapVisualizationType(chartType: string): string {
    const mapping: Record<string, string> = {
      line: 'line',
      bar: 'bar',
      pie: 'world_map', // Sentryworld_map
      heatmap: 'table',
      table: 'table',
    };
    return mapping[chartType] || 'line';
  }

  /**
   * Sentry
   */
  private buildSentryQuery(query: SentryQuery): string {
    let queryStr = '';

    //
    query.filters.forEach(filter => {
      if (queryStr) queryStr += ' ';
      queryStr += `${filter.field}:${filter.value}`;
    });

    return queryStr;
  }

  /**
   * Dashboard
   */
  updateDashboard(id: string, config: Partial<DashboardConfig>): void {
    const existing = this.dashboards.get(id);
    if (existing) {
      this.dashboards.set(id, { ...existing, ...config });
    }
  }

  /**
   * SystemHealth
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

//
export const dashboardConfigManager = new DashboardConfigManager();

//
export function getDashboardConfig(type: DashboardType): DashboardConfig[] {
  return dashboardConfigManager.getDashboardsByType(type);
}

export function generateSentryDashboard(dashboardId: string): object {
  return dashboardConfigManager.generateSentryDashboardConfig(dashboardId);
}
