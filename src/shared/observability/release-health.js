'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.releaseHealthManager = exports.ReleaseHealthManager = void 0;
const Sentry = __importStar(require('@sentry/electron/main'));
const electron_1 = require('electron');
const RELEASE_HEALTH_THRESHOLDS = {
  crashFreeSessionsRate: 99.5, // 99.5%无崩溃会话率
  crashFreeUsersRate: 99.8, // 99.8%无崩溃用户率
  adoptionRate7d: 50.0, // 7天内50%用户升级
  adoptionRateMin14d: 30.0, // 14天内30%最低线
};
/**
 * Release Health专项配置和监控
 * 实现Dev→CI→Prod闭环和健康门槛监控
 */
class ReleaseHealthManager {
  static instance;
  healthMetrics = new Map();
  sessionStartTime = Date.now();
  releaseMetrics = new Map();
  static getInstance() {
    if (!ReleaseHealthManager.instance) {
      ReleaseHealthManager.instance = new ReleaseHealthManager();
    }
    return ReleaseHealthManager.instance;
  }
  /**
   * 初始化Release Health监控
   */
  initializeReleaseHealth() {
    console.log('🏥 初始化Release Health监控...');
    // 🎯 开始会话跟踪
    this.startHealthSession();
    // 🔍 监控关键应用事件
    this.setupAppEventMonitoring();
    // 📊 定期报告健康状态
    this.setupHealthReporting();
    // 🎮 游戏特定健康指标
    this.setupGameHealthMonitoring();
    // 🚨 Release健康门槛监控
    this.setupReleaseHealthGating();
  }
  /**
   * 设置Release健康门槛监控
   */
  setupReleaseHealthGating() {
    console.log('🚨 设置Release健康门槛监控...');
    // 定期检查健康门槛
    setInterval(
      () => {
        this.checkReleaseHealthThresholds();
      },
      10 * 60 * 1000
    ); // 每10分钟检查
    // 关键事件触发检查
    this.setupCriticalEventTriggers();
  }
  /**
   * 检查Release健康门槛
   */
  checkReleaseHealthThresholds() {
    const currentMetrics = this.calculateCurrentHealthMetrics();
    // 🚨 崩溃率检查
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
    // 📈 采用率检查
    this.checkAdoptionRates(currentMetrics);
  }
  /**
   * 检查版本采用率
   */
  checkAdoptionRates(metrics) {
    const currentRelease = electron_1.app.getVersion?.() ?? 'unknown';
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
   * 触发健康告警
   */
  triggerHealthAlert(alertType, data) {
    console.error(`🚨 Release健康门槛触发: ${alertType}`, data);
    Sentry.captureMessage(`Release健康门槛违规: ${alertType}`, {
      level: data.severity,
      tags: {
        'alert.type': alertType,
        'release.version': electron_1.app.getVersion?.() ?? 'unknown',
        'alert.severity': data.severity,
      },
      extra: data,
    });
    // 关键阈值触发时可以执行回滚逻辑
    if (data.severity === 'critical') {
      this.considerRollback(alertType, data);
    }
  }
  /**
   * 考虑版本回滚
   */
  considerRollback(alertType, data) {
    console.warn('🔄 检测到关键健康问题，考虑版本回滚...');
    // 这里可以集成自动回滚逻辑
    // 例如：通知CI/CD系统、标记版本为不健康等
    Sentry.addBreadcrumb({
      message: '考虑版本回滚',
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
   * 计算当前健康指标
   */
  calculateCurrentHealthMetrics() {
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
   * 计算版本采用率（模拟实现）
   */
  calculateAdoptionRate() {
    // 这里应该接入实际的用户分析数据
    // 暂时返回模拟值
    return Math.random() * 100;
  }
  /**
   * 获取发布后天数
   */
  getDaysSinceRelease(version) {
    // 这里应该接入实际的发布时间数据
    // 暂时返回模拟值
    const releaseDate = this.releaseMetrics.get(`release.${version}.date`);
    if (!releaseDate) return 0;
    return Math.floor((Date.now() - releaseDate) / (24 * 60 * 60 * 1000));
  }
  /**
   * 设置关键事件触发器
   */
  setupCriticalEventTriggers() {
    // 崩溃事件立即检查
    process.on('uncaughtException', () => {
      this.incrementMetric('crashes.total');
      this.checkReleaseHealthThresholds();
    });
    // 应用启动时记录会话
    electron_1.app.on('ready', () => {
      this.incrementMetric('sessions.total');
    });
  }
  /**
   * 开始健康会话（D建议：OTel兼容格式）
   */
  startHealthSession() {
    const sessionId = this.generateSessionId();
    Sentry.addBreadcrumb({
      message: '应用健康会话开始',
      category: 'session',
      level: 'info',
      data: {
        sessionId,
        timestamp: new Date().toISOString(),
        platform: process.platform,
        version: electron_1.app.getVersion?.() ?? 'unknown',
        // OTel语义字段
        'service.name': 'guild-manager',
        'service.version': electron_1.app.getVersion?.() ?? 'unknown',
        'deployment.environment': process.env.NODE_ENV || 'production',
      },
    });
    // 记录会话开始指标
    this.healthMetrics.set('session.started', 1);
    this.healthMetrics.set('session.start_time', this.sessionStartTime);
    this.healthMetrics.set(
      'sessions.total',
      (this.healthMetrics.get('sessions.total') || 0) + 1
    );
  }
  /**
   * 监控应用事件
   */
  setupAppEventMonitoring() {
    // 🎯 应用就绪事件
    electron_1.app.on('ready', () => {
      const readyTime = Date.now() - this.sessionStartTime;
      this.healthMetrics.set('app.ready_time', readyTime);
      Sentry.setTag('app.ready_time', `${readyTime}ms`);
      Sentry.addBreadcrumb({
        message: '应用启动完成',
        category: 'app',
        level: 'info',
        data: {
          readyTime: `${readyTime}ms`,
          'duration.startup': readyTime,
          'event.name': 'app.ready',
        },
      });
    });
    // 🔄 应用激活事件
    electron_1.app.on('activate', () => {
      this.incrementMetric('app.activations');
    });
    // 🎯 窗口创建监控
    electron_1.app.on('browser-window-created', (_event, window) => {
      this.incrementMetric('windows.created');
      // 监控窗口崩溃
      window.webContents.on('render-process-gone', (_event, details) => {
        this.recordCrashEvent('renderer', { details });
      });
      // 监控窗口无响应
      window.on('unresponsive', () => {
        this.recordUnresponsiveEvent();
      });
    });
  }
  /**
   * 设置健康状态报告
   */
  setupHealthReporting() {
    // 📊 每5分钟报告一次健康状态
    setInterval(
      () => {
        this.reportHealthMetrics();
      },
      5 * 60 * 1000
    );
    // 🎯 应用退出时报告最终状态
    electron_1.app.on('before-quit', () => {
      this.reportFinalHealthMetrics();
    });
  }
  /**
   * 游戏特定健康监控
   */
  setupGameHealthMonitoring() {
    // 🎮 监控游戏会话质量
    this.monitorGameSessionQuality();
    // 🎯 监控关键游戏流程
    this.monitorCriticalGameFlows();
    // 📊 监控性能指标
    this.monitorPerformanceMetrics();
  }
  /**
   * 监控游戏会话质量
   */
  monitorGameSessionQuality() {
    // 游戏特定的会话质量监控
    setInterval(() => {
      const gameMetrics = this.collectGameMetrics();
      // 检查游戏会话完整性
      if (gameMetrics.sessionIntegrityRate < 99.5) {
        Sentry.captureMessage('游戏会话完整性低于阈值', 'warning');
      }
    }, 60 * 1000); // 每分钟检查
  }
  /**
   * 收集游戏指标
   */
  collectGameMetrics() {
    return {
      sessionIntegrityRate: 99.8, // 模拟值
      phaserEngineErrors: 0,
      uiGameCommunicationErrors: 0,
    };
  }
  /**
   * 监控关键游戏流程
   */
  monitorCriticalGameFlows() {
    // 实现关键业务流程监控
    // 例如：登录、保存、战斗、交易等
    // 这里可以通过EventBus监听游戏事件
    // 示例：监控启动流程
    this.monitorStartupFlow();
  }
  /**
   * 监控启动流程
   */
  monitorStartupFlow() {
    const startupStages = [
      'electron.ready',
      'react.mounted',
      'phaser.initialized',
      'game.loaded',
    ];
    const stageTimings = new Map();
    startupStages.forEach(stage => {
      // 这里应该集成实际的事件监听
      // 暂时使用定时器模拟
      setTimeout(() => {
        stageTimings.set(stage, Date.now());
        if (stageTimings.size === startupStages.length) {
          this.reportStartupPerformance(stageTimings);
        }
      }, Math.random() * 3000);
    });
  }
  /**
   * 报告启动性能
   */
  reportStartupPerformance(timings) {
    const startupData = Object.fromEntries(timings);
    Sentry.addBreadcrumb({
      message: '启动性能报告',
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
   * 监控性能指标
   */
  monitorPerformanceMetrics() {
    // 📊 内存使用监控
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.healthMetrics.set('performance.memory.rss', memUsage.rss);
      this.healthMetrics.set('performance.memory.heapUsed', memUsage.heapUsed);
      // 🚨 内存泄漏检测
      if (memUsage.heapUsed > 500 * 1024 * 1024) {
        // 500MB
        Sentry.captureMessage('内存使用过高', 'warning');
      }
    }, 30 * 1000); // 每30秒检查
  }
  /**
   * 记录崩溃事件
   */
  recordCrashEvent(type, details) {
    this.incrementMetric('crashes.total');
    this.incrementMetric(`crashes.${type}`);
    Sentry.captureException(new Error(`${type} process crashed`), {
      tags: {
        'crash.type': type,
        'error.category': 'crash',
      },
      extra: details,
    });
    // 立即检查健康门槛
    this.checkReleaseHealthThresholds();
  }
  /**
   * 记录无响应事件
   */
  recordUnresponsiveEvent() {
    this.incrementMetric('unresponsive.total');
    Sentry.captureMessage('应用无响应', 'warning');
  }
  /**
   * 增加指标计数
   */
  incrementMetric(key) {
    this.healthMetrics.set(key, (this.healthMetrics.get(key) || 0) + 1);
  }
  /**
   * 报告健康指标（OTel兼容格式）
   */
  reportHealthMetrics() {
    const metrics = Object.fromEntries(this.healthMetrics);
    const sessionDuration = Date.now() - this.sessionStartTime;
    const healthSummary = this.calculateCurrentHealthMetrics();
    Sentry.addBreadcrumb({
      message: '健康状态报告',
      category: 'health',
      level: 'info',
      data: {
        ...metrics,
        sessionDuration: `${Math.round(sessionDuration / 1000)}s`,
        // OTel语义字段
        'metric.name': 'app.health.report',
        'metric.unit': 'count',
        'service.health.status': this.determineHealthStatus(healthSummary),
      },
    });
  }
  /**
   * 确定健康状态
   */
  determineHealthStatus(metrics) {
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
   * 报告最终健康指标
   */
  reportFinalHealthMetrics() {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const metrics = Object.fromEntries(this.healthMetrics);
    const finalHealthSummary = this.calculateCurrentHealthMetrics();
    Sentry.setContext('session_summary', {
      duration: sessionDuration,
      ...metrics,
      healthSummary: finalHealthSummary,
      ended_at: new Date().toISOString(),
      // OTel语义
      'session.duration': sessionDuration,
      'session.end.reason': 'normal',
    });
    Sentry.captureMessage('会话结束健康报告', 'info');
  }
  /**
   * 生成会话ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * 获取健康门槛配置
   */
  getHealthThresholds() {
    return RELEASE_HEALTH_THRESHOLDS;
  }
  /**
   * 获取当前健康状态
   */
  getCurrentHealth() {
    return this.calculateCurrentHealthMetrics();
  }
}
exports.ReleaseHealthManager = ReleaseHealthManager;
// 导出单例实例
exports.releaseHealthManager = ReleaseHealthManager.getInstance();
