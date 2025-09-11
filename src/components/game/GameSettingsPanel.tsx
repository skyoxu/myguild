/**
 * 游戏设置面板组件
 * 提供游戏配置选项和系统设置
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import './GameSettingsPanel.css';

export interface GameSettings {
  // 图形设置
  graphics: {
    quality: 'low' | 'medium' | 'high';
    fullscreen: boolean;
    vsync: boolean;
    showFPS: boolean;
  };

  // 音频设置
  audio: {
    masterVolume: number; // 0-100
    musicVolume: number; // 0-100
    sfxVolume: number; // 0-100
    muted: boolean;
  };

  // 游戏设置
  gameplay: {
    difficulty: 'easy' | 'medium' | 'hard';
    autoSave: boolean;
    autoSaveInterval: number; // 秒
    showNotifications: boolean;
    showTutorials: boolean;
  };

  // 控制设置
  controls: {
    keyboardControls: {
      moveUp: string;
      moveDown: string;
      moveLeft: string;
      moveRight: string;
      action: string;
      pause: string;
    };
    mouseSensitivity: number; // 0-100
  };

  // 界面设置
  ui: {
    theme: 'dark' | 'light' | 'auto';
    language: string;
    showAdvancedStats: boolean;
    notificationPosition:
      | 'top-right'
      | 'top-left'
      | 'bottom-right'
      | 'bottom-left';
  };
}

const defaultSettings: GameSettings = {
  graphics: {
    quality: 'medium',
    fullscreen: false,
    vsync: true,
    showFPS: false,
  },
  audio: {
    masterVolume: 80,
    musicVolume: 70,
    sfxVolume: 85,
    muted: false,
  },
  gameplay: {
    difficulty: 'medium',
    autoSave: true,
    autoSaveInterval: 300, // 5分钟
    showNotifications: true,
    showTutorials: true,
  },
  controls: {
    keyboardControls: {
      moveUp: 'W',
      moveDown: 'S',
      moveLeft: 'A',
      moveRight: 'D',
      action: 'Space',
      pause: 'Escape',
    },
    mouseSensitivity: 50,
  },
  ui: {
    theme: 'dark',
    language: 'zh-CN',
    showAdvancedStats: false,
    notificationPosition: 'top-right',
  },
};

interface GameSettingsPanelProps {
  className?: string;
  isVisible: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: Partial<GameSettings>) => void;
}

export function GameSettingsPanel({
  className = '',
  isVisible,
  onClose,
  onSettingsChange,
}: GameSettingsPanelProps) {
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<
    'graphics' | 'audio' | 'gameplay' | 'controls' | 'ui'
  >('graphics');
  const [hasChanges, setHasChanges] = useState(false);
  const [isKeyBinding, setIsKeyBinding] = useState<string | null>(null);

  const gameEvents = useGameEvents({
    context: 'game-settings-panel',
  });

  // 加载设置
  const loadSettings = useCallback(() => {
    try {
      const savedSettings = localStorage.getItem('guild-game-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  // 保存设置
  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('guild-game-settings', JSON.stringify(settings));
      onSettingsChange?.(settings);
      setHasChanges(false);

      // 发布设置变更事件
      gameEvents.publish({
        type: 'game.ui.notification.shown',
        data: {
          message: '设置已保存',
          type: 'success',
        },
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      gameEvents.publish({
        type: 'game.ui.notification.shown',
        data: {
          message: '保存设置失败',
          type: 'error',
        },
      });
    }
  }, [settings, onSettingsChange, gameEvents]);

  // 重置设置
  const resetSettings = useCallback(() => {
    if (confirm('确定要重置所有设置为默认值吗？')) {
      setSettings(defaultSettings);
      setHasChanges(true);
    }
  }, []);

  // 更新设置的辅助函数
  const updateSettings = useCallback(
    <K extends keyof GameSettings>(
      category: K,
      key: keyof GameSettings[K],
      value: any
    ) => {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      }));
      setHasChanges(true);
    },
    []
  );

  // 键盘绑定处理
  const handleKeyBinding = useCallback((controlKey: string) => {
    setIsKeyBinding(controlKey);

    const handleKeyPress = (event: KeyboardEvent) => {
      event.preventDefault();

      const key =
        event.key === ' '
          ? 'Space'
          : event.key === 'Escape'
            ? 'Escape'
            : event.key.toUpperCase();

      setSettings(prev => ({
        ...prev,
        controls: {
          ...prev.controls,
          keyboardControls: {
            ...prev.controls.keyboardControls,
            [controlKey]: key,
          },
        },
      }));

      setHasChanges(true);
      setIsKeyBinding(null);

      document.removeEventListener('keydown', handleKeyPress);
    };

    document.addEventListener('keydown', handleKeyPress);
  }, []);

  // 加载初始设置
  useEffect(() => {
    if (isVisible) {
      loadSettings();
    }
  }, [isVisible, loadSettings]);

  // 标签页配置
  const tabs = [
    { id: 'graphics', name: '图形', icon: '🎮' },
    { id: 'audio', name: '音频', icon: '🔊' },
    { id: 'gameplay', name: '游戏', icon: '⚙️' },
    { id: 'controls', name: '控制', icon: '🎯' },
    { id: 'ui', name: '界面', icon: '🎨' },
  ] as const;

  if (!isVisible) {
    return null;
  }

  const renderSlider = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    min = 0,
    max = 100
  ) => (
    <div className="game-settings-panel__slider-container">
      <div className="game-settings-panel__slider-header">
        <label className="game-settings-panel__slider-label">{label}</label>
        <span className="game-settings-panel__slider-value">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="game-settings-panel__slider"
      />
    </div>
  );

  const renderSelect = (
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void
  ) => (
    <div className="game-settings-panel__select-container">
      <label className="game-settings-panel__select-label">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="game-settings-panel__select"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const renderCheckbox = (
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void
  ) => (
    <div className="game-settings-panel__checkbox-container">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="game-settings-panel__checkbox"
      />
      <label className="game-settings-panel__checkbox-label">{label}</label>
    </div>
  );

  return (
    <div
      className={`game-settings-panel ${className}`}
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      data-testid="game-settings-panel"
    >
      <div className="game-settings-panel__dialog">
        {/* 侧边栏标签 */}
        <div className="game-settings-panel__sidebar">
          <h2 className="game-settings-panel__sidebar-title">游戏设置</h2>

          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`game-settings-panel__tab ${
                activeTab === tab.id ? 'game-settings-panel__tab--active' : ''
              }`}
            >
              <span>{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        {/* 主内容区域 */}
        <div className="game-settings-panel__main">
          {/* 头部 */}
          <div className="game-settings-panel__header">
            <h3 className="game-settings-panel__header-title">
              {tabs.find(tab => tab.id === activeTab)?.icon}{' '}
              {tabs.find(tab => tab.id === activeTab)?.name}设置
            </h3>

            <button
              onClick={onClose}
              className="game-settings-panel__close-btn"
            >
              ×
            </button>
          </div>

          {/* 设置内容 */}
          <div className="game-settings-panel__content">
            {/* 图形设置 */}
            {activeTab === 'graphics' && (
              <div>
                {renderSelect(
                  '图形质量',
                  settings.graphics.quality,
                  [
                    { value: 'low', label: '低' },
                    { value: 'medium', label: '中' },
                    { value: 'high', label: '高' },
                  ],
                  value => updateSettings('graphics', 'quality', value)
                )}

                {renderCheckbox(
                  '全屏模式',
                  settings.graphics.fullscreen,
                  checked => updateSettings('graphics', 'fullscreen', checked)
                )}

                {renderCheckbox('垂直同步', settings.graphics.vsync, checked =>
                  updateSettings('graphics', 'vsync', checked)
                )}

                {renderCheckbox('显示FPS', settings.graphics.showFPS, checked =>
                  updateSettings('graphics', 'showFPS', checked)
                )}
              </div>
            )}

            {/* 音频设置 */}
            {activeTab === 'audio' && (
              <div>
                {renderCheckbox('静音', settings.audio.muted, checked =>
                  updateSettings('audio', 'muted', checked)
                )}

                {renderSlider('主音量', settings.audio.masterVolume, value =>
                  updateSettings('audio', 'masterVolume', value)
                )}

                {renderSlider('音乐音量', settings.audio.musicVolume, value =>
                  updateSettings('audio', 'musicVolume', value)
                )}

                {renderSlider('音效音量', settings.audio.sfxVolume, value =>
                  updateSettings('audio', 'sfxVolume', value)
                )}
              </div>
            )}

            {/* 游戏设置 */}
            {activeTab === 'gameplay' && (
              <div>
                {renderSelect(
                  '游戏难度',
                  settings.gameplay.difficulty,
                  [
                    { value: 'easy', label: '简单' },
                    { value: 'medium', label: '普通' },
                    { value: 'hard', label: '困难' },
                  ],
                  value => updateSettings('gameplay', 'difficulty', value)
                )}

                {renderCheckbox(
                  '自动保存',
                  settings.gameplay.autoSave,
                  checked => updateSettings('gameplay', 'autoSave', checked)
                )}

                {settings.gameplay.autoSave &&
                  renderSlider(
                    '自动保存间隔 (秒)',
                    settings.gameplay.autoSaveInterval,
                    value =>
                      updateSettings('gameplay', 'autoSaveInterval', value),
                    60,
                    1800
                  )}

                {renderCheckbox(
                  '显示通知',
                  settings.gameplay.showNotifications,
                  checked =>
                    updateSettings('gameplay', 'showNotifications', checked)
                )}

                {renderCheckbox(
                  '显示教程',
                  settings.gameplay.showTutorials,
                  checked =>
                    updateSettings('gameplay', 'showTutorials', checked)
                )}
              </div>
            )}

            {/* 控制设置 */}
            {activeTab === 'controls' && (
              <div>
                <div className="game-settings-panel__controls-section">
                  <h4 className="game-settings-panel__controls-title">
                    键盘控制
                  </h4>

                  {Object.entries(settings.controls.keyboardControls).map(
                    ([action, key]) => (
                      <div
                        key={action}
                        className="game-settings-panel__key-binding-row"
                      >
                        <span className="game-settings-panel__key-binding-label">
                          {action === 'moveUp'
                            ? '向上移动'
                            : action === 'moveDown'
                              ? '向下移动'
                              : action === 'moveLeft'
                                ? '向左移动'
                                : action === 'moveRight'
                                  ? '向右移动'
                                  : action === 'action'
                                    ? '行动'
                                    : action === 'pause'
                                      ? '暂停'
                                      : action}
                        </span>

                        <button
                          onClick={() => handleKeyBinding(action)}
                          className={`game-settings-panel__key-binding-btn ${
                            isKeyBinding === action
                              ? 'game-settings-panel__key-binding-btn--active'
                              : ''
                          }`}
                        >
                          {isKeyBinding === action ? '按键...' : key}
                        </button>
                      </div>
                    )
                  )}
                </div>

                {renderSlider(
                  '鼠标灵敏度',
                  settings.controls.mouseSensitivity,
                  value => updateSettings('controls', 'mouseSensitivity', value)
                )}
              </div>
            )}

            {/* 界面设置 */}
            {activeTab === 'ui' && (
              <div>
                {renderSelect(
                  '主题',
                  settings.ui.theme,
                  [
                    { value: 'dark', label: '深色' },
                    { value: 'light', label: '浅色' },
                    { value: 'auto', label: '自动' },
                  ],
                  value => updateSettings('ui', 'theme', value)
                )}

                {renderSelect(
                  '语言',
                  settings.ui.language,
                  [
                    { value: 'zh-CN', label: '简体中文' },
                    { value: 'en-US', label: 'English' },
                  ],
                  value => updateSettings('ui', 'language', value)
                )}

                {renderSelect(
                  '通知位置',
                  settings.ui.notificationPosition,
                  [
                    { value: 'top-right', label: '右上角' },
                    { value: 'top-left', label: '左上角' },
                    { value: 'bottom-right', label: '右下角' },
                    { value: 'bottom-left', label: '左下角' },
                  ],
                  value => updateSettings('ui', 'notificationPosition', value)
                )}

                {renderCheckbox(
                  '显示高级统计信息',
                  settings.ui.showAdvancedStats,
                  checked => updateSettings('ui', 'showAdvancedStats', checked)
                )}
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="game-settings-panel__footer">
            <button
              onClick={resetSettings}
              className="game-settings-panel__reset-btn"
            >
              重置为默认
            </button>

            <div className="game-settings-panel__footer-actions">
              <button
                onClick={onClose}
                className="game-settings-panel__cancel-btn"
              >
                取消
              </button>

              <button
                onClick={saveSettings}
                disabled={!hasChanges}
                className={`game-settings-panel__save-btn ${
                  hasChanges
                    ? 'game-settings-panel__save-btn--enabled'
                    : 'game-settings-panel__save-btn--disabled'
                }`}
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
