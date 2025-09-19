/**
 * 游戏存档管理组件
 * 提供存档的创建、加载、删除和管理功能
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import { useSaveManager } from '../../contexts/GameStateContext';
import type { SaveData } from '../../game/state/GameStateManager';
import './GameSaveManager.css';

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
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      data-testid="game-save-manager"
    >
      <div className="game-save-manager__dialog">
        {/* 头部 */}
        <div className="game-save-manager__header">
          <h2 className="game-save-manager__title">存档管理</h2>

          <div className="game-save-manager__header-controls">
            <button
              onClick={loadSaveFiles}
              disabled={isLoadingSaves}
              className="game-save-manager__refresh-btn"
            >
              🔄 刷新
            </button>

            <button onClick={onClose} className="game-save-manager__close-btn">
              ×
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="game-save-manager__content">
          {isLoadingSaves ? (
            <div className="game-save-manager__loading">
              <div className="game-save-manager__loading-icon">⏳</div>
              <div>加载存档中...</div>
            </div>
          ) : saveFiles.length === 0 ? (
            <div className="game-save-manager__empty">
              <div className="game-save-manager__empty-icon">📁</div>
              <div className="game-save-manager__empty-title">暂无存档</div>
              <div className="game-save-manager__empty-subtitle">
                开始游戏并保存后，存档将在这里显示
              </div>
            </div>
          ) : (
            <div className="game-save-manager__saves-list">
              {saveFiles.map(saveFile => (
                <div
                  key={saveFile.id}
                  className={`game-save-manager__save-item ${
                    selectedSaveId === saveFile.id
                      ? 'game-save-manager__save-item--selected'
                      : ''
                  }`}
                  onClick={() => setSelectedSaveId(saveFile.id)}
                  onDoubleClick={() => handleLoadSave(saveFile)}
                >
                  <div className="game-save-manager__save-item-content">
                    {/* 存档信息 */}
                    <div className="game-save-manager__save-info">
                      <div className="game-save-manager__save-header">
                        <div className="game-save-manager__save-title">
                          存档 #{saveFile.id.slice(-8)}
                        </div>

                        <div className="game-save-manager__save-stats">
                          <span className="game-save-manager__save-level">
                            等级 {saveFile.state.level}
                          </span>
                          <span className="game-save-manager__save-score">
                            {saveFile.state.score.toLocaleString()} 分
                          </span>
                          <span className="game-save-manager__save-health">
                            {saveFile.state.health} HP
                          </span>
                        </div>
                      </div>

                      <div className="game-save-manager__save-meta">
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
                          <div className="game-save-manager__inventory-preview">
                            {saveFile.state.inventory
                              .slice(0, 5)
                              .map((item, index) => (
                                <div
                                  key={index}
                                  className="game-save-manager__inventory-item"
                                >
                                  {item}
                                </div>
                              ))}
                            {saveFile.state.inventory.length > 5 && (
                              <div className="game-save-manager__inventory-more">
                                +{saveFile.state.inventory.length - 5} 更多
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="game-save-manager__save-actions">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleLoadSave(saveFile);
                        }}
                        className="game-save-manager__action-btn game-save-manager__load-btn"
                        title="加载此存档"
                      >
                        📂 加载
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleExportSave(saveFile);
                        }}
                        className="game-save-manager__action-btn game-save-manager__export-btn"
                        title="导出存档文件"
                      >
                        📤 导出
                      </button>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setShowDeleteConfirm(saveFile.id);
                        }}
                        className="game-save-manager__action-btn game-save-manager__delete-btn"
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
          className="game-save-manager__delete-overlay"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="game-save-manager__delete-dialog"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="game-save-manager__delete-title">确认删除存档</h3>

            <p className="game-save-manager__delete-message">
              您确定要删除此存档吗？此操作无法撤销。
            </p>

            <div className="game-save-manager__delete-actions">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="game-save-manager__delete-cancel"
              >
                取消
              </button>

              <button
                onClick={() => handleDeleteSave(showDeleteConfirm)}
                className="game-save-manager__delete-confirm"
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
