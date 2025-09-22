import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';

// Release Health threshold configuration
interface ReleaseHealthThresholds {
  crashFreeSessionsRate: number; // 99.5%
  crashFreeUsersRate: number; // 99.8%
  adoptionRate7d: number; // 50% in 7days
  adoptionRateMin14d: number; // >=30% in 14days minimum
}

const RELEASE_HEALTH_THRESHOLDS: ReleaseHealthThresholds = {
  crashFreeSessionsRate: 99.5, // 99.5% crash-free session rate
  crashFreeUsersRate: 99.8, // 99.8% crash-free user rate
  adoptionRate7d: 50.0, // 50% user upgrade in 7 days
  adoptionRateMin14d: 30.0, // 30% minimum in 14 days
};

/**
 * Release Health dedicated configuration and monitoring
 * Implement Dev->CI->Prod closed-loop and health threshold monitoring
 */
export class ReleaseHealthManager {
  private static instance: ReleaseHealthManager;
  private healthMetrics: Map<string, number> = new Map();
  private sessionStartTime: number = Date.now();
  private releaseMetrics: Map<string, any> = new Map();

  static getInstance(): ReleaseHealthManager {
    if (!ReleaseHealthManager.instance) {
      ReleaseHealthManager.instance = new ReleaseHealthManager();
    }
    return ReleaseHealthManager.instance;
  }

  /**
   * Initialize Release Health monitoring
   */
  initializeReleaseHealth(): void {
    console.log('[HEALTH] Initializing Release Health monitoring...');

    // Start session tracking
    this.startHealthSession();

    // Monitor critical application events
    this.setupAppEventMonitoring();

    // Regular health status reporting
    this.setupHealthReporting();

    // Game-specific health metrics
    this.setupGameHealthMonitoring();

    // Release health threshold monitoring
    this.setupReleaseHealthGating();
  }

  /**
   * Setup Release health threshold monitoring
   */
  private setupReleaseHealthGating(): void {
    console.log('[HEALTH] Setting up Release health threshold monitoring...');

    // Regular health threshold checks
    setInterval(
      () => {
        this.checkReleaseHealthThresholds();
      },
      10 * 60 * 1000
    ); // Check every 10 minutes

    // Critical event trigger checks
    this.setupCriticalEventTriggers();
  }

  /**
   * Check Release health thresholds
   */
  private checkReleaseHealthThresholds(): void {
    const currentMetrics = this.calculateCurrentHealthMetrics();

    // Crash rate checks
    if (
      currentMetrics.crashFreeSessionsRate <
      RELEASE_HEALTH_THRESHOLDS.crashFreeSessionsRate
    ) {
      this.triggerHealthAlert('crash_sessions_threshold', {
        current: currentMetrics.crashFreeSessionsRate,
        threshold: RELEASE_HEALTH_THRESHOLDS.crashFreeSessionsRate,
        severity: 'critical',
      });
    }

    if (
      currentMetrics.crashFreeUsersRate <
      RELEASE_HEALTH_THRESHOLDS.crashFreeUsersRate
    ) {
      this.triggerHealthAlert('crash_users_threshold', {
        current: currentMetrics.crashFreeUsersRate,
        threshold: RELEASE_HEALTH_THRESHOLDS.crashFreeUsersRate,
        severity: 'critical',
      });
    }

    // Adoption rate checks
    this.checkAdoptionRates(currentMetrics);
  }

  /**
   * Check version adoption rate
   */
  private checkAdoptionRates(metrics: any): void {
    const currentRelease = app.getVersion?.() ?? 'unknown';
    const daysSinceRelease = this.getDaysSinceRelease(currentRelease);

    if (
      daysSinceRelease === 7 &&
      metrics.adoptionRate < RELEASE_HEALTH_THRESHOLDS.adoptionRate7d
    ) {
      this.triggerHealthAlert('adoption_7d_threshold', {
        current: metrics.adoptionRate,
        threshold: RELEASE_HEALTH_THRESHOLDS.adoptionRate7d,
        daysSinceRelease: 7,
        severity: 'warning',
      });
    }

    if (
      daysSinceRelease === 14 &&
      metrics.adoptionRate < RELEASE_HEALTH_THRESHOLDS.adoptionRateMin14d
    ) {
      this.triggerHealthAlert('adoption_14d_threshold', {
        current: metrics.adoptionRate,
        threshold: RELEASE_HEALTH_THRESHOLDS.adoptionRateMin14d,
        daysSinceRelease: 14,
        severity: 'critical',
      });
    }
  }

  /**
   * Trigger health alert
   */
  private triggerHealthAlert(alertType: string, data: any): void {
    console.error(
      `[ALERT] Release health threshold triggered: ${alertType}`,
      data
    );

    Sentry.captureMessage(`Release health threshold violation: ${alertType}`, {
      level: data.severity,
      tags: {
        'alert.type': alertType,
        'release.version': app.getVersion?.() ?? 'unknown',
        'alert.severity': data.severity,
      },
      extra: data,
    });

    // Execute rollback logic when critical thresholds are triggered
    if (data.severity === 'critical') {
      this.considerRollback(alertType, data);
    }
  }

  /**
   * Consider version rollback
   */
  private considerRollback(alertType: string, data: any): void {
    console.warn(
      '[ROLLBACK] Critical health issue detected, considering version rollback...'
    );

    // Auto rollback logic can be integrated here
    // Example: notify CI/CD system, mark version as unhealthy, etc.

    Sentry.addBreadcrumb({
      message: 'Consider version rollback',
      category: 'release.health',
      level: 'warning',
      data: {
        alertType,
        reason: 'health_threshold_violation',
        ...data,
      },
    });
  }

  /**
   * Calculate current health metrics
   */
  private calculateCurrentHealthMetrics(): any {
    const totalSessions = this.healthMetrics.get('sessions.total') || 1;
    const crashedSessions = this.healthMetrics.get('crashes.total') || 0;
    const totalUsers = this.healthMetrics.get('users.total') || 1;
    const crashedUsers = this.healthMetrics.get('users.crashed') || 0;

    return {
      crashFreeSessionsRate:
        ((totalSessions - crashedSessions) / totalSessions) * 100,
      crashFreeUsersRate: ((totalUsers - crashedUsers) / totalUsers) * 100,
      adoptionRate: this.calculateAdoptionRate(),
      totalSessions,
      crashedSessions,
      totalUsers,
      crashedUsers,
    };
  }

  /**
   * Calculate version adoption rate (mock implementation)
   */
  private calculateAdoptionRate(): number {
    // Should integrate with actual user analytics data
    // Return mock values for now
    return Math.random() * 100;
  }

  /**
   * Get days since release
   */
  private getDaysSinceRelease(version: string): number {
    // Should integrate with actual release time data
    // Return mock values for now
    const releaseDate = this.releaseMetrics.get(`release.${version}.date`);
    if (!releaseDate) return 0;

    return Math.floor((Date.now() - releaseDate) / (24 * 60 * 60 * 1000));
  }

  /**
   *
   */
  private setupCriticalEventTriggers(): void {
    //
    process.on('uncaughtException', () => {
      this.incrementMetric('crashes.total');
      this.checkReleaseHealthThresholds();
    });

    //
    app.on('ready', () => {
      this.incrementMetric('sessions.total');
    });
  }

  /**
   * DOTel
   */
  private startHealthSession(): void {
    const sessionId = this.generateSessionId();

    Sentry.addBreadcrumb({
      message: '',
      category: 'session',
      level: 'info',
      data: {
        sessionId,
        timestamp: new Date().toISOString(),
        platform: process.platform,
        version: app.getVersion?.() ?? 'unknown',
        // OTel
        'service.name': 'guild-manager',
        'service.version': app.getVersion?.() ?? 'unknown',
        'deployment.environment': process.env.NODE_ENV || 'production',
      },
    });

    //
    this.healthMetrics.set('session.started', 1);
    this.healthMetrics.set('session.start_time', this.sessionStartTime);
    this.healthMetrics.set(
      'sessions.total',
      (this.healthMetrics.get('sessions.total') || 0) + 1
    );
  }

  /**
   *
   */
  private setupAppEventMonitoring(): void {
    //
    app.on('ready', () => {
      const readyTime = Date.now() - this.sessionStartTime;
      this.healthMetrics.set('app.ready_time', readyTime);

      Sentry.setTag('app.ready_time', `${readyTime}ms`);
      Sentry.addBreadcrumb({
        message: '',
        category: 'app',
        level: 'info',
        data: {
          readyTime: `${readyTime}ms`,
          'duration.startup': readyTime,
          'event.name': 'app.ready',
        },
      });
    });

    //
    app.on('activate', () => {
      this.incrementMetric('app.activations');
    });

    //
    app.on('browser-window-created', (_event, window) => {
      this.incrementMetric('windows.created');

      //
      window.webContents.on(
        'render-process-gone',
        (_event: any, details: any) => {
          this.recordCrashEvent('renderer', { details });
        }
      );

      //
      window.on('unresponsive', () => {
        this.recordUnresponsiveEvent();
      });
    });
  }

  /**
   *
   */
  private setupHealthReporting(): void {
    //  5
    setInterval(
      () => {
        this.reportHealthMetrics();
      },
      5 * 60 * 1000
    );

    //
    app.on('before-quit', () => {
      this.reportFinalHealthMetrics();
    });
  }

  /**
   *
   */
  private setupGameHealthMonitoring(): void {
    //
    this.monitorGameSessionQuality();

    //
    this.monitorCriticalGameFlows();

    //
    this.monitorPerformanceMetrics();
  }

  /**
   *
   */
  private monitorGameSessionQuality(): void {
    //
    setInterval(() => {
      const gameMetrics = this.collectGameMetrics();

      //
      if (gameMetrics.sessionIntegrityRate < 99.5) {
        Sentry.captureMessage('', 'warning');
      }
    }, 60 * 1000); //
  }

  /**
   *
   */
  private collectGameMetrics(): any {
    return {
      sessionIntegrityRate: 99.8, //
      phaserEngineErrors: 0,
      uiGameCommunicationErrors: 0,
    };
  }

  /**
   *
   */
  private monitorCriticalGameFlows(): void {
    //
    //

    // EventBus
    //
    this.monitorStartupFlow();
  }

  /**
   *
   */
  private monitorStartupFlow(): void {
    const startupStages = [
      'electron.ready',
      'react.mounted',
      'phaser.initialized',
      'game.loaded',
    ];
    const stageTimings: Map<string, number> = new Map();

    startupStages.forEach(stage => {
      //
      //
      setTimeout(() => {
        stageTimings.set(stage, Date.now());

        if (stageTimings.size === startupStages.length) {
          this.reportStartupPerformance(stageTimings);
        }
      }, Math.random() * 3000);
    });
  }

  /**
   *
   */
  private reportStartupPerformance(timings: Map<string, number>): void {
    const startupData = Object.fromEntries(timings);

    Sentry.addBreadcrumb({
      message: '',
      category: 'performance',
      level: 'info',
      data: {
        ...startupData,
        'performance.category': 'startup',
        'measurement.unit': 'milliseconds',
      },
    });
  }

  /**
   *
   */
  private monitorPerformanceMetrics(): void {
    //
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.healthMetrics.set('performance.memory.rss', memUsage.rss);
      this.healthMetrics.set('performance.memory.heapUsed', memUsage.heapUsed);

      //
      if (memUsage.heapUsed > 500 * 1024 * 1024) {
        // 500MB
        Sentry.captureMessage('', 'warning');
      }
    }, 30 * 1000); // 30
  }

  /**
   *
   */
  private recordCrashEvent(type: string, details: any): void {
    this.incrementMetric('crashes.total');
    this.incrementMetric(`crashes.${type}`);

    Sentry.captureException(new Error(`${type} process crashed`), {
      tags: {
        'crash.type': type,
        'error.category': 'crash',
      },
      extra: details,
    });

    //
    this.checkReleaseHealthThresholds();
  }

  /**
   *
   */
  private recordUnresponsiveEvent(): void {
    this.incrementMetric('unresponsive.total');

    Sentry.captureMessage('', 'warning');
  }

  /**
   *
   */
  private incrementMetric(key: string): void {
    this.healthMetrics.set(key, (this.healthMetrics.get(key) || 0) + 1);
  }

  /**
   * OTel
   */
  private reportHealthMetrics(): void {
    const metrics = Object.fromEntries(this.healthMetrics);
    const sessionDuration = Date.now() - this.sessionStartTime;
    const healthSummary = this.calculateCurrentHealthMetrics();

    Sentry.addBreadcrumb({
      message: '',
      category: 'health',
      level: 'info',
      data: {
        ...metrics,
        sessionDuration: `${Math.round(sessionDuration / 1000)}s`,
        // OTel
        'metric.name': 'app.health.report',
        'metric.unit': 'count',
        'service.health.status': this.determineHealthStatus(healthSummary),
      },
    });
  }

  /**
   *
   */
  private determineHealthStatus(metrics: any): string {
    if (
      metrics.crashFreeSessionsRate <
        RELEASE_HEALTH_THRESHOLDS.crashFreeSessionsRate ||
      metrics.crashFreeUsersRate < RELEASE_HEALTH_THRESHOLDS.crashFreeUsersRate
    ) {
      return 'unhealthy';
    }

    if (
      metrics.crashFreeSessionsRate < 99.8 ||
      metrics.crashFreeUsersRate < 99.9
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   *
   */
  private reportFinalHealthMetrics(): void {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const metrics = Object.fromEntries(this.healthMetrics);
    const finalHealthSummary = this.calculateCurrentHealthMetrics();

    Sentry.setContext('session_summary', {
      duration: sessionDuration,
      ...metrics,
      healthSummary: finalHealthSummary,
      ended_at: new Date().toISOString(),
      // OTel
      'session.duration': sessionDuration,
      'session.end.reason': 'normal',
    });

    Sentry.captureMessage('', 'info');
  }

  /**
   * ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   *
   */
  getHealthThresholds(): ReleaseHealthThresholds {
    return RELEASE_HEALTH_THRESHOLDS;
  }

  /**
   *
   */
  getCurrentHealth(): any {
    return this.calculateCurrentHealthMetrics();
  }
}

//
export const releaseHealthManager = ReleaseHealthManager.getInstance();
