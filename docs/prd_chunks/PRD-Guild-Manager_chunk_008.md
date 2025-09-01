---
PRD-ID: 'PRD-GM-PRD-GUILD-MANAGER_CHUNK_008'
Title: '公会管理器PRD - 分片8'
Status: 'Active'
Owner: 'Product-Team'
Created: '2024-12-01T00:00:00Z'
Updated: '2025-08-22T00:00:00Z'
Version: 'v1.2.0'
Priority: 'High'
Risk: 'Medium'
Depends-On:
  - 'PRD-GM-BASE-ARCHITECTURE'
chunk: '8/24'
size: '8702 chars'
source: 'PRD-Guild-Manager.md'
Arch-Refs: [CH01, CH02, CH03, CH04]
Test-Refs:
  - 'tests/unit/guild-manager-chunk-008.spec.ts'
Monitors:
  - 'txn.prd-guild-manager_chunk_008.primary'
SLO-Refs:
  - 'UI_P95_100ms'
  - 'EVENT_P95_50ms'
  - 'CRASH_FREE_99.5'
ADRs:
  [
    ADR-0001,
    ADR-0002,
    ADR-0003,
    ADR-0004,
    ADR-0005,
    ADR-0006,
    ADR-0007,
    ADR-0008,
  ]
Release_Gates:
  Quality_Gate:
    enabled: true
    threshold: 'unit_test_coverage >= 80%'
    blockingFailures:
      - 'test_failures'
      - 'coverage_below_threshold'
    windowHours: 24
  Security_Gate:
    enabled: true
    threshold: 'security_scan_passed == true'
    blockingFailures:
      - 'security_vulnerabilities'
      - 'dependency_vulnerabilities'
    windowHours: 12
  Performance_Gate:
    enabled: true
    threshold: 'p95_response_time <= 100ms'
    blockingFailures:
      - 'performance_regression'
      - 'memory_leaks'
    windowHours: 6
  Acceptance_Gate:
    enabled: true
    threshold: 'acceptance_criteria_met >= 95%'
    blockingFailures:
      - 'acceptance_test_failures'
      - 'user_story_incomplete'
    windowHours: 48
  API_Contract_Gate:
    enabled: true
    threshold: 'api_contract_compliance >= 100%'
    blockingFailures:
      - 'contract_violations'
      - 'breaking_changes'
    windowHours: 12
  Sentry_Release_Health_Gate:
    enabled: true
    threshold: 'crash_free_users >= 99.5% AND crash_free_sessions >= 99.9%'
    blockingFailures:
      - 'crash_free_threshold_violation'
      - 'insufficient_adoption_data'
      - 'release_health_regression'
    windowHours: 24
    params:
      sloRef: 'CRASH_FREE_99.5'
      thresholds:
        crashFreeUsers: 99.5
        crashFreeSessions: 99.9
        minAdoptionPercent: 25
        durationHours: 24

Security_Policies:
  permissions:
    read:
      - 'guild-member'
      - 'guild-officer'
      - 'guild-master'
    write:
      - 'guild-officer'
      - 'guild-master'
    admin:
      - 'guild-master'
      - 'system-admin'
  cspNotes: "Electron CSP: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; connect-src 'self' https://api.${PRODUCT_DOMAIN}; style-src 'self' 'nonce-${NONCE_PLACEHOLDER}'; img-src 'self' data: https: ; font-src 'self'"
Traceability_Matrix:
  requirementTags:
    - 'guild-management'
    - 'user-experience'
    - 'performance'
  acceptance:
    functional: '功能需求100%实现'
    performance: '性能指标达到SLO要求'
    security: '安全要求完全满足'
    usability: '用户体验达到设计标准'
  evidence:
    implementation: '源代码实现'
    testing: '自动化测试覆盖'
    documentation: '技术文档完备'
    validation: '用户验收确认'
  businessAcceptance:
    userStoryCompletion: '用户故事100%完成'
    businessRulesValidation: '业务规则验证通过'
    stakeholderApproval: '利益相关者确认'
---

#### 3.2.7 公会后勤模块

##### 3.2.7.1 拍卖行系统设计

```typescript
// 拍卖行系统核心接口
interface AuctionHouseSystem {
  playerAuctions: PlayerAuctionManager; // 玩家拍卖管理
  systemMarketplace: SystemMarketplace; // 系统市场
  aiPurchaseEngine: AIPurchaseEngine; // AI购买引擎
  transactionHistory: TransactionHistory; // 交易历史
  priceOracle: PriceOracle; // 价格预言机
}

// 玩家拍卖管理器
interface PlayerAuctionManager {
  /* 创建拍卖 */
  createAuction(
    item: BankItem,
    startingPrice: number,
    buyoutPrice?: number
  ): AuctionListing;

  /* 取消拍卖 */
  cancelAuction(auctionId: string): CancelResult;

  /* 竞标 */
  placeBid(auctionId: string, bidAmount: number): BidResult;

  /* 一口价购买 */
  buyoutAuction(auctionId: string): PurchaseResult;
}

// 拍卖物品定义
interface AuctionListing {
  auctionId: string; // 拍卖ID
  sellerId: string; // 卖家ID (玩家)
  item: BankItem; // 拍卖物品

  // 价格设置
  startingPrice: number; // 起拍价
  currentBid: number; // 当前出价
  buyoutPrice?: number; // 一口价 (可选)

  // 时间设置
  listingTime: Date; // 上架时间
  duration: AuctionDuration; // 拍卖时长
  expirationTime: Date; // 到期时间

  // 竞拍信息
  bidHistory: BidRecord[]; // 竞拍历史
  currentBidder?: string; // 当前最高出价者
  bidCount: number; // 竞拍次数
}

enum AuctionDuration {
  SHORT = '短期', // 2小时
  MEDIUM = '中期', // 8小时
  LONG = '长期', // 24小时
  VERY_LONG = '超长期', // 48小时
}

// 系统市场
interface SystemMarketplace {
  /* 获取系统刷新物品 */
  getSystemListings(gamePhase: GamePhase): SystemItem[];

  /* 刷新市场物品 */
  refreshMarketplace(): RefreshResult;

  /* 根据游戏阶段调整物品品质 */
  adjustItemQuality(gamePhase: GamePhase): void;
}

// 系统刷新物品
interface SystemItem {
  itemId: string; // 物品ID
  itemName: string; // 物品名称
  itemQuality: ItemQuality; // 物品品质
  itemLevel: number; // 物品等级

  // 价格设置
  basePrice: number; // 基础价格
  currentPrice: number; // 当前价格
  priceFluctuation: number; // 价格波动范围

  // 可用性
  stockQuantity: number; // 库存数量
  refreshTimer: number; // 刷新时间
  purchaseLimit?: number; // 购买限制

  // 阶段限制
  requiredGamePhase: GamePhase; // 需要的游戏阶段
  phaseModifiers: PhaseModifier[]; // 阶段修正
}

// AI购买引擎
interface AIPurchaseEngine {
  /* AI随机购买玩家物品 */
  simulateAIPurchase(): AIPurchaseResult;

  /* 计算AI购买概率 */
  calculatePurchaseProbability(listing: AuctionListing): number;

  /* AI价格评估 */
  evaluateItemValue(item: BankItem): PriceEvaluation;

  /* 系统回收机制 */
  systemRecycle(listing: AuctionListing): RecycleResult;
}

// AI购买行为配置
interface AIPurchaseBehavior {
  purchaseFrequency: number; // 购买频率 (次/小时)
  priceToleranceRange: PriceRange; // 价格容忍范围

  // 物品偏好
  itemPreferences: {
    qualityPreference: Map<ItemQuality, number>; // 品质偏好权重
    typePreference: Map<ItemType, number>; // 类型偏好权重
    levelRangePreference: LevelRange; // 等级范围偏好
  };

  // 市场影响因素
  marketFactors: {
    supplyDemandRatio: number; // 供需比影响
    priceHistoryInfluence: number; // 历史价格影响
    competitionFactor: number; // 竞争因素
  };
}

// 价格预言机系统
interface PriceOracle {
  /* 获取物品建议价格 */
  getSuggestedPrice(item: BankItem): PriceSuggestion;

  /* 分析市场趋势 */
  analyzeMarketTrends(itemType: ItemType): MarketTrend;

  /* 预测价格走势 */
  predictPriceMovement(itemId: string, timeframe: TimeFrame): PricePrediction;
}
```

**Acceptance（就地验收，占位）**

- P95 ≤ 200ms 首屏反馈；≤1s 上报 `txn.prd-guild-manager_chunk_008.primary`。
