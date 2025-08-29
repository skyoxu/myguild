/**
 * 游戏引擎模块导出
 * 提供统一的游戏引擎接口
 */

// 核心适配器
export { GameEngineAdapter } from './GameEngineAdapter';

// 场景管理
export { SceneManager } from './SceneManager';
export type { SceneManagerConfig, SceneKey } from './SceneManager';

// 场景类
export { BaseScene } from './scenes/BaseScene';
export { GameScene } from './scenes/GameScene';
export { MenuScene } from './scenes/MenuScene';

// 便捷创建函数
export { createGameEngine } from './factory';
