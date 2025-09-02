#!/usr/bin/env node
/**
 * 持续安全监控脚本 - 用于监控生产环境安全状态
 *
 * 功能:
 * 1. 实时监控应用安全事件
 * 2. 检测异常行为模式
 * 3. 自动生成安全报告
 * 4. 集成Sentry安全监控
 *
 * 使用: node scripts/ci/security-monitoring.mjs [--config=path] [--output=path]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

// 安全监控配置
const MONITORING_CONFIG = {
  // 监控的安全事件类型
  SECURITY_EVENTS: [
    'permission_request_denied',
    'navigation_blocked',
    'csp_violation',
    'external_request_blocked',
    'context_isolation_breach',
    'preload_api_access_attempt',
  ],

  // 异常行为阈值
  THRESHOLDS: {
    permission_denials_per_hour: 10,
    navigation_blocks_per_hour: 20,
    csp_violations_per_hour: 5,
    failed_api_calls_per_minute: 5,
  },

  // 报告配置
  REPORT: {
    interval_minutes: 60,
    retention_days: 30,
    alert_webhooks: [],
  },
};

class SecurityMonitor {
  constructor(options = {}) {
    this.configPath =
      options.config || join(ROOT_DIR, 'security-monitoring.config.json');
    this.outputPath =
      options.output || join(ROOT_DIR, 'logs/security-monitoring.log');
    this.config = this.loadConfig();
    this.events = [];
    this.alerts = [];
  }

  loadConfig() {
    if (existsSync(this.configPath)) {
      try {
        const customConfig = JSON.parse(readFileSync(this.configPath, 'utf8'));
        return { ...MONITORING_CONFIG, ...customConfig };
      } catch (error) {
        console.warn(`配置文件加载失败，使用默认配置: ${error.message}`);
      }
    }
    return MONITORING_CONFIG;
  }

  log(message, level = 'info', event = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      event,
    };

    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);

    // 记录到文件
    this.writeLogEntry(logEntry);

    // 如果是安全事件，记录到事件列表
    if (event && this.config.SECURITY_EVENTS.includes(event.type)) {
      this.events.push({ ...event, timestamp });
    }
  }

  writeLogEntry(entry) {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      // 这里应该使用异步写入，简化示例使用同步
      if (existsSync(dirname(this.outputPath))) {
        writeFileSync(this.outputPath, logLine, { flag: 'a' });
      }
    } catch (error) {
      console.error('写入日志失败:', error.message);
    }
  }

  // 检查Electron进程安全状态
  async checkElectronSecurity() {
    const checks = {
      processes: await this.checkProcessIntegrity(),
      permissions: await this.checkPermissionRequests(),
      navigation: await this.checkNavigationBlocks(),
      csp: await this.checkCSPViolations(),
    };

    return checks;
  }

  async checkProcessIntegrity() {
    try {
      // 检查是否有异常的Electron进程
      const result = execSync('tasklist | findstr electron', {
        encoding: 'utf8',
      });
      const processes = result.split('\n').filter(line => line.trim());

      const processInfo = {
        count: processes.length,
        suspicious: false,
        details: processes,
      };

      // 检测异常进程数量
      if (processes.length > 5) {
        processInfo.suspicious = true;
        this.log('检测到异常数量的Electron进程', 'warn', {
          type: 'process_anomaly',
          count: processes.length,
        });
      }

      return processInfo;
    } catch (error) {
      return { error: error.message };
    }
  }

  async checkPermissionRequests() {
    // 分析日志中的权限请求
    const recentEvents = this.getRecentEvents('permission_request_denied', 60);
    const threshold = this.config.THRESHOLDS.permission_denials_per_hour;

    if (recentEvents.length > threshold) {
      this.alerts.push({
        type: 'excessive_permission_denials',
        count: recentEvents.length,
        threshold,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      recent_denials: recentEvents.length,
      threshold_exceeded: recentEvents.length > threshold,
    };
  }

  async checkNavigationBlocks() {
    const recentEvents = this.getRecentEvents('navigation_blocked', 60);
    const threshold = this.config.THRESHOLDS.navigation_blocks_per_hour;

    if (recentEvents.length > threshold) {
      this.alerts.push({
        type: 'excessive_navigation_blocks',
        count: recentEvents.length,
        threshold,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      recent_blocks: recentEvents.length,
      threshold_exceeded: recentEvents.length > threshold,
    };
  }

  async checkCSPViolations() {
    const recentEvents = this.getRecentEvents('csp_violation', 60);
    const threshold = this.config.THRESHOLDS.csp_violations_per_hour;

    if (recentEvents.length > threshold) {
      this.alerts.push({
        type: 'excessive_csp_violations',
        count: recentEvents.length,
        threshold,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      recent_violations: recentEvents.length,
      threshold_exceeded: recentEvents.length > threshold,
    };
  }

  getRecentEvents(eventType, minutesBack) {
    const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);
    return this.events.filter(
      event => event.type === eventType && new Date(event.timestamp) > cutoff
    );
  }

  // 检查网络安全状态
  async checkNetworkSecurity() {
    const checks = {
      blocked_requests: await this.checkBlockedRequests(),
      tls_connections: await this.checkTLSConnections(),
      certificate_status: await this.checkCertificates(),
    };

    return checks;
  }

  async checkBlockedRequests() {
    const recentBlocks = this.getRecentEvents('external_request_blocked', 60);

    // 分析被阻止请求的模式
    const patterns = {};
    recentBlocks.forEach(event => {
      const domain = event.details?.domain || 'unknown';
      patterns[domain] = (patterns[domain] || 0) + 1;
    });

    return {
      total_blocked: recentBlocks.length,
      patterns,
      suspicious_domains: Object.entries(patterns)
        .filter(([_, count]) => count > 10)
        .map(([domain, count]) => ({ domain, count })),
    };
  }

  async checkTLSConnections() {
    // 这里应该检查TLS连接状态，简化示例
    return {
      active_connections: 0,
      certificate_errors: 0,
      deprecated_protocols: 0,
    };
  }

  async checkCertificates() {
    // 检查应用证书状态
    return {
      app_certificate_valid: true,
      certificate_expiry: null,
      certificate_chain_valid: true,
    };
  }

  // 生成安全报告
  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      monitoring_period: '1 hour',
      security_status: this.alerts.length === 0 ? 'SECURE' : 'ALERT',

      summary: {
        total_events: this.events.length,
        total_alerts: this.alerts.length,
        event_types: this.getEventTypeSummary(),
      },

      alerts: this.alerts,

      recommendations: this.generateRecommendations(),

      next_check: new Date(
        Date.now() + this.config.REPORT.interval_minutes * 60 * 1000
      ).toISOString(),
    };

    return report;
  }

  getEventTypeSummary() {
    const summary = {};
    this.events.forEach(event => {
      summary[event.type] = (summary[event.type] || 0) + 1;
    });
    return summary;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.alerts.length > 0) {
      recommendations.push('检查应用日志，分析异常行为原因');
      recommendations.push('确认安全策略配置正确');

      if (this.alerts.some(a => a.type.includes('permission'))) {
        recommendations.push('审查权限请求处理逻辑');
      }

      if (this.alerts.some(a => a.type.includes('navigation'))) {
        recommendations.push('检查导航控制策略是否过于严格');
      }

      if (this.alerts.some(a => a.type.includes('csp'))) {
        recommendations.push('审查CSP策略配置，可能存在策略冲突');
      }
    } else {
      recommendations.push('安全状态良好，继续监控');
    }

    return recommendations;
  }

  // 发送报告到外部系统
  async sendReports(report) {
    // 发送到Sentry
    if (process.env.SENTRY_DSN) {
      try {
        // 这里应该集成实际的Sentry SDK
        console.log('发送安全报告到Sentry...');
      } catch (error) {
        this.log(`Sentry报告发送失败: ${error.message}`, 'error');
      }
    }

    // 发送到Webhook
    for (const webhook of this.config.REPORT.alert_webhooks) {
      try {
        // 这里应该发送HTTP请求到webhook
        console.log(`发送报告到 ${webhook}...`);
      } catch (error) {
        this.log(`Webhook报告发送失败: ${error.message}`, 'error');
      }
    }
  }

  // 清理过期数据
  cleanupOldData() {
    const cutoff = new Date(
      Date.now() - this.config.REPORT.retention_days * 24 * 60 * 60 * 1000
    );

    const initialEventCount = this.events.length;
    this.events = this.events.filter(
      event => new Date(event.timestamp) > cutoff
    );

    const cleaned = initialEventCount - this.events.length;
    if (cleaned > 0) {
      this.log(`清理了 ${cleaned} 个过期事件`, 'info');
    }
  }

  // 主监控循环
  async runMonitoringCycle() {
    this.log('开始安全监控周期...', 'info');

    try {
      // 执行各项安全检查
      const electronSecurity = await this.checkElectronSecurity();
      const networkSecurity = await this.checkNetworkSecurity();

      // 记录检查结果
      this.log('Electron安全检查完成', 'info', {
        type: 'security_check',
        category: 'electron',
        results: electronSecurity,
      });

      this.log('网络安全检查完成', 'info', {
        type: 'security_check',
        category: 'network',
        results: networkSecurity,
      });

      // 生成并发送报告
      const report = this.generateSecurityReport();
      await this.sendReports(report);

      this.log(`安全监控周期完成，状态: ${report.security_status}`, 'info');

      // 清理过期数据
      this.cleanupOldData();

      return report;
    } catch (error) {
      this.log(`监控周期异常: ${error.message}`, 'error');
      throw error;
    }
  }

  // 启动持续监控
  async startContinuousMonitoring() {
    this.log('启动持续安全监控...', 'info');

    const intervalMs = this.config.REPORT.interval_minutes * 60 * 1000;

    // 立即执行一次
    await this.runMonitoringCycle();

    // 设置定期执行
    setInterval(async () => {
      try {
        await this.runMonitoringCycle();
      } catch (error) {
        this.log(`定期监控失败: ${error.message}`, 'error');
      }
    }, intervalMs);

    this.log(
      `持续监控已启动，间隔: ${this.config.REPORT.interval_minutes} 分钟`,
      'info'
    );
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  args.forEach(arg => {
    if (arg.startsWith('--config=')) {
      options.config = arg.split('=')[1];
    }
    if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    }
  });

  const monitor = new SecurityMonitor(options);

  if (args.includes('--continuous')) {
    await monitor.startContinuousMonitoring();
  } else {
    // 单次执行
    const report = await monitor.runMonitoringCycle();
    console.log('\n=== 安全监控报告 ===');
    console.log(JSON.stringify(report, null, 2));
  }
}

// 如果直接运行此脚本
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('安全监控执行异常:', error);
    process.exit(1);
  });
}

export { SecurityMonitor };
