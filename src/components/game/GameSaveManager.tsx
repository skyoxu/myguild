/**
 * 游戏存档管理组件
 * 提供存档的创建、加载、删除和管理功能
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import { useSaveManager } from '../../contexts/GameStateContext';
import type { SaveData } from '../../game/state/GameStateManager';

interface GameSaveManagerProps {
  className?: string;
  isVisible: boolean;
  onClose: () => void;
  onSaveSelected?: (saveFile: SaveData) => void;
  onError?: (error: string) => void;
}

export function GameSaveManager({
  className = '',
  isVisible,
  onClose,
  onSaveSelected,
  onError,
}: GameSaveManagerProps) {
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );

  // 使用统一的状态管理
  const { saveFiles, isLoadingSaves, loadGame, deleteSave, refreshSaveList } =
    useSaveManager();

  const gameEvents = useGameEvents({
    context: 'game-save-manager',
  });

  // 加载存档列表（现在由Context处理，这里只是触发刷新）
  const loadSaveFiles = useCallback(async () => {
    try {
      await refreshSaveList();
    } catch (error) {
      console.error('Failed to refresh save files:', error);
      onError?.('加载存档列表失败');
    }
  }, [refreshSaveList, onError]);

  // 加载存档
  const handleLoadSave = useCallback(
    async (saveFile: SaveData) => {
      try {
        const success = await loadGame(saveFile.id);
        if (success) {
          onSaveSelected?.(saveFile);
          onClose();
        } else {
          onError?.('加载存档失败');
        }
      } catch (error) {
        console.error('Failed to load save:', error);
        onError?.('加载存档失败');
      }
    },
    [loadGame, onSaveSelected, onClose, onError]
  );

  // 删除存档
  const handleDeleteSave = useCallback(
    async (saveId: string) => {
      try {
        const success = await deleteSave(saveId);
        if (success) {
          setShowDeleteConfirm(null);

          // 发布删除事件
          gameEvents.publish({
            type: 'game.save.deleted',
            data: { saveId },
          });
        } else {
          onError?.('删除存档失败');
        }
      } catch (error) {
        console.error('Failed to delete save:', error);
        onError?.('删除存档失败');
      }
    },
    [deleteSave, gameEvents, onError]
  );

  // 导出存档
  const handleExportSave = useCallback(
    (saveFile: SaveData) => {
      try {
        const dataStr = JSON.stringify(saveFile, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `guild-game-save-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to export save:', error);
        onError?.('导出存档失败');
      }
    },
    [onError]
  );

  // 监听保存事件（Context会自动处理存档列表更新，这里主要是响应UI需要）
  useEffect(() => {
    const subscription = gameEvents.subscribe('game.save.created', () => {
      // Context已经自动更新了存档列表，这里可以做UI相关的响应
      console.log('新存档已创建');
    });

    return () => {
      gameEvents.unsubscribe(subscription);
    };
  }, [gameEvents]);

  // 初始加载（Context已经在Provider中自动加载了存档列表）
  useEffect(() => {
    if (isVisible && saveFiles.length === 0 && !isLoadingSaves) {
      // 只在没有数据且不在加载中时手动刷新
      loadSaveFiles();
    }
  }, [isVisible, saveFiles.length, isLoadingSaves, loadSaveFiles]);

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 计算存档大小
  const getSaveSize = (saveFile: SaveData) => {
    const jsonStr = JSON.stringify(saveFile);
    return new Blob([jsonStr]).size;
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`game-save-manager ${className}`}
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
      data-testid="game-save-manager"
    >
      <div
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          border: '1px solid #374151',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
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
          <h2
            style={{
              color: '#f9fafb',
              fontSize: '20px',
              fontWeight: '600',
              margin: 0,
            }}
          >
            存档管理
          </h2>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={loadSaveFiles}
              disabled={isLoadingSaves}
              style={{
                padding: '6px 12px',
                backgroundColor: '#374151',
                color: '#d1d5db',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              🔄 刷新
            </button>

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
        </div>

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
          }}
        >
          {isLoadingSaves ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: '#9ca3af',
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <div>加载存档中...</div>
            </div>
          ) : saveFiles.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: '#9ca3af',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>
                暂无存档
              </div>
              <div style={{ fontSize: '14px' }}>
                开始游戏并保存后，存档将在这里显示
              </div>
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {saveFiles.map(saveFile => (
                <div
                  key={saveFile.id}
                  style={{
                    backgroundColor:
                      selectedSaveId === saveFile.id ? '#374151' : '#111827',
                    border: `1px solid ${selectedSaveId === saveFile.id ? '#6b7280' : '#374151'}`,
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setSelectedSaveId(saveFile.id)}
                  onDoubleClick={() => handleLoadSave(saveFile)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* 存档信息 */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '8px',
                        }}
                      >
                        <div
                          style={{
                            color: '#f9fafb',
                            fontSize: '16px',
                            fontWeight: '600',
                          }}
                        >
                          存档 #{saveFile.id.slice(-8)}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            fontSize: '14px',
                          }}
                        >
                          <span style={{ color: '#fbbf24' }}>
                            等级 {saveFile.state.level}
                          </span>
                          <span style={{ color: '#3b82f6' }}>
                            {saveFile.state.score.toLocaleString()} 分
                          </span>
                          <span style={{ color: '#22c55e' }}>
                            {saveFile.state.health} HP
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          color: '#9ca3af',
                          fontSize: '13px',
                          marginBottom: '8px',
                        }}
                      >
                        <div>
                          创建：{saveFile.metadata.createdAt.toLocaleString()}
                        </div>
                        <div>
                          更新：{saveFile.metadata.updatedAt.toLocaleString()}
                        </div>
                        <div>大小：{formatFileSize(getSaveSize(saveFile))}</div>
                      </div>

                      {/* 物品栏预览 */}
                      {saveFile.state.inventory &&
                        saveFile.state.inventory.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              gap: '4px',
                              marginTop: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {saveFile.state.inventory
                              .slice(0, 5)
                              .map((item, index) => (
                                <div
                                  key={index}
                                  style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                    color: '#93c5fd',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                  }}
                                >
                                  {item}
                                </div>
                              ))}
                            {saveFile.state.inventory.length > 5 && (
                              <div
                                style={{
                                  color: '#6b7280',
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                }}
                              >
                                +{saveFile.state.inventory.length - 5} 更多
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginLeft: '16px',
                      }}
                    >
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleLoadSave(saveFile);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#22c55e',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                        title="加载此存档"
                      >
                        📂 加载
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleExportSave(saveFile);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#374151',
                          color: '#d1d5db',
                          border: '1px solid #4b5563',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                        title="导出存档文件"
                      >
                        📤 导出
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setShowDeleteConfirm(saveFile.id);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                        title="删除此存档"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3001,
          }}
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '8px',
              border: '1px solid #374151',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3
              style={{
                color: '#f9fafb',
                fontSize: '18px',
                fontWeight: '600',
                margin: '0 0 16px 0',
              }}
            >
              确认删除存档
            </h3>

            <p
              style={{
                color: '#d1d5db',
                fontSize: '14px',
                margin: '0 0 20px 0',
                lineHeight: 1.5,
              }}
            >
              您确定要删除此存档吗？此操作无法撤销。
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowDeleteConfirm(null)}
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
                onClick={() => handleDeleteSave(showDeleteConfirm)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
