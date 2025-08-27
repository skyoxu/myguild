/**
 * 领域模型类型定义
 * 符合 CLAUDE.md 第6节 TS强化约定：公共DTO/事件/端口类型统一位置
 */

export interface Guild {
  id: string;
  name: string;
  createdAt: number;
}

export interface InventoryItem {
  itemId: string;
  qty: number;
}
