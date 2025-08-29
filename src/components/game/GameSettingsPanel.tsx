/**
 * 游戏设置面板组件
 * 提供游戏配置选项和系统设置
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';

interface GameSettings {
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
  onSettingsChange?: (settings: GameSettings) => void;
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
    <div style={{ marginBottom: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <label style={{ color: '#d1d5db', fontSize: '14px' }}>{label}</label>
        <span style={{ color: '#9ca3af', fontSize: '12px' }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: '4px',
          background: '#374151',
          outline: 'none',
          borderRadius: '2px',
        }}
      />
    </div>
  );

  const renderSelect = (
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void
  ) => (
    <div style={{ marginBottom: '16px' }}>
      <label
        style={{
          display: 'block',
          color: '#d1d5db',
          fontSize: '14px',
          marginBottom: '8px',
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: '#374151',
          color: '#f9fafb',
          border: '1px solid #4b5563',
          borderRadius: '6px',
          fontSize: '14px',
        }}
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{
          width: '16px',
          height: '16px',
          accentColor: '#3b82f6',
        }}
      />
      <label style={{ color: '#d1d5db', fontSize: '14px', cursor: 'pointer' }}>
        {label}
      </label>
    </div>
  );

  return (
    <div
      className={`game-settings-panel ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '20px',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      data-testid="game-settings-panel"
    >
      <div
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          border: '1px solid #374151',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          overflow: 'hidden',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* 侧边栏标签 */}
        <div
          style={{
            width: '200px',
            backgroundColor: '#111827',
            borderRight: '1px solid #374151',
            padding: '20px 0',
          }}
        >
          <h2
            style={{
              color: '#f9fafb',
              fontSize: '18px',
              fontWeight: '600',
              margin: '0 0 20px 20px',
            }}
          >
            游戏设置
          </h2>

          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: '100%',
                padding: '12px 20px',
                backgroundColor:
                  activeTab === tab.id ? '#374151' : 'transparent',
                color: activeTab === tab.id ? '#f9fafb' : '#9ca3af',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        {/* 主内容区域 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 头部 */}
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid #374151',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3
              style={{
                color: '#f9fafb',
                fontSize: '16px',
                fontWeight: '600',
                margin: 0,
              }}
            >
              {tabs.find(tab => tab.id === activeTab)?.icon}{' '}
              {tabs.find(tab => tab.id === activeTab)?.name}设置
            </h3>

            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ×
            </button>
          </div>

          {/* 设置内容 */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
            }}
          >
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
                <div style={{ marginBottom: '24px' }}>
                  <h4
                    style={{
                      color: '#f9fafb',
                      fontSize: '14px',
                      marginBottom: '12px',
                    }}
                  >
                    键盘控制
                  </h4>

                  {Object.entries(settings.controls.keyboardControls).map(
                    ([action, key]) => (
                      <div
                        key={action}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ color: '#d1d5db', fontSize: '14px' }}>
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
                          style={{
                            padding: '4px 12px',
                            backgroundColor:
                              isKeyBinding === action ? '#3b82f6' : '#374151',
                            color:
                              isKeyBinding === action ? '#ffffff' : '#d1d5db',
                            border: '1px solid #4b5563',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            minWidth: '60px',
                          }}
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
          <div
            style={{
              padding: '20px',
              borderTop: '1px solid #374151',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              onClick={resetSettings}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              重置为默认
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#374151',
                  color: '#d1d5db',
                  border: '1px solid #4b5563',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>

              <button
                onClick={saveSettings}
                disabled={!hasChanges}
                style={{
                  padding: '8px 16px',
                  backgroundColor: hasChanges ? '#3b82f6' : '#374151',
                  color: hasChanges ? '#ffffff' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hasChanges ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
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
