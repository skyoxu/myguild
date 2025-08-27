/**
 * 游戏引擎端口定义 - 六边形架构
 * 定义游戏引擎的核心能力接口
 */

import type { DomainEvent } from '../shared/contracts/events';

/**
 * 游戏状态接口
 */
export interface GameState {
  readonly id: string;
  readonly level: number;
  readonly score: number;
  readonly health: number;
  readonly inventory: string[];
  readonly position: Position;
  readonly timestamp: Date;
}

/**
 * 位置坐标
 */
export interface Position {
  x: number;
  y: number;
  z?: number;
}

/**
 * 游戏配置
 */
export interface GameConfig {
  readonly maxLevel: number;
  readonly initialHealth: number;
  readonly scoreMultiplier: number;
  readonly autoSave: boolean;
  readonly difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 游戏引擎输入端口
 * 定义外部系统调用游戏引擎的接口
 */
export interface GameEnginePort {
  /**
   * 初始化游戏
   */
  initializeGame(config: GameConfig): Promise<GameState>;

  /**
   * 开始游戏会话
   */
  startGame(saveId?: string): Promise<GameState>;

  /**
   * 暂停游戏
   */
  pauseGame(): Promise<void>;

  /**
   * 恢复游戏
   */
  resumeGame(): Promise<void>;

  /**
   * 保存游戏状态
   */
  saveGame(): Promise<string>;

  /**
   * 加载游戏状态
   */
  loadGame(saveId: string): Promise<GameState>;

  /**
   * 处理用户输入
   */
  handleInput(input: GameInput): Promise<void>;

  /**
   * 获取当前游戏状态
   */
  getCurrentState(): GameState;

  /**
   * 订阅游戏事件
   */
  onGameEvent(callback: (event: DomainEvent) => void): void;

  /**
   * 取消订阅游戏事件
   */
  offGameEvent(callback: (event: DomainEvent) => void): void;

  /**
   * 结束游戏
   */
  endGame(): Promise<GameResult>;
}

/**
 * 游戏输入类型
 */
export interface GameInput {
  type: 'keyboard' | 'mouse' | 'touch' | 'gamepad';
  action: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * 游戏结果
 */
export interface GameResult {
  finalScore: number;
  levelReached: number;
  playTime: number;
  achievements: string[];
  statistics: GameStatistics;
}

/**
 * 游戏统计信息
 */
export interface GameStatistics {
  totalMoves: number;
  itemsCollected: number;
  enemiesDefeated: number;
  distanceTraveled: number;
  averageReactionTime: number;
}

/**
 * 游戏引擎输出端口
 * 定义游戏引擎对外部系统的依赖接口
 */
export interface GameEngineOutputPort {
  /**
   * 渲染游戏画面
   */
  renderFrame(renderData: RenderData): Promise<void>;

  /**
   * 播放音频
   */
  playAudio(audioData: AudioData): Promise<void>;

  /**
   * 保存数据到存储
   */
  saveData(key: string, data: unknown): Promise<void>;

  /**
   * 从存储加载数据
   */
  loadData(key: string): Promise<unknown>;

  /**
   * 发送网络请求
   */
  sendNetworkRequest(request: NetworkRequest): Promise<NetworkResponse>;

  /**
   * 发布域事件
   */
  publishEvent(event: DomainEvent): Promise<void>;

  /**
   * 记录日志
   */
  logMessage(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): Promise<void>;
}

/**
 * 渲染数据
 */
export interface RenderData {
  sprites: SpriteData[];
  ui: UIData[];
  effects: EffectData[];
  camera: CameraData;
}

/**
 * 精灵数据
 */
export interface SpriteData {
  id: string;
  texture: string;
  position: Position;
  rotation: number;
  scale: { x: number; y: number };
  visible: boolean;
  opacity: number;
}

/**
 * UI数据
 */
export interface UIData {
  id: string;
  type: 'text' | 'button' | 'panel' | 'progress';
  position: Position;
  content: string | number;
  style: Record<string, unknown>;
}

/**
 * 特效数据
 */
export interface EffectData {
  id: string;
  type: string;
  position: Position;
  duration: number;
  parameters: Record<string, unknown>;
}

/**
 * 相机数据
 */
export interface CameraData {
  position: Position;
  zoom: number;
  rotation: number;
  followTarget?: string;
}

/**
 * 音频数据
 */
export interface AudioData {
  id: string;
  type: 'sfx' | 'music' | 'voice';
  volume: number;
  loop: boolean;
  fadeIn?: number;
  fadeOut?: number;
}

/**
 * 网络请求
 */
export interface NetworkRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * 网络响应
 */
export interface NetworkResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
