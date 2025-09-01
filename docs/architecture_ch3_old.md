# 第3章：测试策略与质量保证（TDD基础）

## 13.1 测试策略概述

### 13.1.1 测试金字塔架构

```typescript
namespace Testing.Strategy {
  /**
   * 测试金字塔模型定义
   * 70% 单元测试 + 20% 集成测试 + 10% E2E测试
   */
  interface TestPyramid {
    unitTests: UnitTestLayer; // 70% - 快速反馈
    integrationTests: IntegrationTestLayer; // 20% - 组件协作
    e2eTests: E2ETestLayer; // 10% - 端到端流程
    performanceTests: PerformanceTestLayer; // 专项测试
    securityTests: SecurityTestLayer; // 专项测试
  }

  /**
   * 测试策略控制器
   * 统一管理所有测试层级的执行和报告
   */
  class TestStrategyController {
    private testPyramid: TestPyramid;
    private testExecutor: TestExecutor;
    private reportAggregator: TestReportAggregator;
    private cicdIntegration: CICDIntegration;

    constructor(config: TestStrategyConfig) {
      this.testPyramid = this.initializeTestPyramid(config);
      this.testExecutor = new TestExecutor(config.executorConfig);
      this.reportAggregator = new TestReportAggregator(config.reportConfig);
      this.cicdIntegration = new CICDIntegration(config.cicdConfig);
    }

    /**
     * 执行完整测试套件
     * 按照金字塔原则依序执行各层测试
     */
    async executeFullTestSuite(): Promise<TestSuiteResult> {
      const result: TestSuiteResult = {
        suiteId: generateUniqueId(),
        startTime: Date.now(),
        layers: {},
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        coverage: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0,
        },
        performance: {
          executionTime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
        },
      };

      try {
        // 1. 执行单元测试（并行）
        console.log('🧪 执行单元测试层...');
        result.layers.unit = await this.testExecutor.executeUnitTests(
          this.testPyramid.unitTests
        );

        // 如果单元测试失败率超过阈值，停止后续测试
        if (result.layers.unit.failureRate > 0.05) {
          throw new Error(
            `单元测试失败率过高: ${result.layers.unit.failureRate}`
          );
        }

        // 2. 执行集成测试（串行）
        console.log('🔗 执行集成测试层...');
        result.layers.integration =
          await this.testExecutor.executeIntegrationTests(
            this.testPyramid.integrationTests
          );

        // 3. 执行E2E测试（并行组）
        console.log('🌍 执行端到端测试层...');
        result.layers.e2e = await this.testExecutor.executeE2ETests(
          this.testPyramid.e2eTests
        );

        // 4. 执行性能测试（条件性）
        if (this.shouldRunPerformanceTests(result)) {
          console.log('⚡ 执行性能测试...');
          result.layers.performance =
            await this.testExecutor.executePerformanceTests(
              this.testPyramid.performanceTests
            );
        }

        // 5. 执行安全测试（条件性）
        if (this.shouldRunSecurityTests(result)) {
          console.log('🔐 执行安全测试...');
          result.layers.security = await this.testExecutor.executeSecurityTests(
            this.testPyramid.securityTests
          );
        }

        // 聚合结果
        this.aggregateResults(result);
        result.endTime = Date.now();
        result.performance.executionTime = result.endTime - result.startTime;

        // 生成报告
        await this.reportAggregator.generateComprehensiveReport(result);

        return result;
      } catch (error) {
        result.error = error.message;
        result.endTime = Date.now();
        await this.reportAggregator.generateErrorReport(result);
        throw error;
      }
    }

    /**
     * 智能测试选择
     * 基于代码变更影响分析选择相关测试
     */
    async executeSmartTestSelection(
      changes: CodeChange[]
    ): Promise<TestSuiteResult> {
      const impactAnalysis = await this.analyzeCodeImpact(changes);
      const selectedTests = await this.selectRelevantTests(impactAnalysis);

      return await this.testExecutor.executeSelectedTests(selectedTests);
    }

    private async analyzeCodeImpact(
      changes: CodeChange[]
    ): Promise<ImpactAnalysis> {
      // 分析代码变更对测试的影响
      const impactAnalyzer = new CodeImpactAnalyzer();
      return await impactAnalyzer.analyze(changes);
    }

    private async selectRelevantTests(
      impact: ImpactAnalysis
    ): Promise<TestSelection> {
      const selector = new SmartTestSelector();
      return await selector.selectTests(impact, this.testPyramid);
    }
  }

  /**
   * 测试配置管理
   */
  interface TestStrategyConfig {
    executorConfig: TestExecutorConfig;
    reportConfig: TestReportConfig;
    cicdConfig: CICDIntegrationConfig;
    thresholds: QualityThresholds;
    environments: TestEnvironment[];
  }

  interface QualityThresholds {
    unitTestCoverage: number; // 最小单元测试覆盖率
    integrationTestCoverage: number; // 最小集成测试覆盖率
    maxFailureRate: number; // 最大失败率
    maxExecutionTime: number; // 最大执行时间
    performanceBaseline: PerformanceBaseline;
  }
}
```

## 13.2 单元测试框架

### 13.2.1 Jest + React Testing Library 集成

```typescript
namespace Testing.Unit {
  /**
   * 单元测试层定义
   */
  interface UnitTestLayer {
    reactComponents: ReactComponentTestSuite;
    gameLogic: GameLogicTestSuite;
    utilities: UtilityTestSuite;
    hooks: HooksTestSuite;
    stores: StoreTestSuite;
  }

  /**
   * React组件测试套件
   */
  class ReactComponentTestSuite {
    private testRenderer: ComponentTestRenderer;
    private mockProvider: MockProvider;
    private snapshotManager: SnapshotManager;

    constructor(config: ComponentTestConfig) {
      this.testRenderer = new ComponentTestRenderer(config);
      this.mockProvider = new MockProvider(config.mockConfig);
      this.snapshotManager = new SnapshotManager(config.snapshotConfig);
    }

    /**
     * 执行组件测试
     */
    async executeTests(): Promise<ComponentTestResult[]> {
      const testSuites = await this.discoverTestSuites();
      const results: ComponentTestResult[] = [];

      for (const suite of testSuites) {
        const result = await this.executeComponentTestSuite(suite);
        results.push(result);
      }

      return results;
    }

    /**
     * 执行单个组件测试套件
     */
    private async executeComponentTestSuite(
      suite: ComponentTestSuite
    ): Promise<ComponentTestResult> {
      const result: ComponentTestResult = {
        componentName: suite.componentName,
        tests: [],
        coverage: { lines: 0, functions: 0, branches: 0 },
        snapshots: { created: 0, updated: 0, failed: 0 },
      };

      try {
        // 1. 渲染测试
        await this.executeRenderTests(suite, result);

        // 2. 交互测试
        await this.executeInteractionTests(suite, result);

        // 3. Props测试
        await this.executePropsTests(suite, result);

        // 4. 状态测试
        await this.executeStateTests(suite, result);

        // 5. 生命周期测试
        await this.executeLifecycleTests(suite, result);

        // 6. 快照测试
        await this.executeSnapshotTests(suite, result);

        return result;
      } catch (error) {
        result.error = error.message;
        return result;
      }
    }

    /**
     * 渲染测试 - 验证组件能够正确渲染
     */
    private async executeRenderTests(
      suite: ComponentTestSuite,
      result: ComponentTestResult
    ): Promise<void> {
      const renderTests = suite.tests.filter(t => t.type === 'render');

      for (const test of renderTests) {
        try {
          const wrapper = await this.testRenderer.render(
            test.component,
            test.props,
            test.context
          );

          // 验证组件存在
          expect(wrapper).toBeTruthy();

          // 验证关键元素存在
          if (test.assertions.elements) {
            for (const selector of test.assertions.elements) {
              expect(wrapper.find(selector)).toHaveLength(
                test.assertions.count || 1
              );
            }
          }

          // 验证文本内容
          if (test.assertions.text) {
            expect(wrapper.text()).toContain(test.assertions.text);
          }

          result.tests.push({
            name: test.name,
            status: 'passed',
            duration: Date.now() - test.startTime,
          });
        } catch (error) {
          result.tests.push({
            name: test.name,
            status: 'failed',
            error: error.message,
            duration: Date.now() - test.startTime,
          });
        }
      }
    }

    /**
     * 交互测试 - 验证用户交互行为
     */
    private async executeInteractionTests(
      suite: ComponentTestSuite,
      result: ComponentTestResult
    ): Promise<void> {
      const interactionTests = suite.tests.filter(
        t => t.type === 'interaction'
      );

      for (const test of interactionTests) {
        try {
          const wrapper = await this.testRenderer.render(
            test.component,
            test.props,
            test.context
          );

          // 执行交互序列
          for (const interaction of test.interactions) {
            await this.executeInteraction(wrapper, interaction);
          }

          // 验证交互结果
          await this.verifyInteractionResults(wrapper, test.assertions);

          result.tests.push({
            name: test.name,
            status: 'passed',
            duration: Date.now() - test.startTime,
          });
        } catch (error) {
          result.tests.push({
            name: test.name,
            status: 'failed',
            error: error.message,
            duration: Date.now() - test.startTime,
          });
        }
      }
    }
  }

  /**
   * 游戏逻辑测试套件
   */
  class GameLogicTestSuite {
    private gameSimulator: GameSimulator;
    private stateValidator: StateValidator;

    constructor(config: GameTestConfig) {
      this.gameSimulator = new GameSimulator(config);
      this.stateValidator = new StateValidator(config.validationRules);
    }

    /**
     * 执行游戏逻辑测试
     */
    async executeTests(): Promise<GameLogicTestResult[]> {
      const results: GameLogicTestResult[] = [];

      // 1. 游戏初始化测试
      results.push(await this.testGameInitialization());

      // 2. 角色系统测试
      results.push(await this.testCharacterSystem());

      // 3. 战斗系统测试
      results.push(await this.testBattleSystem());

      // 4. 经济系统测试
      results.push(await this.testEconomySystem());

      // 5. 任务系统测试
      results.push(await this.testQuestSystem());

      return results;
    }

    /**
     * 角色系统测试
     */
    private async testCharacterSystem(): Promise<GameLogicTestResult> {
      const result: GameLogicTestResult = {
        category: 'CharacterSystem',
        tests: [],
      };

      try {
        // 测试角色创建
        const character = await this.gameSimulator.createCharacter({
          name: 'TestHero',
          class: 'Warrior',
          attributes: { strength: 10, agility: 8, intelligence: 6 },
        });

        expect(character.id).toBeDefined();
        expect(character.level).toBe(1);
        expect(character.experience).toBe(0);

        // 测试属性计算
        const calculatedStats = character.calculateStats();
        expect(calculatedStats.health).toBeGreaterThan(0);
        expect(calculatedStats.damage).toBeGreaterThan(0);

        // 测试升级机制
        character.gainExperience(1000);
        expect(character.level).toBe(2);
        expect(character.availableAttributePoints).toBeGreaterThan(0);

        result.tests.push({
          name: 'Character Creation and Leveling',
          status: 'passed',
        });

        return result;
      } catch (error) {
        result.tests.push({
          name: 'Character System',
          status: 'failed',
          error: error.message,
        });
        return result;
      }
    }

    /**
     * 战斗系统测试
     */
    private async testBattleSystem(): Promise<GameLogicTestResult> {
      const result: GameLogicTestResult = {
        category: 'BattleSystem',
        tests: [],
      };

      try {
        // 创建测试角色
        const player = await this.gameSimulator.createCharacter({
          name: 'Player',
          class: 'Warrior',
          attributes: { strength: 15, agility: 10, intelligence: 5 },
        });

        const enemy = await this.gameSimulator.createCharacter({
          name: 'Goblin',
          class: 'Monster',
          attributes: { strength: 8, agility: 12, intelligence: 3 },
        });

        // 创建战斗实例
        const battle = await this.gameSimulator.initiateBattle(player, enemy);

        // 测试战斗回合
        let turnCount = 0;
        while (!battle.isFinished && turnCount < 100) {
          const action = battle.getCurrentTurnCharacter().selectAction();
          await battle.executeAction(action);
          turnCount++;
        }

        // 验证战斗结果
        expect(battle.isFinished).toBe(true);
        expect(battle.winner).toBeDefined();
        expect(turnCount).toBeLessThan(100); // 防止无限循环

        result.tests.push({
          name: 'Battle Execution',
          status: 'passed',
        });

        return result;
      } catch (error) {
        result.tests.push({
          name: 'Battle System',
          status: 'failed',
          error: error.message,
        });
        return result;
      }
    }
  }

  /**
   * 测试工具类
   */
  class TestUtilities {
    /**
     * 创建模拟数据
     */
    static createMockData<T>(template: Partial<T>, count: number = 1): T[] {
      const results: T[] = [];
      for (let i = 0; i < count; i++) {
        results.push({
          ...template,
          id: generateUniqueId(),
          createdAt: new Date(),
          ...this.generateRandomValues(template),
        } as T);
      }
      return results;
    }

    /**
     * 创建测试环境
     */
    static async setupTestEnvironment(): Promise<TestEnvironment> {
      const testDb = await this.createTestDatabase();
      const testCache = await this.createTestCache();
      const testAuth = await this.createTestAuth();

      return {
        database: testDb,
        cache: testCache,
        auth: testAuth,
        cleanup: async () => {
          await testDb.destroy();
          await testCache.clear();
          await testAuth.reset();
        },
      };
    }

    /**
     * 断言工具扩展
     */
    static expectGameState(
      state: GameState,
      expectedState: Partial<GameState>
    ): void {
      Object.keys(expectedState).forEach(key => {
        expect(state[key]).toEqual(expectedState[key]);
      });
    }

    static expectCharacterStats(
      character: Character,
      expectedStats: Partial<CharacterStats>
    ): void {
      const actualStats = character.calculateStats();
      Object.keys(expectedStats).forEach(key => {
        expect(actualStats[key]).toEqual(expectedStats[key]);
      });
    }

    private static generateRandomValues(template: any): any {
      // 生成随机测试数据的逻辑
      return {};
    }
  }
}
```

## 13.3 集成测试系统

### 13.3.1 API集成测试

```typescript
namespace Testing.Integration {
  /**
   * 集成测试层定义
   */
  interface IntegrationTestLayer {
    apiTests: APITestSuite;
    databaseTests: DatabaseTestSuite;
    serviceTests: ServiceTestSuite;
    authenticationTests: AuthTestSuite;
    realTimeTests: RealTimeTestSuite;
  }

  /**
   * API测试套件
   */
  class APITestSuite {
    private httpClient: TestHTTPClient;
    private apiMocker: APIMocker;
    private schemaValidator: SchemaValidator;

    constructor(config: APITestConfig) {
      this.httpClient = new TestHTTPClient(config.baseUrl);
      this.apiMocker = new APIMocker(config.mockConfig);
      this.schemaValidator = new SchemaValidator(config.schemas);
    }

    /**
     * 执行API集成测试
     */
    async executeTests(): Promise<APITestResult[]> {
      const results: APITestResult[] = [];

      // 1. 认证API测试
      results.push(await this.testAuthenticationEndpoints());

      // 2. 用户管理API测试
      results.push(await this.testUserManagementEndpoints());

      // 3. 游戏状态API测试
      results.push(await this.testGameStateEndpoints());

      // 4. 实时通信API测试
      results.push(await this.testRealTimeEndpoints());

      return results;
    }

    /**
     * 用户管理API测试
     */
    private async testUserManagementEndpoints(): Promise<APITestResult> {
      const result: APITestResult = {
        category: 'UserManagement',
        tests: [],
      };

      try {
        // 测试用户注册
        const registerResponse = await this.httpClient.post(
          '/api/auth/register',
          {
            username: 'testuser',
            email: 'test@example.com',
            password: 'SecurePassword123!',
          }
        );

        expect(registerResponse.status).toBe(201);
        expect(registerResponse.data.user.id).toBeDefined();
        expect(registerResponse.data.token).toBeDefined();

        // 验证响应结构
        await this.schemaValidator.validate(
          registerResponse.data,
          'UserRegistrationResponse'
        );

        const userId = registerResponse.data.user.id;
        const token = registerResponse.data.token;

        // 测试用户登录
        const loginResponse = await this.httpClient.post('/api/auth/login', {
          username: 'testuser',
          password: 'SecurePassword123!',
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.data.token).toBeDefined();

        // 测试获取用户信息
        const userInfoResponse = await this.httpClient.get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(userInfoResponse.status).toBe(200);
        expect(userInfoResponse.data.id).toBe(userId);

        // 测试更新用户信息
        const updateResponse = await this.httpClient.put(
          '/api/users/me',
          {
            displayName: 'Test User Updated',
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.displayName).toBe('Test User Updated');

        result.tests.push({
          name: 'User Registration and Management Flow',
          status: 'passed',
        });

        return result;
      } catch (error) {
        result.tests.push({
          name: 'User Management',
          status: 'failed',
          error: error.message,
        });
        return result;
      }
    }

    /**
     * 游戏状态API测试
     */
    private async testGameStateEndpoints(): Promise<APITestResult> {
      const result: APITestResult = {
        category: 'GameState',
        tests: [],
      };

      try {
        // 首先创建测试用户并获取token
        const authToken = await this.createTestUserAndGetToken();

        // 测试创建新游戏
        const createGameResponse = await this.httpClient.post(
          '/api/games',
          {
            name: 'Test Game',
            type: 'guild_manager',
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(createGameResponse.status).toBe(201);
        expect(createGameResponse.data.gameId).toBeDefined();

        const gameId = createGameResponse.data.gameId;

        // 测试获取游戏状态
        const gameStateResponse = await this.httpClient.get(
          `/api/games/${gameId}/state`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(gameStateResponse.status).toBe(200);
        expect(gameStateResponse.data.gameId).toBe(gameId);
        expect(gameStateResponse.data.state).toBeDefined();

        // 测试更新游戏状态
        const updateStateResponse = await this.httpClient.patch(
          `/api/games/${gameId}/state`,
          {
            playerLevel: 2,
            experience: 1500,
            gold: 1000,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(updateStateResponse.status).toBe(200);
        expect(updateStateResponse.data.state.playerLevel).toBe(2);

        // 测试游戏动作执行
        const actionResponse = await this.httpClient.post(
          `/api/games/${gameId}/actions`,
          {
            type: 'recruit_member',
            parameters: {
              memberType: 'warrior',
              cost: 500,
            },
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(actionResponse.status).toBe(200);
        expect(actionResponse.data.success).toBe(true);

        result.tests.push({
          name: 'Game State Management Flow',
          status: 'passed',
        });

        return result;
      } catch (error) {
        result.tests.push({
          name: 'Game State',
          status: 'failed',
          error: error.message,
        });
        return result;
      }
    }
  }

  /**
   * 数据库集成测试
   */
  class DatabaseTestSuite {
    private testDb: TestDatabase;
    private migrationRunner: MigrationRunner;
    private seedManager: SeedManager;

    constructor(config: DatabaseTestConfig) {
      this.testDb = new TestDatabase(config.connectionString);
      this.migrationRunner = new MigrationRunner(config.migrationsPath);
      this.seedManager = new SeedManager(config.seedsPath);
    }

    /**
     * 执行数据库集成测试
     */
    async executeTests(): Promise<DatabaseTestResult[]> {
      const results: DatabaseTestResult[] = [];

      try {
        // 设置测试数据库
        await this.setupTestDatabase();

        // 1. 用户数据操作测试
        results.push(await this.testUserDataOperations());

        // 2. 游戏数据操作测试
        results.push(await this.testGameDataOperations());

        // 3. 事务一致性测试
        results.push(await this.testTransactionConsistency());

        // 4. 并发访问测试
        results.push(await this.testConcurrentAccess());

        return results;
      } finally {
        await this.cleanupTestDatabase();
      }
    }

    /**
     * 用户数据操作测试
     */
    private async testUserDataOperations(): Promise<DatabaseTestResult> {
      const result: DatabaseTestResult = {
        category: 'UserDataOperations',
        tests: [],
      };

      try {
        // 测试用户创建
        const userId = await this.testDb.users.create({
          username: 'dbtest_user',
          email: 'dbtest@example.com',
          passwordHash: 'hashed_password',
          createdAt: new Date(),
        });

        expect(userId).toBeDefined();

        // 测试用户查询
        const user = await this.testDb.users.findById(userId);
        expect(user).toBeTruthy();
        expect(user.username).toBe('dbtest_user');

        // 测试用户更新
        await this.testDb.users.update(userId, {
          displayName: 'DB Test User',
          lastLoginAt: new Date(),
        });

        const updatedUser = await this.testDb.users.findById(userId);
        expect(updatedUser.displayName).toBe('DB Test User');

        // 测试用户删除
        await this.testDb.users.delete(userId);
        const deletedUser = await this.testDb.users.findById(userId);
        expect(deletedUser).toBeNull();

        result.tests.push({
          name: 'User CRUD Operations',
          status: 'passed',
        });

        return result;
      } catch (error) {
        result.tests.push({
          name: 'User Data Operations',
          status: 'failed',
          error: error.message,
        });
        return result;
      }
    }

    /**
     * 事务一致性测试
     */
    private async testTransactionConsistency(): Promise<DatabaseTestResult> {
      const result: DatabaseTestResult = {
        category: 'TransactionConsistency',
        tests: [],
      };

      try {
        // 测试成功事务
        const userId = await this.testDb.transaction(async tx => {
          const userId = await tx.users.create({
            username: 'transaction_user',
            email: 'tx@example.com',
            passwordHash: 'hashed',
          });

          await tx.userProfiles.create({
            userId,
            displayName: 'Transaction User',
            avatar: 'default.png',
          });

          return userId;
        });

        // 验证事务成功
        const user = await this.testDb.users.findById(userId);
        const profile = await this.testDb.userProfiles.findByUserId(userId);

        expect(user).toBeTruthy();
        expect(profile).toBeTruthy();

        // 测试失败事务回滚
        try {
          await this.testDb.transaction(async tx => {
            await tx.users.create({
              username: 'rollback_user',
              email: 'rollback@example.com',
              passwordHash: 'hashed',
            });

            // 故意抛出错误触发回滚
            throw new Error('Intentional rollback');
          });
        } catch (error) {
          // 期望的错误
        }

        // 验证回滚成功
        const rollbackUser =
          await this.testDb.users.findByUsername('rollback_user');
        expect(rollbackUser).toBeNull();

        result.tests.push({
          name: 'Transaction Consistency',
          status: 'passed',
        });

        return result;
      } catch (error) {
        result.tests.push({
          name: 'Transaction Consistency',
          status: 'failed',
          error: error.message,
        });
        return result;
      }
    }
  }

  /**
   * 服务集成测试
   */
  class ServiceTestSuite {
    private serviceOrchestrator: ServiceOrchestrator;
    private messageBroker: TestMessageBroker;

    constructor(config: ServiceTestConfig) {
      this.serviceOrchestrator = new ServiceOrchestrator(config.services);
      this.messageBroker = new TestMessageBroker(config.brokerConfig);
    }

    /**
     * 执行服务集成测试
     */
    async executeTests(): Promise<ServiceTestResult[]> {
      const results: ServiceTestResult[] = [];

      // 1. 服务间通信测试
      results.push(await this.testServiceCommunication());

      // 2. 消息队列集成测试
      results.push(await this.testMessageQueueIntegration());

      // 3. 服务发现测试
      results.push(await this.testServiceDiscovery());

      return results;
    }

    /**
     * 服务间通信测试
     */
    private async testServiceCommunication(): Promise<ServiceTestResult> {
      const result: ServiceTestResult = {
        category: 'ServiceCommunication',
        tests: [],
      };

      try {
        // 测试用户服务调用游戏服务
        const userService = await this.serviceOrchestrator.getService('user');
        const gameService = await this.serviceOrchestrator.getService('game');

        // 创建测试用户
        const user = await userService.createUser({
          username: 'service_test_user',
          email: 'service@example.com',
        });

        // 通过游戏服务为用户创建游戏
        const game = await gameService.createGameForUser(user.id, {
          type: 'guild_manager',
          difficulty: 'normal',
        });

        expect(game.id).toBeDefined();
        expect(game.ownerId).toBe(user.id);

        // 测试服务间数据一致性
        const userGames = await userService.getUserGames(user.id);
        expect(userGames).toContainEqual(
          expect.objectContaining({ gameId: game.id })
        );

        result.tests.push({
          name: 'Inter-Service Communication',
          status: 'passed',
        });

        return result;
      } catch (error) {
        result.tests.push({
          name: 'Service Communication',
          status: 'failed',
          error: error.message,
        });
        return result;
      }
    }
  }
}
```

## 13.4 端到端测试平台

### 13.4.1 Playwright E2E测试框架

#### 13.4.1.1 冒烟用例模板（第1-2周必须完成）

基础设施锁定期间，必须建立最基础的冒烟测试来验证核心架构正确性。

```typescript
namespace Testing.E2E.Smoke {
  /**
   * 冒烟测试配置（基于Playwright Electron官方示例）
   */
  interface SmokeTestConfig {
    electronPath: string;
    appArgs: string[];
    timeout: number;
    retries: number;
    screenshots: boolean;
    video: boolean;
  }

  /**
   * Electron应用冒烟测试管理器
   */
  export class ElectronSmokeTestManager {
    private electronApp: ElectronApplication;
    private mainWindow: Page;
    private config: SmokeTestConfig;

    constructor(config: SmokeTestConfig) {
      this.config = config;
    }

    /**
     * 执行完整的冒烟测试流程
     * 流程：启动 → 加载 → 事件触发 → 断言
     */
    async executeSmokeSuite(): Promise<SmokeTestResult> {
      const result: SmokeTestResult = {
        passed: false,
        duration: 0,
        steps: [],
        errors: [],
      };

      const startTime = Date.now();

      try {
        // 步骤1：应用启动测试
        await this.testAppStartup();
        result.steps.push({
          name: 'App Startup',
          passed: true,
          duration: Date.now() - startTime,
        });

        // 步骤2：主窗口加载测试
        await this.testMainWindowLoad();
        result.steps.push({
          name: 'Main Window Load',
          passed: true,
          duration: Date.now() - startTime,
        });

        // 步骤3：事件触发测试
        await this.testBasicEventTrigger();
        result.steps.push({
          name: 'Basic Event Trigger',
          passed: true,
          duration: Date.now() - startTime,
        });

        // 步骤4：UI/日志断言测试
        await this.testUILogAssertions();
        result.steps.push({
          name: 'UI/Log Assertions',
          passed: true,
          duration: Date.now() - startTime,
        });

        result.passed = true;
      } catch (error) {
        result.errors.push(error.message);
        console.error('[SMOKE_TEST] Failed:', error);
      } finally {
        result.duration = Date.now() - startTime;
        await this.cleanup();
      }

      return result;
    }

    /**
     * 测试Electron应用启动
     */
    private async testAppStartup(): Promise<void> {
      console.log('[SMOKE_TEST] Testing app startup...');

      this.electronApp = await _electron.launch({
        executablePath: this.config.electronPath,
        args: this.config.appArgs,
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
        recordVideo: this.config.video
          ? {
              dir: './test-results/smoke-videos',
              size: { width: 1280, height: 720 },
            }
          : undefined,
        timeout: this.config.timeout,
      });

      // 验证应用进程启动
      expect(this.electronApp).toBeDefined();

      // 等待主窗口创建
      this.mainWindow = await this.electronApp.firstWindow();
      expect(this.mainWindow).toBeDefined();
    }

    /**
     * 测试主窗口加载
     */
    private async testMainWindowLoad(): Promise<void> {
      console.log('[SMOKE_TEST] Testing main window load...');

      // 等待页面加载完成
      await this.mainWindow.waitForLoadState('domcontentloaded', {
        timeout: 10000,
      });

      // 验证Electron安全配置
      const contextIsolated = await this.mainWindow.evaluate(() => {
        return (
          typeof window.electronAPI !== 'undefined' &&
          typeof window.require === 'undefined'
        );
      });
      expect(contextIsolated).toBe(true);

      // 验证React组件渲染
      await this.mainWindow.waitForSelector('[data-testid="app-root"]', {
        timeout: 5000,
      });
      const reactRoot = await this.mainWindow.$('[data-testid="app-root"]');
      expect(reactRoot).not.toBeNull();

      // 验证Phaser场景初始化
      const phaserInitialized = await this.mainWindow.evaluate(() => {
        return new Promise(resolve => {
          const checkPhaser = () => {
            // @ts-ignore
            if (window.game && window.game.scene && window.game.scene.keys) {
              resolve(true);
            } else if (Date.now() - startTime > 8000) {
              resolve(false);
            } else {
              setTimeout(checkPhaser, 100);
            }
          };
          const startTime = Date.now();
          checkPhaser();
        });
      });
      expect(phaserInitialized).toBe(true);

      if (this.config.screenshots) {
        await this.mainWindow.screenshot({
          path: `./test-results/smoke-main-window-loaded.png`,
          fullPage: true,
        });
      }
    }

    /**
     * 测试基础事件触发
     */
    private async testBasicEventTrigger(): Promise<void> {
      console.log('[SMOKE_TEST] Testing basic event trigger...');

      // 触发菜单点击事件
      const menuButton = await this.mainWindow.waitForSelector(
        '[data-testid="main-menu-button"]',
        { timeout: 3000 }
      );
      await menuButton.click();

      // 验证菜单展开
      await this.mainWindow.waitForSelector('[data-testid="menu-dropdown"]', {
        state: 'visible',
        timeout: 2000,
      });

      // 触发IPC通信事件
      const versionInfo = await this.electronApp.evaluate(async ({ app }) => {
        return {
          version: app.getVersion(),
          name: app.getName(),
        };
      });

      expect(versionInfo.version).toBeDefined();
      expect(versionInfo.name).toBe('Guild Manager');

      // 验证React-Phaser事件通信
      await this.mainWindow.evaluate(() => {
        // 触发一个测试事件
        window.dispatchEvent(
          new CustomEvent('test:smoke-event', {
            detail: { type: 'smoke-test', timestamp: Date.now() },
          })
        );
      });

      // 等待事件响应
      const eventHandled = await this.mainWindow.waitForFunction(
        () => {
          // @ts-ignore
          return (
            window.lastTestEvent && window.lastTestEvent.type === 'smoke-test'
          );
        },
        {},
        { timeout: 2000 }
      );

      expect(eventHandled).toBeTruthy();
    }

    /**
     * 测试UI和日志断言
     */
    private async testUILogAssertions(): Promise<void> {
      console.log('[SMOKE_TEST] Testing UI/Log assertions...');

      // 验证控制台日志
      const consoleLogs: string[] = [];
      this.mainWindow.on('console', msg => {
        if (msg.type() === 'log') {
          consoleLogs.push(msg.text());
        }
      });

      // 触发一个日志输出
      await this.mainWindow.evaluate(() => {
        console.log('[SMOKE_TEST] Test log message');
      });

      // 等待日志出现
      await this.mainWindow.waitForTimeout(500);
      const hasTestLog = consoleLogs.some(log =>
        log.includes('[SMOKE_TEST] Test log message')
      );
      expect(hasTestLog).toBe(true);

      // 验证错误处理机制
      const errorLogs: string[] = [];
      this.mainWindow.on('console', msg => {
        if (msg.type() === 'error') {
          errorLogs.push(msg.text());
        }
      });

      // 验证页面标题
      const title = await this.mainWindow.title();
      expect(title).toContain('Guild Manager');

      // 验证窗口状态
      const windowState = await this.mainWindow.evaluate(() => ({
        visible: document.visibilityState === 'visible',
        focused: document.hasFocus(),
        loaded: document.readyState === 'complete',
      }));

      expect(windowState.visible).toBe(true);
      expect(windowState.loaded).toBe(true);
    }

    /**
     * 清理测试资源
     */
    private async cleanup(): Promise<void> {
      if (this.electronApp) {
        await this.electronApp.close();
      }
    }
  }

  /**
   * 冒烟测试结果接口
   */
  interface SmokeTestResult {
    passed: boolean;
    duration: number;
    steps: Array<{
      name: string;
      passed: boolean;
      duration: number;
    }>;
    errors: string[];
  }

  /**
   * CI集成配置（每次commit自动执行）
   */
  export class SmokeTestCIIntegration {
    /**
     * 生成GitHub Actions工作流配置
     */
    static generateGitHubActionsConfig(): string {
      return `
name: Smoke Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright
      run: npx playwright install
    
    - name: Run Smoke Tests
      run: npm run test:smoke
      
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: smoke-test-results
        path: test-results/
        retention-days: 30
      `;
    }

    /**
     * npm脚本配置
     */
    static getPackageJsonScripts(): Record<string, string> {
      return {
        'test:smoke': 'playwright test --config=playwright.smoke.config.ts',
        'test:smoke:headed':
          'playwright test --config=playwright.smoke.config.ts --headed',
        'test:smoke:debug':
          'PWDEBUG=1 playwright test --config=playwright.smoke.config.ts',
      };
    }
  }
}

namespace Testing.E2E {
  /**
   * E2E测试层定义（更新版）
   */
  interface E2ETestLayer {
    smokeTests: Testing.E2E.Smoke.ElectronSmokeTestManager; // 新增：冒烟测试
    userJourneyTests: UserJourneyTestSuite;
    crossBrowserTests: CrossBrowserTestSuite;
    performanceTests: E2EPerformanceTestSuite;
    accessibilityTests: AccessibilityTestSuite;
    mobileTests: MobileTestSuite;
  }

  /**
   * 用户旅程测试套件
   */
  class UserJourneyTestSuite {
    private browser: Browser;
    private testDataManager: TestDataManager;
    private screenshotManager: ScreenshotManager;

    constructor(config: E2ETestConfig) {
      this.testDataManager = new TestDataManager(config.testData);
      this.screenshotManager = new ScreenshotManager(config.screenshots);
    }

    /**
     * 执行用户旅程测试
     */
    async executeTests(): Promise<E2ETestResult[]> {
      const results: E2ETestResult[] = [];

      try {
        // 启动浏览器
        this.browser = await playwright.chromium.launch({
          headless: process.env.CI === 'true',
          devtools: process.env.DEBUG === 'true',
        });

        // 1. 用户注册登录流程
        results.push(await this.testUserRegistrationFlow());

        // 2. 游戏创建和初始化流程
        results.push(await this.testGameCreationFlow());

        // 3. 核心游戏玩法流程
        results.push(await this.testCoreGameplayFlow());

        // 4. 社交功能流程
        results.push(await this.testSocialFeaturesFlow());

        // 5. 支付流程（如果存在）
        results.push(await this.testPaymentFlow());

        return results;
      } finally {
        if (this.browser) {
          await this.browser.close();
        }
      }
    }

    /**
     * 用户注册登录流程测试
     */
    private async testUserRegistrationFlow(): Promise<E2ETestResult> {
      const result: E2ETestResult = {
        category: 'UserRegistration',
        tests: [],
        screenshots: [],
      };

      const page = await this.browser.newPage();

      try {
        // 1. 访问注册页面
        await page.goto('http://localhost:3000/register');
        await page.waitForLoadState('networkidle');

        // 截图：注册页面初始状态
        await this.screenshotManager.capture(page, 'register-initial');

        // 2. 填写注册表单
        await page.fill('[data-testid="username-input"]', 'e2etest_user');
        await page.fill('[data-testid="email-input"]', 'e2etest@example.com');
        await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
        await page.fill(
          '[data-testid="confirm-password-input"]',
          'SecurePassword123!'
        );

        // 截图：表单填写完成
        await this.screenshotManager.capture(page, 'register-form-filled');

        // 3. 提交注册
        await page.click('[data-testid="register-button"]');

        // 4. 等待注册成功并跳转
        await page.waitForURL('**/dashboard', { timeout: 10000 });

        // 验证用户已登录
        const userMenu = await page.locator('[data-testid="user-menu"]');
        await expect(userMenu).toBeVisible();

        // 截图：注册成功后的仪表板
        await this.screenshotManager.capture(
          page,
          'register-success-dashboard'
        );

        // 5. 测试登出
        await page.click('[data-testid="user-menu"]');
        await page.click('[data-testid="logout-button"]');
        await page.waitForURL('**/login');

        // 6. 测试登录
        await page.fill('[data-testid="login-username"]', 'e2etest_user');
        await page.fill('[data-testid="login-password"]', 'SecurePassword123!');
        await page.click('[data-testid="login-button"]');

        // 验证登录成功
        await page.waitForURL('**/dashboard');
        await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

        result.tests.push({
          name: 'Complete Registration and Login Flow',
          status: 'passed',
          duration: Date.now() - result.startTime,
        });

        return result;
      } catch (error) {
        await this.screenshotManager.capture(page, 'register-flow-error');
        result.tests.push({
          name: 'User Registration Flow',
          status: 'failed',
          error: error.message,
        });
        return result;
      } finally {
        await page.close();
      }
    }

    /**
     * 核心游戏玩法流程测试
     */
    private async testCoreGameplayFlow(): Promise<E2ETestResult> {
      const result: E2ETestResult = {
        category: 'CoreGameplay',
        tests: [],
        screenshots: [],
      };

      const page = await this.browser.newPage();

      try {
        // 1. 登录到已有账户
        await this.loginTestUser(page);

        // 2. 创建新游戏
        await page.click('[data-testid="new-game-button"]');
        await page.waitForSelector('[data-testid="game-creation-modal"]');

        await page.fill('[data-testid="game-name-input"]', 'E2E Test Guild');
        await page.selectOption('[data-testid="difficulty-select"]', 'normal');
        await page.click('[data-testid="create-game-button"]');

        // 等待游戏初始化完成
        await page.waitForSelector('[data-testid="game-canvas"]');
        await this.screenshotManager.capture(page, 'game-initial-state');

        // 3. 测试基础游戏操作

        // 招募第一个成员
        await page.click('[data-testid="recruit-button"]');
        await page.waitForSelector('[data-testid="recruitment-modal"]');
        await page.click('[data-testid="recruit-warrior-button"]');
        await page.click('[data-testid="confirm-recruitment-button"]');

        // 验证成员被招募
        await expect(
          page.locator('[data-testid="guild-member-count"]')
        ).toHaveText('1');

        // 4. 执行任务
        await page.click('[data-testid="quests-tab"]');
        await page.click(
          '[data-testid="quest-1"] [data-testid="accept-quest-button"]'
        );

        // 等待任务开始
        await expect(
          page.locator('[data-testid="active-quest-indicator"]')
        ).toBeVisible();

        // 5. 检查资源变化
        const initialGold = await page.textContent(
          '[data-testid="gold-amount"]'
        );

        // 模拟时间流逝（如果游戏支持加速）
        if (
          await page
            .locator('[data-testid="time-acceleration-button"]')
            .isVisible()
        ) {
          await page.click('[data-testid="time-acceleration-button"]');
          await page.waitForTimeout(2000);
        }

        // 验证资源有变化
        const currentGold = await page.textContent(
          '[data-testid="gold-amount"]'
        );
        expect(parseInt(currentGold)).not.toBe(parseInt(initialGold));

        await this.screenshotManager.capture(page, 'gameplay-after-quest');

        result.tests.push({
          name: 'Core Gameplay Flow',
          status: 'passed',
          duration: Date.now() - result.startTime,
        });

        return result;
      } catch (error) {
        await this.screenshotManager.capture(page, 'gameplay-flow-error');
        result.tests.push({
          name: 'Core Gameplay Flow',
          status: 'failed',
          error: error.message,
        });
        return result;
      } finally {
        await page.close();
      }
    }

    /**
     * 跨浏览器兼容性测试
     */
    private async testCrossBrowserCompatibility(): Promise<E2ETestResult[]> {
      const browsers = ['chromium', 'firefox', 'webkit'];
      const results: E2ETestResult[] = [];

      for (const browserName of browsers) {
        const browser = await playwright[browserName].launch();
        const page = await browser.newPage();

        try {
          const result: E2ETestResult = {
            category: `CrossBrowser_${browserName}`,
            tests: [],
          };

          // 基础功能测试
          await page.goto('http://localhost:3000');
          await this.loginTestUser(page);

          // 验证核心UI元素在不同浏览器中正常显示
          await expect(
            page.locator('[data-testid="main-navigation"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="game-canvas"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="resource-panel"]')
          ).toBeVisible();

          result.tests.push({
            name: `${browserName} Compatibility`,
            status: 'passed',
          });

          results.push(result);
        } catch (error) {
          results.push({
            category: `CrossBrowser_${browserName}`,
            tests: [
              {
                name: `${browserName} Compatibility`,
                status: 'failed',
                error: error.message,
              },
            ],
          });
        } finally {
          await browser.close();
        }
      }

      return results;
    }

    /**
     * 辅助方法：登录测试用户
     */
    private async loginTestUser(page: Page): Promise<void> {
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid="login-username"]', 'e2etest_user');
      await page.fill('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/dashboard');
    }
  }

  /**
   * 可访问性测试套件
   */
  class AccessibilityTestSuite {
    private browser: Browser;
    private axeBuilder: AxeBuilder;

    constructor(config: AccessibilityTestConfig) {
      this.axeBuilder = new AxeBuilder();
    }

    /**
     * 执行可访问性测试
     */
    async executeTests(): Promise<AccessibilityTestResult[]> {
      const results: AccessibilityTestResult[] = [];
      this.browser = await playwright.chromium.launch();
      const page = await this.browser.newPage();

      try {
        // 测试主要页面的可访问性
        const testPages = [
          { name: 'Home', url: 'http://localhost:3000' },
          { name: 'Login', url: 'http://localhost:3000/login' },
          { name: 'Register', url: 'http://localhost:3000/register' },
          { name: 'Dashboard', url: 'http://localhost:3000/dashboard' },
          { name: 'Game', url: 'http://localhost:3000/game' },
        ];

        for (const testPage of testPages) {
          const result = await this.testPageAccessibility(page, testPage);
          results.push(result);
        }

        return results;
      } finally {
        await this.browser.close();
      }
    }

    /**
     * 测试单个页面的可访问性
     */
    private async testPageAccessibility(
      page: Page,
      testPage: { name: string; url: string }
    ): Promise<AccessibilityTestResult> {
      const result: AccessibilityTestResult = {
        pageName: testPage.name,
        violations: [],
        passCount: 0,
        violationCount: 0,
      };

      try {
        await page.goto(testPage.url);
        await page.waitForLoadState('networkidle');

        // 如果是受保护页面，先登录
        if (
          testPage.url.includes('/dashboard') ||
          testPage.url.includes('/game')
        ) {
          await this.ensureLoggedIn(page);
        }

        // 运行axe可访问性检测
        const axeResults = await this.axeBuilder.analyze(page);

        result.violations = axeResults.violations.map(violation => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.length,
        }));

        result.violationCount = axeResults.violations.length;
        result.passCount = axeResults.passes.length;

        // 手动测试键盘导航
        await this.testKeyboardNavigation(page, result);

        // 测试屏幕阅读器支持
        await this.testScreenReaderSupport(page, result);

        return result;
      } catch (error) {
        result.error = error.message;
        return result;
      }
    }

    /**
     * 测试键盘导航
     */
    private async testKeyboardNavigation(
      page: Page,
      result: AccessibilityTestResult
    ): Promise<void> {
      try {
        // 测试Tab键导航
        const focusableElements = await page
          .locator(
            '[tabindex]:not([tabindex="-1"]), button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
          )
          .count();

        let tabCount = 0;
        for (let i = 0; i < Math.min(focusableElements, 20); i++) {
          await page.keyboard.press('Tab');
          tabCount++;
        }

        if (tabCount > 0) {
          result.keyboardNavigation = {
            tabNavigationWorking: true,
            focusableElementsCount: focusableElements,
          };
        }
      } catch (error) {
        result.keyboardNavigation = {
          tabNavigationWorking: false,
          error: error.message,
        };
      }
    }

    /**
     * 测试屏幕阅读器支持
     */
    private async testScreenReaderSupport(
      page: Page,
      result: AccessibilityTestResult
    ): Promise<void> {
      try {
        // 检查ARIA标签
        const ariaLabels = await page.locator('[aria-label]').count();
        const ariaDescribedBy = await page
          .locator('[aria-describedby]')
          .count();
        const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
        const landmarks = await page
          .locator(
            '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'
          )
          .count();

        result.screenReaderSupport = {
          ariaLabelsCount: ariaLabels,
          ariaDescribedByCount: ariaDescribedBy,
          headingsCount: headings,
          landmarksCount: landmarks,
        };
      } catch (error) {
        result.screenReaderSupport = {
          error: error.message,
        };
      }
    }

    private async ensureLoggedIn(page: Page): Promise<void> {
      // 检查是否已经登录
      const isLoggedIn = await page
        .locator('[data-testid="user-menu"]')
        .isVisible()
        .catch(() => false);

      if (!isLoggedIn) {
        await page.goto('http://localhost:3000/login');
        await page.fill('[data-testid="login-username"]', 'e2etest_user');
        await page.fill('[data-testid="login-password"]', 'SecurePassword123!');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/dashboard');
      }
    }
  }
}
```

## 13.5 性能测试系统

### 13.5.1 负载测试和压力测试

```typescript
namespace Testing.Performance {
  /**
   * 性能测试层定义
   */
  interface PerformanceTestLayer {
    loadTests: LoadTestSuite;
    stressTests: StressTestSuite;
    enduranceTests: EnduranceTestSuite;
    spikeTests: SpikeTestSuite;
    volumeTests: VolumeTestSuite;
  }

  /**
   * 性能测试控制器
   */
  class PerformanceTestController {
    private k6Runner: K6TestRunner;
    private metricsCollector: PerformanceMetricsCollector;
    private reportGenerator: PerformanceReportGenerator;
    private alertManager: PerformanceAlertManager;

    constructor(config: PerformanceTestConfig) {
      this.k6Runner = new K6TestRunner(config.k6Config);
      this.metricsCollector = new PerformanceMetricsCollector(
        config.metricsConfig
      );
      this.reportGenerator = new PerformanceReportGenerator(
        config.reportConfig
      );
      this.alertManager = new PerformanceAlertManager(config.alertConfig);
    }

    /**
     * 执行完整性能测试套件
     */
    async executeFullPerformanceSuite(): Promise<PerformanceTestSuiteResult> {
      const result: PerformanceTestSuiteResult = {
        suiteId: generateUniqueId(),
        startTime: Date.now(),
        testTypes: {},
        overallMetrics: {
          throughput: 0,
          responseTime: { p95: 0, p99: 0, avg: 0 },
          errorRate: 0,
          resourceUtilization: { cpu: 0, memory: 0, disk: 0, network: 0 },
        },
        slaCompliance: {},
      };

      try {
        console.log('🚀 开始性能测试套件...');

        // 1. 负载测试 - 验证正常工作负载下的性能
        console.log('📈 执行负载测试...');
        result.testTypes.load = await this.executeLoadTests();

        // 2. 压力测试 - 确定系统处理能力上限
        console.log('💪 执行压力测试...');
        result.testTypes.stress = await this.executeStressTests();

        // 3. 峰值测试 - 测试突发流量处理能力
        console.log('⚡ 执行峰值测试...');
        result.testTypes.spike = await this.executeSpikeTests();

        // 4. 容量测试 - 测试数据量处理能力
        console.log('📊 执行容量测试...');
        result.testTypes.volume = await this.executeVolumeTests();

        // 5. 耐久测试 - 长期稳定性验证
        console.log('⏱️ 执行耐久测试...');
        result.testTypes.endurance = await this.executeEnduranceTests();

        // 聚合性能指标
        this.aggregatePerformanceMetrics(result);

        // 生成性能报告
        await this.reportGenerator.generateComprehensiveReport(result);

        // 检查SLA合规性
        await this.checkSLACompliance(result);

        result.endTime = Date.now();
        result.totalDuration = result.endTime - result.startTime;

        return result;
      } catch (error) {
        result.error = error.message;
        await this.reportGenerator.generateErrorReport(result);
        throw error;
      }
    }

    /**
     * 执行负载测试
     */
    private async executeLoadTests(): Promise<LoadTestResult> {
      const loadTestScript = `
        import http from 'k6/http';
        import { check, sleep } from 'k6';
        import { Rate } from 'k6/metrics';

        const errorRate = new Rate('errors');

        export let options = {
          stages: [
            { duration: '2m', target: 100 },  // 预热到100用户
            { duration: '5m', target: 500 },  // 保持500用户负载
            { duration: '2m', target: 0 },    // 逐渐降至0
          ],
          thresholds: {
            http_req_duration: ['p(95)<500'], // 95%的请求响应时间<500ms
            errors: ['rate<0.05'],            // 错误率<5%
          },
        };

        export default function() {
          // 用户注册登录流程
          let loginRes = http.post('http://localhost:3000/api/auth/login', {
            username: \`user_\${__VU}_\${__ITER}\`,
            password: 'testpass123'
          });
          
          check(loginRes, {
            'login status is 200': (r) => r.status === 200,
            'login response time < 500ms': (r) => r.timings.duration < 500,
          }) || errorRate.add(1);

          if (loginRes.status === 200) {
            const token = JSON.parse(loginRes.body).token;
            
            // 游戏状态查询
            let gameStateRes = http.get('http://localhost:3000/api/games/state', {
              headers: { Authorization: \`Bearer \${token}\` }
            });
            
            check(gameStateRes, {
              'game state status is 200': (r) => r.status === 200,
              'game state response time < 200ms': (r) => r.timings.duration < 200,
            }) || errorRate.add(1);

            // 执行游戏操作
            let actionRes = http.post('http://localhost:3000/api/games/actions', {
              type: 'recruit_member',
              parameters: { memberType: 'warrior' }
            }, {
              headers: { Authorization: \`Bearer \${token}\` }
            });
            
            check(actionRes, {
              'action status is 200': (r) => r.status === 200,
              'action response time < 1000ms': (r) => r.timings.duration < 1000,
            }) || errorRate.add(1);
          }

          sleep(1);
        }
      `;

      const result = await this.k6Runner.runTest(loadTestScript, 'load-test');
      return this.parseK6Results(result, 'load');
    }
  }
}
```

## 13.6 安全测试框架

### 13.6.1 OWASP ZAP集成和漏洞扫描

```typescript
namespace Testing.Security {
  /**
   * 安全测试层定义
   */
  interface SecurityTestLayer {
    vulnerabilityScans: VulnerabilityTestSuite;
    authenticationTests: AuthSecurityTestSuite;
    authorizationTests: AuthzSecurityTestSuite;
    inputValidationTests: InputValidationTestSuite;
    cryptographyTests: CryptographyTestSuite;
    owasp10Tests: OWASP10TestSuite;
  }

  /**
   * 安全测试控制器
   */
  class SecurityTestController {
    private zapClient: ZAPClient;
    private burpClient: BurpSuiteClient;
    private sqlmapRunner: SQLMapRunner;
    private reportAggregator: SecurityReportAggregator;

    constructor(config: SecurityTestConfig) {
      this.zapClient = new ZAPClient(config.zapConfig);
      this.burpClient = new BurpSuiteClient(config.burpConfig);
      this.sqlmapRunner = new SQLMapRunner(config.sqlmapConfig);
      this.reportAggregator = new SecurityReportAggregator(config.reportConfig);
    }

    /**
     * 执行完整安全测试套件
     */
    async executeFullSecuritySuite(): Promise<SecurityTestSuiteResult> {
      const result: SecurityTestSuiteResult = {
        suiteId: generateUniqueId(),
        startTime: Date.now(),
        testTypes: {},
        vulnerabilities: [],
        riskScore: 0,
        complianceStatus: {},
      };

      try {
        console.log('🔒 开始安全测试套件...');

        // 1. OWASP Top 10 漏洞扫描
        console.log('🎯 执行OWASP Top 10测试...');
        result.testTypes.owasp10 = await this.executeOWASPTop10Tests();

        // 2. 身份认证安全测试
        console.log('🔐 执行身份认证测试...');
        result.testTypes.authentication =
          await this.executeAuthenticationTests();

        // 3. 授权和访问控制测试
        console.log('🛡️ 执行授权测试...');
        result.testTypes.authorization = await this.executeAuthorizationTests();

        // 4. 输入验证和注入攻击测试
        console.log('💉 执行输入验证测试...');
        result.testTypes.inputValidation =
          await this.executeInputValidationTests();

        // 5. 会话管理安全测试
        console.log('🍪 执行会话管理测试...');
        result.testTypes.sessionManagement =
          await this.executeSessionManagementTests();

        // 6. 加密和数据保护测试
        console.log('🔑 执行加密测试...');
        result.testTypes.cryptography = await this.executeCryptographyTests();

        // 聚合漏洞信息
        this.aggregateVulnerabilities(result);

        // 计算风险评分
        result.riskScore = this.calculateRiskScore(result.vulnerabilities);

        // 生成安全报告
        await this.reportAggregator.generateSecurityReport(result);

        result.endTime = Date.now();
        return result;
      } catch (error) {
        result.error = error.message;
        throw error;
      }
    }
  }
}
```

## 13.7 测试数据管理

### 13.7.1 测试数据工厂和数据清理

```typescript
namespace Testing.DataManagement {
  /**
   * 测试数据管理器
   */
  class TestDataManager {
    private dataFactory: TestDataFactory;
    private dbCleaner: DatabaseCleaner;
    private seedManager: SeedDataManager;
    private snapshotManager: DataSnapshotManager;

    constructor(config: TestDataConfig) {
      this.dataFactory = new TestDataFactory(config.factoryConfig);
      this.dbCleaner = new DatabaseCleaner(config.cleanupConfig);
      this.seedManager = new SeedDataManager(config.seedConfig);
      this.snapshotManager = new DataSnapshotManager(config.snapshotConfig);
    }

    /**
     * 为测试套件准备数据
     */
    async prepareTestData(testSuite: string): Promise<TestDataSet> {
      const dataSet: TestDataSet = {
        id: generateUniqueId(),
        testSuite,
        createdAt: Date.now(),
        data: {},
      };

      try {
        // 1. 清理已有测试数据
        await this.dbCleaner.cleanupTestData();

        // 2. 创建基础种子数据
        const seedData = await this.seedManager.createSeedData(testSuite);
        dataSet.data.seed = seedData;

        // 3. 生成特定测试数据
        const testSpecificData =
          await this.dataFactory.generateTestData(testSuite);
        dataSet.data.testSpecific = testSpecificData;

        // 4. 创建数据快照
        await this.snapshotManager.createSnapshot(dataSet.id);

        return dataSet;
      } catch (error) {
        throw new Error(`Failed to prepare test data: ${error.message}`);
      }
    }

    /**
     * 清理测试数据
     */
    async cleanupTestData(dataSetId: string): Promise<void> {
      try {
        // 1. 恢复到快照状态
        await this.snapshotManager.restoreSnapshot(dataSetId);

        // 2. 清理生成的测试数据
        await this.dbCleaner.cleanupByDataSetId(dataSetId);

        // 3. 删除快照
        await this.snapshotManager.deleteSnapshot(dataSetId);
      } catch (error) {
        console.warn(`Failed to cleanup test data: ${error.message}`);
      }
    }
  }

  /**
   * 测试数据工厂
   */
  class TestDataFactory {
    private builders: Map<string, DataBuilder>;
    private faker: FakerInstance;

    constructor(config: DataFactoryConfig) {
      this.builders = new Map();
      this.faker = new FakerInstance(config.locale || 'zh_CN');
      this.initializeBuilders();
    }

    /**
     * 生成用户测试数据
     */
    async generateUsers(count: number = 10): Promise<User[]> {
      const users: User[] = [];

      for (let i = 0; i < count; i++) {
        const user: User = {
          id: generateUniqueId(),
          username: this.faker.internet.userName(),
          email: this.faker.internet.email(),
          displayName: this.faker.name.fullName(),
          passwordHash: await this.hashPassword('testpass123'),
          createdAt: this.faker.date.past(),
          updatedAt: new Date(),
          isActive: this.faker.datatype.boolean(0.9), // 90%的用户是活跃的
          profile: {
            avatar: this.faker.image.avatar(),
            bio: this.faker.lorem.paragraph(),
            location: this.faker.location.city(),
            website: this.faker.internet.url(),
          },
        };
        users.push(user);
      }

      return users;
    }

    /**
     * 生成游戏测试数据
     */
    async generateGames(users: User[], count: number = 20): Promise<Game[]> {
      const games: Game[] = [];

      for (let i = 0; i < count; i++) {
        const owner = this.faker.helpers.arrayElement(users);
        const game: Game = {
          id: generateUniqueId(),
          name: this.generateGameName(),
          ownerId: owner.id,
          type: this.faker.helpers.arrayElement([
            'guild_manager',
            'adventure',
            'strategy',
          ]),
          difficulty: this.faker.helpers.arrayElement([
            'easy',
            'normal',
            'hard',
            'nightmare',
          ]),
          state: {
            level: this.faker.number.int({ min: 1, max: 50 }),
            experience: this.faker.number.int({ min: 0, max: 100000 }),
            gold: this.faker.number.int({ min: 100, max: 50000 }),
            resources: {
              wood: this.faker.number.int({ min: 0, max: 1000 }),
              stone: this.faker.number.int({ min: 0, max: 1000 }),
              food: this.faker.number.int({ min: 0, max: 1000 }),
            },
            members: await this.generateGuildMembers(),
            quests: await this.generateQuests(),
          },
          createdAt: this.faker.date.past(),
          updatedAt: new Date(),
          lastPlayedAt: this.faker.date.recent(),
        };
        games.push(game);
      }

      return games;
    }

    /**
     * 生成公会成员数据
     */
    private async generateGuildMembers(): Promise<GuildMember[]> {
      const memberCount = this.faker.number.int({ min: 1, max: 20 });
      const members: GuildMember[] = [];

      for (let i = 0; i < memberCount; i++) {
        const member: GuildMember = {
          id: generateUniqueId(),
          name: this.faker.name.firstName(),
          class: this.faker.helpers.arrayElement([
            'warrior',
            'mage',
            'archer',
            'rogue',
            'cleric',
          ]),
          level: this.faker.number.int({ min: 1, max: 100 }),
          attributes: {
            strength: this.faker.number.int({ min: 5, max: 20 }),
            agility: this.faker.number.int({ min: 5, max: 20 }),
            intelligence: this.faker.number.int({ min: 5, max: 20 }),
            vitality: this.faker.number.int({ min: 5, max: 20 }),
          },
          equipment: await this.generateEquipment(),
          status: this.faker.helpers.arrayElement([
            'idle',
            'on_quest',
            'training',
            'injured',
          ]),
          joinedAt: this.faker.date.past(),
        };
        members.push(member);
      }

      return members;
    }

    private generateGameName(): string {
      const prefixes = ['龙', '凤', '虎', '狮', '鹰', '狼', '熊', '蛇'];
      const middle = ['之', '的', '与', '和'];
      const suffixes = [
        '王国',
        '帝国',
        '联盟',
        '公会',
        '军团',
        '部落',
        '传说',
        '史诗',
      ];

      return (
        this.faker.helpers.arrayElement(prefixes) +
        this.faker.helpers.arrayElement(middle) +
        this.faker.helpers.arrayElement(suffixes)
      );
    }
  }

  /**
   * 数据库清理器
   */
  class DatabaseCleaner {
    private db: TestDatabase;
    private cleanupStrategies: Map<string, CleanupStrategy>;

    constructor(config: DatabaseCleanerConfig) {
      this.db = new TestDatabase(config.connectionString);
      this.cleanupStrategies = this.initializeCleanupStrategies();
    }

    /**
     * 清理所有测试数据
     */
    async cleanupAllTestData(): Promise<void> {
      await this.db.transaction(async tx => {
        // 按依赖关系顺序清理表
        const tableOrder = [
          'game_quest_completions',
          'game_member_equipment',
          'game_members',
          'game_quests',
          'games',
          'user_sessions',
          'user_profiles',
          'users',
        ];

        for (const table of tableOrder) {
          await tx.raw(`DELETE FROM ${table} WHERE id LIKE 'test_%'`);
        }
      });
    }

    /**
     * 增量清理策略
     */
    async incrementalCleanup(): Promise<void> {
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24小时前

      await this.db.transaction(async tx => {
        // 清理过期的测试数据
        await tx.raw(
          `
          DELETE FROM games 
          WHERE id LIKE 'test_%' 
          AND created_at < ?
        `,
          [new Date(cutoffTime)]
        );

        await tx.raw(
          `
          DELETE FROM users 
          WHERE id LIKE 'test_%' 
          AND created_at < ?
        `,
          [new Date(cutoffTime)]
        );
      });
    }

    /**
     * 智能清理 - 保留重要的测试数据
     */
    async smartCleanup(): Promise<void> {
      // 保留活跃测试会话相关的数据
      const activeSessionIds = await this.getActiveTestSessionIds();

      if (activeSessionIds.length === 0) {
        await this.cleanupAllTestData();
        return;
      }

      await this.db.transaction(async tx => {
        const placeholders = activeSessionIds.map(() => '?').join(',');

        // 清理非活跃会话的数据
        await tx.raw(
          `
          DELETE FROM games 
          WHERE id LIKE 'test_%' 
          AND session_id NOT IN (${placeholders})
        `,
          activeSessionIds
        );
      });
    }

    private async getActiveTestSessionIds(): Promise<string[]> {
      const result = await this.db.raw(
        `
        SELECT DISTINCT session_id 
        FROM test_sessions 
        WHERE is_active = true 
        AND updated_at > ?
      `,
        [new Date(Date.now() - 60 * 60 * 1000)]
      ); // 1小时内活跃

      return result.rows.map(row => row.session_id);
    }
  }
}
```

## 13.8 测试报告和度量

### 13.8.1 综合测试报告生成

```typescript
namespace Testing.Reporting {
  /**
   * 测试报告聚合器
   */
  class TestReportAggregator {
    private reportGenerators: Map<string, ReportGenerator>;
    private metricsCollector: TestMetricsCollector;
    private templateEngine: ReportTemplateEngine;
    private exportManager: ReportExportManager;

    constructor(config: ReportConfig) {
      this.reportGenerators = this.initializeGenerators(config);
      this.metricsCollector = new TestMetricsCollector(config.metricsConfig);
      this.templateEngine = new ReportTemplateEngine(config.templateConfig);
      this.exportManager = new ReportExportManager(config.exportConfig);
    }

    /**
     * 生成综合测试报告
     */
    async generateComprehensiveReport(
      testResults: TestSuiteResult[]
    ): Promise<ComprehensiveTestReport> {
      const report: ComprehensiveTestReport = {
        id: generateUniqueId(),
        generatedAt: Date.now(),
        summary: {},
        details: {},
        metrics: {},
        trends: {},
        recommendations: [],
      };

      try {
        // 1. 生成执行摘要
        report.summary = await this.generateExecutiveSummary(testResults);

        // 2. 生成详细测试结果
        report.details = await this.generateDetailedResults(testResults);

        // 3. 生成测试度量
        report.metrics = await this.generateTestMetrics(testResults);

        // 4. 生成趋势分析
        report.trends = await this.generateTrendAnalysis(testResults);

        // 5. 生成改进建议
        report.recommendations =
          await this.generateRecommendations(testResults);

        // 6. 导出不同格式的报告
        await this.exportReportInMultipleFormats(report);

        return report;
      } catch (error) {
        throw new Error(
          `Failed to generate comprehensive report: ${error.message}`
        );
      }
    }

    /**
     * 生成执行摘要
     */
    private async generateExecutiveSummary(
      testResults: TestSuiteResult[]
    ): Promise<ExecutiveSummary> {
      const totalTests = testResults.reduce(
        (sum, result) => sum + result.totalTests,
        0
      );
      const passedTests = testResults.reduce(
        (sum, result) => sum + result.passedTests,
        0
      );
      const failedTests = testResults.reduce(
        (sum, result) => sum + result.failedTests,
        0
      );
      const skippedTests = testResults.reduce(
        (sum, result) => sum + result.skippedTests,
        0
      );

      const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
      const executionTime = testResults.reduce(
        (sum, result) => sum + (result.endTime - result.startTime),
        0
      );

      // 计算覆盖率
      const coverageData = await this.calculateAggregatedCoverage(testResults);

      // 分析质量趋势
      const qualityTrend = await this.analyzeQualityTrend(testResults);

      return {
        overview: {
          totalTests,
          passedTests,
          failedTests,
          skippedTests,
          passRate: Math.round(passRate * 100) / 100,
          executionTime: Math.round(executionTime / 1000), // 转换为秒
          testSuites: testResults.length,
        },
        coverage: {
          lines: Math.round(coverageData.lines * 100) / 100,
          functions: Math.round(coverageData.functions * 100) / 100,
          branches: Math.round(coverageData.branches * 100) / 100,
          statements: Math.round(coverageData.statements * 100) / 100,
        },
        qualityGate: {
          status: this.determineQualityGateStatus(passRate, coverageData),
          criteria: [
            {
              name: '通过率',
              target: 95,
              actual: passRate,
              passed: passRate >= 95,
            },
            {
              name: '行覆盖率',
              target: 80,
              actual: coverageData.lines,
              passed: coverageData.lines >= 80,
            },
            {
              name: '分支覆盖率',
              target: 75,
              actual: coverageData.branches,
              passed: coverageData.branches >= 75,
            },
          ],
        },
        trends: qualityTrend,
        keyInsights: await this.generateKeyInsights(testResults),
      };
    }

    /**
     * 生成详细测试结果
     */
    private async generateDetailedResults(
      testResults: TestSuiteResult[]
    ): Promise<DetailedTestResults> {
      const detailed: DetailedTestResults = {
        byCategory: {},
        byPriority: {},
        failures: [],
        slowTests: [],
        flakyTests: [],
      };

      // 按类别分组
      for (const result of testResults) {
        if (result.layers) {
          Object.keys(result.layers).forEach(layer => {
            if (!detailed.byCategory[layer]) {
              detailed.byCategory[layer] = {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0,
              };
            }

            const layerResult = result.layers[layer];
            detailed.byCategory[layer].total += layerResult.totalTests || 0;
            detailed.byCategory[layer].passed += layerResult.passedTests || 0;
            detailed.byCategory[layer].failed += layerResult.failedTests || 0;
            detailed.byCategory[layer].skipped += layerResult.skippedTests || 0;
            detailed.byCategory[layer].duration += layerResult.duration || 0;
          });
        }
      }

      // 识别失败的测试
      detailed.failures = this.extractFailedTests(testResults);

      // 识别慢测试
      detailed.slowTests = this.identifySlowTests(testResults);

      // 识别不稳定测试
      detailed.flakyTests = await this.identifyFlakyTests(testResults);

      return detailed;
    }

    /**
     * 生成测试度量
     */
    private async generateTestMetrics(
      testResults: TestSuiteResult[]
    ): Promise<TestMetrics> {
      const metrics: TestMetrics = {
        execution: {},
        quality: {},
        performance: {},
        coverage: {},
        stability: {},
      };

      // 执行度量
      metrics.execution = {
        totalDuration: testResults.reduce(
          (sum, r) => sum + (r.endTime - r.startTime),
          0
        ),
        averageTestDuration: this.calculateAverageTestDuration(testResults),
        parallelization: this.calculateParallelizationEfficiency(testResults),
        resourceUtilization:
          await this.calculateResourceUtilization(testResults),
      };

      // 质量度量
      metrics.quality = {
        defectDensity: this.calculateDefectDensity(testResults),
        testEffectiveness: this.calculateTestEffectiveness(testResults),
        requirementsCoverage:
          await this.calculateRequirementsCoverage(testResults),
        automationRate: this.calculateAutomationRate(testResults),
      };

      // 性能度量
      if (this.hasPerformanceTests(testResults)) {
        metrics.performance =
          await this.generatePerformanceMetrics(testResults);
      }

      // 覆盖率度量
      metrics.coverage = await this.generateCoverageMetrics(testResults);

      // 稳定性度量
      metrics.stability = await this.generateStabilityMetrics(testResults);

      return metrics;
    }

    /**
     * 生成HTML报告
     */
    async generateHTMLReport(report: ComprehensiveTestReport): Promise<string> {
      const template = await this.templateEngine.loadTemplate(
        'comprehensive-report.html'
      );

      const htmlContent = await this.templateEngine.render(template, {
        report,
        generatedAt: new Date().toISOString(),
        charts: await this.generateChartData(report),
        styles: await this.templateEngine.loadStyles('report.css'),
        scripts: await this.templateEngine.loadScripts('report.js'),
      });

      return htmlContent;
    }

    /**
     * 生成图表数据
     */
    private async generateChartData(
      report: ComprehensiveTestReport
    ): Promise<ChartData> {
      return {
        passFailChart: {
          type: 'pie',
          data: {
            labels: ['通过', '失败', '跳过'],
            values: [
              report.summary.overview.passedTests,
              report.summary.overview.failedTests,
              report.summary.overview.skippedTests,
            ],
          },
        },
        coverageChart: {
          type: 'bar',
          data: {
            labels: ['行覆盖率', '函数覆盖率', '分支覆盖率', '语句覆盖率'],
            values: [
              report.summary.coverage.lines,
              report.summary.coverage.functions,
              report.summary.coverage.branches,
              report.summary.coverage.statements,
            ],
          },
        },
        trendChart: {
          type: 'line',
          data: await this.getTrendChartData(report.trends),
        },
        categoryChart: {
          type: 'horizontalBar',
          data: await this.getCategoryChartData(report.details.byCategory),
        },
      };
    }
  }

  /**
   * 测试度量收集器
   */
  class TestMetricsCollector {
    private metricsStore: MetricsStore;
    private calculators: Map<string, MetricCalculator>;

    constructor(config: MetricsConfig) {
      this.metricsStore = new MetricsStore(config.storeConfig);
      this.calculators = this.initializeCalculators();
    }

    /**
     * 收集执行时间度量
     */
    async collectExecutionMetrics(testRun: TestRun): Promise<ExecutionMetrics> {
      const startTime = testRun.startTime;
      const endTime = testRun.endTime;
      const duration = endTime - startTime;

      const metrics: ExecutionMetrics = {
        totalDuration: duration,
        setupTime: testRun.setupTime || 0,
        teardownTime: testRun.teardownTime || 0,
        actualTestTime:
          duration - (testRun.setupTime || 0) - (testRun.teardownTime || 0),
        parallelismFactor: this.calculateParallelismFactor(testRun),
        averageTestTime: duration / (testRun.totalTests || 1),
      };

      await this.metricsStore.store('execution', metrics);
      return metrics;
    }

    /**
     * 收集质量度量
     */
    async collectQualityMetrics(
      testResults: TestResult[]
    ): Promise<QualityMetrics> {
      const totalTests = testResults.length;
      const passedTests = testResults.filter(r => r.status === 'passed').length;
      const failedTests = testResults.filter(r => r.status === 'failed').length;

      const metrics: QualityMetrics = {
        passRate: (passedTests / totalTests) * 100,
        failRate: (failedTests / totalTests) * 100,
        testDensity: await this.calculateTestDensity(),
        defectLeakageRate: await this.calculateDefectLeakageRate(),
        testMaintainabilityIndex:
          await this.calculateMaintainabilityIndex(testResults),
      };

      await this.metricsStore.store('quality', metrics);
      return metrics;
    }

    /**
     * 收集覆盖率度量
     */
    async collectCoverageMetrics(
      coverageData: CoverageData
    ): Promise<CoverageMetrics> {
      const metrics: CoverageMetrics = {
        lineCoverage: coverageData.lines.pct,
        branchCoverage: coverageData.branches.pct,
        functionCoverage: coverageData.functions.pct,
        statementCoverage: coverageData.statements.pct,
        uncoveredLines: coverageData.lines.total - coverageData.lines.covered,
        uncoveredBranches:
          coverageData.branches.total - coverageData.branches.covered,
        coverageTrend: await this.calculateCoverageTrend(),
        criticalPathCoverage:
          await this.calculateCriticalPathCoverage(coverageData),
      };

      await this.metricsStore.store('coverage', metrics);
      return metrics;
    }

    private calculateParallelismFactor(testRun: TestRun): number {
      if (!testRun.parallelExecutions) return 1;

      const totalSequentialTime = testRun.parallelExecutions.reduce(
        (sum, execution) => sum + execution.duration,
        0
      );

      return totalSequentialTime / testRun.totalDuration;
    }

    private async calculateTestDensity(): Promise<number> {
      // 测试密度 = 测试数量 / 代码行数
      const totalTests = await this.metricsStore.count('tests');
      const totalLoc = await this.metricsStore.get('codebase', 'lines_of_code');

      return totalTests / (totalLoc || 1);
    }
  }
}
```

## 13.9 持续测试集成

### 13.9.1 CI/CD管道中的测试自动化

```typescript
namespace Testing.CI {
  /**
   * 持续测试协调器
   */
  class ContinuousTestingOrchestrator {
    private pipelineIntegration: PipelineIntegration;
    private testScheduler: TestScheduler;
    private reportPublisher: ReportPublisher;
    private qualityGateEnforcer: QualityGateEnforcer;

    constructor(config: ContinuousTestingConfig) {
      this.pipelineIntegration = new PipelineIntegration(config.pipelineConfig);
      this.testScheduler = new TestScheduler(config.schedulerConfig);
      this.reportPublisher = new ReportPublisher(config.publisherConfig);
      this.qualityGateEnforcer = new QualityGateEnforcer(
        config.qualityGateConfig
      );
    }

    /**
     * 处理代码提交触发的测试
     */
    async handleCommitTrigger(
      commitInfo: CommitInfo
    ): Promise<ContinuousTestResult> {
      const result: ContinuousTestResult = {
        triggerId: generateUniqueId(),
        trigger: 'commit',
        commitHash: commitInfo.hash,
        branch: commitInfo.branch,
        author: commitInfo.author,
        timestamp: Date.now(),
        stages: [],
      };

      try {
        console.log(`🔄 开始处理提交 ${commitInfo.hash} 的持续测试...`);

        // 1. 预检查阶段
        console.log('✅ 执行预检查...');
        const preCheckResult = await this.executePreChecks(commitInfo);
        result.stages.push(preCheckResult);

        if (preCheckResult.status === 'failed') {
          return await this.publishFailureResult(result, '预检查失败');
        }

        // 2. 快速反馈测试
        console.log('⚡ 执行快速反馈测试...');
        const fastTestResult = await this.executeFastFeedbackTests(commitInfo);
        result.stages.push(fastTestResult);

        if (fastTestResult.status === 'failed') {
          return await this.publishFailureResult(result, '快速测试失败');
        }

        // 3. 全面测试套件
        console.log('🧪 执行全面测试套件...');
        const fullTestResult = await this.executeFullTestSuite(commitInfo);
        result.stages.push(fullTestResult);

        // 4. 质量门检查
        console.log('🚪 执行质量门检查...');
        const qualityGateResult =
          await this.qualityGateEnforcer.evaluate(fullTestResult);
        result.stages.push(qualityGateResult);

        // 5. 发布测试报告
        await this.reportPublisher.publishTestResults(result);

        result.overallStatus = this.determineOverallStatus(result.stages);
        result.completedAt = Date.now();

        return result;
      } catch (error) {
        result.error = error.message;
        result.overallStatus = 'error';
        return result;
      }
    }

    /**
     * 执行预检查
     */
    private async executePreChecks(commitInfo: CommitInfo): Promise<TestStage> {
      const stage: TestStage = {
        name: 'PreChecks',
        startTime: Date.now(),
        checks: [],
      };

      // 1. 代码格式检查
      const lintResult = await this.runLinting(commitInfo);
      stage.checks.push(lintResult);

      // 2. 类型检查
      const typeCheckResult = await this.runTypeChecking(commitInfo);
      stage.checks.push(typeCheckResult);

      // 3. 依赖安全扫描
      const securityScanResult =
        await this.runDependencySecurityScan(commitInfo);
      stage.checks.push(securityScanResult);

      // 4. 构建验证
      const buildResult = await this.runBuildVerification(commitInfo);
      stage.checks.push(buildResult);

      stage.endTime = Date.now();
      stage.duration = stage.endTime - stage.startTime;
      stage.status = stage.checks.every(c => c.status === 'passed')
        ? 'passed'
        : 'failed';

      return stage;
    }

    /**
     * 执行快速反馈测试
     */
    private async executeFastFeedbackTests(
      commitInfo: CommitInfo
    ): Promise<TestStage> {
      const stage: TestStage = {
        name: 'FastFeedback',
        startTime: Date.now(),
        checks: [],
      };

      try {
        // 1. 单元测试（仅受影响的模块）
        const impactedModules = await this.analyzeImpactedModules(commitInfo);
        const unitTestResult = await this.runImpactedUnitTests(impactedModules);
        stage.checks.push(unitTestResult);

        // 2. 集成测试（关键路径）
        const criticalPathTests =
          await this.identifyCriticalPathTests(commitInfo);
        const integrationTestResult =
          await this.runCriticalIntegrationTests(criticalPathTests);
        stage.checks.push(integrationTestResult);

        // 3. API合约测试
        const contractTestResult = await this.runAPIContractTests(commitInfo);
        stage.checks.push(contractTestResult);

        stage.endTime = Date.now();
        stage.duration = stage.endTime - stage.startTime;
        stage.status = stage.checks.every(c => c.status === 'passed')
          ? 'passed'
          : 'failed';

        return stage;
      } catch (error) {
        stage.error = error.message;
        stage.status = 'error';
        return stage;
      }
    }

    /**
     * 执行全面测试套件
     */
    private async executeFullTestSuite(
      commitInfo: CommitInfo
    ): Promise<TestStage> {
      const stage: TestStage = {
        name: 'FullTestSuite',
        startTime: Date.now(),
        checks: [],
      };

      try {
        // 并行执行不同类型的测试
        const testPromises = [
          this.runAllUnitTests(),
          this.runAllIntegrationTests(),
          this.runE2ETests(),
          this.runPerformanceTests(),
          this.runSecurityTests(),
        ];

        const testResults = await Promise.allSettled(testPromises);

        testResults.forEach((result, index) => {
          const testType = [
            'Unit',
            'Integration',
            'E2E',
            'Performance',
            'Security',
          ][index];

          if (result.status === 'fulfilled') {
            stage.checks.push({
              name: testType,
              status: result.value.status,
              duration: result.value.duration,
              details: result.value.details,
            });
          } else {
            stage.checks.push({
              name: testType,
              status: 'failed',
              error: result.reason.message,
            });
          }
        });

        stage.endTime = Date.now();
        stage.duration = stage.endTime - stage.startTime;
        stage.status = stage.checks.every(c => c.status === 'passed')
          ? 'passed'
          : 'failed';

        return stage;
      } catch (error) {
        stage.error = error.message;
        stage.status = 'error';
        return stage;
      }
    }

    /**
     * 分析受影响的模块
     */
    private async analyzeImpactedModules(
      commitInfo: CommitInfo
    ): Promise<string[]> {
      const changedFiles = await this.getChangedFiles(commitInfo);
      const dependencyGraph = await this.buildDependencyGraph();

      const impactedModules = new Set<string>();

      for (const file of changedFiles) {
        const module = this.getModuleForFile(file);
        impactedModules.add(module);

        // 添加依赖此模块的其他模块
        const dependentModules = dependencyGraph.getDependents(module);
        dependentModules.forEach(dep => impactedModules.add(dep));
      }

      return Array.from(impactedModules);
    }
  }

  /**
   * 测试调度器
   */
  class TestScheduler {
    private schedules: Map<string, TestSchedule>;
    private executor: TestExecutor;

    constructor(config: SchedulerConfig) {
      this.schedules = new Map();
      this.executor = new TestExecutor(config.executorConfig);
      this.initializeSchedules(config.schedules);
    }

    /**
     * 调度定期测试
     */
    async schedulePeriodicTests(): Promise<void> {
      // 每小时运行快速回归测试
      this.scheduleRecurringTest('hourly-regression', '0 * * * *', async () => {
        return await this.executor.executeRegressionTests();
      });

      // 每天运行全面测试套件
      this.scheduleRecurringTest('daily-full-suite', '0 2 * * *', async () => {
        return await this.executor.executeFullTestSuite();
      });

      // 每周运行性能基准测试
      this.scheduleRecurringTest(
        'weekly-performance',
        '0 3 * * 1',
        async () => {
          return await this.executor.executePerformanceBenchmarks();
        }
      );

      // 每月运行安全漏洞扫描
      this.scheduleRecurringTest('monthly-security', '0 4 1 * *', async () => {
        return await this.executor.executeSecurityScans();
      });
    }

    /**
     * 调度基于事件的测试
     */
    async scheduleEventBasedTests(): Promise<void> {
      // 监听部署事件
      this.scheduleEventTriggeredTest(
        'post-deployment',
        'deployment.completed',
        async event => {
          return await this.executor.executePostDeploymentTests(
            event.environment
          );
        }
      );

      // 监听数据库迁移事件
      this.scheduleEventTriggeredTest(
        'post-migration',
        'database.migration.completed',
        async event => {
          return await this.executor.executeMigrationTests(
            event.migrationVersion
          );
        }
      );

      // 监听配置变更事件
      this.scheduleEventTriggeredTest(
        'config-change',
        'configuration.updated',
        async event => {
          return await this.executor.executeConfigurationTests(
            event.configChanges
          );
        }
      );
    }

    private scheduleRecurringTest(
      id: string,
      cronPattern: string,
      testFunction: () => Promise<TestResult>
    ): void {
      const schedule: TestSchedule = {
        id,
        type: 'recurring',
        cronPattern,
        testFunction,
        isActive: true,
        nextRunTime: this.calculateNextRunTime(cronPattern),
        lastRunTime: null,
      };

      this.schedules.set(id, schedule);
      this.startScheduleMonitoring(schedule);
    }

    private scheduleEventTriggeredTest(
      id: string,
      eventType: string,
      testFunction: (event: any) => Promise<TestResult>
    ): void {
      const schedule: TestSchedule = {
        id,
        type: 'event-triggered',
        eventType,
        testFunction,
        isActive: true,
      };

      this.schedules.set(id, schedule);
      this.startEventMonitoring(schedule);
    }
  }

  /**
   * 质量门执行器
   */
  class QualityGateEnforcer {
    private criteria: QualityGateCriteria[];
    private evaluators: Map<string, CriteriaEvaluator>;

    constructor(config: QualityGateConfig) {
      this.criteria = config.criteria;
      this.evaluators = this.initializeEvaluators();
    }

    /**
     * 评估质量门
     */
    async evaluate(testResult: TestStageResult): Promise<QualityGateResult> {
      const result: QualityGateResult = {
        gateId: generateUniqueId(),
        timestamp: Date.now(),
        overallStatus: 'passed',
        criteriaResults: [],
      };

      for (const criteria of this.criteria) {
        const evaluator = this.evaluators.get(criteria.type);
        if (!evaluator) {
          console.warn(
            `No evaluator found for criteria type: ${criteria.type}`
          );
          continue;
        }

        try {
          const criteriaResult = await evaluator.evaluate(testResult, criteria);
          result.criteriaResults.push(criteriaResult);

          if (criteriaResult.status === 'failed' && criteria.blocking) {
            result.overallStatus = 'failed';
          }
        } catch (error) {
          result.criteriaResults.push({
            criteriaId: criteria.id,
            name: criteria.name,
            status: 'error',
            error: error.message,
          });
        }
      }

      return result;
    }

    /**
     * 初始化评估器
     */
    private initializeEvaluators(): Map<string, CriteriaEvaluator> {
      const evaluators = new Map();

      // 测试通过率评估器
      evaluators.set('pass_rate', new PassRateEvaluator());

      // 代码覆盖率评估器
      evaluators.set('coverage', new CoverageEvaluator());

      // 性能基准评估器
      evaluators.set('performance', new PerformanceEvaluator());

      // 安全漏洞评估器
      evaluators.set('security', new SecurityEvaluator());

      // 技术债务评估器
      evaluators.set('technical_debt', new TechnicalDebtEvaluator());

      return evaluators;
    }
  }

  /**
   * 通过率评估器
   */
  class PassRateEvaluator implements CriteriaEvaluator {
    async evaluate(
      testResult: TestStageResult,
      criteria: QualityGateCriteria
    ): Promise<CriteriaResult> {
      const totalTests = testResult.totalTests;
      const passedTests = testResult.passedTests;
      const actualPassRate =
        totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

      const targetPassRate = criteria.threshold;
      const passed = actualPassRate >= targetPassRate;

      return {
        criteriaId: criteria.id,
        name: criteria.name,
        status: passed ? 'passed' : 'failed',
        actualValue: actualPassRate,
        targetValue: targetPassRate,
        details: {
          totalTests,
          passedTests,
          failedTests: totalTests - passedTests,
          message: passed
            ? `通过率 ${actualPassRate.toFixed(2)}% 达到目标 ${targetPassRate}%`
            : `通过率 ${actualPassRate.toFixed(2)}% 低于目标 ${targetPassRate}%`,
        },
      };
    }
  }
}
```

## 13.10 测试策略总结

### 13.10.1 测试策略实施路线图

```typescript
namespace Testing.Strategy.Implementation {
  /**
   * 测试策略实施管理器
   */
  class TestStrategyImplementationManager {
    private roadmapManager: RoadmapManager;
    private metricsTracker: ImplementationMetricsTracker;
    private progressReporter: ProgressReporter;

    constructor(config: ImplementationConfig) {
      this.roadmapManager = new RoadmapManager(config.roadmapConfig);
      this.metricsTracker = new ImplementationMetricsTracker(
        config.metricsConfig
      );
      this.progressReporter = new ProgressReporter(config.reportConfig);
    }

    /**
     * 生成实施路线图
     */
    generateImplementationRoadmap(): TestingRoadmap {
      return {
        phases: [
          {
            name: '基础设施建设阶段',
            duration: '2-3周',
            objectives: [
              '搭建Jest + React Testing Library单元测试框架',
              '配置测试数据管理和清理机制',
              '建立基础CI/CD测试集成',
            ],
            deliverables: [
              '单元测试框架搭建完成',
              '测试数据工厂和清理器就绪',
              '基础测试报告模板',
            ],
          },
          {
            name: '核心测试能力建设阶段',
            duration: '3-4周',
            objectives: [
              '实现集成测试框架',
              '搭建Playwright E2E测试平台',
              '建立性能测试基准',
            ],
            deliverables: [
              'API集成测试套件',
              '用户旅程E2E测试',
              'K6性能测试脚本',
            ],
          },
          {
            name: '高级测试能力阶段',
            duration: '2-3周',
            objectives: [
              '集成OWASP ZAP安全测试',
              '建立可访问性测试',
              '实现智能测试选择',
            ],
            deliverables: [
              '安全漏洞扫描集成',
              '无障碍访问测试套件',
              '测试影响分析工具',
            ],
          },
          {
            name: '测试优化和成熟化阶段',
            duration: '2周',
            objectives: [
              '优化测试执行效率',
              '完善测试报告和度量',
              '建立测试最佳实践',
            ],
            deliverables: ['测试并行化优化', '综合测试仪表板', '测试策略文档'],
          },
        ],
        milestones: [
          { name: '单元测试覆盖率达到80%', targetDate: '第4周' },
          { name: '集成测试自动化完成', targetDate: '第7周' },
          { name: 'E2E测试覆盖核心用户旅程', targetDate: '第9周' },
          { name: '性能基准建立', targetDate: '第10周' },
          { name: '安全测试集成完成', targetDate: '第12周' },
        ],
        risks: [
          {
            description: '测试环境稳定性问题',
            impact: 'Medium',
            mitigation: '建立独立测试环境和环境监控',
          },
          {
            description: '测试数据管理复杂性',
            impact: 'High',
            mitigation: '实施数据快照和自动清理策略',
          },
          {
            description: '测试执行时间过长',
            impact: 'Medium',
            mitigation: '智能测试选择和并行化优化',
          },
        ],
      };
    }

    /**
     * 评估当前测试成熟度
     */
    async assessCurrentMaturity(): Promise<TestingMaturityAssessment> {
      const assessment: TestingMaturityAssessment = {
        overallLevel: 'Initial',
        dimensions: {},
      };

      // 评估各个维度
      assessment.dimensions.automation = await this.assessAutomationMaturity();
      assessment.dimensions.coverage = await this.assessCoverageMaturity();
      assessment.dimensions.integration =
        await this.assessIntegrationMaturity();
      assessment.dimensions.processes = await this.assessProcessMaturity();
      assessment.dimensions.culture = await this.assessCultureMaturity();

      // 计算总体成熟度
      assessment.overallLevel = this.calculateOverallMaturity(
        assessment.dimensions
      );

      return assessment;
    }

    private async assessAutomationMaturity(): Promise<MaturityLevel> {
      const metrics = await this.metricsTracker.getAutomationMetrics();

      if (metrics.automationRate > 90) return 'Optimizing';
      if (metrics.automationRate > 70) return 'Managed';
      if (metrics.automationRate > 50) return 'Defined';
      if (metrics.automationRate > 20) return 'Repeatable';
      return 'Initial';
    }
  }

  /**
   * 测试最佳实践指南
   */
  class TestingBestPracticesGuide {
    /**
     * 获取单元测试最佳实践
     */
    getUnitTestingBestPractices(): BestPractice[] {
      return [
        {
          category: '测试结构',
          title: '遵循AAA模式',
          description: 'Arrange-Act-Assert模式确保测试清晰易懂',
          example: `
            test('should calculate total price correctly', () => {
              // Arrange
              const items = [{ price: 10 }, { price: 20 }]
              const calculator = new PriceCalculator()
              
              // Act
              const total = calculator.calculateTotal(items)
              
              // Assert
              expect(total).toBe(30)
            })
          `,
        },
        {
          category: '测试命名',
          title: '描述性测试名称',
          description: '测试名称应该清楚描述测试场景和期望结果',
          example: `
            // ❌ 不好的命名
            test('user test', () => { ... })
            
            // ✅ 好的命名
            test('should return user profile when valid userId is provided', () => { ... })
          `,
        },
        {
          category: '测试隔离',
          title: '确保测试独立性',
          description: '每个测试应该独立运行，不依赖其他测试的状态',
          example: `
            beforeEach(() => {
              // 在每个测试前重置状态
              jest.clearAllMocks()
              testDatabase.reset()
            })
          `,
        },
      ];
    }

    /**
     * 获取集成测试最佳实践
     */
    getIntegrationTestingBestPractices(): BestPractice[] {
      return [
        {
          category: '测试环境',
          title: '使用专用测试环境',
          description: '集成测试应使用与生产环境相似但独立的测试环境',
          example: `
            const config = {
              database: {
                host: process.env.TEST_DB_HOST,
                name: 'test_guild_manager'
              },
              api: {
                baseUrl: process.env.TEST_API_URL
              }
            }
          `,
        },
        {
          category: '数据管理',
          title: '测试数据隔离',
          description: '使用独立的测试数据，避免与其他测试或生产数据冲突',
          example: `
            beforeEach(async () => {
              // 创建独立的测试数据
              testUser = await createTestUser('integration_test_user')
              testGame = await createTestGame(testUser.id)
            })
            
            afterEach(async () => {
              // 清理测试数据
              await cleanupTestData(testUser.id)
            })
          `,
        },
      ];
    }

    /**
     * 获取E2E测试最佳实践
     */
    getE2ETestingBestPractices(): BestPractice[] {
      return [
        {
          category: '测试稳定性',
          title: '使用稳定的选择器',
          description:
            '优先使用data-testid等专用测试属性，避免依赖易变的CSS类或文本',
          example: `
            // ✅ 推荐使用
            await page.click('[data-testid="login-button"]')
            
            // ❌ 不推荐
            await page.click('.btn-primary')
            await page.click('button:contains("登录")')
          `,
        },
        {
          category: '等待策略',
          title: '智能等待机制',
          description: '使用条件等待而非固定时间等待，提高测试稳定性',
          example: `
            // ✅ 等待元素出现
            await page.waitForSelector('[data-testid="game-canvas"]')
            
            // ✅ 等待网络请求完成
            await page.waitForLoadState('networkidle')
            
            // ❌ 固定时间等待
            await page.waitForTimeout(5000)
          `,
        },
      ];
    }

    /**
     * 获取性能测试最佳实践
     */
    getPerformanceTestingBestPractices(): BestPractice[] {
      return [
        {
          category: '基准设定',
          title: '建立性能基准',
          description: '在优化前建立明确的性能基准，用于对比改进效果',
          example: `
            const performanceBaseline = {
              apiResponseTime: { p95: 500 }, // 95%请求<500ms
              pageLoadTime: { p95: 2000 },  // 95%页面加载<2s
              throughput: { min: 100 }      // 最低100 RPS
            }
          `,
        },
        {
          category: '负载模拟',
          title: '真实负载模拟',
          description: '基于生产环境的实际用户行为模式设计负载测试',
          example: `
            export let options = {
              stages: [
                { duration: '5m', target: 10 },   // 预热
                { duration: '10m', target: 50 },  // 正常负载
                { duration: '5m', target: 100 },  // 峰值负载
                { duration: '10m', target: 50 },  // 恢复
                { duration: '5m', target: 0 }     // 冷却
              ]
            }
          `,
        },
      ];
    }
  }
}
```

通过这个全面的测试策略架构，我们建立了一个涵盖单元测试、集成测试、端到端测试、性能测试和安全测试的完整测试体系。该架构支持自动化执行、智能测试选择、持续集成，并提供详细的测试报告和度量分析，确保代码质量和系统可靠性。

继续撰写第13章的剩余内容...
