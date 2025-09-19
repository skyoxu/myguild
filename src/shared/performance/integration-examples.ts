/**
 * User Timing API集成示例
 * 展示如何在应用关键路径中集成性能测点
 */

import React from 'react';
import { userTiming, mark, measure, measureFunction } from './UserTiming.js';

/**
 * React组件性能测量示例
 */
export class ReactPerformanceIntegration {
  /**
   * 测量组件挂载时间
   */
  static wrapComponentMount<T>(Component: React.ComponentType<T>) {
    return class extends React.Component<T> {
      componentDidMount() {
        mark('react.component.mount.end');
        measure(
          'react.component.mount',
          'react.component.mount.start',
          'react.component.mount.end'
        );
      }

      componentWillMount() {
        mark('react.component.mount.start');
      }

      render() {
        return React.createElement(Component, this.props);
      }
    };
  }

  /**
   * 测量异步组件加载
   */
  static async measureAsyncComponent(loadComponent: () => Promise<any>) {
    return await measureFunction('react.component.async-load', loadComponent);
  }
}

/**
 * 游戏引擎(Phaser)性能测量示例
 */
export class PhaserPerformanceIntegration {
  /**
   * 测量场景创建时间
   */
  static instrumentScene(scene: Phaser.Scene) {
    const originalCreate = (scene as any).create?.bind(scene);
    const originalPreload = (scene as any).preload?.bind(scene);

    (scene as any).preload = function () {
      mark('phaser.scene.preload.start');
      originalPreload?.();
      mark('phaser.scene.preload.end');
      measure(
        'phaser.scene.preload',
        'phaser.scene.preload.start',
        'phaser.scene.preload.end'
      );
    };

    (scene as any).create = function () {
      mark('phaser.scene.create.start');
      originalCreate?.();
      mark('phaser.scene.create.end');
      measure(
        'phaser.scene.create',
        'phaser.scene.create.start',
        'phaser.scene.create.end'
      );
    };
  }

  /**
   * 测量游戏回合处理
   */
  static async measureTurnProcess(turnHandler: () => Promise<void>) {
    return await measureFunction('game.turn.process', turnHandler);
  }
}

/**
 * Electron IPC性能测量示例
 */
export class ElectronIPCPerformance {
  /**
   * 测量IPC调用时间
   */
  static async measureIPCCall<T>(channel: string, args: any[]): Promise<T> {
    const result = await measureFunction(
      `electron.ipc.call.${channel}`,
      async () => {
        // @ts-ignore - window.electronAPI通过preload脚本注入
        return await window.electronAPI.invoke(channel, ...args);
      }
    );
    return result as T;
  }

  /**
   * 批量测量多个IPC调用
   */
  static async measureMultipleIPCCalls(
    calls: Array<{ channel: string; args: any[] }>
  ) {
    const results = [];

    mark('electron.ipc.batch.start');

    for (const call of calls) {
      const result = await this.measureIPCCall(call.channel, call.args);
      results.push(result);
    }

    mark('electron.ipc.batch.end');
    measure(
      'electron.ipc.batch',
      'electron.ipc.batch.start',
      'electron.ipc.batch.end'
    );

    return results;
  }
}

/**
 * 数据持久化性能测量示例
 */
export class DataPersistencePerformance {
  /**
   * 测量数据保存操作
   */
  static async measureDataSave(saveOperation: () => Promise<void>) {
    return await measureFunction('data.save', saveOperation);
  }

  /**
   * 测量数据加载操作
   */
  static async measureDataLoad<T>(loadOperation: () => Promise<T>): Promise<T> {
    const result = await measureFunction('data.load', loadOperation);
    return result.result;
  }

  /**
   * 测量批量数据操作
   */
  static async measureBatchOperation<T>(
    operationName: string,
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    const results: T[] = [];

    mark(`${operationName}.batch.start`);

    for (let i = 0; i < operations.length; i++) {
      const result = await measureFunction(
        `${operationName}.item.${i}`,
        operations[i]
      );
      results.push(result.result);
    }

    mark(`${operationName}.batch.end`);
    measure(
      `${operationName}.batch`,
      `${operationName}.batch.start`,
      `${operationName}.batch.end`
    );

    return results;
  }
}

/**
 * 应用启动性能测量
 */
export class AppStartupPerformance {
  private static startupMarks: string[] = [];

  /**
   * 标记启动阶段
   */
  static markStartupPhase(phase: string) {
    const markName = `app.startup.${phase}`;
    mark(markName);
    this.startupMarks.push(markName);
  }

  /**
   * 计算启动总时间
   */
  static measureStartupComplete() {
    if (this.startupMarks.length < 2) {
      console.warn('[UserTiming] 启动测量需要至少2个标记点');
      return null;
    }

    const firstMark = this.startupMarks[0];
    const lastMark = this.startupMarks[this.startupMarks.length - 1];

    return measure('app.startup', firstMark, lastMark);
  }

  /**
   * 获取启动阶段详细报告
   */
  static getStartupReport() {
    const report: any = {
      phases: [],
      totalTime: null,
    };

    // 测量各阶段时间
    for (let i = 1; i < this.startupMarks.length; i++) {
      const phaseName = this.startupMarks[i].replace('app.startup.', '');
      const measurement = measure(
        `app.startup.phase.${phaseName}`,
        this.startupMarks[i - 1],
        this.startupMarks[i]
      );

      if (measurement) {
        report.phases.push({
          name: phaseName,
          duration: measurement.duration,
        });
      }
    }

    // 测量总时间
    const totalMeasurement = this.measureStartupComplete();
    if (totalMeasurement) {
      report.totalTime = totalMeasurement.duration;
    }

    return report;
  }
}

/**
 * UI交互性能测量
 */
export class UIInteractionPerformance {
  /**
   * 测量模态框操作
   */
  static measureModalOperation(
    operation: 'open' | 'close',
    handler: () => Promise<void>
  ) {
    return measureFunction(`ui.modal.${operation}`, handler);
  }

  /**
   * 测量表单提交
   */
  static measureFormSubmit(formId: string, submitHandler: () => Promise<void>) {
    return measureFunction(`ui.form.submit.${formId}`, submitHandler);
  }

  /**
   * 测量导航变化
   */
  static measureNavigation(
    from: string,
    to: string,
    handler: () => Promise<void>
  ) {
    return measureFunction(`ui.navigation.${from}-to-${to}`, handler);
  }
}

/**
 * 性能报告生成器
 */
export class PerformanceReporter {
  /**
   * 生成性能报告
   */
  static generateReport() {
    return userTiming.getPerformanceReport();
  }

  /**
   * 检查P95阈值
   */
  static checkThresholds() {
    return userTiming.assertP95Thresholds();
  }

  /**
   * 生成CSV格式报告
   */
  static generateCSVReport(): string {
    const report = this.generateReport();
    const lines = ['Name,Count,Avg,Min,Max,P95,P99,Status'];

    for (const [name, stats] of Object.entries(report)) {
      if (typeof stats === 'object' && stats.count) {
        lines.push(
          [
            name,
            stats.count,
            stats.avg,
            stats.min,
            stats.max,
            stats.p95 || 'N/A',
            stats.p99 || 'N/A',
            stats.status,
          ].join(',')
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * 输出控制台报告
   */
  static logReport() {
    const report = this.generateReport();
    console.group('📊 User Timing Performance Report');

    for (const [name, stats] of Object.entries(report)) {
      if (typeof stats === 'object' && stats.count) {
        const statusIcon =
          stats.status === 'good'
            ? '✅'
            : stats.status === 'warning'
              ? '⚠️'
              : stats.status === 'critical'
                ? '🔴'
                : '❓';

        console.log(
          `${statusIcon} ${name}: P95=${stats.p95}ms (${stats.count} samples)`
        );
      }
    }

    console.groupEnd();
  }
}
