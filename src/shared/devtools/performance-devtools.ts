/**
 * 性能闸DevTools可视化工具
 * 提供User Timing性能数据的可视化界面和调试能力
 */

import { userTiming } from '../performance/UserTiming.js';

export interface PerformanceVisualizationData {
  measurements: Array<{
    name: string;
    startTime: number;
    duration: number;
    color: string;
    category: 'app' | 'game' | 'ui' | 'data' | 'ipc';
  }>;
  thresholds: Array<{
    name: string;
    p95Threshold: number;
    currentP95: number;
    status: 'good' | 'warning' | 'critical';
  }>;
  timeline: Array<{
    timestamp: number;
    event: string;
    duration?: number;
  }>;
}

/**
 * DevTools性能可视化管理器
 */
export class PerformanceDevTools {
  private static instance: PerformanceDevTools;
  private visualizationPanel: HTMLElement | null = null;
  private isEnabled = false;
  private measurements: Map<string, number[]> = new Map();
  private thresholdAlerts: Array<{
    name: string;
    timestamp: number;
    severity: string;
  }> = [];

  static getInstance(): PerformanceDevTools {
    if (!PerformanceDevTools.instance) {
      PerformanceDevTools.instance = new PerformanceDevTools();
    }
    return PerformanceDevTools.instance;
  }

  /**
   * 启用DevTools面板
   */
  enable() {
    if (this.isEnabled) return;

    this.isEnabled = true;
    this.createVisualizationPanel();
    this.setupPerformanceMonitoring();
    this.injectStyles();

    console.log('[PerformanceDevTools] 性能可视化已启用');
  }

  /**
   * 禁用DevTools面板
   */
  disable() {
    if (!this.isEnabled) return;

    this.isEnabled = false;
    if (this.visualizationPanel) {
      document.body.removeChild(this.visualizationPanel);
      this.visualizationPanel = null;
    }

    console.log('[PerformanceDevTools] 性能可视化已禁用');
  }

  /**
   * 创建可视化面板
   */
  private createVisualizationPanel() {
    this.visualizationPanel = document.createElement('div');
    this.visualizationPanel.id = 'performance-devtools-panel';
    this.visualizationPanel.className = 'perf-devtools-panel';

    this.visualizationPanel.innerHTML = `
      <div class="perf-devtools-header">
        <h3>🚀 性能监控面板</h3>
        <div class="perf-devtools-controls">
          <button id="perf-toggle-recording" class="perf-btn">开始记录</button>
          <button id="perf-clear-data" class="perf-btn">清除数据</button>
          <button id="perf-export-data" class="perf-btn">导出数据</button>
          <button id="perf-close-panel" class="perf-btn perf-btn-close">×</button>
        </div>
      </div>
      
      <div class="perf-devtools-content">
        <div class="perf-section">
          <h4>⏱️ 实时性能指标</h4>
          <div id="perf-metrics-grid" class="perf-metrics-grid"></div>
        </div>
        
        <div class="perf-section">
          <h4>📊 P95阈值监控</h4>
          <div id="perf-thresholds-list" class="perf-thresholds-list"></div>
        </div>
        
        <div class="perf-section">
          <h4>📈 性能时间线</h4>
          <canvas id="perf-timeline-chart" class="perf-timeline-chart"></canvas>
        </div>
        
        <div class="perf-section">
          <h4>🔍 测量详情</h4>
          <div id="perf-measurements-table" class="perf-measurements-table"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.visualizationPanel);
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    if (!this.visualizationPanel) return;

    // 关闭面板
    const closeBtn = this.visualizationPanel.querySelector('#perf-close-panel');
    closeBtn?.addEventListener('click', () => this.disable());

    // 清除数据
    const clearBtn = this.visualizationPanel.querySelector('#perf-clear-data');
    clearBtn?.addEventListener('click', () => this.clearData());

    // 导出数据
    const exportBtn =
      this.visualizationPanel.querySelector('#perf-export-data');
    exportBtn?.addEventListener('click', () => this.exportData());

    // 记录控制
    const toggleBtn = this.visualizationPanel.querySelector(
      '#perf-toggle-recording'
    );
    toggleBtn?.addEventListener('click', e =>
      this.toggleRecording(e.target as HTMLButtonElement)
    );
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring() {
    // 定期更新显示
    setInterval(() => {
      if (this.isEnabled) {
        this.updateVisualization();
      }
    }, 1000);

    // 监听performance事件
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'measure') {
            this.recordMeasurement(entry.name, entry.duration);
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('[PerformanceDevTools] PerformanceObserver不可用:', error);
      }
    }
  }

  /**
   * 记录测量数据
   */
  private recordMeasurement(name: string, duration: number) {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }

    const measurements = this.measurements.get(name)!;
    measurements.push(duration);

    // 保留最近100个测量值
    if (measurements.length > 100) {
      measurements.shift();
    }

    // 检查阈值
    this.checkThresholds(name, duration);
  }

  /**
   * 检查性能阈值
   */
  private checkThresholds(name: string, duration: number) {
    const report = userTiming.getPerformanceReport();
    const metrics = report[name];

    if (metrics && metrics.threshold) {
      let severity = 'info';

      if (duration > metrics.threshold.critical) {
        severity = 'critical';
      } else if (duration > metrics.threshold.warning) {
        severity = 'warning';
      }

      if (severity !== 'info') {
        this.thresholdAlerts.push({
          name,
          timestamp: Date.now(),
          severity,
        });

        // 保留最近50个警报
        if (this.thresholdAlerts.length > 50) {
          this.thresholdAlerts.shift();
        }
      }
    }
  }

  /**
   * 更新可视化显示
   */
  private updateVisualization() {
    if (!this.visualizationPanel) return;

    this.updateMetricsGrid();
    this.updateThresholdsList();
    this.updateTimelineChart();
    this.updateMeasurementsTable();
  }

  /**
   * 更新指标网格
   */
  private updateMetricsGrid() {
    const container =
      this.visualizationPanel?.querySelector('#perf-metrics-grid');
    if (!container) return;

    const report = userTiming.getPerformanceReport();
    const html = Object.entries(report)
      .map(([name, stats]) => {
        if (typeof stats !== 'object' || !stats.count) return '';

        const statusColor = this.getStatusColor(stats.status);

        return `
          <div class="perf-metric-card" style="border-left: 4px solid ${statusColor}">
            <div class="perf-metric-name">${name}</div>
            <div class="perf-metric-values">
              <span class="perf-metric-value">P95: ${stats.p95 || 'N/A'}ms</span>
              <span class="perf-metric-value">平均: ${stats.avg}ms</span>
              <span class="perf-metric-value">计数: ${stats.count}</span>
            </div>
            <div class="perf-metric-status perf-status-${stats.status}">${this.getStatusText(stats.status)}</div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = html;
  }

  /**
   * 更新阈值列表
   */
  private updateThresholdsList() {
    const container = this.visualizationPanel?.querySelector(
      '#perf-thresholds-list'
    );
    if (!container) return;

    const report = userTiming.getPerformanceReport();
    const html = Object.entries(report)
      .filter(([_, stats]) => typeof stats === 'object' && stats.threshold)
      .map(([name, stats]) => {
        const p95 = stats.p95 || 0;
        const threshold = stats.threshold.p95;
        const percentage = ((p95 / threshold) * 100).toFixed(1);
        const isOverThreshold = p95 > threshold;

        return `
          <div class="perf-threshold-item ${isOverThreshold ? 'perf-threshold-exceeded' : ''}">
            <div class="perf-threshold-name">${name}</div>
            <div class="perf-threshold-bar">
              <div class="perf-threshold-progress" style="width: ${Math.min(100, parseFloat(percentage))}%"></div>
            </div>
            <div class="perf-threshold-values">
              <span>${p95}ms / ${threshold}ms (${percentage}%)</span>
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = html;
  }

  /**
   * 更新时间线图表
   */
  private updateTimelineChart() {
    const canvas = this.visualizationPanel?.querySelector(
      '#perf-timeline-chart'
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制时间线
    this.drawTimeline(ctx, canvas.width, canvas.height);
  }

  /**
   * 绘制性能时间线
   */
  private drawTimeline(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    const now = Date.now();
    const timeWindow = 60000; // 显示最近60秒
    const startTime = now - timeWindow;

    // 绘制背景网格
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    // 垂直网格线 (时间)
    for (let i = 0; i <= 6; i++) {
      const x = (width / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // 时间标签
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      const timeLabel = `${60 - i * 10}s`;
      ctx.fillText(timeLabel, x + 2, height - 5);
    }

    // 水平网格线 (性能值)
    const maxValue = 1000; // 最大1秒
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // 性能值标签
      const valueLabel = `${maxValue - (maxValue / 4) * i}ms`;
      ctx.fillText(valueLabel, 2, y + 12);
    }

    // 绘制性能数据线
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
    let colorIndex = 0;

    this.measurements.forEach((measurements, name) => {
      if (measurements.length === 0) return;

      ctx.strokeStyle = colors[colorIndex % colors.length];
      ctx.lineWidth = 2;
      ctx.beginPath();

      let isFirstPoint = true;

      measurements.forEach((value, index) => {
        // 假设测量点均匀分布在时间窗口内
        const x = (index / measurements.length) * width;
        const y = height - (value / maxValue) * height;

        if (isFirstPoint) {
          ctx.moveTo(x, y);
          isFirstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
      colorIndex++;
    });
  }

  /**
   * 更新测量表格
   */
  private updateMeasurementsTable() {
    const container = this.visualizationPanel?.querySelector(
      '#perf-measurements-table'
    );
    if (!container) return;

    const report = userTiming.getPerformanceReport();
    const tableRows = Object.entries(report)
      .filter(([_, stats]) => typeof stats === 'object' && stats.count)
      .map(
        ([name, stats]) => `
        <tr class="perf-table-row">
          <td class="perf-table-cell">${name}</td>
          <td class="perf-table-cell">${stats.count}</td>
          <td class="perf-table-cell">${stats.avg}ms</td>
          <td class="perf-table-cell">${stats.min}ms</td>
          <td class="perf-table-cell">${stats.max}ms</td>
          <td class="perf-table-cell">${stats.p95 || 'N/A'}ms</td>
          <td class="perf-table-cell">
            <span class="perf-status-badge perf-status-${stats.status}">${this.getStatusText(stats.status)}</span>
          </td>
        </tr>
      `
      )
      .join('');

    container.innerHTML = `
      <table class="perf-table">
        <thead>
          <tr class="perf-table-header">
            <th class="perf-table-cell">测量名称</th>
            <th class="perf-table-cell">次数</th>
            <th class="perf-table-cell">平均值</th>
            <th class="perf-table-cell">最小值</th>
            <th class="perf-table-cell">最大值</th>
            <th class="perf-table-cell">P95</th>
            <th class="perf-table-cell">状态</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  }

  /**
   * 获取状态颜色
   */
  private getStatusColor(status: string): string {
    switch (status) {
      case 'good':
        return '#28a745';
      case 'warning':
        return '#ffc107';
      case 'elevated':
        return '#fd7e14';
      case 'critical':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'good':
        return '良好';
      case 'warning':
        return '警告';
      case 'elevated':
        return '升高';
      case 'critical':
        return '严重';
      default:
        return '未知';
    }
  }

  /**
   * 切换记录状态
   */
  private toggleRecording(button: HTMLButtonElement) {
    // 这里可以实现启停记录的逻辑
    const isRecording = button.textContent === '停止记录';

    if (isRecording) {
      button.textContent = '开始记录';
      button.classList.remove('perf-btn-recording');
    } else {
      button.textContent = '停止记录';
      button.classList.add('perf-btn-recording');
    }
  }

  /**
   * 清除数据
   */
  private clearData() {
    this.measurements.clear();
    this.thresholdAlerts = [];
    userTiming.clearMeasurements();
    this.updateVisualization();

    console.log('[PerformanceDevTools] 性能数据已清除');
  }

  /**
   * 导出数据
   */
  private exportData() {
    const report = userTiming.getPerformanceReport();
    const exportData = {
      timestamp: new Date().toISOString(),
      report,
      alerts: this.thresholdAlerts,
      measurements: Object.fromEntries(this.measurements),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[PerformanceDevTools] 性能数据已导出');
  }

  /**
   * 注入样式
   */
  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .perf-devtools-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 600px;
        max-height: 80vh;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        z-index: 10000;
        overflow: hidden;
      }
      
      .perf-devtools-header {
        background: #f8f9fa;
        padding: 12px 16px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .perf-devtools-header h3 {
        margin: 0;
        font-size: 14px;
        color: #495057;
      }
      
      .perf-devtools-controls {
        display: flex;
        gap: 8px;
      }
      
      .perf-btn {
        padding: 4px 8px;
        border: 1px solid #ced4da;
        background: #fff;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      }
      
      .perf-btn:hover {
        background: #e9ecef;
      }
      
      .perf-btn-close {
        background: #dc3545;
        color: white;
        border-color: #dc3545;
      }
      
      .perf-btn-recording {
        background: #dc3545;
        color: white;
        border-color: #dc3545;
      }
      
      .perf-devtools-content {
        max-height: 70vh;
        overflow-y: auto;
        padding: 16px;
      }
      
      .perf-section {
        margin-bottom: 20px;
      }
      
      .perf-section h4 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: #6c757d;
        font-weight: 600;
      }
      
      .perf-metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
      }
      
      .perf-metric-card {
        background: #f8f9fa;
        padding: 8px;
        border-radius: 4px;
        border-left: 4px solid #28a745;
      }
      
      .perf-metric-name {
        font-weight: 600;
        font-size: 11px;
        margin-bottom: 4px;
        color: #495057;
      }
      
      .perf-metric-values {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .perf-metric-value {
        font-size: 10px;
        color: #6c757d;
      }
      
      .perf-metric-status {
        margin-top: 4px;
        font-size: 10px;
        font-weight: 600;
      }
      
      .perf-status-good { color: #28a745; }
      .perf-status-warning { color: #ffc107; }
      .perf-status-elevated { color: #fd7e14; }
      .perf-status-critical { color: #dc3545; }
      
      .perf-threshold-item {
        padding: 8px;
        margin-bottom: 4px;
        background: #f8f9fa;
        border-radius: 4px;
      }
      
      .perf-threshold-exceeded {
        background: #fff5f5;
        border-left: 3px solid #dc3545;
      }
      
      .perf-threshold-name {
        font-weight: 600;
        font-size: 11px;
        margin-bottom: 4px;
      }
      
      .perf-threshold-bar {
        background: #e9ecef;
        height: 4px;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 4px;
      }
      
      .perf-threshold-progress {
        background: #28a745;
        height: 100%;
        transition: width 0.3s ease;
      }
      
      .perf-threshold-exceeded .perf-threshold-progress {
        background: #dc3545;
      }
      
      .perf-threshold-values {
        font-size: 10px;
        color: #6c757d;
      }
      
      .perf-timeline-chart {
        width: 100%;
        height: 200px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
      }
      
      .perf-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      
      .perf-table-header {
        background: #f8f9fa;
      }
      
      .perf-table-cell {
        padding: 6px 8px;
        border: 1px solid #dee2e6;
        text-align: left;
      }
      
      .perf-table-row:nth-child(even) {
        background: #f8f9fa;
      }
      
      .perf-status-badge {
        padding: 2px 6px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
      }
    `;

    document.head.appendChild(style);
  }
}

// 导出单例实例
export const performanceDevTools = PerformanceDevTools.getInstance();

// 快速启动函数
export function enablePerformanceDevTools() {
  performanceDevTools.enable();
}

// 键盘快捷键支持
if (typeof window !== 'undefined') {
  document.addEventListener('keydown', e => {
    // Ctrl+Shift+P 启动性能面板
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      performanceDevTools.enable();
    }
  });
}

// 控制台命令
if (typeof window !== 'undefined') {
  (window as any).enablePerformanceDevTools = enablePerformanceDevTools;
  console.log(
    '[PerformanceDevTools] 可用命令: enablePerformanceDevTools() 或 Ctrl+Shift+P'
  );
}
