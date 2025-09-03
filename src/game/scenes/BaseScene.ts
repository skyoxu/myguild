/**
 * 基础场景类 - 所有游戏场景的父类
 * 提供通用的场景功能和事件处理
 */

import Phaser from 'phaser';
import type { DomainEvent } from '../../shared/contracts/events';

export abstract class BaseScene extends Phaser.Scene {
  protected eventCallbacks: Map<string, Function[]> = new Map();

  constructor(config: string | Phaser.Types.Scenes.SettingsConfig) {
    super(config);
  }

  /**
   * 发布域事件到 React 层
   */
  protected publishEvent(event: DomainEvent): void {
    this.events.emit('domain-event', event);
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
    this.initializeScene();

    // 设置更新循环
    this.events.on('update', this.updateScene, this);
  }

  /**
   * 通用的 update 方法
   */
  update(time: number, delta: number): void {
    this.updateScene(time, delta);
  }
}
