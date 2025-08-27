/* 安全监控和告警系统 */

interface SecurityEvent {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: 'auth' | 'network' | 'file' | 'process' | 'memory' | 'general';
  message: string;
  details?: Record<string, any>;
  source?: string;
}

interface SecurityMetrics {
  failedLoginAttempts: number;
  suspiciousNetworkRequests: number;
  fileAccessViolations: number;
  memoryUsage: number;
  activeConnections: number;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics = {
    failedLoginAttempts: 0,
    suspiciousNetworkRequests: 0,
    fileAccessViolations: 0,
    memoryUsage: 0,
    activeConnections: 0,
  };

  private readonly MAX_EVENTS = 1000;
  private readonly ALERT_THRESHOLDS = {
    failedLoginAttempts: 5,
    suspiciousNetworkRequests: 10,
    fileAccessViolations: 3,
    memoryUsage: 85, // percentage
    activeConnections: 100,
  };

  /**
   * 记录安全事件
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(securityEvent);

    // 保持事件数量限制
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // 检查是否需要触发告警
    this.checkAlertConditions(securityEvent);

    // 输出到日志
    this.writeToLog(securityEvent);
  }

  /**
   * 更新安全指标
   */
  updateMetrics(partialMetrics: Partial<SecurityMetrics>): void {
    this.metrics = { ...this.metrics, ...partialMetrics };

    // 检查指标阈值
    this.checkMetricsThresholds();
  }

  /**
   * 获取安全事件
   */
  getSecurityEvents(
    category?: SecurityEvent['category'],
    level?: SecurityEvent['level'],
    since?: Date
  ): SecurityEvent[] {
    let filteredEvents = this.events;

    if (category) {
      filteredEvents = filteredEvents.filter(e => e.category === category);
    }

    if (level) {
      filteredEvents = filteredEvents.filter(e => e.level === level);
    }

    if (since) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= since);
    }

    return filteredEvents.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * 获取安全指标
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * 检查告警条件
   */
  private checkAlertConditions(event: SecurityEvent): void {
    if (event.level === 'critical') {
      this.triggerAlert('Critical security event detected', event);
    }

    // 根据事件类型检查特定条件
    switch (event.category) {
      case 'auth':
        if (
          this.metrics.failedLoginAttempts >=
          this.ALERT_THRESHOLDS.failedLoginAttempts
        ) {
          this.triggerAlert('Multiple failed login attempts detected', event);
        }
        break;

      case 'network':
        if (
          this.metrics.suspiciousNetworkRequests >=
          this.ALERT_THRESHOLDS.suspiciousNetworkRequests
        ) {
          this.triggerAlert('Suspicious network activity detected', event);
        }
        break;

      case 'file':
        if (
          this.metrics.fileAccessViolations >=
          this.ALERT_THRESHOLDS.fileAccessViolations
        ) {
          this.triggerAlert('Multiple file access violations detected', event);
        }
        break;
    }
  }

  /**
   * 检查指标阈值
   */
  private checkMetricsThresholds(): void {
    Object.entries(this.ALERT_THRESHOLDS).forEach(([metric, threshold]) => {
      const currentValue = this.metrics[metric as keyof SecurityMetrics];
      if (currentValue >= threshold) {
        this.triggerAlert(
          `Security metric threshold exceeded: ${metric} = ${currentValue} (threshold: ${threshold})`
        );
      }
    });
  }

  /**
   * 触发安全告警
   */
  private triggerAlert(message: string, event?: SecurityEvent): void {
    const alert = {
      timestamp: new Date(),
      message,
      event,
      metrics: this.getSecurityMetrics(),
    };

    // 写入告警日志
    this.writeToAlertLog(alert);

    // 可以在这里添加其他告警机制：
    // - 发送邮件
    // - 推送通知
    // - 写入数据库
    // - 调用外部监控系统API

    console.error('🚨 SECURITY ALERT:', alert);
  }

  /**
   * 写入安全日志
   */
  private writeToLog(event: SecurityEvent): void {
    const logEntry = {
      timestamp: event.timestamp.toISOString(),
      level: event.level,
      category: event.category,
      message: event.message,
      details: event.details,
      source: event.source,
    };

    // 在生产环境中，这里应该写入文件或发送到日志收集系统
    console.log('🔒 Security Event:', JSON.stringify(logEntry, null, 2));
  }

  /**
   * 写入告警日志
   */
  private writeToAlertLog(alert: any): void {
    // 在生产环境中，这里应该写入专用的告警日志文件
    console.error('🚨 Security Alert:', JSON.stringify(alert, null, 2));
  }

  /**
   * 生成安全报告
   */
  generateSecurityReport(periodHours: number = 24): {
    summary: {
      totalEvents: number;
      criticalEvents: number;
      warningEvents: number;
      topCategories: string[];
    };
    events: SecurityEvent[];
    metrics: SecurityMetrics;
  } {
    const since = new Date(Date.now() - periodHours * 60 * 60 * 1000);
    const periodEvents = this.getSecurityEvents(undefined, undefined, since);

    const criticalEvents = periodEvents.filter(
      e => e.level === 'critical'
    ).length;
    const warningEvents = periodEvents.filter(
      e => e.level === 'warning'
    ).length;

    const categoryCount: Record<string, number> = {};
    periodEvents.forEach(event => {
      categoryCount[event.category] = (categoryCount[event.category] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    return {
      summary: {
        totalEvents: periodEvents.length,
        criticalEvents,
        warningEvents,
        topCategories,
      },
      events: periodEvents,
      metrics: this.getSecurityMetrics(),
    };
  }
}

// 创建全局安全监控实例
export const securityMonitor = new SecurityMonitor();

// 导出常用的安全事件记录函数
export function logSecurityEvent(
  level: SecurityEvent['level'],
  category: SecurityEvent['category'],
  message: string,
  details?: Record<string, any>
) {
  securityMonitor.logSecurityEvent({ level, category, message, details });
}

// 导出安全指标更新函数
export function updateSecurityMetrics(metrics: Partial<SecurityMetrics>) {
  securityMonitor.updateMetrics(metrics);
}
