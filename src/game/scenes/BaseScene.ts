/**
 * 基础场景类 - 所有游戏场景的父类
 * 提供通用的场景功能和事件处理
 */

// 顶层移除对 phaser 的静态导入，改用全局 Phaser（由 SceneManager.initialize 注入）
declare const Phaser: any;
// 在单元测试（未注入全局 Phaser）时，提供一个最小的基类以避免模块评估期抛错
// 生产/集成环境下 SceneManager.initialize 会注入全局 Phaser，此分支不会被命中
const PhaserSceneBase: any = (globalThis as any)?.Phaser?.Scene ?? class {};
import type { DomainEvent } from '../../shared/contracts/events';
import { globalEventBus } from '../../hooks/useGameEvents';

export abstract class BaseScene extends PhaserSceneBase {
  protected eventCallbacks: Map<string, Function[]> = new Map();

  constructor(config: string | Phaser.Types.Scenes.SettingsConfig) {
    super(config);
  }

  /**
   * 发布域事件到 React 层
   */
  protected publishEvent(event: DomainEvent): void {
    console.log('🎪 BaseScene.publishEvent: 发布事件', event.type, event);

    // 方法1: 通过Scene事件系统（原有方式）
    this.events.emit('domain-event', event);
    console.log('🎪 BaseScene.publishEvent: domain-event 已emit');

    // 方法2: 直接发布到全局事件总线（绕过SceneManager）
    try {
      console.log('🎪 BaseScene.publishEvent: 直接发布到globalEventBus');
      // 类型转换：DomainEvent兼容GameDomainEvent
      globalEventBus.publish(event as any, {
        id: `scene-direct-${Date.now()}`,
        timestamp: new Date(),
        source: 'base-scene-direct',
        priority: 'normal' as any,
      });
      console.log('🎪 BaseScene.publishEvent: globalEventBus发布成功');
    } catch (error) {
      console.error(
        '🎪 BaseScene.publishEvent: globalEventBus发布失败:',
        error
      );
    }
  }

  /**
   * 订阅域事件
   */
  protected subscribeEvent(eventType: string, callback: Function): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    this.eventCallbacks.get(eventType)!.push(callback);
  }

  /**
   * 取消订阅域事件
   */
  protected unsubscribeEvent(eventType: string, callback: Function): void {
    const callbacks = this.eventCallbacks.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 场景销毁时清理事件监听器
   */
  destroy(): void {
    this.eventCallbacks.clear();
    // Note: Phaser.Scene doesn't have a destroy method, cleanup is handled by Phaser internally
  }

  /**
   * 抽象方法：场景特定的初始化逻辑
   */
  abstract initializeScene(): void;

  /**
   * 抽象方法：场景特定的更新逻辑
   */
  abstract updateScene(time: number, delta: number): void;

  /**
   * 通用的 create 方法
   */
  create(): void {
    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark(`scene_create_start:${this.scene.key}`);
      }
    } catch {}

    this.initializeScene();

    // 设置更新循环
    this.events.on('update', this.updateScene, this);

    try {
      if (
        typeof performance !== 'undefined' &&
        performance.mark &&
        performance.measure
      ) {
        performance.mark(`scene_create_end:${this.scene.key}`);
        performance.measure(
          `scene_create_duration:${this.scene.key}`,
          `scene_create_start:${this.scene.key}`,
          `scene_create_end:${this.scene.key}`
        );
      }
    } catch {}
  }

  /**
   * 通用的 update 方法
   */
  update(time: number, delta: number): void {
    this.updateScene(time, delta);
  }
}
