/**
 *
 *
 *
 * - Slack, Email, SMS, PagerDuty
 * -
 * -
 * - SLA
 * -
 *
 *
 * -
 * -
 * -
 * -
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

/*  */
export interface AlertingConfig {
  //
  channels: {
    slack?: {
      enabled: boolean;
      webhookUrl: string;
      defaultChannel: string;
      mentions: Record<string, string[]>; // severity -> userIds
    };
    email?: {
      enabled: boolean;
      smtpConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth: { user: string; pass: string };
      };
      recipients: Record<string, string[]>; // severity -> emails
    };
    sms?: {
      enabled: boolean;
      provider: 'twilio' | 'aws-sns';
      apiKey: string;
      recipients: Record<string, string[]>; // severity -> phones
    };
    pagerduty?: {
      enabled: boolean;
      integrationKey: string;
      serviceKey: string;
    };
  };

  //
  rules: {
    errorRate: { threshold: number; window: number };
    latency: { p95Threshold: number; p99Threshold: number };
    availability: { threshold: number; window: number };
    customMetrics: Array<{
      name: string;
      threshold: number;
      operator: '>' | '<' | '=' | '!=' | '>=' | '<=';
      window: number;
    }>;
  };

  //
  aggregation: {
    enabled: boolean;
    timeWindow: number;
    maxSimilarAlerts: number;
    groupingKeys: string[];
  };

  //
  escalation: {
    enabled: boolean;
    levels: Array<{
      after: number; //
      severity: 'low' | 'medium' | 'high' | 'critical';
      channels: string[];
    }>;
  };

  //  SLA
  sla: {
    availability: {
      target: number;
      measurement: 'monthly' | 'weekly' | 'daily';
    };
    latency: { p95Target: number; p99Target: number };
    errorRate: { target: number };
  };
}

/*  */
export interface AlertEvent {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  title: string;
  description: string;

  //
  metrics: {
    currentValue: number;
    threshold: number;
    unit: string;
    trend: 'increasing' | 'decreasing' | 'stable';
  };

  //
  labels: Record<string, string>;
  annotations: Record<string, string>;

  //
  relatedServices: string[];
  affectedUsers?: number;
  businessImpact?: string;

  //
  previousOccurrences: number;
  mttr?: number; //

  //
  suggestedActions: string[];
  runbooks: string[];

  //
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  assignee?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

/*  */
export interface IncidentResponse {
  id: string;
  alertId: string;
  timestamp: string;

  //
  category: 'performance' | 'availability' | 'security' | 'capacity' | 'other';
  priority: 'p0' | 'p1' | 'p2' | 'p3' | 'p4';

  //
  commander?: string;
  responders: string[];
  stakeholders: string[];

  //
  timeline: Array<{
    timestamp: string;
    action: string;
    author: string;
    details: string;
  }>;

  //
  impact: {
    usersAffected: number;
    servicesAffected: string[];
    revenueImpact?: number;
    slaBreaches: string[];
  };

  //
  mitigation: {
    status: 'not-started' | 'in-progress' | 'completed';
    actions: string[];
    estimatedResolution?: string;
  };

  //
  postmortem?: {
    rootCause: string;
    timeline: string;
    lessonsLearned: string[];
    actionItems: Array<{
      task: string;
      assignee: string;
      dueDate: string;
      status: 'open' | 'completed';
    }>;
  };
}

/* SLA */
export interface SLAStatus {
  service: string;
  period: string;

  availability: {
    target: number;
    current: number;
    status: 'healthy' | 'at-risk' | 'violated';
    remainingErrorBudget: number;
  };

  latency: {
    p95: { target: number; current: number; status: string };
    p99: { target: number; current: number; status: string };
  };

  errorRate: {
    target: number;
    current: number;
    status: 'healthy' | 'at-risk' | 'violated';
  };
}

/**
 *
 */
export class EnterpriseAlertingSystem extends EventEmitter {
  private static instance: EnterpriseAlertingSystem;

  private config: AlertingConfig;
  private isInitialized = false;

  //
  private activeAlerts = new Map<string, AlertEvent>();
  private alertHistory: AlertEvent[] = [];

  //
  private activeIncidents = new Map<string, IncidentResponse>();

  //  SLA
  private slaStatus = new Map<string, SLAStatus>();

  //
  private aggregationCache = new Map<string, AlertEvent[]>();

  //
  private metricsEvaluationTimer?: NodeJS.Timeout;
  private alertCleanupTimer?: NodeJS.Timeout;
  private slaCalculationTimer?: NodeJS.Timeout;

  private constructor() {
    super();
    this.config = this.getDefaultConfig();
  }

  static getInstance(): EnterpriseAlertingSystem {
    if (!EnterpriseAlertingSystem.instance) {
      EnterpriseAlertingSystem.instance = new EnterpriseAlertingSystem();
    }
    return EnterpriseAlertingSystem.instance;
  }

  /**
   *
   */
  async initialize(config?: Partial<AlertingConfig>): Promise<void> {
    if (this.isInitialized) {
      console.warn(' ');
      return;
    }

    try {
      this.config = { ...this.config, ...config };

      console.log(' ...');
      console.log(`📢 启用渠道: ${this.getEnabledChannels().join(', ')}`);

      //
      await this.validateConfiguration();

      //
      this.startMetricsEvaluation();

      //
      this.startAlertCleanup();

      // SLA
      this.startSLACalculation();

      //
      this.setupGlobalErrorHandling();

      this.isInitialized = true;
      console.log(' ');
    } catch (error) {
      console.error(' :', error);
      throw error;
    }
  }

  /**
   *
   */
  async triggerAlert(
    event: Omit<AlertEvent, 'id' | 'timestamp' | 'status'>
  ): Promise<string> {
    try {
      const alertId = this.generateAlertId();

      const fullEvent: AlertEvent = {
        ...event,
        id: alertId,
        timestamp: new Date().toISOString(),
        status: 'open',
      };

      //
      if (this.config.aggregation.enabled) {
        const shouldAggregate = await this.checkAggregation(fullEvent);
        if (shouldAggregate) {
          console.log(`🔄 告警已聚合: ${alertId}`);
          return alertId;
        }
      }

      //
      this.activeAlerts.set(alertId, fullEvent);
      this.alertHistory.push(fullEvent);

      console.log(
        `🚨 新告警触发: ${fullEvent.severity.toUpperCase()} - ${fullEvent.title}`
      );

      //
      await this.sendNotifications(fullEvent);

      //
      if (fullEvent.severity === 'high' || fullEvent.severity === 'critical') {
        await this.createIncident(fullEvent);
      }

      //
      if (this.config.escalation.enabled) {
        this.scheduleEscalation(fullEvent);
      }

      this.emit('alert-triggered', fullEvent);
      return alertId;
    } catch (error) {
      console.error(' :', error);
      throw error;
    }
  }

  /**
   *
   */
  async resolveAlert(
    alertId: string,
    resolution: {
      resolvedBy: string;
      notes?: string;
      rootCause?: string;
    }
  ): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`告警不存在: ${alertId}`);
      }

      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      alert.resolutionNotes = resolution.notes;

      //
      this.activeAlerts.delete(alertId);

      console.log(`✅ 告警已解决: ${alert.title}`);

      //
      await this.sendResolutionNotification(alert, resolution);

      //
      await this.updateRelatedIncident(alertId, 'resolved');

      this.emit('alert-resolved', alert);
    } catch (error) {
      console.error(' :', error);
      throw error;
    }
  }

  /**
   *
   */
  getActiveAlerts(filters?: {
    severity?: string;
    source?: string;
    labels?: Record<string, string>;
  }): AlertEvent[] {
    let alerts = Array.from(this.activeAlerts.values());

    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.source) {
        alerts = alerts.filter(a => a.source === filters.source);
      }
      if (filters.labels) {
        alerts = alerts.filter(a => {
          return Object.entries(filters.labels!).every(
            ([key, value]) => a.labels[key] === value
          );
        });
      }
    }

    return alerts.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   *
   */
  async createIncident(alert: AlertEvent): Promise<string> {
    try {
      const incidentId = this.generateIncidentId();

      const incident: IncidentResponse = {
        id: incidentId,
        alertId: alert.id,
        timestamp: new Date().toISOString(),
        category: this.categorizeAlert(alert),
        priority: this.determinePriority(alert),
        responders: [],
        stakeholders: [],
        timeline: [
          {
            timestamp: new Date().toISOString(),
            action: 'incident-created',
            author: 'system',
            details: `事件由告警 ${alert.id} 自动创建`,
          },
        ],
        impact: {
          usersAffected: alert.affectedUsers || 0,
          servicesAffected: alert.relatedServices,
          slaBreaches: [],
        },
        mitigation: {
          status: 'not-started',
          actions: [],
        },
      };

      this.activeIncidents.set(incidentId, incident);

      console.log(
        `🔥 事件已创建: ${incidentId} (优先级: ${incident.priority})`
      );

      //
      await this.sendIncidentNotification(incident);

      this.emit('incident-created', incident);
      return incidentId;
    } catch (error) {
      console.error(' :', error);
      throw error;
    }
  }

  /**
   *  SLA
   */
  getSLAStatus(service?: string): SLAStatus[] {
    const statuses = Array.from(this.slaStatus.values());

    if (service) {
      return statuses.filter(s => s.service === service);
    }

    return statuses;
  }

  /**
   *
   */
  private getDefaultConfig(): AlertingConfig {
    return {
      channels: {
        slack: {
          enabled: !!process.env.SLACK_WEBHOOK_URL,
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          defaultChannel: '#alerts',
          mentions: {
            critical: ['@channel'],
            high: ['@here'],
            medium: [],
            low: [],
          },
        },
        email: {
          enabled: false,
          smtpConfig: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: '', pass: '' },
          },
          recipients: {
            critical: [],
            high: [],
            medium: [],
            low: [],
          },
        },
      },

      rules: {
        errorRate: { threshold: 0.05, window: 300 }, // 5%  5
        latency: { p95Threshold: 1000, p99Threshold: 2000 }, // ms
        availability: { threshold: 0.99, window: 300 }, // 99%  5
        customMetrics: [],
      },

      aggregation: {
        enabled: true,
        timeWindow: 300, // 5
        maxSimilarAlerts: 5,
        groupingKeys: ['source', 'severity'],
      },

      escalation: {
        enabled: true,
        levels: [
          { after: 900, severity: 'medium', channels: ['slack'] }, // 15
          { after: 1800, severity: 'high', channels: ['slack', 'email'] }, // 30
          {
            after: 3600,
            severity: 'critical',
            channels: ['slack', 'email', 'pagerduty'],
          }, // 1
        ],
      },

      sla: {
        availability: { target: 0.999, measurement: 'monthly' }, // 99.9%
        latency: { p95Target: 500, p99Target: 1000 }, // ms
        errorRate: { target: 0.001 }, // 0.1%
      },
    };
  }

  private getEnabledChannels(): string[] {
    const channels: string[] = [];

    if (this.config.channels.slack?.enabled) channels.push('Slack');
    if (this.config.channels.email?.enabled) channels.push('Email');
    if (this.config.channels.sms?.enabled) channels.push('SMS');
    if (this.config.channels.pagerduty?.enabled) channels.push('PagerDuty');

    return channels;
  }

  private async validateConfiguration(): Promise<void> {
    if (!this.getEnabledChannels().length) {
      console.warn(' ');
    }

    //  Slack
    if (
      this.config.channels.slack?.enabled &&
      !this.config.channels.slack.webhookUrl
    ) {
      throw new Error('Slack  webhook URL');
    }

    console.log(' ');
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateIncidentId(): string {
    return `incident-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private async checkAggregation(alert: AlertEvent): Promise<boolean> {
    //
    const key = this.config.aggregation.groupingKeys
      .map(k => alert.labels[k] || alert[k as keyof AlertEvent])
      .join('-');

    const existing = this.aggregationCache.get(key) || [];
    existing.push(alert);

    if (existing.length >= this.config.aggregation.maxSimilarAlerts) {
      console.log(`🔄 达到聚合阈值，聚合 ${existing.length} 个告警`);
      this.aggregationCache.set(key, []);
      return true;
    }

    this.aggregationCache.set(key, existing);
    return false;
  }

  private async sendNotifications(alert: AlertEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    // Slack
    if (this.config.channels.slack?.enabled) {
      promises.push(this.sendSlackNotification(alert));
    }

    // Email
    if (this.config.channels.email?.enabled) {
      promises.push(this.sendEmailNotification(alert));
    }

    await Promise.allSettled(promises);
  }

  private async sendSlackNotification(alert: AlertEvent): Promise<void> {
    try {
      const color = this.getSeverityColor(alert.severity);
      const mentions =
        this.config.channels.slack?.mentions[alert.severity] || [];

      const message = {
        text: mentions.length ? mentions.join(' ') : undefined,
        attachments: [
          {
            color,
            title: `🚨 ${alert.title}`,
            text: alert.description,
            fields: [
              {
                title: '',
                value: alert.severity.toUpperCase(),
                short: true,
              },
              { title: '', value: alert.source, short: true },
              {
                title: '',
                value: `${alert.metrics.currentValue}${alert.metrics.unit}`,
                short: true,
              },
              {
                title: '',
                value: `${alert.metrics.threshold}${alert.metrics.unit}`,
                short: true,
              },
            ],
            footer: 'Guild Manager ',
            ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
          },
        ],
      };

      //  Slack
      console.log(' Slack :', alert.title);
    } catch (error) {
      console.error(' Slack :', error);
    }
  }

  private async sendEmailNotification(alert: AlertEvent): Promise<void> {
    try {
      console.log(' Email :', alert.title);
    } catch (error) {
      console.error(' Email :', error);
    }
  }

  private async sendResolutionNotification(
    alert: AlertEvent,
    resolution: any
  ): Promise<void> {
    console.log(`✅ 解决通知已发送: ${alert.title}`);
  }

  private async sendIncidentNotification(
    incident: IncidentResponse
  ): Promise<void> {
    console.log(`🔥 事件通知已发送: ${incident.id}`);
  }

  private getSeverityColor(severity: string): string {
    const colors = {
      low: '#36a64f', //
      medium: '#ff9500', //
      high: '#ff0000', //
      critical: '#8b0000', //
    };
    return colors[severity as keyof typeof colors] || '#cccccc';
  }

  private categorizeAlert(alert: AlertEvent): IncidentResponse['category'] {
    //
    if (
      alert.title.toLowerCase().includes('latency') ||
      alert.title.toLowerCase().includes('slow')
    ) {
      return 'performance';
    }
    if (
      alert.title.toLowerCase().includes('down') ||
      alert.title.toLowerCase().includes('unavailable')
    ) {
      return 'availability';
    }
    return 'other';
  }

  private determinePriority(alert: AlertEvent): IncidentResponse['priority'] {
    switch (alert.severity) {
      case 'critical':
        return 'p0';
      case 'high':
        return 'p1';
      case 'medium':
        return 'p2';
      case 'low':
        return 'p3';
      default:
        return 'p4';
    }
  }

  private scheduleEscalation(alert: AlertEvent): void {
    //
    console.log(`⏰ 升级策略已启动: ${alert.id}`);
  }

  private async updateRelatedIncident(
    alertId: string,
    status: string
  ): Promise<void> {
    //
    console.log(`🔄 更新相关事件: ${alertId} -> ${status}`);
  }

  private startMetricsEvaluation(): void {
    this.metricsEvaluationTimer = setInterval(() => {
      this.evaluateMetrics();
    }, 30000); // 30
  }

  private startAlertCleanup(): void {
    this.alertCleanupTimer = setInterval(() => {
      this.cleanupOldAlerts();
    }, 3600000); //
  }

  private startSLACalculation(): void {
    this.slaCalculationTimer = setInterval(() => {
      this.calculateSLA();
    }, 300000); // 5
  }

  private setupGlobalErrorHandling(): void {
    process.on('uncaughtException', error => {
      this.triggerAlert({
        severity: 'critical',
        source: 'global-error-handler',
        title: '',
        description: error.message,
        metrics: {
          currentValue: 1,
          threshold: 0,
          unit: 'errors',
          trend: 'increasing',
        },
        labels: { type: 'uncaughtException' },
        annotations: { stack: error.stack || '' },
        relatedServices: ['guild-manager'],
        suggestedActions: ['', ''],
        runbooks: [],
        previousOccurrences: 0,
      });
    });
  }

  private evaluateMetrics(): void {
    //
    console.log(' ...');
  }

  private cleanupOldAlerts(): void {
    //
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.alertHistory = this.alertHistory.filter(
      alert => new Date(alert.timestamp).getTime() > oneDayAgo
    );
  }

  private calculateSLA(): void {
    // SLA
    console.log(' SLA...');
  }

  /**
   *
   */
  async shutdown(): Promise<void> {
    if (this.metricsEvaluationTimer) clearInterval(this.metricsEvaluationTimer);
    if (this.alertCleanupTimer) clearInterval(this.alertCleanupTimer);
    if (this.slaCalculationTimer) clearInterval(this.slaCalculationTimer);

    console.log(' ');
  }
}

/*  */
export const enterpriseAlerting = EnterpriseAlertingSystem.getInstance();

/*  */
export async function triggerCriticalAlert(
  title: string,
  description: string,
  source: string = 'system'
) {
  return enterpriseAlerting.triggerAlert({
    severity: 'critical',
    source,
    title,
    description,
    metrics: {
      currentValue: 1,
      threshold: 0,
      unit: 'alerts',
      trend: 'increasing',
    },
    labels: { type: 'critical' },
    annotations: {},
    relatedServices: ['guild-manager'],
    suggestedActions: [],
    runbooks: [],
    previousOccurrences: 0,
  });
}

export async function triggerPerformanceAlert(
  metric: string,
  currentValue: number,
  threshold: number,
  unit: string
) {
  return enterpriseAlerting.triggerAlert({
    severity: currentValue > threshold * 2 ? 'critical' : 'high',
    source: 'performance-monitor',
    title: `性能指标超阈值: ${metric}`,
    description: `${metric} 当前值 ${currentValue}${unit} 超过阈值 ${threshold}${unit}`,
    metrics: { currentValue, threshold, unit, trend: 'increasing' },
    labels: { type: 'performance', metric },
    annotations: {},
    relatedServices: ['guild-manager'],
    suggestedActions: ['', ''],
    runbooks: [],
    previousOccurrences: 0,
  });
}
