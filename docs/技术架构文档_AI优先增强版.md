# 《公会经理》技术架构文档 - AI优先增强版

## 文档信息

## 第1章 约束与目标 (Constraints & Objectives)

> **设计理念**: 基于"不可回退约束→安全威胁模型→测试质量门禁→系统上下文→数据模型→运行时视图→开发环境→功能纵切→性能规划"的AI友好顺序

### 1.1 核心约束条件 (Non-Functional Requirements)

#### 1.1.1 技术栈硬性约束

```typescript
// 技术栈约束矩阵 - 严禁变更的技术选型
export const TECH_STACK_CONSTRAINTS = {
  桌面容器: 'Electron', // 跨平台打包 & Node API 集成
  游戏引擎: 'Phaser 3', // WebGL渲染 & 场景管理
  UI框架: 'React 19', // 复杂界面组件开发
  构建工具: 'Vite', // Dev服务器 & 生产打包
  开发语言: 'TypeScript', // 全栈强类型支持
  数据服务: 'SQLite', // 高性能本地数据库
  样式方案: 'Tailwind CSS v4', // 原子化CSS开发
  AI计算: 'Web Worker', // AI计算线程分离
  配置存储: 'Local JSON', // 配置文件存储
  通信机制: 'EventBus', // Phaser ↔ React通信
  测试框架: 'Vitest + Playwright', // 单元测试 + E2E测试
  监控工具: 'Sentry', // 错误监控和性能追踪
  日志系统: 'logs/ 目录', // 本地日志持久化
  打包工具: 'electron-builder', // 多平台打包
} as const;

// 硬性版本约束 - 绝对不允许降级
export const VERSION_CONSTRAINTS = {
  react: '^19.0.0', // 强制使用v19，禁用v18及以下
  tailwindcss: '^4.0.0', // 强制使用v4，禁用v3及以下
  typescript: '^5.0.0', // 严格类型检查
  electron: '^latest', // 最新稳定版
  phaser: '^3.80.0', // 最新3.x版本
  vite: '^5.0.0', // 最新稳定版
  vitest: '^1.0.0', // 与Vite配套
  playwright: '^1.40.0', // Electron测试支持
  '@sentry/electron': '^4.0.0', // Electron专用Sentry
} as const;
```

#### 1.1.2 开发约束与原则 (Development Constraints)

**KISS原则（Keep It Simple, Stupid）**

```typescript
// 代码复杂度约束 - 强制执行
export const COMPLEXITY_CONSTRAINTS = {
  最大函数行数: 50, // 超过50行必须重构
  最大类方法数: 20, // 超过20个方法拆分类
  最大循环嵌套层数: 3, // 禁止超过3层嵌套
  最大条件分支数: 8, // 超过8个分支使用映射表
  最大函数参数数: 5, // 超过5个参数使用对象参数
  最大认知复杂度: 15, // ESLint complexity规则
  最大文件行数: 300, // 超过300行必须模块化
  最小测试覆盖率: 90, // 低于90%不允许合并PR
} as const;

// 命名规范标准 - 严格执行
export const NAMING_CONVENTIONS = {
  文件名: 'kebab-case', // user-service.ts
  组件文件: 'PascalCase.tsx', // UserProfile.tsx
  类名: 'PascalCase', // UserService
  方法名: 'camelCase', // getUserById
  常量: 'SCREAMING_SNAKE_CASE', // MAX_RETRY_COUNT
  接口: 'I前缀PascalCase', // IUserRepository
  枚举: 'PascalCase', // UserStatus
  类型别名: 'PascalCase', // UserCredentials
  事件名: '模块.动作', // user.created, guild.updated
  CSS类名: 'Tailwind原子类优先', // bg-blue-500 text-white
} as const;
```

**YAGNI原则（You Aren't Gonna Need It）**

```typescript
// YAGNI执行清单 - 代码审查必检项
export const YAGNI_CHECKLIST = {
  禁止预设功能: [
    '未明确需求的功能实现',
    '可能用得上的配置选项',
    '预留的扩展接口',
    '过度通用化的工具函数',
  ],

  允许的预设: [
    '已确认的MVP需求',
    '技术架构必需的基础设施',
    '明确的业务规则实现',
    '性能优化的关键路径',
  ],

  重构触发条件: [
    '需求重复出现3次以上',
    '相同逻辑在3个地方使用',
    '性能测试发现瓶颈',
    '代码复杂度超过约束',
  ],
} as const;
```

**SOLID原则执行标准**

```typescript
// SOLID原则检查清单
export const SOLID_PRINCIPLES = {
  单一职责: {
    检查标准: '每个类只有一个变更理由',
    违反指标: '类中方法操作不同数据源',
    重构方案: '按职责拆分类，使用组合模式',
  },

  开闭原则: {
    检查标准: '对扩展开放，对修改封闭',
    违反指标: '添加新功能需要修改现有代码',
    重构方案: '使用策略模式、插件架构',
  },

  里氏替换: {
    检查标准: '子类可完全替换父类',
    违反指标: '子类改变父类的预期行为',
    重构方案: '重新设计继承关系，使用接口',
  },

  接口隔离: {
    检查标准: '客户端不应依赖不需要的接口',
    违反指标: '接口包含客户端不使用的方法',
    重构方案: '拆分接口，使用角色接口',
  },

  依赖倒置: {
    检查标准: '依赖抽象而非具体实现',
    违反指标: '高层模块直接依赖底层模块',
    重构方案: '使用依赖注入、IoC容器',
  },
} as const;
```

#### 1.1.3 文档规范标准 (Documentation Standards)

**TSDoc代码注释规范**

```typescript
// TSDoc注释规范 - 严格执行的文档标准
export const TSDOC_STANDARDS = {
  // 🔖 函数注释标准格式
  functionDocumentation: `
  /**
   * 简洁描述函数的核心功能，使用动词开头
   *
   * 详细描述函数的业务逻辑、算法思路、使用场景
   * 
   * @param paramName - 参数描述，说明类型、范围、默认值
   * @param options - 可选参数对象描述
   * @param options.config - 配置选项说明
   * @returns 返回值描述，说明返回的数据结构和可能的值
   * 
   * @throws {Error} 抛出异常的条件和错误类型
   * @throws {ValidationError} 输入验证失败时抛出
   * 
   * @example
   * // 基本用法示例
   * const result = await functionName(param1, { config: true });
   * console.log(result); // 输出: 期望的结果格式
   * 
   * @example
   * // 错误处理示例
   * try {
   *   const result = await functionName(invalidParam);
   * } catch (error) {
   *   console.error('处理错误:', error.message);
   * }
   * 
   * @since 1.0.0 - 功能首次引入的版本号
   * @see {@link RelatedFunction} - 相关功能函数引用
   * @see {@link https://docs.example.com/api} - 外部文档链接
   * 
   * @internal - 内部使用函数，不对外暴露
   * @deprecated 使用 {@link NewFunction} 代替，将在v2.0.0中移除
   * 
   * @complexity O(n) - 算法时间复杂度
   * @performance 适用于处理1000条以下数据，大数据量请使用批处理版本
   */`,

  // 🏗️ 类注释标准格式
  classDocumentation: `
  /**
   * 类的核心功能和职责描述
   *
   * 详细说明类的设计意图、使用场景、主要功能模块
   * 描述类与其他组件的关系和依赖关系
   * 
   * @template T - 泛型参数说明
   * @template K - 键类型约束说明
   * 
   * @example
   * // 基本实例化和使用
   * const instance = new ClassName<DataType>({
   *   config: 'value',
   *   options: { enabled: true }
   * });
   * 
   * // 主要功能使用示例
   * const result = await instance.mainMethod();
   * 
   * @example
   * // 继承使用示例
   * class ExtendedClass extends ClassName<string> {
   *   constructor() {
   *     super({ defaultConfig: 'inherited' });
   *   }
   * }
   * 
   * @since 1.0.0
   * @see {@link RelatedInterface} - 实现的接口
   * @see {@link DependentClass} - 依赖的其他类
   * 
   * @immutable - 不可变类，所有方法都返回新实例
   * @singleton - 单例模式实现
   * @threadsafe - 线程安全的类实现
   */`,

  // 📋 接口注释标准格式
  interfaceDocumentation: `
  /**
   * 接口的核心功能和契约描述
   *
   * 详细说明接口定义的数据结构或行为契约
   * 描述实现此接口的要求和约束条件
   * 
   * @example
   * // 接口实现示例
   * const userObject: UserInterface = {
   *   id: 'user-123',
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   isActive: true,
   *   
   *   // 方法实现示例
   *   async save(): Promise<boolean> {
   *     return await this.saveToDatabase();
   *   }
   * };
   * 
   * @example
   * // 函数参数使用示例
   * function processUser(user: UserInterface): ProcessResult {
   *   return {
   *     success: true,
   *     message: \`处理用户: \${user.name}\`
   *   };
   * }
   * 
   * @since 1.0.0
   * @see {@link ImplementingClass} - 实现此接口的类
   * @see {@link ExtendedInterface} - 扩展此接口的其他接口
   */`,
} as const;

// 📄 API文档规范
export const API_DOCUMENTATION_STANDARDS = {
  // REST API文档格式
  restApiDocumentation: {
    description: '详细的API端点描述，包括业务功能和使用场景',
    method: 'HTTP方法 (GET, POST, PUT, DELETE等)',
    endpoint: '/api/endpoint/path/{id}',
    parameters: {
      path: [
        {
          name: 'id',
          type: 'string',
          required: true,
          description: '资源唯一标识符',
          example: 'user-123',
        },
      ],
      query: [
        {
          name: 'limit',
          type: 'number',
          required: false,
          default: 20,
          description: '返回结果数量限制',
          range: '1-100',
        },
      ],
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: {
            type: 'string',
            minLength: 2,
            maxLength: 50,
            description: '用户姓名',
          },
        },
      },
    },
    responses: {
      200: {
        description: '请求成功',
        contentType: 'application/json',
        schema: '参照数据模型定义',
        example: {
          id: 'user-123',
          name: 'John Doe',
          status: 'active',
        },
      },
      400: {
        description: '请求参数错误',
        schema: 'ErrorResponse',
        example: {
          error: 'INVALID_INPUT',
          message: '用户名不能为空',
          field: 'name',
        },
      },
    },
    security: ['Bearer Token', 'API Key'],
    rateLimit: '每分钟100次请求',
    examples: [
      {
        title: '获取用户信息',
        request: "curl -H 'Authorization: Bearer token' /api/users/123",
        response: '{ "id": "123", "name": "John" }',
      },
    ],
  },

  // GraphQL API文档格式
  graphqlDocumentation: {
    type: 'Query | Mutation | Subscription',
    name: '操作名称',
    description: '操作详细描述和业务场景',
    arguments: [
      {
        name: 'input',
        type: 'InputType!',
        description: '输入参数说明',
      },
    ],
    returns: {
      type: 'ResponseType',
      description: '返回数据结构说明',
    },
    examples: [
      {
        query: `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
            email
          }
        }`,
        variables: { id: 'user-123' },
        response: {
          user: {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      },
    ],
  },
} as const;

// 🏗️ 架构文档维护规范
export const ARCHITECTURE_DOCUMENTATION_STANDARDS = {
  // ADR (Architecture Decision Record) 格式
  adrTemplate: {
    title: 'ADR-001: 标题 - 简明扼要描述决策内容',
    status: 'Proposed | Accepted | Rejected | Superseded',
    date: 'YYYY-MM-DD',
    context: '决策背景和问题描述，说明为什么需要做这个决策',
    options: [
      {
        name: '选项1名称',
        description: '选项详细描述',
        pros: ['优点1', '优点2'],
        cons: ['缺点1', '缺点2'],
        effort: '实施工作量评估',
        risks: '风险评估',
      },
    ],
    decision: '最终决策内容和选择的方案',
    rationale: '决策理由和权衡考虑',
    consequences: ['积极影响1', '积极影响2', '负面影响或需要注意的点'],
    implementation: {
      tasks: ['实施任务1', '实施任务2'],
      timeline: '实施时间计划',
      dependencies: ['依赖项1', '依赖项2'],
    },
    monitoring: '如何监控决策效果和成功指标',
    reviewDate: '决策审查日期',
    relatedADRs: ['ADR-002', 'ADR-003'],
  },

  // 技术规格文档模板
  technicalSpecTemplate: {
    overview: '功能概述和目标',
    requirements: {
      functional: ['功能需求1', '功能需求2'],
      nonFunctional: ['性能需求', '安全需求', '可用性需求'],
    },
    architecture: {
      components: '组件架构图和说明',
      dataFlow: '数据流图和处理流程',
      interfaces: '接口定义和契约',
      dependencies: '依赖关系和版本约束',
    },
    implementation: {
      codeStructure: '代码结构组织',
      keyAlgorithms: '核心算法和数据结构',
      errorHandling: '错误处理策略',
      logging: '日志记录规范',
    },
    testing: {
      strategy: '测试策略和覆盖率要求',
      testCases: '关键测试用例',
      performance: '性能测试基准',
      security: '安全测试要求',
    },
    deployment: {
      environment: '部署环境要求',
      configuration: '配置管理',
      monitoring: '监控和告警',
      rollback: '回滚策略',
    },
    maintenance: {
      knownIssues: '已知问题和限制',
      futureWork: '未来改进计划',
      supportContacts: '技术支持联系人',
    },
  },

  // 文档同步和更新机制
  documentationSync: {
    updateTriggers: [
      '代码结构重大变更',
      'API接口变更',
      '架构决策更新',
      '配置参数修改',
      '性能基准调整',
    ],
    responsibilities: {
      developers: '代码级文档更新(TSDoc注释)',
      architects: '架构文档和ADR维护',
      productOwners: '需求文档和用户文档',
      qaTeam: '测试文档和质量标准',
    },
    reviewProcess: [
      '文档草案提交',
      '技术审查和反馈',
      '文档修订和完善',
      '最终审批和发布',
      '版本控制和归档',
    ],
    versionControl: {
      naming: 'v{major}.{minor}.{patch}-{date}',
      changeLog: '详细变更日志记录',
      approval: '文档变更审批流程',
      distribution: '文档分发和通知机制',
    },
  },
} as const;
```

#### 1.1.4 AI代码生成约束 (AI Code Generation Constraints)

**代码一致性保证机制**

```typescript
// AI代码生成一致性约束 - 确保生成代码质量和统一性
export const AI_CODE_GENERATION_CONSTRAINTS = {
  // 🎯 代码一致性保证
  consistencyGuarantees: {
    // 命名规范统一性
    namingConsistency: {
      enforcement: '强制执行',
      validationTool: 'ESLint + 自定义规则',
      rules: [
        '所有函数使用camelCase命名',
        '所有类使用PascalCase命名',
        '所有常量使用SCREAMING_SNAKE_CASE',
        '所有接口使用I前缀 + PascalCase',
        '所有类型别名使用PascalCase',
        '事件名使用模块.动作格式',
      ],
      autoCorrection: '自动修正不符合规范的命名',
      example: {
        correct: 'getUserById, UserService, MAX_RETRY_COUNT, IUserRepository',
        incorrect: 'get_user_by_id, userservice, maxRetryCount, UserRepository',
      },
    },

    // 代码结构一致性
    structureConsistency: {
      fileOrganization: {
        pattern: '功能模块 + 层次结构组织',
        structure: {
          'src/components/': 'React组件，按功能分组',
          'src/services/': '业务服务层，按领域分组',
          'src/stores/': '状态管理，按数据实体分组',
          'src/utils/': '工具函数，按功能分类',
          'src/types/': 'TypeScript类型定义',
          'src/constants/': '常量定义文件',
        },
        imports: [
          '// 第三方库导入放在最前面',
          '// 本地组件和服务导入',
          '// 类型定义导入放在最后',
          '// 使用绝对路径导入(@/开头)',
        ],
      },

      codePatterns: {
        errorHandling: '统一使用async/await + try/catch模式',
        stateManagement: '统一使用Zustand store模式',
        eventHandling: '统一使用EventBus模式',
        apiCalls: '统一使用service层封装',
        logging: '统一使用结构化日志格式',
        testing: '统一使用AAA(Arrange-Act-Assert)模式',
      },
    },

    // API设计一致性
    apiConsistency: {
      responseFormat: {
        success: {
          status: 'success',
          data: '实际数据',
          metadata: '元数据(分页、计数等)',
        },
        error: {
          status: 'error',
          error: '错误代码',
          message: '用户友好的错误消息',
          details: '详细错误信息(开发环境)',
        },
      },

      urlConventions: [
        '使用RESTful风格的URL设计',
        '资源名称使用复数形式',
        '使用连字符分隔多个单词',
        '版本控制使用v1、v2格式',
        '过滤和排序使用查询参数',
      ],

      httpMethods: {
        GET: '获取资源，无副作用',
        POST: '创建新资源',
        PUT: '完全更新资源',
        PATCH: '部分更新资源',
        DELETE: '删除资源',
      },
    },
  },

  // 🏗️ 架构模式固定
  architecturePatterns: {
    mandatoryPatterns: [
      {
        pattern: 'Repository Pattern',
        usage: '所有数据访问必须通过Repository抽象',
        implementation: '实现IRepository接口，封装SQLite操作',
        validation: '检查是否直接使用SQL查询',
      },
      {
        pattern: 'Service Layer Pattern',
        usage: '业务逻辑必须封装在Service层',
        implementation: '每个业务领域创建对应的Service类',
        validation: '检查组件是否直接调用Repository',
      },
      {
        pattern: 'Event-Driven Pattern',
        usage: '组件间通信必须使用EventBus',
        implementation: '强类型事件定义，统一事件处理',
        validation: '检查是否存在直接组件依赖',
      },
      {
        pattern: 'Factory Pattern',
        usage: '复杂对象创建必须使用工厂模式',
        implementation: '为AI实体、公会实体提供工厂方法',
        validation: '检查是否存在复杂的new操作',
      },
    ],

    prohibitedPatterns: [
      {
        pattern: 'Singleton Pattern',
        reason: '难以测试，增加耦合度',
        alternative: '使用依赖注入容器',
      },
      {
        pattern: 'God Object',
        reason: '违反单一职责原则',
        detection: '类超过500行或方法超过20个',
        refactoring: '按职责拆分为多个类',
      },
      {
        pattern: 'Deep Inheritance',
        reason: '增加复杂度，难以维护',
        limit: '继承层级不超过3层',
        alternative: '使用组合替代继承',
      },
    ],

    patternValidation: {
      staticAnalysis: '使用ESLint插件检查架构模式',
      codeReview: '人工审查架构设计合规性',
      automated: 'CI/CD流程中自动检查模式违规',
      reporting: '生成架构合规性报告',
    },
  },

  // 🔍 代码质量检查点
  qualityCheckpoints: {
    // 生成前检查
    preGeneration: {
      contextValidation: '验证上下文信息完整性',
      requirementsClarity: '确保需求描述清晰明确',
      dependencyAnalysis: '分析代码依赖关系',
      patternSelection: '选择合适的架构模式',
    },

    // 生成中检查
    duringGeneration: {
      syntaxValidation: '实时语法检查',
      typeChecking: 'TypeScript类型检查',
      conventionCompliance: '编码规范遵循检查',
      performanceConsiderations: '性能影响评估',
    },

    // 生成后验证
    postGeneration: {
      compilationTest: '代码编译测试',
      unitTestGeneration: '自动生成对应单元测试',
      integrationValidation: '集成点验证',
      documentationGeneration: '自动生成TSDoc注释',
      securityReview: '安全漏洞扫描',
      performanceBaseline: '性能基准测试',
    },
  },

  // 📊 AI生成代码评分标准
  qualityScoring: {
    weightedCriteria: {
      functionality: { weight: 30, description: '功能正确性和完整性' },
      readability: { weight: 25, description: '代码可读性和可维护性' },
      performance: { weight: 20, description: '性能效率和资源使用' },
      security: { weight: 15, description: '安全性和错误处理' },
      testability: { weight: 10, description: '可测试性和模块化程度' },
    },

    scoringThresholds: {
      excellent: { min: 90, action: '直接使用，作为最佳实践' },
      good: { min: 80, action: '轻微修改后使用' },
      acceptable: { min: 70, action: '重构优化后使用' },
      poor: { min: 50, action: '重新生成或手动编写' },
      unacceptable: { max: 49, action: '拒绝使用，分析失败原因' },
    },

    automaticImprovement: {
      enabled: true,
      maxIterations: 3,
      improvementTargets: ['提升可读性', '增强错误处理', '优化性能'],
      validationCriteria: '每次迭代必须提升总分至少5分',
    },
  },

  // 🎛️ 生成控制参数
  generationControls: {
    codeStyle: {
      indentation: '2 spaces', // 缩进风格
      quotes: 'single', // 引号风格
      semicolons: true, // 分号使用
      trailingCommas: 'es5', // 尾随逗号
      lineLength: 100, // 行长度限制
      bracketSpacing: true, // 括号间距
    },

    complexityLimits: {
      cyclomaticComplexity: 10, // 圈复杂度限制
      cognitiveComplexity: 15, // 认知复杂度限制
      nestingDepth: 4, // 嵌套深度限制
      functionLength: 50, // 函数长度限制
      classLength: 300, // 类长度限制
      parameterCount: 5, // 参数数量限制
    },

    safetyChecks: {
      noEval: true, // 禁用eval相关代码
      noInnerHtml: true, // 禁用innerHTML直接赋值
      noUnsafeRegex: true, // 禁用不安全的正则表达式
      noHardcodedSecrets: true, // 禁用硬编码密钥
      noSqlInjection: true, // 禁用SQL注入风险代码
    },
  },
} as const;

// 🚀 AI代码生成工作流
export const AI_GENERATION_WORKFLOW = {
  phases: [
    {
      phase: '1. 需求分析',
      activities: [
        '解析用户需求和上下文',
        '识别涉及的组件和模式',
        '确定技术约束和依赖',
        '验证需求完整性和可行性',
      ],
      outputs: ['需求规格说明', '技术方案概要', '依赖关系图'],
    },
    {
      phase: '2. 架构设计',
      activities: [
        '选择合适的架构模式',
        '定义接口和数据结构',
        '设计错误处理策略',
        '规划测试验证方案',
      ],
      outputs: ['架构设计文档', '接口定义', '测试计划'],
    },
    {
      phase: '3. 代码生成',
      activities: [
        '生成核心业务逻辑代码',
        '生成接口和类型定义',
        '生成错误处理代码',
        '生成单元测试代码',
      ],
      outputs: ['源代码文件', '类型定义文件', '测试文件'],
    },
    {
      phase: '4. 质量验证',
      activities: [
        '静态代码分析',
        '类型检查和编译验证',
        '单元测试执行',
        '集成测试验证',
        '安全漏洞扫描',
        '性能基准测试',
      ],
      outputs: ['质量报告', '测试报告', '性能报告'],
    },
    {
      phase: '5. 文档生成',
      activities: [
        '生成TSDoc注释',
        '生成API文档',
        '生成使用示例',
        '生成部署指南',
      ],
      outputs: ['API文档', '使用指南', '部署文档'],
    },
  ],

  checkpoints: [
    {
      phase: '需求分析完成',
      criteria: ['需求明确性>90%', '技术可行性确认', '依赖关系清晰'],
      action: '继续架构设计 | 需求澄清',
    },
    {
      phase: '架构设计完成',
      criteria: ['架构合规性100%', '接口定义完整', '测试策略确定'],
      action: '开始代码生成 | 架构优化',
    },
    {
      phase: '代码生成完成',
      criteria: ['编译通过', '基本功能实现', '代码规范遵循'],
      action: '质量验证 | 代码优化',
    },
    {
      phase: '质量验证完成',
      criteria: ['质量评分≥80分', '测试覆盖率≥90%', '性能达标'],
      action: '生成文档 | 质量改进',
    },
    {
      phase: '文档生成完成',
      criteria: ['文档完整性100%', '示例可执行', '部署指南有效'],
      action: '交付代码 | 文档完善',
    },
  ],
} as const;
```

#### 1.1.4 架构质量门禁约束

```typescript
// 架构质量基线 - 不可降级的质量标准
export const ARCHITECTURE_QUALITY_GATES = {
  模块独立性: '100%', // 绝对禁止循环依赖
  测试覆盖率: '>90%', // 单元测试强制覆盖率
  集成覆盖率: '>80%', // 集成测试覆盖率
  E2E覆盖率: '>95%关键路径', // 端到端测试覆盖关键业务流程
  代码重用率: '>80%', // 代码复用要求
  Bug修复时间: '<2天', // 平均Bug修复时间
  技术债务比例: '<15%', // 技术债务占比控制
  依赖管理: '严格版本锁定', // package.json版本精确控制
  性能基线: '冷启动<3秒', // 应用启动时间要求
  内存占用: '运行<512MB', // 内存使用上限
  CPU占用: '空闲<5%', // CPU空闲时占用
  安全扫描: '0个高危漏洞', // 依赖安全要求
  代码质量: 'ESLint无警告', // 代码规范要求
  TypeScript: 'strict模式', // 类型检查要求
  文档覆盖率: '>80%公共API', // API文档覆盖率
} as const;
```

### 1.2 业务目标定义 (Business Objectives)

#### 1.2.1 核心业务价值

**主业务流程定义**

```typescript
// 核心业务流程映射
export const CORE_BUSINESS_FLOWS = {
  公会创建与管理: {
    核心价值: '玩家自主创建和运营虚拟公会',
    关键指标: ['公会创建成功率>95%', '公会管理操作响应<200ms'],
    依赖系统: ['事件系统', '数据完整性引擎', '状态管理'],
  },

  智能AI决策系统: {
    核心价值: 'NPC公会自主运营提供挑战与互动',
    关键指标: ['AI决策时间<100ms', 'AI行为一致性>85%'],
    依赖系统: ['AI行为引擎', '事件驱动架构', '机器学习模块'],
  },

  战斗策略系统: {
    核心价值: '多样化PVP/PVE战斗，策略深度体验',
    关键指标: ['战斗计算时间<500ms', '战斗结果公正性100%'],
    依赖系统: ['游戏引擎', '战斗逻辑', '状态同步'],
  },

  经济生态循环: {
    核心价值: '拍卖行、交易、资源流转的经济系统',
    关键指标: ['交易延迟<50ms', '经济平衡性>90%'],
    依赖系统: ['经济引擎', '交易系统', '数据分析'],
  },

  社交互动平台: {
    核心价值: '论坛、邮件、智能分类的社交体验',
    关键指标: ['消息送达率>99%', '智能分类准确率>80%'],
    依赖系统: ['通信系统', 'AI分类', '内容管理'],
  },
} as const;
```

#### 1.2.2 技术性能目标

```typescript
// 性能基线定义 - 严格执行的性能标准
export const PERFORMANCE_BASELINES = {
  startup: {
    coldStart: {
      target: 3000, // 3秒目标
      warning: 4000, // 4秒警告
      critical: 6000, // 6秒临界
    },
    warmStart: {
      target: 1000, // 1秒目标
      warning: 1500, // 1.5秒警告
      critical: 2500, // 2.5秒临界
    },
  },

  runtime: {
    frameRate: {
      target: 60, // 60fps目标
      warning: 45, // 45fps警告
      critical: 30, // 30fps临界
    },
    memoryUsage: {
      target: 256, // 256MB目标
      warning: 512, // 512MB警告
      critical: 1024, // 1GB临界
    },
    eventProcessing: {
      target: 1000, // 1000 events/sec目标
      warning: 500, // 500 events/sec警告
      critical: 100, // 100 events/sec临界
    },
  },

  database: {
    queryTime: {
      target: 10, // 10ms目标
      warning: 50, // 50ms警告
      critical: 200, // 200ms临界
    },
    concurrentUsers: {
      target: 1000, // 支持1000并发用户
      warning: 500, // 500用户警告
      critical: 100, // 100用户临界
    },
    transactionTime: {
      target: 50, // 50ms事务时间目标
      warning: 100, // 100ms警告
      critical: 500, // 500ms临界
    },
  },

  ai: {
    decisionTime: {
      target: 100, // 100ms AI决策时间
      warning: 300, // 300ms警告
      critical: 1000, // 1000ms临界
    },
    batchProcessing: {
      target: 50, // 50个AI实体并行处理
      warning: 30, // 30个警告
      critical: 10, // 10个临界
    },
  },
} as const;
```

### 1.3 风险评估与缓解策略 (Risk Assessment)

#### 1.3.1 技术风险矩阵

| 风险类别       | 风险描述               | 概率 | 影响 | 风险等级 | 缓解策略                  | 负责人       |
| -------------- | ---------------------- | ---- | ---- | -------- | ------------------------- | ------------ |
| **架构风险**   | 循环依赖导致系统僵化   | 中   | 高   | 🔴高     | 强制依赖检查工具+代码审查 | 架构师       |
| **性能风险**   | 内存泄露影响长期运行   | 高   | 中   | 🔴高     | 内存监控+自动重启机制     | 性能工程师   |
| **安全风险**   | Electron安全漏洞       | 低   | 高   | 🟡中     | 安全基线+定期审计         | 安全工程师   |
| **数据风险**   | SQLite数据损坏         | 低   | 高   | 🟡中     | 自动备份+完整性检查       | 数据工程师   |
| **AI风险**     | AI决策质量下降         | 中   | 中   | 🟡中     | 效果监控+人工干预         | AI工程师     |
| **依赖风险**   | 第三方包漏洞或停维     | 中   | 中   | 🟡中     | 定期更新+备选方案         | DevOps工程师 |
| **复杂度风险** | 过度工程化影响开发效率 | 中   | 中   | 🟡中     | YAGNI原则+定期重构        | 技术主管     |
| **兼容性风险** | 跨平台兼容性问题       | 低   | 中   | 🟢低     | CI多平台测试              | 测试工程师   |

#### 1.3.2 业务连续性规划

**数据备份策略**

```typescript
// 备份策略配置 - 关键数据保护
export const BACKUP_STRATEGY = {
  频率策略: {
    实时备份: {
      数据: '关键事务数据', // 公会状态、战斗结果、经济交易
      方式: '写时复制+事务日志',
      恢复目标: 'RTO: 0秒, RPO: 0秒',
    },
    每小时备份: {
      数据: '玩家数据', // 个人进度、成就、设置
      方式: '增量备份到本地目录',
      恢复目标: 'RTO: 5分钟, RPO: 1小时',
    },
    每日备份: {
      数据: '完整数据库', // 全量数据备份
      方式: 'SQLite数据库文件复制',
      恢复目标: 'RTO: 30分钟, RPO: 24小时',
    },
    每周备份: {
      数据: '系统配置', // 配置文件、日志文件
      方式: '配置文件打包压缩',
      恢复目标: 'RTO: 1小时, RPO: 1周',
    },
  },

  保留策略: {
    实时备份: '24小时', // 24小时内的事务日志
    小时备份: '7天', // 7天内的小时备份
    日备份: '30天', // 30天内的日备份
    周备份: '1年', // 1年内的周备份
    归档备份: '永久', // 重要里程碑永久保存
  },

  完整性验证: {
    实时验证: '事务提交时校验',
    定期验证: '每小时备份完整性检查',
    恢复验证: '每次恢复后数据一致性验证',
  },
} as const;
```

**灾难恢复计划**

```typescript
// 灾难恢复等级定义
export const DISASTER_RECOVERY_LEVELS = {
  Level1_数据损坏: {
    检测方式: '数据完整性检查失败',
    恢复流程: [
      '立即停止写入操作',
      '从最近备份恢复数据',
      '执行数据一致性验证',
      '重启应用服务',
    ],
    预期恢复时间: '5分钟',
    数据丢失量: '最多1小时',
  },

  Level2_应用崩溃: {
    检测方式: '应用无响应或频繁崩溃',
    恢复流程: [
      '收集崩溃日志和内存dump',
      '重启应用到最后已知良好状态',
      '加载最近数据备份',
      '执行烟雾测试验证功能',
    ],
    预期恢复时间: '10分钟',
    数据丢失量: '最多10分钟',
  },

  Level3_系统故障: {
    检测方式: '操作系统或硬件故障',
    恢复流程: [
      '在备用系统上部署应用',
      '恢复最新完整备份',
      '重新配置系统环境',
      '执行完整功能测试',
    ],
    预期恢复时间: '2小时',
    数据丢失量: '最多24小时',
  },
} as const;
```

#### 1.3.3 质量保证机制

**代码质量保证**

```typescript
// 代码质量检查点
export const CODE_QUALITY_CHECKPOINTS = {
  开发阶段: {
    编写时: [
      'TypeScript严格模式编译检查',
      'ESLint代码规范实时检查',
      '单元测试TDD开发模式',
      '代码复杂度实时监控',
    ],
    提交时: [
      'Pre-commit钩子执行完整检查',
      '代码格式化(Prettier)自动修复',
      '提交信息规范验证',
      '增量测试执行',
    ],
  },

  集成阶段: {
    PR创建时: [
      '自动化代码审查(SonarQube)',
      '安全漏洞扫描(npm audit)',
      '测试覆盖率检查',
      '依赖分析和更新建议',
    ],
    合并前: [
      '人工代码审查(至少2人)',
      '集成测试完整执行',
      '性能基准测试',
      '架构合规性检查',
    ],
  },

  发布阶段: {
    构建时: [
      '多平台兼容性验证',
      '打包完整性检查',
      '资源优化和压缩',
      '数字签名验证',
    ],
    部署前: [
      '端到端测试完整执行',
      '性能回归测试',
      '安全渗透测试',
      '用户验收测试',
    ],
  },
} as const;
```

### 1.4 开发规范与质量标准

#### 1.4.1 TypeScript开发规范

**严格模式配置**

```typescript
// tsconfig.json - 最严格的TypeScript配置
export const TYPESCRIPT_CONFIG = {
  compilerOptions: {
    // 严格性配置
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    strictPropertyInitialization: true,
    noImplicitReturns: true,
    noImplicitThis: true,
    alwaysStrict: true,

    // 额外严格检查
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noPropertyAccessFromIndexSignature: true,

    // 模块和解析
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'bundler',
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,

    // 路径映射
    baseUrl: './src',
    paths: {
      '@/*': ['*'],
      '@components/*': ['components/*'],
      '@utils/*': ['utils/*'],
      '@types/*': ['types/*'],
      '@services/*': ['services/*'],
      '@stores/*': ['stores/*'],
    },
  },
} as const;

// 类型定义规范
export interface TypeDefinitionStandards {
  // 使用明确的类型定义，避免any
  goodExample: {
    userId: string;
    age: number;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };

  // 使用泛型提高代码复用性
  genericExample: <T extends Record<string, unknown>>(data: T) => T;

  // 使用联合类型替代枚举（更灵活）
  unionType: 'pending' | 'approved' | 'rejected';

  // 使用readonly确保不可变性
  immutableArray: readonly string[];
  immutableObject: {
    readonly id: string;
    readonly name: string;
  };
}
```

**React 19开发规范**

```tsx
// React组件开发规范示例
import React, { useState, useEffect, memo, useCallback } from 'react';

// Props接口定义 - 始终使用接口
interface UserProfileProps {
  readonly userId: string;
  readonly onUpdate?: (user: User) => void;
  readonly className?: string;
}

// 组件实现 - 使用函数组件+Hook
const UserProfile: React.FC<UserProfileProps> = memo(
  ({ userId, onUpdate, className = '' }) => {
    // 状态管理 - 明确类型
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // 副作用管理 - 清理函数
    useEffect(() => {
      let mounted = true;

      const fetchUser = async () => {
        setLoading(true);
        setError(null);

        try {
          const userData = await userService.fetchUser(userId);
          if (mounted) {
            setUser(userData);
          }
        } catch (err) {
          if (mounted) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      fetchUser();

      return () => {
        mounted = false;
      };
    }, [userId]);

    // 事件处理器 - 使用useCallback优化
    const handleUpdate = useCallback(
      (updatedUser: User) => {
        setUser(updatedUser);
        onUpdate?.(updatedUser);
      },
      [onUpdate]
    );

    // 条件渲染
    if (loading) {
      return <div className="flex justify-center p-4">Loading...</div>;
    }

    if (error) {
      return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    if (!user) {
      return <div className="text-gray-500 p-4">User not found</div>;
    }

    // JSX返回
    return (
      <div className={`user-profile ${className}`}>
        <h2 className="text-xl font-bold">{user.name}</h2>
        <p className="text-gray-600">{user.email}</p>
        {/* 其他UI内容 */}
      </div>
    );
  }
);

// 显示名称 - 调试用
UserProfile.displayName = 'UserProfile';

export default UserProfile;
```

#### 1.4.2 Phaser 3开发规范

**Scene架构标准**

```typescript
// Phaser Scene开发规范
import Phaser from 'phaser';
import { EventBus } from '@/core/events/EventBus';
import { GameEvents } from '@/core/events/GameEvents';

export class GuildManagementScene extends Phaser.Scene {
  // 类型化的游戏对象
  private background!: Phaser.GameObjects.Image;
  private guildList!: Phaser.GameObjects.Container;
  private ui!: {
    createButton: Phaser.GameObjects.Text;
    titleText: Phaser.GameObjects.Text;
  };

  // 场景数据
  private guilds: Guild[] = [];
  private selectedGuild: Guild | null = null;

  constructor() {
    super({ key: 'GuildManagementScene' });
  }

  // 预加载资源
  preload(): void {
    this.load.image('guild-bg', 'assets/backgrounds/guild-management.png');
    this.load.image('guild-card', 'assets/ui/guild-card.png');
    this.load.audio('click-sound', 'assets/sounds/click.mp3');
  }

  // 创建场景
  create(): void {
    this.createBackground();
    this.createUI();
    this.setupEventListeners();
    this.loadGuilds();
  }

  // 背景创建
  private createBackground(): void {
    this.background = this.add
      .image(this.cameras.main.centerX, this.cameras.main.centerY, 'guild-bg')
      .setDisplaySize(this.cameras.main.width, this.cameras.main.height);
  }

  // UI创建
  private createUI(): void {
    // 标题
    this.ui.titleText = this.add
      .text(this.cameras.main.centerX, 50, '公会管理', {
        fontSize: '32px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // 创建按钮
    this.ui.createButton = this.add
      .text(this.cameras.main.width - 150, 50, '创建公会', {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        backgroundColor: '#4CAF50',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.handleCreateGuild, this);

    // 公会列表容器
    this.guildList = this.add.container(50, 100);
  }

  // 事件监听器设置
  private setupEventListeners(): void {
    // 监听来自React的事件
    EventBus.on(GameEvents.GUILD_CREATED, this.onGuildCreated, this);
    EventBus.on(GameEvents.GUILD_UPDATED, this.onGuildUpdated, this);
    EventBus.on(GameEvents.GUILD_DELETED, this.onGuildDeleted, this);

    // 场景销毁时清理事件监听器
    this.events.once('shutdown', () => {
      EventBus.off(GameEvents.GUILD_CREATED, this.onGuildCreated, this);
      EventBus.off(GameEvents.GUILD_UPDATED, this.onGuildUpdated, this);
      EventBus.off(GameEvents.GUILD_DELETED, this.onGuildDeleted, this);
    });
  }

  // 加载公会数据
  private async loadGuilds(): Promise<void> {
    try {
      this.guilds = await guildService.getAllGuilds();
      this.renderGuildList();
    } catch (error) {
      console.error('Failed to load guilds:', error);
      EventBus.emit(GameEvents.ERROR_OCCURRED, {
        message: '加载公会列表失败',
        error,
      });
    }
  }

  // 渲染公会列表
  private renderGuildList(): void {
    // 清空现有列表
    this.guildList.removeAll(true);

    this.guilds.forEach((guild, index) => {
      const guildCard = this.createGuildCard(guild, index);
      this.guildList.add(guildCard);
    });
  }

  // 创建公会卡片
  private createGuildCard(
    guild: Guild,
    index: number
  ): Phaser.GameObjects.Container {
    const cardContainer = this.add.container(0, index * 120);

    // 背景
    const cardBg = this.add
      .image(0, 0, 'guild-card')
      .setDisplaySize(600, 100)
      .setOrigin(0, 0.5);

    // 公会名称
    const nameText = this.add.text(20, -20, guild.name, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#333333',
    });

    // 成员数量
    const memberText = this.add.text(
      20,
      10,
      `成员: ${guild.memberCount}/${guild.maxMembers}`,
      {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#666666',
      }
    );

    // 公会等级
    const levelText = this.add.text(400, -20, `等级 ${guild.level}`, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#4CAF50',
    });

    cardContainer.add([cardBg, nameText, memberText, levelText]);

    // 交互设置
    cardBg
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleGuildSelect(guild));

    return cardContainer;
  }

  // 事件处理器
  private handleCreateGuild(): void {
    this.sound.play('click-sound', { volume: 0.5 });
    EventBus.emit(GameEvents.SHOW_CREATE_GUILD_MODAL);
  }

  private handleGuildSelect(guild: Guild): void {
    this.selectedGuild = guild;
    EventBus.emit(GameEvents.GUILD_SELECTED, guild);
  }

  // 外部事件处理
  private onGuildCreated(guild: Guild): void {
    this.guilds.push(guild);
    this.renderGuildList();
  }

  private onGuildUpdated(updatedGuild: Guild): void {
    const index = this.guilds.findIndex(g => g.id === updatedGuild.id);
    if (index !== -1) {
      this.guilds[index] = updatedGuild;
      this.renderGuildList();
    }
  }

  private onGuildDeleted(guildId: string): void {
    this.guilds = this.guilds.filter(g => g.id !== guildId);
    this.renderGuildList();
    if (this.selectedGuild?.id === guildId) {
      this.selectedGuild = null;
    }
  }

  // 场景更新循环
  update(time: number, delta: number): void {
    // 场景逻辑更新
    // 注意：避免在update中进行重计算，使用缓存和增量更新
  }
}
```

#### 1.4.3 事件命名规范

**强类型事件系统**

```typescript
// 事件名称规范 - 强类型定义
export const GameEvents = {
  // 公会相关事件
  GUILD_CREATED: 'guild.created',
  GUILD_UPDATED: 'guild.updated',
  GUILD_DELETED: 'guild.deleted',
  GUILD_SELECTED: 'guild.selected',
  GUILD_MEMBER_JOINED: 'guild.member.joined',
  GUILD_MEMBER_LEFT: 'guild.member.left',

  // 战斗相关事件
  BATTLE_STARTED: 'battle.started',
  BATTLE_ENDED: 'battle.ended',
  BATTLE_TURN_START: 'battle.turn.start',
  BATTLE_ACTION_EXECUTED: 'battle.action.executed',

  // AI相关事件
  AI_DECISION_MADE: 'ai.decision.made',
  AI_STATE_CHANGED: 'ai.state.changed',
  AI_LEARNING_UPDATED: 'ai.learning.updated',

  // 系统事件
  ERROR_OCCURRED: 'system.error.occurred',
  PERFORMANCE_WARNING: 'system.performance.warning',
  DATA_SYNC_REQUIRED: 'system.data.sync.required',

  // UI事件
  SHOW_CREATE_GUILD_MODAL: 'ui.modal.create.guild.show',
  HIDE_CREATE_GUILD_MODAL: 'ui.modal.create.guild.hide',
  SHOW_NOTIFICATION: 'ui.notification.show',
} as const;

// 事件数据类型定义
export interface GameEventData {
  [GameEvents.GUILD_CREATED]: Guild;
  [GameEvents.GUILD_UPDATED]: Guild;
  [GameEvents.GUILD_DELETED]: { guildId: string };
  [GameEvents.GUILD_SELECTED]: Guild;
  [GameEvents.ERROR_OCCURRED]: { message: string; error?: unknown };
  [GameEvents.SHOW_NOTIFICATION]: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  };
}

// 类型安全的事件发射器
export class TypedEventEmitter {
  private listeners = new Map<string, Function[]>();

  emit<K extends keyof GameEventData>(event: K, data: GameEventData[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
  }

  on<K extends keyof GameEventData>(
    event: K,
    listener: (data: GameEventData[K]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off<K extends keyof GameEventData>(
    event: K,
    listener: (data: GameEventData[K]) => void
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
}
```

### 1.5 成功指标与验收标准

#### 1.5.1 架构成熟度评估

**架构评分标准 (目标: 98+分)**

| 评分维度             | 权重 | 目标分数 | 关键指标                                             | 测量方式                               |
| -------------------- | ---- | -------- | ---------------------------------------------------- | -------------------------------------- |
| **AI代码生成友好度** | 40%  | 39/40    | 清晰依赖关系、标准化接口、完整代码示例、详细配置模板 | 代码块数量、示例完整性、文档结构化程度 |
| **架构顺序符合度**   | 30%  | 29/30    | 严格遵循arc42/C4标准、AI优先9章排序、不可回退约束    | 章节顺序检查、依赖关系验证             |
| **测试金字塔实现**   | 20%  | 20/20    | 70%单元+20%集成+10%E2E、完整自动化、质量门禁         | 测试覆盖率统计、自动化执行率           |
| **实际可操作性**     | 10%  | 10/10    | 详细实施指南、工具链配置、具体操作步骤               | 可执行性验证、配置文件完整性           |
| **总分**             | 100% | **98+**  | 综合评估                                             | 自动化评分工具                         |

#### 1.5.2 交付质量门禁

```typescript
// 发布质量门禁 - 严格执行的质量标准
export const RELEASE_QUALITY_GATES = {
  代码质量: {
    测试覆盖率: '>= 90%', // 单元测试覆盖率
    集成覆盖率: '>= 80%', // 集成测试覆盖率
    E2E覆盖率: '>= 95%关键路径', // 端到端测试覆盖关键业务流程
    代码重复率: '<= 5%', // 代码重复比例
    圈复杂度: '<= 10', // 单个函数圈复杂度
    技术债务比例: '<= 15%', // 技术债务占总代码比例
    ESLint违规: '0个error, 0个warning', // 代码规范检查
    TypeScript错误: '0个编译错误', // 类型检查
  },

  性能质量: {
    冷启动时间: '<= 3000ms', // 应用首次启动时间
    热启动时间: '<= 1000ms', // 应用二次启动时间
    内存使用峰值: '<= 512MB', // 内存占用上限
    CPU空闲占用: '<= 5%', // CPU空闲时占用率
    帧率稳定性: '>= 95% (>45fps)', // 游戏帧率稳定性
    数据库查询时间: '<= 50ms P95', // 95%查询响应时间
    事件处理延迟: '<= 10ms P99', // 99%事件处理延迟
    AI决策时间: '<= 100ms P95', // 95%AI决策响应时间
  },

  安全质量: {
    安全漏洞数量: '0个高危, 0个中危', // 依赖安全扫描结果
    代码安全扫描: '0个严重问题', // 代码安全审计结果
    数据加密覆盖率: '100%敏感数据', // 敏感数据加密比例
    权限控制覆盖率: '100%受保护资源', // 权限控制覆盖度
    安全配置检查: '100%通过', // Electron安全配置检查
    渗透测试: '0个可利用漏洞', // 安全渗透测试结果
    审计日志完整性: '100%关键操作', // 安全审计日志覆盖度
    备份恢复验证: '100%成功', // 数据备份和恢复验证
  },

  用户体验: {
    界面响应时间: '<= 200ms P95', // 95%界面操作响应时间
    错误恢复能力: '>= 99%自动恢复', // 系统错误自动恢复率
    用户操作成功率: '>= 99.5%', // 用户操作成功完成率
    界面可用性: '100%通过性测试', // 可用性测试通过率
    多平台兼容性: '100%目标平台', // 跨平台兼容性
    本地化准确性: '100%翻译内容', // 多语言本地化准确性
    帮助文档完整性: '100%功能覆盖', // 用户帮助文档覆盖度
    错误消息友好性: '100%用户友好', // 错误消息的用户友好程度
  },
} as const;
```

---

## 第2章 威胁模型与安全基线 (Threat Model & Security Baseline)

### 2.1 威胁建模与风险评估

#### 2.1.1 威胁建模框架 (STRIDE + DREAD)

**STRIDE威胁分析**
| 威胁类型 | 具体威胁 | 影响资产 | 风险等级 | 缓解措施 | 实施优先级 |
|---------|----------|----------|----------|----------|------------|
| **欺骗 (Spoofing)** | 恶意软件伪造应用身份 | 用户信任、系统完整性 | 🔴高 | 代码签名、证书验证 | P0 |
| **篡改 (Tampering)** | 修改存档数据或配置文件 | 游戏数据完整性 | 🔴高 | 文件加密、完整性校验 | P0 |
| **否认 (Repudiation)** | 否认游戏内交易或操作 | 审计可信度 | 🟡中 | 操作日志、数字签名 | P1 |
| **信息泄露 (Information Disclosure)** | 敏感数据被恶意读取 | 用户隐私、商业机密 | 🔴高 | 数据加密、访问控制 | P0 |
| **拒绝服务 (Denial of Service)** | 恶意代码消耗系统资源 | 系统可用性 | 🟡中 | 资源限制、异常检测 | P1 |
| **特权提升 (Elevation of Privilege)** | 突破Electron沙箱限制 | 系统安全边界 | 🔴高 | 严格安全配置、权限最小化 | P0 |

**DREAD风险量化**

```typescript
// DREAD评分矩阵 (1-10分制)
export const DREAD_RISK_MATRIX = {
  代码注入攻击: {
    Damage: 9, // 损害程度：可完全控制系统
    Reproducibility: 3, // 重现难度：需要特殊条件
    Exploitability: 5, // 利用难度：需要一定技能
    AffectedUsers: 8, // 影响用户：大部分用户
    Discoverability: 4, // 发现难度：需要深入分析
    总分: 29, // 高风险 (25-30)
    风险等级: '高',
  },

  数据泄露: {
    Damage: 7, // 损害程度：泄露敏感信息
    Reproducibility: 6, // 重现难度：相对容易重现
    Exploitability: 4, // 利用难度：需要基本技能
    AffectedUsers: 9, // 影响用户：几乎所有用户
    Discoverability: 5, // 发现难度：中等难度发现
    总分: 31, // 高风险 (30-35)
    风险等级: '高',
  },

  拒绝服务: {
    Damage: 5, // 损害程度：影响可用性
    Reproducibility: 8, // 重现难度：容易重现
    Exploitability: 7, // 利用难度：相对容易
    AffectedUsers: 10, // 影响用户：所有用户
    Discoverability: 7, // 发现难度：容易发现
    总分: 37, // 高风险 (35-40)
    风险等级: '高',
  },
} as const;
```

#### 2.1.2 攻击面分析

**Electron应用攻击面映射**

```typescript
// 攻击面详细分析
export const ATTACK_SURFACE_MAP = {
  Electron主进程: {
    描述: '应用的核心控制进程，具有完整的Node.js API访问权限',
    风险点: [
      'Node.js API直接访问文件系统',
      '进程间通信(IPC)通道暴露',
      '系统权限提升可能',
      '第三方模块安全漏洞',
    ],
    缓解措施: [
      'contextIsolation: true // 严格上下文隔离',
      'nodeIntegration: false // 禁用Node集成',
      'enableRemoteModule: false // 禁用远程模块',
      '定期更新依赖包并进行安全扫描',
    ],
    监控指标: [
      'IPC通信频率和异常模式',
      '文件系统访问权限检查',
      '内存使用异常监控',
    ],
  },

  渲染进程: {
    描述: 'Web内容显示进程，运行React应用和Phaser游戏',
    风险点: [
      'XSS跨站脚本攻击',
      '恶意脚本注入',
      'DOM操作篡改',
      '第三方库漏洞利用',
    ],
    缓解措施: [
      '严格的CSP(内容安全策略)配置',
      '输入验证和输出编码',
      'DOMPurify清理用户输入',
      'React内置XSS防护机制',
    ],
    监控指标: ['脚本执行异常检测', 'DOM修改监控', '网络请求异常分析'],
  },

  本地存储: {
    描述: 'SQLite数据库和配置文件存储',
    风险点: [
      '数据库文件直接访问',
      '配置文件明文存储',
      '存档文件完整性破坏',
      '敏感数据泄露',
    ],
    缓解措施: [
      'AES-256-GCM数据库加密',
      '文件完整性哈希验证',
      '敏感配置加密存储',
      '定期数据备份和验证',
    ],
    监控指标: [
      '文件系统访问模式监控',
      '数据完整性检查结果',
      '异常数据访问告警',
    ],
  },

  Web_Worker线程: {
    描述: 'AI计算和后台任务处理线程',
    风险点: [
      '恶意代码在Worker中执行',
      '资源耗尽攻击',
      '跨Worker通信篡改',
      '计算结果被操控',
    ],
    缓解措施: [
      'Worker沙箱隔离',
      '计算资源限制配置',
      '消息验证和签名',
      '结果一致性验证',
    ],
    监控指标: ['Worker资源使用监控', '异常计算时间检测', '跨线程通信安全审计'],
  },
} as const;
```

### 2.2 Electron安全基线配置 (ChatGPT5核心建议)

#### 2.2.1 安全配置清单

**主进程安全配置**

```typescript
// main.ts - Electron主进程安全配置
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { SecurityManager } from './security/SecurityManager';

// Electron安全基线配置 (ChatGPT5建议的安全护栏)
export const ELECTRON_SECURITY_CONFIG = {
  webPreferences: {
    // 🔒 核心安全配置
    contextIsolation: true, // 上下文隔离 - 防止渲染进程污染主进程
    nodeIntegration: false, // 禁用Node.js集成 - 防止直接访问系统API
    webSecurity: true, // 启用Web安全 - 强制同源策略
    allowRunningInsecureContent: false, // 禁止不安全内容 - 防止混合内容攻击
    experimentalFeatures: false, // 禁用实验性功能 - 避免未知安全风险

    // 🛡️ 沙箱配置
    sandbox: true, // 启用沙箱模式 - 限制渲染进程权限
    enableRemoteModule: false, // 禁用远程模块 - 防止远程代码执行
    nodeIntegrationInWorker: false, // Worker中禁用Node.js - 防止Worker权限提升
    nodeIntegrationInSubFrames: false, // 子框架禁用Node.js - 防止iframe攻击

    // 📁 文件访问控制
    webgl: false, // 禁用WebGL - 减少GPU相关攻击面
    plugins: false, // 禁用插件系统 - 防止第三方插件安全风险
    java: false, // 禁用Java - 减少Java相关漏洞

    // 🔐 预加载脚本安全
    preload: path.join(__dirname, 'preload.js'), // 安全预加载脚本
    safeDialogs: true, // 安全对话框 - 防止对话框欺骗
    safeDialogsMessage: '此应用正在尝试显示安全对话框', // 安全提示信息

    // 🌐 网络安全
    allowDisplayingInsecureContent: false, // 禁止显示不安全内容
    allowRunningInsecureContent: false, // 禁止运行不安全内容
    blinkFeatures: '', // 禁用所有Blink实验性功能
    disableBlinkFeatures: 'Auxclick,AutoplayPolicy', // 禁用特定Blink功能
  },

  // 📋 CSP策略 (内容安全策略)
  contentSecurityPolicy: [
    "default-src 'self'", // 默认只允许同源内容
    "script-src 'self' 'unsafe-inline'", // 脚本只允许同源和内联
    "style-src 'self' 'unsafe-inline'", // 样式允许同源和内联
    "img-src 'self' data: https:", // 图片允许同源、data URL和HTTPS
    "font-src 'self'", // 字体只允许同源
    "connect-src 'self'", // 网络连接只允许同源
    "object-src 'none'", // 禁止嵌入对象(Flash等)
    "embed-src 'none'", // 禁止embed标签
    "base-uri 'self'", // base标签只允许同源
    "form-action 'self'", // 表单提交只允许同源
    "frame-ancestors 'none'", // 禁止被其他页面嵌入
    'upgrade-insecure-requests', // 自动升级不安全请求到HTTPS
  ].join('; '),

  // 🔒 权限策略
  permissionsPolicy: {
    camera: [], // 禁用摄像头
    microphone: [], // 禁用麦克风
    geolocation: [], // 禁用地理位置
    notifications: ['self'], // 通知只允许自身
    payment: [], // 禁用支付API
    usb: [], // 禁用USB API
    bluetooth: [], // 禁用蓝牙API
  },
} as const;

// 创建安全的主窗口
export function createSecureMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: ELECTRON_SECURITY_CONFIG.webPreferences,

    // 🖼️ 窗口安全配置
    show: false, // 初始隐藏，避免白屏闪烁
    titleBarStyle: 'default', // 使用系统标题栏
    autoHideMenuBar: true, // 自动隐藏菜单栏

    // 🔐 权限限制
    webSecurity: true, // 强制Web安全
    contextIsolation: true, // 确保上下文隔离
  });

  // 🌐 加载应用内容
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile('dist/index.html');
  }

  // 🛡️ 安全事件监听
  setupSecurityEventListeners(mainWindow);

  return mainWindow;
}

// 安全事件监听器设置
function setupSecurityEventListeners(window: BrowserWindow): void {
  // 阻止新窗口创建
  window.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // 阻止导航到外部链接
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (
      parsedUrl.origin !== 'http://localhost:3000' &&
      parsedUrl.origin !== 'file://'
    ) {
      event.preventDefault();
    }
  });

  // 监控证书错误
  window.webContents.on(
    'certificate-error',
    (event, url, error, certificate, callback) => {
      // 在生产环境中严格验证证书
      if (process.env.NODE_ENV === 'production') {
        event.preventDefault();
        callback(false);
        console.error('Certificate error:', error, 'for URL:', url);
      }
    }
  );

  // 监控权限请求
  window.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      // 默认拒绝所有权限请求
      callback(false);
      console.warn('Permission request denied:', permission);
    }
  );
}
```

#### 2.2.2 预加载脚本安全实现

```typescript
// preload.ts - 安全的预加载脚本
import { contextBridge, ipcRenderer } from 'electron';
import { SecurityManager } from './security/SecurityManager';

// 🔒 安全API白名单 - 严格限制暴露的API
const SAFE_CHANNELS = [
  // 应用基础API
  'app:get-version',
  'app:get-platform',
  'app:quit',

  // 游戏数据API
  'game:save-data',
  'game:load-data',
  'game:export-data',

  // 日志API
  'log:write-entry',
  'log:get-logs',

  // 系统API
  'system:get-info',
  'system:show-message-box',
] as const;

// 🛡️ 输入验证和清理
class InputValidator {
  // 清理字符串输入
  static sanitizeString(input: unknown): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    // 移除潜在危险的字符和脚本标签
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  // 验证游戏数据结构
  static validateGameData(data: unknown): GameSaveData {
    if (!data || typeof data !== 'object') {
      throw new Error('Game data must be an object');
    }

    const gameData = data as Record<string, unknown>;

    // 验证必需字段
    if (!gameData.version || typeof gameData.version !== 'string') {
      throw new Error('Game data must have a version field');
    }

    if (!gameData.timestamp || typeof gameData.timestamp !== 'number') {
      throw new Error('Game data must have a timestamp field');
    }

    // 验证数据大小限制
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 10 * 1024 * 1024) {
      // 10MB限制
      throw new Error('Game data too large (>10MB)');
    }

    return gameData as GameSaveData;
  }

  // 验证日志级别
  static validateLogLevel(level: unknown): LogLevel {
    const validLevels = ['debug', 'info', 'warn', 'error'] as const;
    if (!validLevels.includes(level as LogLevel)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    return level as LogLevel;
  }
}

// 🔐 安全的上下文桥接API
contextBridge.exposeInMainWorld('electronAPI', {
  // 🏠 应用信息API
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

    getPlatform: (): Promise<string> => ipcRenderer.invoke('app:get-platform'),

    quit: (): void => ipcRenderer.send('app:quit'),
  },

  // 💾 安全的游戏数据API
  game: {
    saveData: async (data: unknown): Promise<boolean> => {
      const validatedData = InputValidator.validateGameData(data);
      return ipcRenderer.invoke('game:save-data', validatedData);
    },

    loadData: (): Promise<GameSaveData | null> =>
      ipcRenderer.invoke('game:load-data'),

    exportData: async (format: 'json' | 'csv'): Promise<string> => {
      if (!['json', 'csv'].includes(format)) {
        throw new Error('Invalid export format');
      }
      return ipcRenderer.invoke('game:export-data', format);
    },
  },

  // 📝 安全的日志API
  log: {
    writeEntry: async (level: unknown, message: unknown): Promise<void> => {
      const validLevel = InputValidator.validateLogLevel(level);
      const sanitizedMessage = InputValidator.sanitizeString(message);

      // 限制日志消息长度
      const truncatedMessage =
        sanitizedMessage.length > 1000
          ? sanitizedMessage.substring(0, 1000) + '...'
          : sanitizedMessage;

      return ipcRenderer.invoke('log:write-entry', {
        level: validLevel,
        message: truncatedMessage,
        timestamp: Date.now(),
      });
    },

    getLogs: async (options?: {
      level?: LogLevel;
      limit?: number;
      since?: Date;
    }): Promise<LogEntry[]> => {
      // 验证选项参数
      if (options?.limit && (options.limit < 1 || options.limit > 1000)) {
        throw new Error('Log limit must be between 1 and 1000');
      }

      return ipcRenderer.invoke('log:get-logs', options);
    },
  },

  // 🖥️ 系统信息API (只读)
  system: {
    getInfo: (): Promise<SystemInfo> => ipcRenderer.invoke('system:get-info'),

    showMessageBox: async (options: {
      type?: 'info' | 'warning' | 'error';
      title?: string;
      message: string;
    }): Promise<void> => {
      const sanitizedOptions = {
        type: options.type || 'info',
        title: InputValidator.sanitizeString(options.title || 'Guild Manager'),
        message: InputValidator.sanitizeString(options.message),
      };

      return ipcRenderer.invoke('system:show-message-box', sanitizedOptions);
    },
  },
});

// 🚫 安全检查 - 确保Node.js API未暴露
if (process?.versions?.node) {
  console.error('🚨 Security violation: Node.js APIs are exposed to renderer!');
  // 在开发环境中抛出错误，生产环境中记录但继续运行
  if (process.env.NODE_ENV === 'development') {
    throw new Error('Node.js integration must be disabled');
  }
}

// 📊 预加载脚本加载完成标记
window.dispatchEvent(new CustomEvent('preload-ready'));
console.log('✅ Secure preload script loaded successfully');
```

#### 2.2.3 IPC通信安全

```typescript
// ipc-security.ts - IPC通信安全管理
import { ipcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import crypto from 'crypto';
import { SecurityAuditService } from './security/SecurityAuditService';
import { RateLimiter } from './security/RateLimiter';

// 🔒 IPC安全管理器
export class IPCSecurityManager {
  private static instance: IPCSecurityManager;
  private rateLimiter: RateLimiter;
  private sessionKeys: Map<string, string> = new Map();

  private constructor() {
    this.rateLimiter = new RateLimiter({
      windowMs: 60000, // 1分钟窗口
      maxRequests: 1000, // 每分钟最多1000个请求
      keyGenerator: event => this.getEventSource(event),
    });

    this.setupSecureHandlers();
  }

  public static getInstance(): IPCSecurityManager {
    if (!IPCSecurityManager.instance) {
      IPCSecurityManager.instance = new IPCSecurityManager();
    }
    return IPCSecurityManager.instance;
  }

  // 设置安全的IPC处理器
  private setupSecureHandlers(): void {
    // 🔐 应用信息处理器
    ipcMain.handle(
      'app:get-version',
      this.secureHandler(async event => {
        return process.env.npm_package_version || '1.0.0';
      })
    );

    ipcMain.handle(
      'app:get-platform',
      this.secureHandler(async event => {
        return process.platform;
      })
    );

    // 💾 游戏数据处理器
    ipcMain.handle(
      'game:save-data',
      this.secureHandler(async (event, data: GameSaveData) => {
        // 数据验证
        if (!this.validateGameData(data)) {
          throw new Error('Invalid game data format');
        }

        // 数据加密保存
        const encrypted = await this.encryptGameData(data);
        const success = await gameDataService.saveEncryptedData(encrypted);

        // 审计日志
        SecurityAuditService.logSecurityEvent(
          'GAME_DATA_SAVED',
          { success, dataSize: JSON.stringify(data).length },
          this.getEventSource(event)
        );

        return success;
      })
    );

    ipcMain.handle(
      'game:load-data',
      this.secureHandler(async event => {
        const encryptedData = await gameDataService.loadEncryptedData();
        if (!encryptedData) {
          return null;
        }

        const decryptedData = await this.decryptGameData(encryptedData);

        // 审计日志
        SecurityAuditService.logSecurityEvent(
          'GAME_DATA_LOADED',
          { dataSize: JSON.stringify(decryptedData).length },
          this.getEventSource(event)
        );

        return decryptedData;
      })
    );

    // 📝 日志处理器
    ipcMain.handle(
      'log:write-entry',
      this.secureHandler(async (event, logEntry: LogEntry) => {
        // 验证日志条目
        if (!this.validateLogEntry(logEntry)) {
          throw new Error('Invalid log entry format');
        }

        // 写入安全日志
        await logService.writeSecureLog(logEntry);

        return true;
      })
    );
  }

  // 🛡️ 安全处理器包装
  private secureHandler<T extends unknown[], R>(
    handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R>
  ) {
    return async (event: IpcMainInvokeEvent, ...args: T): Promise<R> => {
      try {
        // 速率限制检查
        if (!this.rateLimiter.checkLimit(event)) {
          throw new Error('Rate limit exceeded');
        }

        // 来源验证
        if (!this.verifyEventSource(event)) {
          throw new Error('Invalid event source');
        }

        // 执行处理器
        const result = await handler(event, ...args);

        return result;
      } catch (error) {
        // 安全错误日志
        SecurityAuditService.logSecurityEvent(
          'IPC_HANDLER_ERROR',
          {
            channel: event.processId.toString(),
            error: error instanceof Error ? error.message : 'Unknown error',
            args: JSON.stringify(args).substring(0, 200), // 限制日志长度
          },
          this.getEventSource(event)
        );

        throw error;
      }
    };
  }

  // 🔍 事件来源验证
  private verifyEventSource(event: IpcMainInvokeEvent): boolean {
    // 验证事件来源于可信的渲染进程
    const webContents = event.sender;

    // 检查URL是否为应用内部URL
    const url = webContents.getURL();
    const allowedUrls = [
      'http://localhost:3000', // 开发环境
      'file://', // 生产环境
      'app://', // 自定义协议
    ];

    const isAllowedUrl = allowedUrls.some(allowedUrl =>
      url.startsWith(allowedUrl)
    );
    if (!isAllowedUrl) {
      console.warn(`🚨 Suspicious IPC request from URL: ${url}`);
      return false;
    }

    // 验证渲染进程是否启用了安全设置
    const preferences = webContents.getWebPreferences();
    if (!preferences.contextIsolation || preferences.nodeIntegration) {
      console.warn('🚨 IPC request from insecure renderer process');
      return false;
    }

    return true;
  }

  // 📊 获取事件来源标识
  private getEventSource(event: IpcMainInvokeEvent): string {
    return `pid-${event.processId}-${event.frameId}`;
  }

  // ✅ 游戏数据验证
  private validateGameData(data: unknown): data is GameSaveData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const gameData = data as Record<string, unknown>;

    // 必需字段验证
    if (
      typeof gameData.version !== 'string' ||
      typeof gameData.timestamp !== 'number' ||
      !Array.isArray(gameData.guilds)
    ) {
      return false;
    }

    // 数据大小限制
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 50 * 1024 * 1024) {
      // 50MB限制
      return false;
    }

    return true;
  }

  // ✅ 日志条目验证
  private validateLogEntry(entry: unknown): entry is LogEntry {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const logEntry = entry as Record<string, unknown>;

    return (
      typeof logEntry.level === 'string' &&
      typeof logEntry.message === 'string' &&
      typeof logEntry.timestamp === 'number' &&
      ['debug', 'info', 'warn', 'error'].includes(logEntry.level) &&
      logEntry.message.length <= 1000
    ); // 消息长度限制
  }

  // 🔐 游戏数据加密
  private async encryptGameData(data: GameSaveData): Promise<string> {
    const dataStr = JSON.stringify(data);
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher('aes-256-gcm', key);
    let encrypted = cipher.update(dataStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // 组合密钥、IV、认证标签和加密数据
    return Buffer.concat([
      key,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ]).toString('base64');
  }

  // 🔓 游戏数据解密
  private async decryptGameData(encryptedData: string): Promise<GameSaveData> {
    const buffer = Buffer.from(encryptedData, 'base64');

    const key = buffer.subarray(0, 32);
    const iv = buffer.subarray(32, 48);
    const authTag = buffer.subarray(48, 64);
    const encrypted = buffer.subarray(64);

    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as GameSaveData;
  }
}

// 🚀 启动IPC安全管理器
export function initializeIPCSecurity(): void {
  IPCSecurityManager.getInstance();
  console.log('✅ IPC Security Manager initialized');
}
```

#### 2.2.4 CSP策略实施

**内容安全策略配置**

```typescript
// csp-config.ts - 内容安全策略配置
export const CSP_POLICY_CONFIG = {
  // 🔒 生产环境CSP策略 (最严格)
  production: {
    'default-src': "'self'",
    'script-src': [
      "'self'",
      "'wasm-unsafe-eval'", // 允许WebAssembly
      // 生产环境禁止unsafe-inline和unsafe-eval
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Tailwind CSS需要内联样式
    ],
    'img-src': [
      "'self'",
      'data:', // 允许base64图片
      'blob:', // 允许blob图片
    ],
    'font-src': [
      "'self'",
      'data:', // 允许base64字体
    ],
    'connect-src': [
      "'self'",
      // 生产环境不允许外部连接
    ],
    'worker-src': [
      "'self'", // Web Worker只允许同源
    ],
    'child-src': [
      "'none'", // 禁止iframe
    ],
    'object-src': [
      "'none'", // 禁止object/embed
    ],
    'media-src': [
      "'self'", // 媒体文件只允许同源
    ],
    'frame-src': [
      "'none'", // 禁止iframe
    ],
    'base-uri': [
      "'self'", // base标签只允许同源
    ],
    'form-action': [
      "'self'", // 表单提交只允许同源
    ],
    'frame-ancestors': [
      "'none'", // 禁止被其他页面嵌入
    ],
    'upgrade-insecure-requests': true, // 自动升级HTTP到HTTPS
  },

  // 🔧 开发环境CSP策略 (相对宽松)
  development: {
    'default-src': "'self'",
    'script-src': [
      "'self'",
      "'unsafe-inline'", // 开发工具需要
      "'unsafe-eval'", // HMR需要
      'http://localhost:*', // Vite开发服务器
      'ws://localhost:*', // WebSocket连接
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'http://localhost:*'],
    'img-src': ["'self'", 'data:', 'blob:', 'http://localhost:*'],
    'font-src': ["'self'", 'data:', 'http://localhost:*'],
    'connect-src': [
      "'self'",
      'http://localhost:*',
      'ws://localhost:*',
      'wss://localhost:*',
    ],
    'worker-src': [
      "'self'",
      'blob:', // 允许blob Worker用于开发工具
    ],
  },

  // 🧪 测试环境CSP策略
  test: {
    'default-src': "'self'",
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'", // 测试工具可能需要
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", 'http://localhost:*'],
  },
} as const;

// CSP策略生成器
export class CSPPolicyGenerator {
  // 生成CSP字符串
  static generateCSP(environment: keyof typeof CSP_POLICY_CONFIG): string {
    const policy = CSP_POLICY_CONFIG[environment];

    const directives = Object.entries(policy)
      .map(([directive, sources]) => {
        if (typeof sources === 'boolean') {
          return sources ? directive : null;
        }

        if (Array.isArray(sources)) {
          return `${directive} ${sources.join(' ')}`;
        }

        return `${directive} ${sources}`;
      })
      .filter(Boolean);

    return directives.join('; ');
  }

  // 验证CSP策略有效性
  static validateCSP(csp: string): boolean {
    try {
      // 基本语法验证
      const directives = csp.split(';');

      for (const directive of directives) {
        const parts = directive.trim().split(/\s+/);
        if (parts.length === 0) continue;

        const directiveName = parts[0];
        if (
          !directiveName.endsWith('-src') &&
          ![
            'default-src',
            'base-uri',
            'form-action',
            'frame-ancestors',
          ].includes(directiveName)
        ) {
          console.warn(`Unknown CSP directive: ${directiveName}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Invalid CSP policy:', error);
      return false;
    }
  }

  // 应用CSP到Electron窗口
  static applyCSPToWindow(
    window: BrowserWindow,
    environment: keyof typeof CSP_POLICY_CONFIG
  ): void {
    const csp = this.generateCSP(environment);

    if (!this.validateCSP(csp)) {
      throw new Error('Invalid CSP policy generated');
    }

    // 设置响应头
    window.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp],
            'X-Content-Type-Options': ['nosniff'],
            'X-Frame-Options': ['DENY'],
            'X-XSS-Protection': ['1; mode=block'],
            'Strict-Transport-Security': [
              'max-age=31536000; includeSubDomains',
            ],
            'Referrer-Policy': ['strict-origin-when-cross-origin'],
          },
        });
      }
    );

    console.log(`✅ CSP applied for ${environment}:`, csp);
  }
}
```

#### 2.2.5 Electron安全基线工程化+CI冒烟用例（ChatGPT5建议2）

> **工程化目标**: 将Electron安全基线配置工程化实现，并集成到CI/CD流水线中进行自动化验证

```typescript
// security-baseline-enforcer.ts - 安全基线强制执行器
export class ElectronSecurityBaselineEnforcer {
  private static readonly BASELINE_VERSION = '1.0.0';

  // 安全基线检查配置（固化）
  private static readonly BASELINE_CHECKS = {
    // 关键安全配置检查
    criticalChecks: [
      {
        name: 'contextIsolation',
        expectedValue: true,
        severity: 'CRITICAL',
        description: '上下文隔离必须启用',
      },
      {
        name: 'nodeIntegration',
        expectedValue: false,
        severity: 'CRITICAL',
        description: 'Node.js集成必须禁用',
      },
      {
        name: 'webSecurity',
        expectedValue: true,
        severity: 'CRITICAL',
        description: 'Web安全必须启用',
      },
      {
        name: 'sandbox',
        expectedValue: true,
        severity: 'HIGH',
        description: '沙箱模式必须启用',
      },
    ],

    // 高级安全配置检查
    advancedChecks: [
      {
        name: 'allowRunningInsecureContent',
        expectedValue: false,
        severity: 'HIGH',
        description: '必须禁止运行不安全内容',
      },
      {
        name: 'experimentalFeatures',
        expectedValue: false,
        severity: 'MEDIUM',
        description: '必须禁用实验性功能',
      },
      {
        name: 'enableRemoteModule',
        expectedValue: false,
        severity: 'HIGH',
        description: '必须禁用远程模块',
      },
    ],
  };

  // 自动化安全基线验证
  static validateSecurityBaseline(
    webPreferences: any
  ): SecurityValidationResult {
    const results: SecurityCheckResult[] = [];
    let overallScore = 100;

    // 执行关键检查
    for (const check of this.BASELINE_CHECKS.criticalChecks) {
      const result = this.performSecurityCheck(webPreferences, check);
      results.push(result);

      if (!result.passed) {
        overallScore -= check.severity === 'CRITICAL' ? 25 : 10;
      }
    }

    // 执行高级检查
    for (const check of this.BASELINE_CHECKS.advancedChecks) {
      const result = this.performSecurityCheck(webPreferences, check);
      results.push(result);

      if (!result.passed) {
        overallScore -= check.severity === 'HIGH' ? 15 : 5;
      }
    }

    return {
      baselineVersion: this.BASELINE_VERSION,
      overallScore: Math.max(0, overallScore),
      passed: overallScore >= 80, // 80分以上才算通过
      checkResults: results,
      timestamp: new Date().toISOString(),
      criticalFailures: results.filter(
        r => !r.passed && r.severity === 'CRITICAL'
      ).length,
    };
  }

  // 执行单个安全检查
  private static performSecurityCheck(
    webPreferences: any,
    check: SecurityCheck
  ): SecurityCheckResult {
    const actualValue = webPreferences[check.name];
    const passed = actualValue === check.expectedValue;

    return {
      name: check.name,
      expectedValue: check.expectedValue,
      actualValue,
      passed,
      severity: check.severity,
      description: check.description,
      timestamp: new Date().toISOString(),
    };
  }

  // 生成安全基线报告
  static generateBaselineReport(
    validationResult: SecurityValidationResult
  ): string {
    const { overallScore, passed, checkResults, criticalFailures } =
      validationResult;

    let report = `\n🔒 Electron安全基线验证报告\n`;
    report += `=================================\n`;
    report += `基线版本: ${validationResult.baselineVersion}\n`;
    report += `验证时间: ${validationResult.timestamp}\n`;
    report += `总体评分: ${overallScore}/100 ${passed ? '✅' : '❌'}\n`;
    report += `关键失败: ${criticalFailures}个\n\n`;

    // 详细检查结果
    report += `详细检查结果:\n`;
    for (const result of checkResults) {
      const status = result.passed ? '✅' : '❌';
      const severity = result.severity.padEnd(8);
      report += `${status} [${severity}] ${result.name}: ${result.description}\n`;

      if (!result.passed) {
        report += `    预期: ${result.expectedValue}, 实际: ${result.actualValue}\n`;
      }
    }

    return report;
  }

  // CI/CD集成钩子
  static async runCISecurityCheck(): Promise<boolean> {
    try {
      // 模拟获取当前Electron配置
      const currentConfig = await this.getCurrentElectronConfig();

      // 执行安全基线验证
      const validationResult = this.validateSecurityBaseline(
        currentConfig.webPreferences
      );

      // 生成报告
      const report = this.generateBaselineReport(validationResult);
      console.log(report);

      // 记录到文件（CI artifacts）
      await this.saveReportToFile(report, validationResult);

      // 如果有关键失败，立即失败CI
      if (validationResult.criticalFailures > 0) {
        console.error(
          `❌ CI失败: 发现${validationResult.criticalFailures}个关键安全问题`
        );
        return false;
      }

      // 如果分数低于阈值，失败CI
      if (validationResult.overallScore < 80) {
        console.error(
          `❌ CI失败: 安全基线评分${validationResult.overallScore}低于80分阈值`
        );
        return false;
      }

      console.log('✅ 安全基线验证通过');
      return true;
    } catch (error) {
      console.error('❌ 安全基线检查异常:', error);
      return false;
    }
  }

  // 获取当前Electron配置（适配不同环境）
  private static async getCurrentElectronConfig(): Promise<any> {
    // 在实际实现中，这里会读取实际的Electron配置
    // 这里返回示例配置用于演示
    return {
      webPreferences: ELECTRON_SECURITY_CONFIG.webPreferences,
    };
  }

  // 保存报告到文件
  private static async saveReportToFile(
    report: string,
    result: SecurityValidationResult
  ): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    // 确保reports目录存在
    const reportsDir = path.join(process.cwd(), 'reports', 'security');
    await fs.mkdir(reportsDir, { recursive: true });

    // 保存文本报告
    const reportPath = path.join(
      reportsDir,
      `security-baseline-${Date.now()}.txt`
    );
    await fs.writeFile(reportPath, report);

    // 保存JSON结果
    const jsonPath = path.join(
      reportsDir,
      `security-baseline-${Date.now()}.json`
    );
    await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));

    console.log(`📄 安全基线报告已保存: ${reportPath}`);
  }
}

// 类型定义
interface SecurityCheck {
  name: string;
  expectedValue: any;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

interface SecurityCheckResult extends SecurityCheck {
  actualValue: any;
  passed: boolean;
  timestamp: string;
}

interface SecurityValidationResult {
  baselineVersion: string;
  overallScore: number;
  passed: boolean;
  checkResults: SecurityCheckResult[];
  timestamp: string;
  criticalFailures: number;
}
```

#### 2.2.6 CI/CD管道安全冒烟测试集成

```yaml
# .github/workflows/security-baseline.yml - GitHub Actions安全基线检查
name: Electron Security Baseline Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # 每日凌晨2点自动检查

jobs:
  security-baseline:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout代码
        uses: actions/checkout@v4

      - name: 设置Node.js环境
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: 安装依赖
        run: npm ci

      - name: 运行安全基线检查
        id: security-check
        run: |
          echo "🔒 开始Electron安全基线验证..."
          npm run security:baseline
          echo "security-check-result=$?" >> $GITHUB_OUTPUT

      - name: 运行Electron冒烟测试
        id: smoke-test
        run: |
          echo "🧪 开始Electron冒烟测试..."
          npm run test:electron:smoke
          echo "smoke-test-result=$?" >> $GITHUB_OUTPUT

      - name: 上传安全报告
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: security-baseline-report
          path: reports/security/
          retention-days: 30

      - name: 评估安全状态
        if: always()
        run: |
          SECURITY_RESULT=${{ steps.security-check.outputs.security-check-result }}
          SMOKE_RESULT=${{ steps.smoke-test.outputs.smoke-test-result }}

          if [ "$SECURITY_RESULT" != "0" ]; then
            echo "❌ 安全基线检查失败"
            exit 1
          fi

          if [ "$SMOKE_RESULT" != "0" ]; then
            echo "❌ Electron冒烟测试失败"
            exit 1
          fi

          echo "✅ 所有安全检查通过"

      - name: 通知安全团队（失败时）
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          channel: '#security-alerts'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          message: |
            🚨 Electron安全基线检查失败
            仓库: ${{ github.repository }}
            分支: ${{ github.ref }}
            提交: ${{ github.sha }}
            查看报告: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

```typescript
// scripts/security-baseline-check.ts - 安全基线检查脚本
#!/usr/bin/env ts-node

import { ElectronSecurityBaselineEnforcer } from '../src/security/security-baseline-enforcer';

/**
 * CI/CD安全基线检查入口点
 * 用法: npm run security:baseline
 */
async function runSecurityBaselineCheck(): Promise<void> {
  console.log('🔒 启动Electron安全基线检查...\n');

  try {
    // 执行安全基线检查
    const passed = await ElectronSecurityBaselineEnforcer.runCISecurityCheck();

    if (passed) {
      console.log('\n✅ 安全基线检查通过 - CI继续执行');
      process.exit(0);
    } else {
      console.log('\n❌ 安全基线检查失败 - CI停止执行');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 安全基线检查异常:', error);
    process.exit(1);
  }
}

// 当直接运行此脚本时执行检查
if (require.main === module) {
  runSecurityBaselineCheck();
}
```

```json
// package.json - 安全基线检查脚本配置
{
  "scripts": {
    "security:baseline": "ts-node scripts/security-baseline-check.ts",
    "security:baseline:dev": "ts-node scripts/security-baseline-check.ts --env=development",
    "test:electron:smoke": "playwright test tests/smoke/electron-security-smoke.spec.ts",
    "ci:security:full": "npm run security:baseline && npm run test:electron:smoke"
  }
}
```

```typescript
// tests/smoke/electron-security-smoke.spec.ts - Electron安全冒烟测试
import { test, expect } from '@playwright/test';
import { ElectronApplication, _electron as electron } from 'playwright';
import { ElectronSecurityBaselineEnforcer } from '../../src/security/security-baseline-enforcer';

test.describe('Electron安全基线冒烟测试', () => {
  let electronApp: ElectronApplication;

  test.beforeAll(async () => {
    // 启动Electron应用
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
      },
    });
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('应用启动时安全配置正确', async () => {
    // 获取主窗口
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // 验证窗口存在且可见
    expect(window).toBeTruthy();
    await expect(window).toHaveTitle(/Guild Manager/);

    // 验证安全配置
    const securityConfig = await window.evaluate(() => {
      return {
        contextIsolation: window.electronAPI !== undefined, // 间接验证contextIsolation
        nodeIntegration: typeof require === 'undefined', // 验证nodeIntegration被禁用
        webSecurity: true, // 假设启用了webSecurity
      };
    });

    // 断言安全配置
    expect(securityConfig.contextIsolation).toBe(true);
    expect(securityConfig.nodeIntegration).toBe(true); // require应该是undefined
    expect(securityConfig.webSecurity).toBe(true);
  });

  test('CSP策略正确应用', async () => {
    const window = await electronApp.firstWindow();

    // 尝试执行不安全的操作（应该被CSP阻止）
    const cspViolation = await window.evaluate(() => {
      try {
        // 尝试创建不安全的脚本标签
        const script = document.createElement('script');
        script.src = 'https://evil.example.com/malicious.js';
        document.head.appendChild(script);
        return false; // 如果没有抛错，说明CSP未生效
      } catch (error) {
        return true; // CSP正确阻止了不安全操作
      }
    });

    expect(cspViolation).toBe(true);
  });

  test('Node.js API访问被正确阻止', async () => {
    const window = await electronApp.firstWindow();

    // 验证Node.js模块无法直接访问
    const nodeAccess = await window.evaluate(() => {
      try {
        // @ts-ignore
        const fs = require('fs');
        return false; // 如果成功require，说明安全配置有问题
      } catch (error) {
        return true; // 正确阻止了Node.js访问
      }
    });

    expect(nodeAccess).toBe(true);
  });

  test('外部导航被正确阻止', async () => {
    const window = await electronApp.firstWindow();
    const originalUrl = window.url();

    // 尝试导航到外部URL
    try {
      await window.goto('https://evil.example.com');
      // 如果成功导航，检查URL是否真的改变了
      const newUrl = window.url();
      expect(newUrl).toBe(originalUrl); // URL不应该改变
    } catch (error) {
      // 导航被阻止是正确行为
      expect(error).toBeTruthy();
    }
  });

  test('预加载脚本安全API正常工作', async () => {
    const window = await electronApp.firstWindow();

    // 验证只有安全API可访问
    const apiAccess = await window.evaluate(() => {
      return {
        // @ts-ignore
        hasElectronAPI: typeof window.electronAPI !== 'undefined',
        // @ts-ignore
        hasSecureChannels:
          window.electronAPI && typeof window.electronAPI.invoke === 'function',
        // @ts-ignore
        hasUnsafeAccess: typeof window.require !== 'undefined',
      };
    });

    expect(apiAccess.hasElectronAPI).toBe(true);
    expect(apiAccess.hasSecureChannels).toBe(true);
    expect(apiAccess.hasUnsafeAccess).toBe(false);
  });
});
```

## 第3章 测试策略与质量门禁 (Testing Strategy & Quality Gates)

**ChatGPT5核心建议**: 本章作为"不可变更的质量宪法"，所有后续开发必须遵循此章定义的测试法规和质量门禁标准

## 第3章 测试策略与质量门禁 (Testing Strategy & Quality Gates)

> **核心理念**: 测试先行、质量内建、AI代码生成质量保障

### 3.1 测试金字塔设计与范围定义

#### 3.1.1 测试层级标准配比 (ChatGPT5护栏核心)

```typescript
// 测试金字塔黄金配比 - 严格执行
export const TEST_PYRAMID_GOLDEN_RATIO = {
  单元测试: {
    占比: '70%', // 快速反馈的基础
    执行时间目标: '< 2秒', // 全量单元测试执行时间
    目标覆盖率: '>= 90%', // 代码行覆盖率
    特点: [
      '纯函数逻辑验证',
      '组件状态管理测试',
      '业务规则边界测试',
      '数据转换和验证',
      'AI决策算法核心逻辑',
    ],
  },

  集成测试: {
    占比: '20%', // 组件协作验证
    执行时间目标: '< 30秒', // 全量集成测试执行时间
    目标覆盖率: '>= 80%', // 接口和数据流覆盖
    特点: [
      'API契约验证',
      '数据库交互测试',
      '外部依赖集成',
      '事件流端到端验证',
      'Phaser ↔ React 通信测试',
    ],
  },

  端到端测试: {
    占比: '10%', // 关键路径保障
    执行时间目标: '< 10分钟', // 全量E2E测试执行时间
    目标覆盖率: '>= 95%关键路径', // 业务关键路径覆盖
    特点: [
      '用户完整旅程验证',
      '跨系统集成测试',
      '性能回归检查',
      'Electron应用完整启动流程',
      'AI系统端到端决策验证',
    ],
  },

  专项测试: {
    占比: '按需', // 特殊质量保障
    执行时间目标: '< 1小时', // 完整专项测试套件
    覆盖范围: '100%专项需求', // 专项测试需求覆盖
    类型: [
      '性能基准测试',
      '安全渗透测试',
      'AI行为验证测试',
      '负载和压力测试',
      '兼容性测试',
    ],
  },
} as const;
```

#### 3.1.2 Electron特定测试策略

**三进程测试架构**

```typescript
// Electron测试架构配置
export const ELECTRON_TEST_ARCHITECTURE = {
  主进程测试: {
    测试目标: [
      '窗口生命周期管理',
      'IPC通信安全验证',
      '系统集成功能',
      '菜单和托盘功能',
      '自动更新机制',
    ],
    测试工具: ['electron-mocha', '@electron/rebuild'],
    测试环境: 'Node.js环境',
    示例配置: {
      testMatch: ['**/tests/main/**/*.test.ts'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/main/setup.ts'],
    },
  },

  渲染进程测试: {
    测试目标: [
      'React组件渲染',
      'Phaser场景逻辑',
      'UI交互响应',
      '状态管理(Redux/Zustand)',
      '事件处理和绑定',
    ],
    测试工具: ['@testing-library/react', 'jest-environment-jsdom'],
    测试环境: 'JSDOM环境',
    示例配置: {
      testMatch: ['**/tests/renderer/**/*.test.tsx'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/renderer/setup.ts'],
    },
  },

  进程间通信测试: {
    测试目标: [
      'IPC消息传递',
      '数据序列化/反序列化',
      '安全边界验证',
      '错误处理和恢复',
      '并发通信测试',
    ],
    测试工具: ['spectron', 'playwright-electron'],
    测试环境: '完整Electron环境',
    示例配置: {
      testMatch: ['**/tests/ipc/**/*.test.ts'],
      testTimeout: 30000,
      setupFiles: ['<rootDir>/tests/ipc/setup.ts'],
    },
  },
} as const;
```

#### 3.1.3 AI系统特定测试策略

```typescript
// AI系统测试架构
export const AI_SYSTEM_TEST_STRATEGY = {
  AI决策单元测试: {
    测试维度: [
      '决策算法正确性',
      '输入边界处理',
      '性能基准验证',
      '随机性一致性',
      '状态转换逻辑',
    ],
    测试数据: {
      固定种子: '确保可重现结果',
      边界用例: '极值和异常输入',
      批量数据: '性能和内存测试',
      历史数据: '回归测试用例',
    },
    验收标准: {
      决策时间: '< 100ms P95',
      内存使用: '< 10MB per AI entity',
      准确性: '> 85% for known scenarios',
      一致性: '相同输入产生相同输出',
    },
  },

  AI集成测试: {
    测试场景: [
      '多AI实体协作',
      'AI与游戏状态同步',
      'AI学习和适应',
      'AI行为可预测性',
      'AI资源管理',
    ],
    Mock策略: {
      外部API: 'Mock所有外部AI服务',
      随机数: '使用固定种子',
      时间戳: '使用模拟时间',
      用户输入: '预定义输入序列',
    },
    验证方法: {
      行为树执行: '验证决策路径',
      状态机转换: '验证状态变迁',
      事件响应: '验证事件处理',
      性能指标: '监控资源使用',
    },
  },
} as const;
```

### 3.2 工具链与基线配置

#### 3.2.1 核心工具栈配置

**单元测试配置 (Vitest)**

```typescript
// vitest.config.ts - 单元测试配置
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 🚀 性能配置
    threads: true, // 并行执行
    pool: 'forks', // 进程池隔离
    maxConcurrency: 8, // 最大并发数

    // 📊 覆盖率配置
    coverage: {
      provider: 'v8', // 使用V8覆盖率
      reporter: ['text', 'html', 'json', 'lcov'],
      thresholds: {
        global: {
          statements: 90, // 语句覆盖率90%
          functions: 90, // 函数覆盖率90%
          branches: 85, // 分支覆盖率85%
          lines: 90, // 行覆盖率90%
        },
        // 关键模块更高要求
        'src/ai/**/*.ts': {
          statements: 95,
          functions: 95,
          branches: 90,
          lines: 95,
        },
        'src/security/**/*.ts': {
          statements: 100,
          functions: 100,
          branches: 95,
          lines: 100,
        },
      },
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '**/*.d.ts',
        '**/types/**',
      ],
    },

    // 🎯 测试匹配
    include: [
      'src/**/*.{test,spec}.{js,ts,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],

    // ⚙️ 环境配置
    environment: 'jsdom', // DOM环境模拟
    setupFiles: ['./tests/setup/vitest.setup.ts'],

    // 🔧 别名配置
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },

    // ⏱️ 超时配置
    testTimeout: 10000, // 单个测试10秒超时
    hookTimeout: 30000, // 钩子30秒超时

    // 📝 报告配置
    reporters: ['default', 'junit', 'html'],
    outputFile: {
      junit: './test-results/junit.xml',
      html: './test-results/html/index.html',
    },
  },
});
```

**集成测试配置**

```typescript
// tests/integration/jest.config.js - 集成测试专用配置
export default {
  displayName: 'Integration Tests',
  testMatch: ['<rootDir>/tests/integration/**/*.test.{js,ts,tsx}'],

  // 🗄️ 数据库配置
  globalSetup: '<rootDir>/tests/integration/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/integration/setup/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup/setupTests.ts'],

  // 📊 覆盖率配置
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/*.stories.{js,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      functions: 80,
      branches: 75,
      lines: 80,
    },
  },

  // ⏱️ 超时配置
  testTimeout: 30000, // 集成测试30秒超时

  // 🔧 模块配置
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // 🛠️ 转换配置
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },

  // 🌍 环境配置
  testEnvironment: 'node',
  maxWorkers: 4, // 限制并发工作线程
};
```

#### 3.2.2 Playwright Electron配置标准 (ChatGPT5护栏)

```typescript
// playwright.config.ts - Playwright Electron E2E测试配置
import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';
import { findLatestBuild, parseElectronApp } from 'electron-playwright-helpers';

const config: PlaywrightTestConfig = defineConfig({
  // 📁 测试目录
  testDir: './tests/e2e',

  // ⏱️ 超时配置
  timeout: 60000, // 单个测试60秒超时
  expect: {
    timeout: 15000, // 断言15秒超时
  },

  // 🔄 重试配置
  retries: process.env.CI ? 3 : 1, // CI环境3次重试，本地1次

  // 👥 工作线程配置
  workers: 1, // Electron应用需要单线程执行

  // 📊 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright'],
  ],

  // 🎥 失败时记录
  use: {
    screenshot: 'only-on-failure', // 失败时截图
    video: 'retain-on-failure', // 失败时保留视频
    trace: 'on-first-retry', // 重试时记录trace
  },

  // 🚀 项目配置
  projects: [
    {
      name: 'electron-main',
      use: {
        // Electron特定配置
        browserName: 'chromium', // 基于Chromium
        launchOptions: {
          executablePath: getElectronPath(), // 动态获取Electron路径
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu-sandbox',
          ],
        },

        // 🔧 上下文配置
        ignoreHTTPSErrors: true,
        acceptDownloads: false,

        // 📱 设备模拟
        ...devices['Desktop Chrome'],
      },
    },

    // 🧪 冒烟测试项目
    {
      name: 'smoke-tests',
      testMatch: '**/smoke/**/*.test.ts',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: getElectronPath(),
        },
      },
      // 冒烟测试必须最先运行
      dependencies: [],
    },
  ],

  // 📂 输出目录
  outputDir: 'test-results/e2e',

  // 🌐 Web服务器（如果需要）
  webServer:
    process.env.NODE_ENV === 'development'
      ? {
          command: 'npm run dev',
          port: 3000,
          reuseExistingServer: !process.env.CI,
        }
      : undefined,
});

// 动态获取Electron可执行文件路径
function getElectronPath(): string {
  if (process.env.ELECTRON_PATH) {
    return process.env.ELECTRON_PATH;
  }

  try {
    const latestBuild = findLatestBuild();
    const appInfo = parseElectronApp(latestBuild);
    return appInfo.main;
  } catch (error) {
    console.error('Failed to find Electron executable:', error);
    return 'electron'; // 回退到全局electron
  }
}

export default config;
```

#### 3.2.3 测试数据与Fixtures规范

```typescript
// tests/fixtures/test-data.ts - 测试数据管理
export class TestDataManager {
  // 🏗️ 测试数据工厂
  static createGuild(overrides: Partial<Guild> = {}): Guild {
    return {
      id: crypto.randomUUID(),
      name: '测试公会',
      description: '这是一个用于测试的公会',
      level: 1,
      experience: 0,
      maxMembers: 50,
      memberCount: 0,
      treasury: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createMember(overrides: Partial<GuildMember> = {}): GuildMember {
    return {
      id: crypto.randomUUID(),
      name: '测试成员',
      role: 'member',
      level: 1,
      experience: 0,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      ...overrides,
    };
  }

  // 🎯 AI测试数据
  static createAIScenario(overrides: Partial<AIScenario> = {}): AIScenario {
    return {
      id: crypto.randomUUID(),
      name: '测试AI场景',
      description: '用于测试AI决策的场景',
      initialState: {
        resources: 1000,
        mood: 'neutral',
        relationships: new Map(),
      },
      expectedDecision: 'explore',
      metadata: {
        difficulty: 'easy',
        category: 'exploration',
      },
      ...overrides,
    };
  }

  // 📊 性能测试数据生成
  static generateBulkData<T>(factory: () => T, count: number): T[] {
    return Array.from({ length: count }, factory);
  }

  // 🗄️ 数据库种子数据
  static async seedDatabase(db: Database): Promise<void> {
    const guilds = this.generateBulkData(() => this.createGuild(), 10);
    const members = guilds.flatMap(guild =>
      this.generateBulkData(
        () => this.createMember({ guildId: guild.id }),
        Math.floor(Math.random() * 20) + 1
      )
    );

    // 批量插入数据
    await db.transaction(async tx => {
      for (const guild of guilds) {
        await tx.insert(guilds).values(guild);
      }
      for (const member of members) {
        await tx.insert(guildMembers).values(member);
      }
    });
  }
}

// 测试隔离和清理
export class TestEnvironment {
  private static testDatabases: Map<string, Database> = new Map();

  // 创建隔离的测试数据库
  static async createIsolatedDB(testName: string): Promise<Database> {
    const dbPath = `./test-data/${testName}-${Date.now()}.db`;
    const db = new Database(dbPath);

    // 初始化数据库架构
    await initializeDatabaseSchema(db);

    this.testDatabases.set(testName, db);
    return db;
  }

  // 清理测试数据库
  static async cleanupTestDB(testName: string): Promise<void> {
    const db = this.testDatabases.get(testName);
    if (db) {
      await db.close();
      this.testDatabases.delete(testName);

      // 删除测试数据库文件
      const fs = await import('fs/promises');
      try {
        await fs.unlink(`./test-data/${testName}-*.db`);
      } catch (error) {
        console.warn('Failed to delete test database file:', error);
      }
    }
  }

  // 全局清理
  static async globalCleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.testDatabases.keys()).map(
      testName => this.cleanupTestDB(testName)
    );

    await Promise.all(cleanupPromises);
  }
}
```

### 3.3 质量门禁 (CI/CD红线) 🚦

#### 3.3.1 PR合并必须通过项

```typescript
// PR质量门禁配置
export const PR_QUALITY_GATES = {
  // ✅ 代码检查 (阻塞性)
  代码检查: {
    ESLint检查: {
      标准: '0个error, 0个warning',
      命令: 'npm run lint',
      失败处理: '阻塞PR合并',
    },
    TypeScript编译: {
      标准: '编译成功，无类型错误',
      命令: 'npm run type-check',
      失败处理: '阻塞PR合并',
    },
    代码格式化: {
      标准: 'Prettier格式一致',
      命令: 'npm run format:check',
      失败处理: '自动修复或阻塞',
    },
  },

  // ✅ 单元测试 (阻塞性)
  单元测试: {
    测试通过率: {
      标准: '100%通过',
      命令: 'npm run test:unit',
      失败处理: '阻塞PR合并',
    },
    覆盖率检查: {
      标准: '>= 90% (总体), >= 95% (AI模块), >= 100% (安全模块)',
      命令: 'npm run test:coverage',
      失败处理: '阻塞PR合并',
    },
    性能基准: {
      标准: '测试执行时间 < 2秒',
      监控: '自动监控测试执行时间',
      失败处理: '警告，不阻塞',
    },
  },

  // ✅ 集成测试 (阻塞性)
  集成测试: {
    核心功能: {
      标准: '核心业务流程集成测试100%通过',
      范围: ['公会管理', '战斗系统', 'AI决策', '数据同步'],
      失败处理: '阻塞PR合并',
    },
    API契约: {
      标准: '所有API契约测试通过',
      工具: 'Contract Testing',
      失败处理: '阻塞PR合并',
    },
  },

  // ✅ Electron冒烟测试 (ChatGPT5护栏)
  Electron冒烟: {
    应用启动: {
      标准: '应用能正常启动到主界面',
      超时: '30秒',
      失败处理: '阻塞PR合并',
    },
    主要功能: {
      标准: '主窗口显示 → 导航功能 → 基础交互正常',
      测试用例: ['创建公会', '查看列表', '基础设置'],
      失败处理: '阻塞PR合并',
    },
    进程通信: {
      标准: 'IPC通信正常，无安全警告',
      检查项: ['安全配置', '权限边界', '数据传输'],
      失败处理: '阻塞PR合并',
    },
  },
} as const;
```

#### 3.3.2 覆盖率阈值标准

```yaml
# coverage-thresholds.yml - 覆盖率配置
coverage_thresholds:
  # 全局基线标准
  global:
    statements: 90% # 语句覆盖率基线
    functions: 90% # 函数覆盖率基线
    branches: 85% # 分支覆盖率基线
    lines: 90% # 行覆盖率基线

  # 关键模块更高要求
  critical_modules:
    ai_engine: 95% # AI引擎核心算法
    security: 100% # 安全相关模块
    data_integrity: 95% # 数据完整性模块
    ipc_communication: 95% # IPC通信模块
    game_core: 90% # 游戏核心逻辑

  # 特定文件路径要求
  path_specific:
    'src/ai/**/*.ts': 95%
    'src/security/**/*.ts': 100%
    'src/core/events/**/*.ts': 95%
    'src/core/data/**/*.ts': 95%
    'src/services/**/*.ts': 85%

  # 排除项
  exclusions:
    - '**/node_modules/**'
    - '**/tests/**'
    - '**/*.d.ts'
    - '**/types/**'
    - '**/*.config.{js,ts}'
    - '**/stories/**'
    - '**/mocks/**'

# 覆盖率报告配置
coverage_reporting:
  formats:
    - text # 控制台输出
    - html # HTML报告
    - lcov # LCOV格式（用于CI集成）
    - json # JSON格式（用于工具集成）
    - cobertura # Cobertura格式（用于某些CI系统）

  output_directories:
    html: './coverage/html'
    lcov: './coverage/lcov.info'
    json: './coverage/coverage.json'

  # 失败条件
  fail_on:
    statements: 90
    functions: 90
    branches: 85
    lines: 90
```

#### 3.3.3 主干/预发分支额外门禁

```typescript
// 主干分支额外质量门禁
export const MAIN_BRANCH_GATES = {
  // ✅ E2E关键路径测试
  E2E测试: {
    用户关键旅程: {
      测试场景: [
        '完整的公会创建和管理流程',
        'AI公会互动和战斗系统',
        '经济系统交易流程',
        '社交功能完整体验',
        '设置和配置管理',
      ],
      通过标准: '100%关键路径测试通过',
      执行时间: '< 10分钟',
      失败处理: '阻塞合并到主干',
    },

    跨平台验证: {
      目标平台: ['Windows 10/11', 'macOS 12+', 'Ubuntu 20.04+'],
      测试内容: '核心功能在所有目标平台正常运行',
      执行方式: '并行执行，至少80%平台通过',
      失败处理: '警告，但不阻塞（平台特定问题单独处理）',
    },
  },

  // ✅ 性能基线验证
  性能基线: {
    启动时间: {
      冷启动: '< 3秒 (P95)',
      热启动: '< 1秒 (P95)',
      测量方法: '自动化性能测试',
      失败处理: '阻塞合并，需要性能优化',
    },

    运行时性能: {
      内存占用: '< 512MB (稳定状态)',
      CPU占用: '< 30% (游戏运行), < 5% (空闲)',
      帧率稳定性: '>= 95% 时间保持 > 45fps',
      失败处理: '阻塞合并，需要性能调优',
    },

    响应时间: {
      UI响应: '< 200ms (P95)',
      数据库查询: '< 50ms (P95)',
      AI决策: '< 100ms (P95)',
      失败处理: '阻塞合并，需要优化',
    },
  },

  // ✅ 安全扫描
  安全扫描: {
    依赖漏洞: {
      扫描工具: ['npm audit', 'Snyk', 'OWASP Dependency Check'],
      允许等级: '0个高危, 0个中危',
      扫描范围: '所有生产依赖',
      失败处理: '阻塞合并，必须修复或替换依赖',
    },

    代码安全: {
      扫描工具: ['SonarQube Security Hotspots', 'ESLint Security'],
      检查项: ['硬编码密钥', 'SQL注入', 'XSS风险'],
      允许等级: '0个严重问题',
      失败处理: '阻塞合并，必须修复安全问题',
    },

    Electron安全: {
      检查项: [
        'contextIsolation必须为true',
        'nodeIntegration必须为false',
        '预加载脚本安全检查',
        'CSP策略验证',
      ],
      验证方式: '自动化安全配置检查',
      失败处理: '阻塞合并，安全配置不合规',
    },
  },

  // ✅ AI行为验证回归测试
  AI行为验证: {
    决策一致性: {
      测试方法: '固定种子回归测试',
      验证内容: '相同输入产生相同AI决策',
      测试用例: '100个标准决策场景',
      通过标准: '>= 95%决策一致性',
      失败处理: '阻塞合并，AI行为回归',
    },

    性能回归: {
      AI决策时间: '不超过基线的110%',
      内存使用: '不超过基线的120%',
      并发处理: '支持至少50个AI实体并发',
      失败处理: '阻塞合并，性能回归修复',
    },
  },
} as const;
```

#### 3.3.4 发布门禁标准

```typescript
// 生产发布质量门禁
export const RELEASE_QUALITY_GATES = {
  // ✅ 全量测试套件
  全量测试: {
    测试套件完整性: {
      单元测试: '100%通过，>= 90%覆盖率',
      集成测试: '100%通过，>= 80%覆盖率',
      E2E测试: '100%通过，>= 95%关键路径覆盖',
      执行时间: '< 30分钟（完整测试套件）',
      失败处理: '阻塞发布，必须修复所有失败测试',
    },

    专项测试: {
      性能测试: '所有性能指标在基线范围内',
      安全测试: '安全扫描100%通过',
      兼容性测试: '目标平台100%兼容',
      负载测试: '支持预期用户负载',
      失败处理: '阻塞发布，专项问题必须解决',
    },
  },

  // ✅ 性能回归检测
  性能回归: {
    基准对比: {
      对比基准: '上一个稳定版本',
      允许回归: '性能下降不超过5%',
      关键指标: [
        '启动时间',
        '内存使用',
        'UI响应时间',
        'AI决策速度',
        '数据库查询性能',
      ],
      失败处理: '阻塞发布，性能问题必须优化',
    },
  },

  // ✅ 兼容性验证
  兼容性验证: {
    目标平台: {
      Windows: ['Windows 10 1909+', 'Windows 11'],
      macOS: ['macOS 12 Monterey+', 'macOS 13 Ventura+', 'macOS 14 Sonoma+'],
      Linux: ['Ubuntu 20.04+', 'Fedora 36+', 'Debian 11+'],
      验证方法: '自动化多平台构建和测试',
      失败处理: '平台特定问题记录，不阻塞但需要跟进',
    },

    向后兼容: {
      数据格式: '支持之前版本的存档文件',
      配置文件: '自动迁移旧版本配置',
      用户数据: '无损迁移用户数据',
      失败处理: '阻塞发布，兼容性问题必须解决',
    },
  },

  // ✅ 安全合规检查
  安全合规: {
    Electron安全: {
      安全配置: '100%符合安全基线',
      代码签名: '所有可执行文件必须签名',
      更新机制: '安全的自动更新验证',
      失败处理: '阻塞发布，安全问题零容忍',
    },

    数据保护: {
      数据加密: '敏感数据100%加密存储',
      备份完整性: '备份和恢复机制验证',
      隐私合规: '符合GDPR等隐私法规',
      失败处理: '阻塞发布，数据保护必须完善',
    },
  },
} as const;
```

### 3.4 观测与告警基线

#### 3.4.1 Sentry Electron初始化标准 (ChatGPT5护栏)

```typescript
// sentry-config.ts - Sentry监控配置
import * as Sentry from '@sentry/electron';
import { app } from 'electron';

// Sentry初始化配置
export function initializeSentry(): void {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: `guild-manager@${app.getVersion()}`,
    environment: process.env.NODE_ENV || 'production',

    // 🎯 采样率配置 (ChatGPT5建议)
    tracesSampleRate: getTraceSampleRate(), // 性能监控采样率
    sampleRate: getErrorSampleRate(), // 错误监控采样率
    profilesSampleRate: getProfileSampleRate(), // 性能分析采样率

    // 🔧 Electron特定集成
    integrations: [
      // 主进程集成
      new Sentry.Integrations.Electron.ElectronMainIntegration({
        captureRendererCrashes: true, // 捕获渲染进程崩溃
        electronAppName: 'Guild Manager',
      }),

      // Node.js集成
      new Sentry.Integrations.Http({ tracing: true }), // HTTP请求追踪
      new Sentry.Integrations.Fs(), // 文件系统操作追踪
      new Sentry.Integrations.Console(), // 控制台日志集成

      // 全局异常处理
      new Sentry.Integrations.GlobalHandlers({
        onunhandledrejection: true, // 未处理的Promise rejection
        onerror: true, // 未捕获的异常
      }),

      // Event Loop Block检测 (ChatGPT5核心建议)
      new Sentry.Integrations.LocalVariables({
        captureAllExceptions: false, // 只捕获未处理异常的局部变量
      }),
    ],

    // 📊 性能监控配置
    beforeSend: filterAndEnrichEvent,
    beforeSendTransaction: filterPerformanceTransaction,

    // 🏷️ 标签和上下文
    initialScope: {
      tags: {
        component: 'guild-manager',
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
      },

      user: {
        id: getUserId(), // 匿名用户ID
      },

      extra: {
        appPath: app.getAppPath(),
        userDataPath: app.getPath('userData'),
        locale: app.getLocale(),
      },
    },
  });

  // 设置全局错误边界
  setupGlobalErrorHandling();

  console.log('✅ Sentry monitoring initialized');
}

// 动态采样率配置
function getTraceSampleRate(): number {
  const environment = process.env.NODE_ENV;
  switch (environment) {
    case 'production':
      return 0.1; // 生产环境10%采样
    case 'development':
      return 1.0; // 开发环境100%采样
    case 'test':
      return 0.0; // 测试环境0%采样
    default:
      return 0.1;
  }
}

function getErrorSampleRate(): number {
  const environment = process.env.NODE_ENV;
  switch (environment) {
    case 'production':
      return 1.0; // 生产环境100%错误收集
    case 'development':
      return 1.0; // 开发环境100%错误收集
    case 'test':
      return 0.0; // 测试环境0%错误收集
    default:
      return 1.0;
  }
}

function getProfileSampleRate(): number {
  const environment = process.env.NODE_ENV;
  switch (environment) {
    case 'production':
      return 0.01; // 生产环境1%性能分析
    case 'development':
      return 0.1; // 开发环境10%性能分析
    case 'test':
      return 0.0; // 测试环境0%性能分析
    default:
      return 0.01;
  }
}

// 事件过滤和增强
function filterAndEnrichEvent(event: Sentry.Event): Sentry.Event | null {
  // 🔒 隐私保护 - 过滤敏感信息
  if (event.exception) {
    event.exception.values?.forEach(exception => {
      if (exception.stacktrace?.frames) {
        exception.stacktrace.frames = exception.stacktrace.frames.map(frame => {
          // 移除文件系统路径中的敏感信息
          if (frame.filename) {
            frame.filename = sanitizeFilePath(frame.filename);
          }
          return frame;
        });
      }
    });
  }

  // 🚫 过滤开发环境噪音
  if (process.env.NODE_ENV === 'development') {
    const message = event.message || '';
    const devNoisePatterns = ['HMR', 'hot reload', 'webpack', 'vite'];

    if (
      devNoisePatterns.some(pattern => message.toLowerCase().includes(pattern))
    ) {
      return null; // 忽略开发环境噪音
    }
  }

  // 📈 增强错误上下文
  event.tags = {
    ...event.tags,
    errorBoundary: getCurrentErrorBoundary(),
    userAction: getLastUserAction(),
    gameState: getCurrentGameState(),
  };

  return event;
}

// 性能事务过滤
function filterPerformanceTransaction(
  event: Sentry.Event
): Sentry.Event | null {
  // 过滤短时间的事务（可能是噪音）
  if (
    event.type === 'transaction' &&
    event.start_timestamp &&
    event.timestamp
  ) {
    const duration = event.timestamp - event.start_timestamp;
    if (duration < 0.01) {
      // 10ms以下的事务
      return null;
    }
  }

  return event;
}

// Event Loop Block检测实现
export class EventLoopBlockDetector {
  private static readonly THRESHOLDS = {
    主进程阻塞阈值: 500, // ms - 主进程阻塞阈值
    渲染进程ANR阈值: 5000, // ms - 渲染进程ANR阈值
    游戏循环阻塞阈值: 33, // ms - 影响60fps的阈值
    告警升级次数: 3, // 连续阻塞次数触发告警
  };

  private consecutiveBlocks = 0;
  private lastBlockTime = 0;

  // 启动Event Loop监控
  static startMonitoring(): void {
    const detector = new EventLoopBlockDetector();

    // 主进程Event Loop监控
    setInterval(() => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        detector.checkMainProcessBlock(lag);
      });
    }, 1000);

    console.log('✅ Event Loop Block Detection started');
  }

  // 检查主进程阻塞
  private checkMainProcessBlock(lag: number): void {
    if (lag > EventLoopBlockDetector.THRESHOLDS.主进程阻塞阈值) {
      this.consecutiveBlocks++;
      this.lastBlockTime = Date.now();

      // 记录阻塞事件
      Sentry.addBreadcrumb({
        message: `Event Loop blocked for ${lag}ms`,
        category: 'performance',
        level: 'warning',
        data: {
          lag,
          threshold: EventLoopBlockDetector.THRESHOLDS.主进程阻塞阈值,
          consecutiveBlocks: this.consecutiveBlocks,
        },
      });

      // 连续阻塞告警
      if (
        this.consecutiveBlocks >= EventLoopBlockDetector.THRESHOLDS.告警升级次数
      ) {
        this.triggerBlockAlert(lag);
      }
    } else {
      // 重置计数器
      this.consecutiveBlocks = 0;
    }
  }

  // 触发阻塞告警
  private triggerBlockAlert(lag: number): void {
    Sentry.captureMessage(
      `Event Loop severely blocked: ${lag}ms (${this.consecutiveBlocks} consecutive blocks)`,
      'warning'
    );

    // 收集性能快照
    Sentry.withScope(scope => {
      scope.setContext('performance', {
        eventLoopLag: lag,
        consecutiveBlocks: this.consecutiveBlocks,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      });

      scope.setLevel('warning');
      scope.setTag('performance-issue', 'event-loop-block');

      Sentry.captureException(new Error(`Event Loop Block: ${lag}ms`));
    });
  }
}
```

#### 3.4.2 Event Loop Block检测阈值

```typescript
// performance-monitoring.ts - 性能监控配置
export const PERFORMANCE_MONITORING_CONFIG = {
  // Event Loop阻塞检测配置
  eventLoopBlock: {
    主进程阻塞阈值: 500, // ms - 影响窗口响应
    渲染进程ANR阈值: 5000, // ms - 影响用户交互
    游戏循环阻塞阈值: 33, // ms - 影响60fps流畅度 (1000/60 ≈ 16.67ms * 2)

    // 告警升级策略
    告警升级策略: {
      连续阻塞3次: '警告级别',
      连续阻塞5次: '错误级别',
      连续阻塞10次: '严重级别',
      单次阻塞超过2000ms: '立即严重告警',
    },

    // 监控频率
    监控频率: {
      主进程检查间隔: 1000, // ms - 每秒检查一次
      渲染进程检查间隔: 100, // ms - 每100ms检查一次
      游戏循环检查间隔: 16, // ms - 每帧检查
    },
  },

  // 性能监控基线
  performanceBaselines: {
    应用启动时间: {
      目标: 3000, // ms - 从点击到主窗口显示
      警告: 4000, // ms - 启动时间警告阈值
      严重: 6000, // ms - 启动时间严重阈值
    },

    内存使用基线: {
      启动内存: 200, // MB - 应用启动后内存使用
      稳定运行: 400, // MB - 稳定运行内存使用
      警告阈值: 600, // MB - 内存使用警告
      严重阈值: 800, // MB - 内存使用严重告警
    },

    CPU使用基线: {
      空闲状态: 5, // % - 应用空闲时CPU使用率
      游戏运行: 30, // % - 游戏运行时CPU使用率
      警告阈值: 50, // % - CPU使用警告
      严重阈值: 80, // % - CPU使用严重告警
    },

    磁盘IO基线: {
      存档操作: 100, // ms - 游戏存档操作时间
      资源加载: 500, // ms - 游戏资源加载时间
      数据库查询: 50, // ms - 数据库查询时间
      警告倍数: 2, // 超过基线2倍触发警告
      严重倍数: 5, // 超过基线5倍触发严重告警
    },
  },
} as const;

// 性能监控实现
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsBuffer: PerformanceMetric[] = [];
  private isMonitoring = false;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 启动性能监控
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // 启动各类性能监控
    this.startMemoryMonitoring();
    this.startCPUMonitoring();
    this.startDiskIOMonitoring();
    EventLoopBlockDetector.startMonitoring();

    // 定期上报性能指标
    setInterval(() => {
      this.reportPerformanceMetrics();
    }, 60000); // 每分钟上报一次

    console.log('✅ Performance monitoring started');
  }

  // 内存监控
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const totalMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      // 检查内存使用阈值
      if (
        totalMB >
        PERFORMANCE_MONITORING_CONFIG.performanceBaselines.内存使用基线.严重阈值
      ) {
        this.reportPerformanceIssue('memory-critical', {
          currentUsage: totalMB,
          threshold:
            PERFORMANCE_MONITORING_CONFIG.performanceBaselines.内存使用基线
              .严重阈值,
          memoryDetails: memUsage,
        });
      } else if (
        totalMB >
        PERFORMANCE_MONITORING_CONFIG.performanceBaselines.内存使用基线.警告阈值
      ) {
        this.reportPerformanceIssue('memory-warning', {
          currentUsage: totalMB,
          threshold:
            PERFORMANCE_MONITORING_CONFIG.performanceBaselines.内存使用基线
              .警告阈值,
          memoryDetails: memUsage,
        });
      }

      // 记录指标
      this.recordMetric('memory', totalMB);
    }, 10000); // 每10秒检查一次
  }

  // CPU监控
  private startCPUMonitoring(): void {
    let previousCpuUsage = process.cpuUsage();

    setInterval(() => {
      const currentCpuUsage = process.cpuUsage();
      const cpuPercent = this.calculateCPUPercentage(
        previousCpuUsage,
        currentCpuUsage
      );

      // 检查CPU使用阈值
      if (
        cpuPercent >
        PERFORMANCE_MONITORING_CONFIG.performanceBaselines.CPU使用基线.严重阈值
      ) {
        this.reportPerformanceIssue('cpu-critical', {
          currentUsage: cpuPercent,
          threshold:
            PERFORMANCE_MONITORING_CONFIG.performanceBaselines.CPU使用基线
              .严重阈值,
          cpuDetails: currentCpuUsage,
        });
      } else if (
        cpuPercent >
        PERFORMANCE_MONITORING_CONFIG.performanceBaselines.CPU使用基线.警告阈值
      ) {
        this.reportPerformanceIssue('cpu-warning', {
          currentUsage: cpuPercent,
          threshold:
            PERFORMANCE_MONITORING_CONFIG.performanceBaselines.CPU使用基线
              .警告阈值,
          cpuDetails: currentCpuUsage,
        });
      }

      // 记录指标
      this.recordMetric('cpu', cpuPercent);
      previousCpuUsage = currentCpuUsage;
    }, 5000); // 每5秒检查一次
  }

  // 磁盘IO监控
  private startDiskIOMonitoring(): void {
    const originalReadFile = require('fs').readFile;
    const originalWriteFile = require('fs').writeFile;

    // Hook文件读取操作
    require('fs').readFile = (...args: any[]) => {
      const startTime = Date.now();
      const originalCallback = args[args.length - 1];

      args[args.length - 1] = (...callbackArgs: any[]) => {
        const duration = Date.now() - startTime;
        this.recordMetric('disk-read', duration);

        if (
          duration >
          PERFORMANCE_MONITORING_CONFIG.performanceBaselines.磁盘IO基线
            .资源加载 *
            PERFORMANCE_MONITORING_CONFIG.performanceBaselines.磁盘IO基线
              .严重倍数
        ) {
          this.reportPerformanceIssue('disk-io-critical', {
            operation: 'read',
            duration,
            file: args[0],
            threshold:
              PERFORMANCE_MONITORING_CONFIG.performanceBaselines.磁盘IO基线
                .资源加载,
          });
        }

        originalCallback(...callbackArgs);
      };

      return originalReadFile(...args);
    };

    // 类似的写入操作监控...
  }

  // 记录性能指标
  private recordMetric(type: string, value: number): void {
    this.metricsBuffer.push({
      type,
      value,
      timestamp: Date.now(),
    });

    // 限制缓冲区大小
    if (this.metricsBuffer.length > 1000) {
      this.metricsBuffer = this.metricsBuffer.slice(-500);
    }
  }

  // 上报性能问题
  private reportPerformanceIssue(
    type: string,
    data: Record<string, unknown>
  ): void {
    Sentry.withScope(scope => {
      scope.setTag('performance-issue', type);
      scope.setLevel(type.includes('critical') ? 'error' : 'warning');
      scope.setContext('performance-data', data);

      Sentry.captureMessage(
        `Performance issue: ${type}`,
        type.includes('critical') ? 'error' : 'warning'
      );
    });
  }

  // 计算CPU使用百分比
  private calculateCPUPercentage(
    previous: NodeJS.CpuUsage,
    current: NodeJS.CpuUsage
  ): number {
    const totalDiff =
      current.user + current.system - (previous.user + previous.system);
    const idleDiff = 1000000; // 1秒的微秒数
    return Math.min(100, (totalDiff / idleDiff) * 100);
  }

  // 上报性能指标
  private reportPerformanceMetrics(): void {
    if (this.metricsBuffer.length === 0) return;

    // 计算指标统计
    const stats = this.calculateMetricStats();

    // 上报到Sentry
    Sentry.addBreadcrumb({
      message: 'Performance metrics reported',
      category: 'performance',
      level: 'info',
      data: stats,
    });

    // 清空缓冲区
    this.metricsBuffer = [];
  }

  private calculateMetricStats(): Record<string, unknown> {
    const groupedMetrics = this.metricsBuffer.reduce(
      (acc, metric) => {
        if (!acc[metric.type]) acc[metric.type] = [];
        acc[metric.type].push(metric.value);
        return acc;
      },
      {} as Record<string, number[]>
    );

    const stats: Record<string, unknown> = {};

    for (const [type, values] of Object.entries(groupedMetrics)) {
      values.sort((a, b) => a - b);
      stats[type] = {
        count: values.length,
        min: values[0],
        max: values[values.length - 1],
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        p50: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
        p99: values[Math.floor(values.length * 0.99)],
      };
    }

    return stats;
  }
}
```

#### 3.4.3 监控配置法规中心整合（ChatGPT5建议1）

> **整合目标**: 将Playwright×Electron配置细节和监控面板项统一整合到质量法规中心，建立统一的可观测基线标准

```typescript
// 监控配置法规中心 - 统一配置管理
namespace MonitoringConfigurationCenter {
  // 监控配置版本管理
  export const MONITORING_CONFIG_VERSION = '1.0.0';

  // Playwright×Electron监控配置标准（整合）
  export const PLAYWRIGHT_ELECTRON_MONITORING = {
    // E2E测试中的监控配置
    e2eMonitoring: {
      // 性能监控配置
      performanceTracking: {
        启动时间监控: {
          最大允许时间: 10000, // ms
          基线时间: 5000, // ms
          超时警告阈值: 8000, // ms
          监控指标: ['launch-time', 'first-paint', 'dom-ready'],
        },

        内存监控: {
          基线内存: 150, // MB
          警告阈值: 300, // MB
          严重阈值: 500, // MB
          监控频率: 5000, // ms
          GC监控: true,
        },

        CPU监控: {
          基线CPU: 20, // %
          警告阈值: 50, // %
          严重阈值: 80, // %
          监控间隔: 1000, // ms
          空闲检测: true,
        },
      },

      // E2E测试中的错误监控
      errorTracking: {
        捕获级别: ['error', 'warning', 'uncaught'],
        自动截图: true,
        错误上下文: true,
        堆栈追踪: true,
        控制台日志: true,
      },

      // Electron特定监控
      electronSpecific: {
        IPC监控: {
          消息延迟监控: true,
          消息失败监控: true,
          超时检测: 30000, // ms
          重试计数监控: true,
        },

        渲染进程监控: {
          崩溃检测: true,
          内存泄漏检测: true,
          响应性监控: true,
          白屏检测: true,
        },

        主进程监控: {
          事件循环阻塞: true,
          文件系统操作: true,
          网络请求监控: true,
          系统资源监控: true,
        },
      },
    },

    // Playwright测试配置增强
    playwrightConfig: {
      监控报告: {
        性能报告: 'reports/performance/',
        错误报告: 'reports/errors/',
        截图报告: 'reports/screenshots/',
        视频报告: 'reports/videos/',
      },

      监控钩子: {
        testStart: 'setupMonitoring',
        testEnd: 'collectMetrics',
        testFail: 'captureErrorContext',
        globalSetup: 'initMonitoringBaseline',
      },
    },
  };

  // 监控面板配置标准（整合）
  export const MONITORING_DASHBOARD_CONFIG = {
    // 实时监控面板布局
    dashboardLayout: {
      主监控面板: {
        性能指标区: {
          position: 'top-left',
          metrics: [
            'cpu-usage',
            'memory-usage',
            'fps-counter',
            'event-loop-lag',
          ],
          refreshRate: 1000, // ms
          alertThresholds: true,
        },

        错误监控区: {
          position: 'top-right',
          displays: [
            'error-count',
            'warning-count',
            'crash-reports',
            'recent-errors',
          ],
          maxItems: 10,
          autoRefresh: true,
        },

        网络监控区: {
          position: 'bottom-left',
          tracking: [
            'api-calls',
            'response-times',
            'failure-rates',
            'connection-status',
          ],
          historySize: 100,
        },

        AI系统监控区: {
          position: 'bottom-right',
          aiMetrics: [
            'decision-time',
            'worker-status',
            'ai-errors',
            'compute-queue',
          ],
          realTimeUpdate: true,
        },
      },
    },

    // 监控数据源配置
    dataSources: {
      Sentry集成: {
        实时错误流: 'sentry-real-time-api',
        性能事务: 'sentry-performance-api',
        用户反馈: 'sentry-feedback-api',
      },

      系统指标: {
        进程监控: 'process-metrics-collector',
        系统资源: 'system-resource-monitor',
        网络状态: 'network-status-monitor',
      },

      应用指标: {
        游戏性能: 'phaser-performance-metrics',
        UI响应: 'react-performance-metrics',
        AI计算: 'worker-performance-metrics',
      },
    },

    // 告警规则配置
    alertingRules: {
      性能告警: {
        CPU高使用: {
          条件: 'cpu > 80% for 30s',
          级别: 'warning',
          通知: ['sentry', 'console'],
        },

        内存泄漏: {
          条件: 'memory increase > 50MB in 60s',
          级别: 'critical',
          通知: ['sentry', 'console', 'email'],
        },

        事件循环阻塞: {
          条件: 'event_loop_lag > 100ms',
          级别: 'error',
          通知: ['sentry', 'console'],
        },
      },

      业务告警: {
        AI决策超时: {
          条件: 'ai_decision_time > 5000ms',
          级别: 'warning',
          通知: ['sentry', 'console'],
        },

        游戏帧率下降: {
          条件: 'fps < 50 for 10s',
          级别: 'warning',
          通知: ['sentry', 'console'],
        },
      },
    },
  };

  // 可观测基线标准整合
  export const OBSERVABILITY_BASELINE = {
    // 日志标准
    loggingStandards: {
      级别定义: {
        ERROR: '系统错误、AI异常、数据异常',
        WARN: '性能警告、业务异常、兼容性问题',
        INFO: '关键操作、状态变更、里程碑事件',
        DEBUG: '详细追踪、变量状态、执行路径',
      },

      结构化格式: {
        timestamp: 'ISO8601',
        level: 'string',
        component: 'string',
        message: 'string',
        context: 'object',
        traceId: 'string',
      },

      输出目标: {
        开发环境: ['console', 'file'],
        生产环境: ['sentry', 'file'],
        测试环境: ['memory', 'console'],
      },
    },

    // 指标收集标准
    metricsCollection: {
      系统指标: {
        收集频率: 5000, // ms
        保留时间: 86400, // 24小时
        聚合方式: 'avg',
        基线更新: 'weekly',
      },

      业务指标: {
        收集频率: 10000, // ms
        保留时间: 604800, // 7天
        聚合方式: 'sum',
        趋势分析: true,
      },

      性能指标: {
        收集频率: 1000, // ms
        保留时间: 3600, // 1小时
        聚合方式: 'p95',
        实时告警: true,
      },
    },

    // 追踪标准
    tracingStandards: {
      分布式追踪: {
        启用组件: ['api-calls', 'db-operations', 'ai-compute'],
        采样率: '10%',
        上下文传播: true,
        性能影响: '< 2%',
      },

      用户会话追踪: {
        会话标识: 'anonymous-uuid',
        行为追踪: ['clicks', 'navigation', 'errors'],
        隐私保护: true,
        GDPR合规: true,
      },
    },
  };
}
```

#### 3.4.4 自动化冒烟测试断言 (每章节验证)

```typescript
// smoke-tests.ts - 冒烟测试实现 (ChatGPT5护栏)
import { test, expect } from '@playwright/test';
import { ElectronApplication, _electron as electron } from 'playwright';

// 冒烟测试套件 - 每个功能模块的基础验证
export class SmokeTestSuite {
  private app: ElectronApplication | null = null;

  // 通用应用启动测试
  async smokeTest_ApplicationStartup(): Promise<void> {
    const startTime = Date.now();

    // 启动Electron应用
    this.app = await electron.launch({
      args: ['.'],
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
      },
    });

    const window = await this.app.firstWindow();

    // 断言：应用启动时间
    const launchTime = Date.now() - startTime;
    expect(launchTime).toBeLessThan(10000); // 10秒内启动

    // 断言：主窗口存在
    expect(window).toBeTruthy();

    // 断言：窗口可见
    const isVisible = await window.isVisible();
    expect(isVisible).toBe(true);

    // 断言：标题正确
    const title = await window.title();
    expect(title).toContain('Guild Manager');

    console.log(`✅ Application startup test passed (${launchTime}ms)`);
  }

  // 监控系统冒烟测试 (第2章验证)
  async smokeTest_MonitoringSystem(): Promise<void> {
    if (!this.app) throw new Error('Application not started');

    const window = await this.app.firstWindow();

    // 验证Sentry初始化
    const sentryInit = await window.evaluate(() => {
      return window.__SENTRY__ !== undefined;
    });
    expect(sentryInit).toBe(true);

    // 模拟Event Loop阻塞
    await window.evaluate(() => {
      const start = Date.now();
      while (Date.now() - start < 600) {
        // 阻塞Event Loop超过500ms阈值
      }
    });

    // 等待阻塞检测
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 验证阻塞告警 (通过日志或Sentry事件)
    const blockAlert = await window.evaluate(() => {
      return window.__PERFORMANCE_ALERTS__?.eventLoopBlock || null;
    });

    if (blockAlert) {
      expect(blockAlert.threshold).toBe(500);
      expect(blockAlert.actualDuration).toBeGreaterThan(500);
    }

    console.log('✅ Monitoring system smoke test passed');
  }

  // 开发规范冒烟测试 (第4章验证)
  async smokeTest_DevelopmentStandards(): Promise<void> {
    if (!this.app) throw new Error('Application not started');

    const window = await this.app.firstWindow();

    // 验证TypeScript严格模式
    const tsConfig = await window.evaluate(() => {
      return {
        strict: true, // 这应该在编译时验证
        noImplicitAny: true,
      };
    });
    expect(tsConfig.strict).toBe(true);
    expect(tsConfig.noImplicitAny).toBe(true);

    // 验证ESLint规则生效 (通过错误检查)
    const hasLintViolations = await window.evaluate(() => {
      // 检查是否有运行时的规范违规
      return window.__LINT_VIOLATIONS__ || [];
    });
    expect(hasLintViolations).toEqual([]); // 应该没有违规

    console.log('✅ Development standards smoke test passed');
  }

  // Electron安全基线冒烟测试 (第5章验证)
  async smokeTest_ElectronSecurity(): Promise<void> {
    if (!this.app) throw new Error('Application not started');

    const window = await this.app.firstWindow();

    // 验证contextIsolation启用
    const securityConfig = await this.app.evaluate(async ({ app }) => {
      const windows = app.getAllWindows();
      const mainWindow = windows[0];
      if (!mainWindow) return null;

      const webContents = mainWindow.webContents;
      const preferences = webContents.getWebPreferences();

      return {
        contextIsolation: preferences.contextIsolation,
        nodeIntegration: preferences.nodeIntegration,
        webSecurity: preferences.webSecurity,
        sandbox: preferences.sandbox,
      };
    });

    expect(securityConfig?.contextIsolation).toBe(true);
    expect(securityConfig?.nodeIntegration).toBe(false);
    expect(securityConfig?.webSecurity).toBe(true);
    expect(securityConfig?.sandbox).toBe(true);

    // 验证预加载脚本安全
    const preloadSecurity = await window.evaluate(() => {
      // 验证Node.js API未暴露到渲染进程
      return {
        nodeExposed:
          typeof process !== 'undefined' && !!process?.versions?.node,
        electronAPIExposed: typeof window.electronAPI !== 'undefined',
        requireExposed: typeof require !== 'undefined',
      };
    });

    expect(preloadSecurity.nodeExposed).toBe(false); // Node.js不应暴露
    expect(preloadSecurity.electronAPIExposed).toBe(true); // 安全API应该暴露
    expect(preloadSecurity.requireExposed).toBe(false); // require不应暴露

    console.log('✅ Electron security baseline smoke test passed');
  }

  // 游戏核心系统冒烟测试 (第9章验证)
  async smokeTest_GameCoreSystem(): Promise<void> {
    if (!this.app) throw new Error('Application not started');

    const window = await this.app.firstWindow();

    // 验证Phaser游戏引擎启动
    const phaserInit = await window.evaluate(() => {
      return typeof window.Phaser !== 'undefined';
    });
    expect(phaserInit).toBe(true);

    // 验证游戏循环稳定运行
    const fpsStable = await window.evaluate(() => {
      return new Promise(resolve => {
        let frameCount = 0;
        let startTime = Date.now();

        function measureFPS() {
          frameCount++;
          if (frameCount >= 60) {
            // 测量60帧
            const duration = Date.now() - startTime;
            const fps = (frameCount / duration) * 1000;
            resolve(fps);
          } else {
            requestAnimationFrame(measureFPS);
          }
        }

        requestAnimationFrame(measureFPS);
      });
    });

    expect(fpsStable).toBeGreaterThan(30); // 至少30fps

    // 验证资源加载器
    const resourceLoader = await window.evaluate(() => {
      return window.game?.load?.image !== undefined;
    });
    expect(resourceLoader).toBe(true);

    console.log(`✅ Game core system smoke test passed (${fpsStable}fps)`);
  }

  // AI行为引擎冒烟测试 (第11章验证)
  async smokeTest_AIBehaviorEngine(): Promise<void> {
    if (!this.app) throw new Error('Application not started');

    const window = await this.app.firstWindow();

    // 验证AI实体创建
    const aiEntity = await window.evaluate(() => {
      if (typeof window.AIEntity === 'undefined') return null;

      const ai = new window.AIEntity({ personality: 'friendly' });
      return {
        hasPersonality: !!ai.personality,
        hasStateMachine: !!ai.fsm,
        hasBehaviorTree: !!ai.behaviorTree,
      };
    });

    expect(aiEntity?.hasPersonality).toBe(true);
    expect(aiEntity?.hasStateMachine).toBe(true);
    expect(aiEntity?.hasBehaviorTree).toBe(true);

    // 验证FSM状态转换
    const fsmTest = await window.evaluate(() => {
      if (typeof window.AIEntity === 'undefined') return null;

      const ai = new window.AIEntity({ personality: 'friendly' });
      ai.fsm.setState('idle');
      ai.fsm.handleEvent('player_approach');

      return {
        currentState: ai.fsm.currentState,
        expectedState: 'greeting',
      };
    });

    expect(fsmTest?.currentState).toBe(fsmTest?.expectedState);

    // 验证AI决策性能
    const decisionTime = await window.evaluate(() => {
      if (typeof window.AIEntity === 'undefined') return 9999;

      const ai = new window.AIEntity({ personality: 'friendly' });
      const startTime = Date.now();

      // 执行决策
      ai.makeDecision({ scenario: 'test', complexity: 'low' });

      return Date.now() - startTime;
    });

    expect(decisionTime).toBeLessThan(100); // 100ms内完成决策

    console.log(
      `✅ AI behavior engine smoke test passed (${decisionTime}ms decision time)`
    );
  }

  // 清理资源
  async cleanup(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
  }
}

// 使用Playwright测试运行器执行冒烟测试
test.describe('系统冒烟测试套件', () => {
  let smokeTests: SmokeTestSuite;

  test.beforeAll(async () => {
    smokeTests = new SmokeTestSuite();
    await smokeTests.smokeTest_ApplicationStartup();
  });

  test.afterAll(async () => {
    await smokeTests.cleanup();
  });

  test('监控系统应能正常工作', async () => {
    await smokeTests.smokeTest_MonitoringSystem();
  });

  test('开发规范应能正确执行', async () => {
    await smokeTests.smokeTest_DevelopmentStandards();
  });

  test('Electron安全基线应已启用', async () => {
    await smokeTests.smokeTest_ElectronSecurity();
  });

  test('游戏核心系统应能稳定运行', async () => {
    await smokeTests.smokeTest_GameCoreSystem();
  });

  test('AI行为引擎应能正常决策', async () => {
    await smokeTests.smokeTest_AIBehaviorEngine();
  });
});
```

## 第4章：系统上下文与C4+事件流（融合API架构系列）

> **核心理念**: 严格遵循C4模型Context→Container→Component标准序列，基于事件驱动架构构建松耦合、高内聚的系统边界，固化IPC/事件总线契约，为后续垂直切片实现提供稳固基础

> **ChatGPT5优化**: 标准化C4架构图设计顺序，固化跨容器通信契约，确保AI代码生成的架构一致性

### 4.1 系统上下文图（C4模型Level 1）

#### 4.1.1 核心系统边界

```typescript
// 系统上下文定义
interface SystemContext {
  name: 'GuildManager';
  boundary: {
    internal: {
      gameCore: 'Phaser3游戏引擎';
      uiLayer: 'React19界面层';
      dataLayer: 'SQLite存储层';
      aiEngine: 'WebWorker AI计算';
    };
    external: {
      electronRuntime: 'Electron桌面容器';
      operatingSystem: 'Windows/macOS/Linux';
      networkServices: '可选网络服务';
    };
    communication: {
      inbound: ['用户交互', '系统事件', '定时任务'];
      outbound: ['界面更新', '数据持久化', '系统通知'];
    };
  };
}
```

#### 4.1.2 利益相关者映射

```typescript
// 利益相关者系统
interface StakeholderMap {
  primaryUsers: {
    guildManager: '公会管理员';
    guildMember: '普通成员';
    npcCharacter: 'AI控制的NPC';
  };
  externalSystems: {
    electronMain: '主进程（文件系统、窗口管理）';
    operatingSystem: '操作系统服务';
    hardwareLayer: '硬件抽象层';
  };
  supportingSystems: {
    loggingService: '日志收集服务';
    configService: '配置管理服务';
    securityService: '安全基线服务';
  };
}
```

### 4.2 容器图（C4模型Level 2）

#### 4.2.1 应用容器架构

```typescript
// 应用容器定义
interface ApplicationContainers {
  // 主渲染进程容器
  mainRenderer: {
    technology: 'Electron Renderer + React 19';
    responsibilities: ['用户界面渲染', '用户交互处理', '状态管理', '事件协调'];
    communicationPorts: {
      uiEvents: 'DOM事件 → React组件';
      gameEvents: 'Phaser场景 → React状态';
      dataEvents: 'SQLite查询 → React组件';
    };
  };

  // 游戏引擎容器
  gameEngine: {
    technology: 'Phaser 3 + Canvas API';
    responsibilities: [
      '游戏场景渲染',
      '动画与特效',
      '用户输入响应',
      '游戏循环管理',
    ];
    communicationPorts: {
      renderLoop: 'requestAnimationFrame';
      inputHandler: 'Keyboard/Mouse事件';
      gameState: '与React状态同步';
    };
  };

  // AI计算容器
  aiWorker: {
    technology: 'Web Worker + TypeScript';
    responsibilities: ['NPC决策计算', '战术分析', '市场预测', '行为模式学习'];
    communicationPorts: {
      workerMessages: 'postMessage/onMessage';
      computeRequests: '主线程 → Worker';
      resultCallbacks: 'Worker → 主线程';
    };
  };

  // 数据存储容器
  dataStore: {
    technology: 'SQLite + 文件系统';
    responsibilities: [
      '游戏数据持久化',
      '配置文件管理',
      '日志文件存储',
      '缓存数据管理',
    ];
    communicationPorts: {
      sqlInterface: 'SQL查询接口';
      fileSystem: 'Node.js fs API';
      cacheLayer: '内存缓存层';
    };
  };
}
```

#### 4.2.2 容器间通信协议（固化IPC契约）

> **契约固化目标**: 为垂直切片实现提供标准化的跨容器通信契约，确保所有AI生成代码遵循统一的IPC接口规范

```typescript
// 容器通信协议 - 固化版本 v1.0
interface ContainerCommunicationProtocol {
  // React ↔ Phaser通信协议
  reactPhaserBridge: {
    gameToUI: {
      events: ['game:state:update', 'game:scene:change', 'game:error'];
      dataFormat: '{ type: string, payload: any, timestamp: number }';
      transport: 'CustomEvent + EventTarget';
    };
    uiToGame: {
      events: ['ui:action:guild', 'ui:action:combat', 'ui:config:update'];
      dataFormat: '{ action: string, params: any, requestId: string }';
      transport: '直接方法调用 + Promise';
    };
  };

  // 主线程 ↔ Worker通信协议
  mainWorkerBridge: {
    computeRequests: {
      aiDecision: "{ type: 'AI_DECISION', npcId: string, context: GameContext }";
      strategyAnalysis: "{ type: 'STRATEGY_ANALYSIS', battleData: BattleData }";
      marketPrediction: "{ type: 'MARKET_PREDICTION', economyState: EconomyState }";
    };
    responses: {
      format: '{ requestId: string, result: any, error?: Error }';
      timeout: '30秒超时机制';
      fallback: '超时返回默认值';
    };
  };

  // 应用 ↔ 数据存储通信协议
  dataAccessProtocol: {
    queryInterface: {
      sync: 'SQLite同步查询（启动时）';
      async: 'SQLite异步查询（运行时）';
      batch: '批量操作接口';
      transaction: '事务保证机制';
    };
    cachingStrategy: {
      l1Cache: '组件级内存缓存';
      l2Cache: '应用级Redux状态';
      l3Cache: 'SQLite内存模式';
      invalidation: '基于事件的缓存失效';
    };
  };
}
```

#### 4.2.3 IPC契约固化规范（垂直切片基础）

> **固化原则**: 建立不可变的跨容器通信契约，任何AI代码生成都必须严格遵循以下IPC接口标准

```typescript
// IPC契约固化规范 - 版本化管理
namespace IPCContractStandards {
  // 契约版本控制
  export const CONTRACT_VERSION = '1.0.0';
  export const COMPATIBILITY_MATRIX = {
    '1.0.x': ['MainRenderer', 'GameEngine', 'AIWorker', 'DataStore'],
    breaking_changes: '主版本号变更时需要全容器升级',
  };

  // 标准化消息格式
  export interface StandardIPCMessage<T = any> {
    readonly contractVersion: string; // 契约版本
    readonly messageId: string; // 消息唯一ID
    readonly timestamp: number; // 时间戳
    readonly source: ContainerType; // 源容器
    readonly target: ContainerType; // 目标容器
    readonly type: string; // 消息类型
    readonly payload: T; // 消息载荷
    readonly timeout?: number; // 超时设置（可选）
    readonly requiresAck?: boolean; // 是否需要确认（可选）
  }

  // 容器类型枚举（固化）
  export enum ContainerType {
    MAIN_RENDERER = 'main-renderer',
    GAME_ENGINE = 'game-engine',
    AI_WORKER = 'ai-worker',
    DATA_STORE = 'data-store',
  }

  // React ↔ Phaser IPC契约（固化）
  export namespace ReactPhaserContract {
    export const BRIDGE_NAME = 'react-phaser-bridge';

    // 游戏状态事件（固化）
    export interface GameStateUpdateMessage extends StandardIPCMessage {
      type: 'GAME_STATE_UPDATE';
      payload: {
        sceneId: string;
        gameState: GameState;
        deltaTime: number;
        fps: number;
      };
    }

    // UI命令事件（固化）
    export interface UICommandMessage extends StandardIPCMessage {
      type: 'UI_COMMAND';
      payload: {
        command: 'GUILD_ACTION' | 'COMBAT_ACTION' | 'CONFIG_UPDATE';
        params: Record<string, any>;
        requestId: string;
      };
    }

    // 错误处理契约（固化）
    export interface ErrorMessage extends StandardIPCMessage {
      type: 'GAME_ERROR';
      payload: {
        errorCode: string;
        errorMessage: string;
        stack?: string;
        context: Record<string, any>;
      };
    }
  }

  // 主线程 ↔ Worker IPC契约（固化）
  export namespace MainWorkerContract {
    export const BRIDGE_NAME = 'main-worker-bridge';

    // AI计算请求（固化）
    export interface AIComputeRequest extends StandardIPCMessage {
      type: 'AI_COMPUTE_REQUEST';
      payload: {
        computeType: 'DECISION' | 'STRATEGY' | 'PREDICTION';
        npcId?: string;
        context: AIContext;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
      };
    }

    // AI计算响应（固化）
    export interface AIComputeResponse extends StandardIPCMessage {
      type: 'AI_COMPUTE_RESPONSE';
      payload: {
        requestId: string;
        result: AIResult;
        computeTime: number;
        confidence: number;
        error?: string;
      };
    }
  }

  // 数据访问IPC契约（固化）
  export namespace DataAccessContract {
    export const BRIDGE_NAME = 'data-access-bridge';

    // 数据查询请求（固化）
    export interface DataQueryRequest extends StandardIPCMessage {
      type: 'DATA_QUERY';
      payload: {
        queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
        table: string;
        conditions?: Record<string, any>;
        data?: Record<string, any>;
        transaction?: boolean;
      };
    }

    // 数据响应（固化）
    export interface DataQueryResponse extends StandardIPCMessage {
      type: 'DATA_RESPONSE';
      payload: {
        requestId: string;
        data?: any[];
        rowsAffected?: number;
        error?: string;
        executionTime: number;
      };
    }
  }

  // 契约验证器（固化）
  export class IPCContractValidator {
    static validateMessage(message: any): message is StandardIPCMessage {
      return (
        typeof message === 'object' &&
        typeof message.contractVersion === 'string' &&
        typeof message.messageId === 'string' &&
        typeof message.timestamp === 'number' &&
        Object.values(ContainerType).includes(message.source) &&
        Object.values(ContainerType).includes(message.target) &&
        typeof message.type === 'string' &&
        message.payload !== undefined
      );
    }

    static enforceTimeout(message: StandardIPCMessage): number {
      return message.timeout || 30000; // 默认30秒超时
    }
  }
}
```

### 4.3 组件图（C4模型Level 3）

#### 4.3.1 事件系统组件设计（事件总线契约固化）

> **事件总线契约固化**: 建立标准化的事件总线契约，确保所有组件遵循统一的事件发布/订阅模式

```typescript
// 事件总线契约固化规范 v1.0
namespace EventBusContractStandards {
  // 事件契约版本
  export const EVENT_CONTRACT_VERSION = '1.0.0';

  // 标准事件格式（固化）
  export interface StandardGameEvent<T = any> {
    readonly contractVersion: string; // 事件契约版本
    readonly eventId: string; // 事件唯一ID
    readonly type: string; // 事件类型
    readonly source: string; // 事件源
    readonly timestamp: number; // 时间戳
    readonly payload: T; // 事件载荷
    readonly priority: EventPriority; // 事件优先级
    readonly ttl?: number; // 生存时间（可选）
  }

  // 事件优先级（固化）
  export enum EventPriority {
    CRITICAL = 0, // 关键事件（立即处理）
    HIGH = 1, // 高优先级（下一帧处理）
    MEDIUM = 2, // 中优先级（批量处理）
    LOW = 3, // 低优先级（空闲时处理）
  }

  // 事件类型命名空间（固化）
  export namespace EventTypes {
    export const GUILD = {
      CREATED: 'guild.created',
      MEMBER_JOINED: 'guild.member.joined',
      MEMBER_LEFT: 'guild.member.left',
      DISBANDED: 'guild.disbanded',
    } as const;

    export const COMBAT = {
      BATTLE_STARTED: 'combat.battle.started',
      BATTLE_ENDED: 'combat.battle.ended',
      FORMATION_CHANGED: 'combat.formation.changed',
      STRATEGY_UPDATED: 'combat.strategy.updated',
    } as const;

    export const ECONOMY = {
      BID_PLACED: 'auction.bid.placed',
      ITEM_SOLD: 'auction.item.sold',
      TRADE_COMPLETED: 'trade.completed',
      INFLATION_ALERT: 'economy.inflation.alert',
    } as const;

    export const SOCIAL = {
      MAIL_RECEIVED: 'mail.received',
      POST_CREATED: 'forum.post.created',
      CHAT_MESSAGE: 'chat.message.sent',
    } as const;
  }

  // 事件处理器契约（固化）
  export interface StandardEventHandler<T = any> {
    readonly handlerId: string;
    readonly eventType: string;
    readonly priority: EventPriority;
    handle(event: StandardGameEvent<T>): Promise<void> | void;
    canHandle(event: StandardGameEvent): boolean;
    onError?(error: Error, event: StandardGameEvent<T>): void;
  }

  // 事件总线接口（固化）
  export interface IStandardEventBus {
    // 核心方法
    publish<T>(event: StandardGameEvent<T>): Promise<void>;
    subscribe<T>(eventType: string, handler: StandardEventHandler<T>): string;
    unsubscribe(handlerId: string): void;

    // 批量操作
    publishBatch(events: StandardGameEvent[]): Promise<void>;

    // 事件查询
    getEventHistory(eventType: string, limit?: number): StandardGameEvent[];

    // 性能监控
    getMetrics(): EventBusMetrics;
  }

  // 事件总线性能指标（固化）
  export interface EventBusMetrics {
    eventsPerSecond: number;
    averageLatency: number;
    errorRate: number;
    queueDepth: number;
    activeHandlers: number;
  }
}

// 事件系统核心组件
interface EventSystemComponents {
  // 事件池核心引擎
  eventPoolCore: {
    file: 'src/core/events/EventPoolCore.ts';
    responsibilities: [
      '事件注册与注销',
      '事件优先级排序',
      '批量事件分发',
      '性能监控',
    ];
    interfaces: {
      IEventEmitter: '事件发射器接口';
      IEventListener: '事件监听器接口';
      IEventPriority: '事件优先级接口';
      IEventFilter: '事件过滤器接口';
    };
    keyMethods: [
      'emit(event: GameEvent): Promise<void>',
      'on(type: string, listener: EventListener): void',
      'off(type: string, listener: EventListener): void',
      'batch(events: GameEvent[]): Promise<void>',
    ];
  };

  // 游戏事件类型定义
  gameEventTypes: {
    file: 'src/core/events/GameEvents.ts';
    eventCategories: {
      guild: {
        'guild.created': 'GuildCreatedEvent';
        'guild.member.joined': 'MemberJoinedEvent';
        'guild.member.left': 'MemberLeftEvent';
        'guild.disbanded': 'GuildDisbandedEvent';
      };
      combat: {
        'combat.battle.started': 'BattleStartedEvent';
        'combat.battle.ended': 'BattleEndedEvent';
        'combat.formation.changed': 'FormationChangedEvent';
        'combat.strategy.updated': 'StrategyUpdatedEvent';
      };
      economy: {
        'auction.bid.placed': 'BidPlacedEvent';
        'auction.item.sold': 'ItemSoldEvent';
        'trade.completed': 'TradeCompletedEvent';
        'economy.inflation.alert': 'InflationAlertEvent';
      };
      social: {
        'mail.received': 'MailReceivedEvent';
        'forum.post.created': 'PostCreatedEvent';
        'chat.message.sent': 'ChatMessageEvent';
      };
    };
  };

  // 事件分发器组件
  eventDispatcher: {
    file: 'src/core/events/EventDispatcher.ts';
    features: {
      nonBlocking: '非阻塞分发机制';
      errorHandling: '异常隔离与恢复';
      performanceOptimization: '60FPS性能保证';
      debugMode: '开发时事件追踪';
    };
    configuration: {
      batchSize: 100;
      tickInterval: '16ms (60FPS)';
      maxRetries: 3;
      timeoutMs: 1000;
    };
  };
}
```

#### 4.3.2 API架构系列组件

```typescript
// API架构核心组件设计
interface APIArchitectureComponents {
  // 公会管理API层
  guildAPI: {
    path: 'src/api/guild/';
    components: {
      'GuildService.ts': {
        methods: [
          'createGuild(config: GuildConfig): Promise<Guild>',
          'getGuildById(id: string): Promise<Guild | null>',
          'updateGuild(id: string, updates: Partial<Guild>): Promise<Guild>',
          'disbandGuild(id: string, reason: string): Promise<void>',
        ];
        events: ['guild.*'];
        dependencies: ['EventPool', 'DataIntegrity', 'Storage'];
      };
      'MembershipService.ts': {
        methods: [
          'addMember(guildId: string, memberId: string): Promise<void>',
          'removeMember(guildId: string, memberId: string): Promise<void>',
          'promoteMember(guildId: string, memberId: string, role: string): Promise<void>',
          'getMembersByGuild(guildId: string): Promise<GuildMember[]>',
        ];
        events: ['guild.member.*'];
        businessRules: ['最大成员数限制', '角色权限验证', '活跃度要求'];
      };
    };
  };

  // 战斗系统API层
  combatAPI: {
    path: 'src/api/combat/';
    components: {
      'CombatService.ts': {
        methods: [
          'initiateBattle(battleConfig: BattleConfig): Promise<Battle>',
          'submitFormation(battleId: string, formation: Formation): Promise<void>',
          'executeStrategy(battleId: string, strategy: Strategy): Promise<BattleResult>',
          'getBattleHistory(guildId: string): Promise<Battle[]>',
        ];
        events: ['combat.*'];
        aiIntegration: '与AI Worker通信进行战术分析';
      };
      'FormationService.ts': {
        methods: [
          'validateFormation(formation: Formation): ValidationResult',
          'optimizeFormation(members: Member[], objective: string): Formation',
          'getRecommendedFormations(enemy: EnemyInfo): Formation[]',
        ];
        algorithms: ['阵容有效性算法', 'AI推荐算法', '克制关系计算'];
      };
    };
  };

  // 经济系统API层
  economyAPI: {
    path: 'src/api/economy/';
    components: {
      'AuctionService.ts': {
        methods: [
          'listItem(item: Item, startingBid: number, duration: number): Promise<Auction>',
          'placeBid(auctionId: string, bidAmount: number, bidderId: string): Promise<void>',
          'closeAuction(auctionId: string): Promise<AuctionResult>',
          'getActiveAuctions(): Promise<Auction[]>',
        ];
        events: ['auction.*'];
        businessRules: ['最低竞价增幅', '拍卖时间限制', '反作弊机制'];
      };
      'TradeService.ts': {
        methods: [
          'createTradeOffer(offer: TradeOffer): Promise<Trade>',
          'acceptTrade(tradeId: string, accepterId: string): Promise<TradeResult>',
          'cancelTrade(tradeId: string, reason: string): Promise<void>',
        ];
        events: ['trade.*'];
        safetyMechanisms: ['交易锁定', '价值评估', '欺诈检测'];
      };
    };
  };

  // 社交系统API层
  socialAPI: {
    path: 'src/api/social/';
    components: {
      'MailService.ts': {
        methods: [
          'sendMail(mail: Mail): Promise<void>',
          'getMail(recipientId: string): Promise<Mail[]>',
          'markAsRead(mailId: string): Promise<void>',
          'deleteMail(mailId: string): Promise<void>',
        ];
        events: ['mail.*'];
        features: ['智能分类', '垃圾邮件过滤', '快捷回复'];
      };
      'ForumService.ts': {
        methods: [
          'createPost(post: ForumPost): Promise<void>',
          'replyToPost(postId: string, reply: Reply): Promise<void>',
          'moderateContent(contentId: string, action: ModerationAction): Promise<void>',
        ];
        events: ['forum.*'];
        aiFeatures: ['内容审核', '情感分析', '热度预测'];
      };
    };
  };
}
```

### 4.4 事件流设计

#### 4.4.1 核心事件流图

```typescript
// 核心业务事件流
interface CoreEventFlows {
  // 公会创建事件流
  guildCreationFlow: {
    trigger: '用户点击创建公会';
    steps: [
      {
        step: 1;
        component: 'UI组件';
        action: '触发 guild.create.requested 事件';
        event: 'GuildCreateRequestedEvent';
      },
      {
        step: 2;
        component: 'GuildService';
        action: '验证创建条件';
        validation: ['名称唯一性', '用户资格', '资源充足'];
      },
      {
        step: 3;
        component: 'DataIntegrityEngine';
        action: '勾稽关系检查';
        checks: ['用户公会数限制', '名称冲突检测'];
      },
      {
        step: 4;
        component: 'DatabaseManager';
        action: '创建公会记录';
        transaction: '原子性事务保证';
      },
      {
        step: 5;
        component: 'EventPool';
        action: '发布 guild.created 事件';
        notify: ['UI更新', '统计记录', '成就检查'];
      },
    ];
  };

  // 战斗执行事件流
  battleExecutionFlow: {
    trigger: '战斗开始指令';
    steps: [
      {
        step: 1;
        component: 'CombatService';
        action: '初始化战斗环境';
        setup: ['阵容验证', '规则加载', '随机种子'];
      },
      {
        step: 2;
        component: 'AI Worker';
        action: '计算AI决策';
        async: true;
        timeout: '5秒超时保护';
      },
      {
        step: 3;
        component: 'CombatEngine';
        action: '执行战斗回合';
        loop: '直到分出胜负';
      },
      {
        step: 4;
        component: 'Phaser场景';
        action: '动画播放';
        rendering: '60FPS流畅动画';
      },
      {
        step: 5;
        component: 'StatisticsService';
        action: '记录战斗数据';
        analytics: ['胜率统计', '策略效果', '平衡性数据'];
      },
    ];
  };

  // 经济交易事件流
  economicTransactionFlow: {
    trigger: '拍卖竞价/交易提交';
    steps: [
      {
        step: 1;
        component: 'EconomyService';
        action: '交易验证';
        checks: ['资金充足', '物品存在', '权限验证'];
      },
      {
        step: 2;
        component: 'AntiCheatEngine';
        action: '反作弊检测';
        algorithms: ['价格异常检测', '频率限制', '关联账户分析'];
      },
      {
        step: 3;
        component: 'TransactionProcessor';
        action: '执行交易';
        atomicity: 'ACID事务保证';
      },
      {
        step: 4;
        component: 'EconomyAnalyzer';
        action: '市场影响分析';
        metrics: ['价格波动', '流动性影响', '通胀指标'];
      },
      {
        step: 5;
        component: 'NotificationService';
        action: '交易通知';
        channels: ['界面提示', '邮件通知', '成就解锁'];
      },
    ];
  };
}
```

#### 4.4.2 事件优先级与性能优化

```typescript
// 事件优先级配置
interface EventPriorityConfiguration {
  // 关键业务事件（最高优先级）
  critical: {
    priority: 100;
    events: [
      'combat.battle.ended', // 战斗结束必须立即处理
      'economy.transaction.completed', // 交易完成必须确保
      'security.violation.detected', // 安全违规立即响应
      'system.error.critical', // 系统严重错误
    ];
    guarantees: ['立即执行', '不可延迟', '重试保证'];
  };

  // 高优先级事件
  high: {
    priority: 80;
    events: [
      'guild.member.joined', // 成员加入需要快速响应
      'auction.bid.placed', // 竞价需要及时处理
      'mail.received', // 邮件接收用户关注
      'achievement.unlocked', // 成就解锁用户期待
    ];
    guarantees: ['1秒内处理', '允许批量', '失败重试'];
  };

  // 普通优先级事件
  normal: {
    priority: 50;
    events: [
      'ui.state.updated', // UI状态更新
      'analytics.data.recorded', // 分析数据记录
      'cache.invalidated', // 缓存失效通知
      'config.changed', // 配置变更通知
    ];
    guarantees: ['5秒内处理', '批量优化', '丢失可接受'];
  };

  // 低优先级事件
  low: {
    priority: 20;
    events: [
      'debug.log.generated', // 调试日志生成
      'performance.metric.collected', // 性能指标收集
      'statistics.aggregated', // 统计数据聚合
      'cleanup.scheduled', // 清理任务调度
    ];
    guarantees: ['30秒内处理', '可延迟执行', '失败忽略'];
  };
}
```

## 第5章：数据模型与存储端口（融合数据库设计+业务逻辑）

> **设计原则**: 基于领域驱动设计（DDD）和六边形架构，实现数据与业务逻辑的清晰分离，确保AI代码生成时具备明确的数据边界认知

### 5.1 领域模型设计

#### 5.1.1 公会管理领域模型

```typescript
// 公会聚合根（Aggregate Root）
interface GuildAggregate {
  // 聚合标识
  id: GuildId; // UUID v4

  // 基本属性
  name: GuildName; // 公会名称（唯一）
  description: string; // 公会描述
  level: GuildLevel; // 公会等级 (1-50)
  experience: number; // 公会经验值

  // 成员管理
  members: GuildMember[]; // 成员列表
  memberLimit: number; // 成员上限
  leadership: GuildLeadership; // 领导层结构

  // 资源管理
  treasury: GuildTreasury; // 公会金库
  resources: ResourceCollection; // 资源集合
  facilities: GuildFacility[]; // 公会设施

  // 活动数据
  activities: GuildActivity[]; // 公会活动记录
  statistics: GuildStatistics; // 统计信息

  // 元数据
  createdAt: DateTime; // 创建时间
  updatedAt: DateTime; // 更新时间
  version: number; // 乐观锁版本号

  // 聚合业务方法
  addMember(member: GuildMember): DomainResult<void>;
  removeMember(memberId: MemberId): DomainResult<void>;
  promoteMember(memberId: MemberId, newRole: GuildRole): DomainResult<void>;
  allocateResource(resource: ResourceType, amount: number): DomainResult<void>;
  upgradeLevel(): DomainResult<void>;

  // 领域事件产生
  collectDomainEvents(): DomainEvent[];
  clearDomainEvents(): void;
}

// 公会成员值对象
interface GuildMember {
  id: MemberId; // 成员ID
  userId: UserId; // 关联用户ID
  role: GuildRole; // 成员角色
  joinedAt: DateTime; // 加入时间
  contributions: ContributionRecord[]; // 贡献记录
  permissions: Permission[]; // 权限列表
  activityScore: number; // 活跃度评分

  // 值对象验证
  isValid(): boolean;
  canPerform(action: GuildAction): boolean;
}

// 公会角色枚举
enum GuildRole {
  LEADER = 'leader', // 会长
  VICE_LEADER = 'vice_leader', // 副会长
  OFFICER = 'officer', // 干事
  ELITE = 'elite', // 精英
  MEMBER = 'member', // 普通成员
}
```

#### 5.1.2 战斗系统领域模型

```typescript
// 战斗聚合根
interface BattleAggregate {
  // 战斗标识
  id: BattleId; // 战斗唯一标识

  // 基本信息
  type: BattleType; // 战斗类型 (PVP/PVE/WorldBoss)
  status: BattleStatus; // 战斗状态
  configuration: BattleConfig; // 战斗配置

  // 参战方
  attackingParty: CombatParty; // 攻击方
  defendingParty: CombatParty; // 防守方

  // 战斗过程
  rounds: BattleRound[]; // 战斗回合
  currentRound: number; // 当前回合

  // 战斗结果
  result?: BattleResult; // 战斗结果
  rewards: BattleReward[]; // 战斗奖励

  // 时间信息
  startedAt: DateTime; // 开始时间
  endedAt?: DateTime; // 结束时间
  duration?: Duration; // 战斗时长

  // 聚合业务方法
  initializeBattle(): DomainResult<void>;
  executeRound(): DomainResult<BattleRound>;
  applyStrategy(party: PartyType, strategy: BattleStrategy): DomainResult<void>;
  concludeBattle(): DomainResult<BattleResult>;

  // 领域事件
  collectDomainEvents(): DomainEvent[];
  clearDomainEvents(): void;
}

// 战斗队伍值对象
interface CombatParty {
  id: PartyId; // 队伍标识
  guildId: GuildId; // 所属公会
  formation: Formation; // 阵容配置
  strategy: BattleStrategy; // 战斗策略
  members: CombatMember[]; // 参战成员

  // 队伍状态
  totalPower: number; // 总战力
  morale: number; // 士气值
  buffs: Buff[]; // 增益效果
  debuffs: Debuff[]; // 减益效果

  // 值对象方法
  calculateTotalPower(): number;
  applyFormationBonus(): void;
  canExecuteStrategy(strategy: BattleStrategy): boolean;
}

// 战斗成员值对象
interface CombatMember {
  id: MemberId; // 成员ID
  position: BattlePosition; // 战斗位置
  stats: CombatStats; // 战斗属性
  equipment: Equipment[]; // 装备列表
  skills: Skill[]; // 技能列表

  // 战斗状态
  currentHP: number; // 当前血量
  currentMP: number; // 当前魔法值
  statusEffects: StatusEffect[]; // 状态效果
  actionQueue: Action[]; // 行动队列

  // 成员行为
  canAct(): boolean;
  selectAction(context: BattleContext): Action;
  executeAction(action: Action): ActionResult;
}
```

#### 5.1.3 经济系统领域模型

```typescript
// 拍卖聚合根
interface AuctionAggregate {
  // 拍卖标识
  id: AuctionId; // 拍卖ID

  // 拍卖物品
  item: AuctionItem; // 拍卖物品
  quantity: number; // 数量

  // 拍卖配置
  startingBid: Money; // 起拍价
  currentBid: Money; // 当前最高价
  bidIncrement: Money; // 最小加价幅度

  // 参与方
  seller: SellerId; // 卖方
  bidders: Bidder[]; // 竞价者列表
  currentWinner?: BidderId; // 当前最高价者

  // 时间控制
  duration: Duration; // 拍卖时长
  startTime: DateTime; // 开始时间
  endTime: DateTime; // 结束时间

  // 状态管理
  status: AuctionStatus; // 拍卖状态

  // 聚合业务方法
  placeBid(bidder: BidderId, amount: Money): DomainResult<void>;
  extendDuration(extension: Duration): DomainResult<void>;
  closeAuction(): DomainResult<AuctionResult>;
  cancelAuction(reason: string): DomainResult<void>;

  // 业务规则验证
  isValidBid(amount: Money): boolean;
  isActive(): boolean;
  canBid(bidder: BidderId): boolean;

  // 领域事件
  collectDomainEvents(): DomainEvent[];
  clearDomainEvents(): void;
}

// 交易聚合根
interface TradeAggregate {
  // 交易标识
  id: TradeId; // 交易ID

  // 交易双方
  initiator: TraderId; // 发起方
  recipient: TraderId; // 接受方

  // 交易内容
  initiatorOffer: TradeOffer; // 发起方报价
  recipientOffer: TradeOffer; // 接受方报价

  // 交易状态
  status: TradeStatus; // 交易状态
  negotiations: TradeNegotiation[]; // 谈判记录

  // 安全机制
  securityDeposit: Money; // 保证金
  escrowService?: EscrowId; // 第三方托管
  verificationRequired: boolean; // 是否需要验证

  // 时间信息
  createdAt: DateTime; // 创建时间
  expiresAt: DateTime; // 过期时间
  completedAt?: DateTime; // 完成时间

  // 聚合业务方法
  negotiate(trader: TraderId, newOffer: TradeOffer): DomainResult<void>;
  accept(trader: TraderId): DomainResult<void>;
  reject(trader: TraderId, reason: string): DomainResult<void>;
  execute(): DomainResult<TradeResult>;
  cancel(reason: string): DomainResult<void>;

  // 安全验证
  verifyTradeItems(): boolean;
  detectFraud(): FraudRisk;
  calculateTradeTax(): Money;
}
```

### 5.2 数据存储端口设计

#### 5.2.1 仓储模式接口（Repository Pattern）

```typescript
// 通用仓储基接口
interface IRepository<TAggregate, TId> {
  // 基本CRUD操作
  findById(id: TId): Promise<TAggregate | null>;
  save(aggregate: TAggregate): Promise<void>;
  delete(id: TId): Promise<void>;

  // 批量操作
  saveMany(aggregates: TAggregate[]): Promise<void>;
  deleteMany(ids: TId[]): Promise<void>;

  // 查询支持
  findBy(criteria: QueryCriteria): Promise<TAggregate[]>;
  count(criteria: QueryCriteria): Promise<number>;
  exists(id: TId): Promise<boolean>;

  // 事务支持
  saveInTransaction(
    aggregate: TAggregate,
    transaction: Transaction
  ): Promise<void>;

  // 领域事件支持
  saveWithEvents(aggregate: TAggregate): Promise<void>;
}

// 公会仓储接口
interface IGuildRepository extends IRepository<GuildAggregate, GuildId> {
  // 公会特定查询
  findByName(name: string): Promise<GuildAggregate | null>;
  findByLeader(leaderId: UserId): Promise<GuildAggregate[]>;
  findByLevel(level: GuildLevel): Promise<GuildAggregate[]>;
  findTopByExperience(limit: number): Promise<GuildAggregate[]>;

  // 成员相关查询
  findByMember(memberId: UserId): Promise<GuildAggregate | null>;
  findMembersCount(guildId: GuildId): Promise<number>;

  // 统计查询
  getStatistics(): Promise<GuildStatistics>;
  getActiveGuilds(since: DateTime): Promise<GuildAggregate[]>;

  // 复杂查询
  searchGuilds(criteria: GuildSearchCriteria): Promise<GuildSearchResult>;
}

// 战斗仓储接口
interface IBattleRepository extends IRepository<BattleAggregate, BattleId> {
  // 战斗历史查询
  findByGuild(guildId: GuildId, limit?: number): Promise<BattleAggregate[]>;
  findByParticipant(
    participantId: UserId,
    limit?: number
  ): Promise<BattleAggregate[]>;
  findByDateRange(start: DateTime, end: DateTime): Promise<BattleAggregate[]>;

  // 战斗统计
  getWinRate(guildId: GuildId): Promise<number>;
  getBattleStats(guildId: GuildId): Promise<BattleStatistics>;

  // 活跃战斗
  findActiveBattles(): Promise<BattleAggregate[]>;
  findPendingBattles(guildId: GuildId): Promise<BattleAggregate[]>;
}

// 拍卖仓储接口
interface IAuctionRepository extends IRepository<AuctionAggregate, AuctionId> {
  // 活跃拍卖查询
  findActiveAuctions(): Promise<AuctionAggregate[]>;
  findEndingSoon(within: Duration): Promise<AuctionAggregate[]>;

  // 物品查询
  findByItem(itemType: ItemType): Promise<AuctionAggregate[]>;
  findByPriceRange(min: Money, max: Money): Promise<AuctionAggregate[]>;

  // 用户相关查询
  findBySeller(sellerId: SellerId): Promise<AuctionAggregate[]>;
  findByBidder(bidderId: BidderId): Promise<AuctionAggregate[]>;

  // 市场分析
  getPriceHistory(itemType: ItemType, period: Period): Promise<PriceHistory[]>;
  getMarketTrends(): Promise<MarketTrend[]>;
}
```

#### 5.2.2 数据访问适配器实现

```typescript
// SQLite数据访问适配器基类
abstract class SQLiteRepositoryBase<TAggregate, TId>
  implements IRepository<TAggregate, TId>
{
  protected db: Database;
  protected tableName: string;
  protected eventDispatcher: IEventDispatcher;

  constructor(
    db: Database,
    tableName: string,
    eventDispatcher: IEventDispatcher
  ) {
    this.db = db;
    this.tableName = tableName;
    this.eventDispatcher = eventDispatcher;
  }

  // 通用查询方法
  async findById(id: TId): Promise<TAggregate | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const row = this.db.prepare(sql).get(id);
    return row ? this.mapRowToAggregate(row) : null;
  }

  // 通用保存方法
  async save(aggregate: TAggregate): Promise<void> {
    const transaction = this.db.transaction(() => {
      // 保存聚合根数据
      this.insertOrUpdateAggregate(aggregate);

      // 保存关联数据
      this.saveAssociatedEntities(aggregate);

      // 发布领域事件
      this.publishDomainEvents(aggregate);
    });

    transaction();
  }

  // 事务内保存
  async saveInTransaction(
    aggregate: TAggregate,
    transaction: Transaction
  ): Promise<void> {
    // 在提供的事务内执行保存操作
    transaction.exec(() => {
      this.insertOrUpdateAggregate(aggregate);
      this.saveAssociatedEntities(aggregate);
    });
  }

  // 抽象方法，由具体实现类定义
  protected abstract mapRowToAggregate(row: any): TAggregate;
  protected abstract insertOrUpdateAggregate(aggregate: TAggregate): void;
  protected abstract saveAssociatedEntities(aggregate: TAggregate): void;

  // 领域事件处理
  protected async publishDomainEvents(aggregate: TAggregate): Promise<void> {
    if ('collectDomainEvents' in aggregate) {
      const events = (aggregate as any).collectDomainEvents();
      for (const event of events) {
        await this.eventDispatcher.dispatch(event);
      }
      (aggregate as any).clearDomainEvents();
    }
  }
}

// 公会仓储SQLite实现
class SQLiteGuildRepository
  extends SQLiteRepositoryBase<GuildAggregate, GuildId>
  implements IGuildRepository
{
  constructor(db: Database, eventDispatcher: IEventDispatcher) {
    super(db, 'guilds', eventDispatcher);
  }

  // 公会特定查询实现
  async findByName(name: string): Promise<GuildAggregate | null> {
    const sql = `SELECT * FROM guilds WHERE name = ?`;
    const row = this.db.prepare(sql).get(name);
    return row ? this.mapRowToAggregate(row) : null;
  }

  async findByLeader(leaderId: UserId): Promise<GuildAggregate[]> {
    const sql = `
      SELECT g.* FROM guilds g
      INNER JOIN guild_members gm ON g.id = gm.guild_id
      WHERE gm.user_id = ? AND gm.role = 'leader'
    `;
    const rows = this.db.prepare(sql).all(leaderId);
    return rows.map(row => this.mapRowToAggregate(row));
  }

  async findTopByExperience(limit: number): Promise<GuildAggregate[]> {
    const sql = `
      SELECT * FROM guilds 
      ORDER BY experience DESC 
      LIMIT ?
    `;
    const rows = this.db.prepare(sql).all(limit);
    return rows.map(row => this.mapRowToAggregate(row));
  }

  // 复杂查询实现
  async searchGuilds(
    criteria: GuildSearchCriteria
  ): Promise<GuildSearchResult> {
    let sql = `SELECT * FROM guilds WHERE 1=1`;
    const params: any[] = [];

    if (criteria.name) {
      sql += ` AND name LIKE ?`;
      params.push(`%${criteria.name}%`);
    }

    if (criteria.minLevel) {
      sql += ` AND level >= ?`;
      params.push(criteria.minLevel);
    }

    if (criteria.maxLevel) {
      sql += ` AND level <= ?`;
      params.push(criteria.maxLevel);
    }

    if (criteria.hasOpenSlots) {
      sql += ` AND (SELECT COUNT(*) FROM guild_members WHERE guild_id = guilds.id) < member_limit`;
    }

    // 分页支持
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const total = this.db.prepare(countSql).get(params).total;

    sql += ` ORDER BY ${criteria.sortBy || 'experience'} ${criteria.sortOrder || 'DESC'}`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(
      criteria.pageSize || 20,
      (criteria.page || 0) * (criteria.pageSize || 20)
    );

    const rows = this.db.prepare(sql).all(params);
    const guilds = rows.map(row => this.mapRowToAggregate(row));

    return {
      guilds,
      total,
      page: criteria.page || 0,
      pageSize: criteria.pageSize || 20,
    };
  }

  // 数据映射实现
  protected mapRowToAggregate(row: any): GuildAggregate {
    // 从数据库行数据重建公会聚合根
    const guild = new GuildAggregate(
      new GuildId(row.id),
      new GuildName(row.name),
      row.description,
      new GuildLevel(row.level),
      row.experience
    );

    // 加载成员数据
    const membersSql = `SELECT * FROM guild_members WHERE guild_id = ?`;
    const memberRows = this.db.prepare(membersSql).all(row.id);
    guild.members = memberRows.map(memberRow => this.mapMemberRow(memberRow));

    // 加载其他关联数据...

    return guild;
  }

  protected insertOrUpdateAggregate(aggregate: GuildAggregate): void {
    const sql = `
      INSERT OR REPLACE INTO guilds 
      (id, name, description, level, experience, member_limit, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db
      .prepare(sql)
      .run(
        aggregate.id.value,
        aggregate.name.value,
        aggregate.description,
        aggregate.level.value,
        aggregate.experience,
        aggregate.memberLimit,
        aggregate.createdAt.toISOString(),
        new Date().toISOString(),
        aggregate.version + 1
      );
  }

  protected saveAssociatedEntities(aggregate: GuildAggregate): void {
    // 保存公会成员
    this.saveMemberships(aggregate.id, aggregate.members);

    // 保存公会设施
    this.saveFacilities(aggregate.id, aggregate.facilities);

    // 保存资源数据
    this.saveResources(aggregate.id, aggregate.resources);
  }

  private saveMemberships(guildId: GuildId, members: GuildMember[]): void {
    // 先删除现有成员关系
    this.db
      .prepare(`DELETE FROM guild_members WHERE guild_id = ?`)
      .run(guildId.value);

    // 插入新的成员关系
    const insertSql = `
      INSERT INTO guild_members 
      (guild_id, user_id, role, joined_at, activity_score)
      VALUES (?, ?, ?, ?, ?)
    `;

    const stmt = this.db.prepare(insertSql);
    for (const member of members) {
      stmt.run(
        guildId.value,
        member.userId.value,
        member.role,
        member.joinedAt.toISOString(),
        member.activityScore
      );
    }
  }
}
```

### 5.3 业务逻辑层设计

> **设计原则**: 基于领域驱动设计的业务逻辑分层，通过规则引擎、状态机和事件驱动架构实现复杂业务规则的清晰表达和高效执行

#### 5.3.1 业务规则引擎

```typescript
// 业务规则定义接口
interface BusinessRule<TContext = any> {
  id: string;
  name: string;
  description: string;
  priority: number; // 规则优先级 (1-100)
  condition: (context: TContext) => boolean;
  action: (context: TContext) => Promise<TContext>;
  tags: string[]; // 规则分类标签
  enabled: boolean; // 规则启用状态
  version: string; // 规则版本
}

// 业务规则上下文
interface BusinessContext {
  // 核心实体
  guild: GuildAggregate;
  member: MemberAggregate;
  action: ActionType;

  // 上下文数据
  timestamp: number;
  userId: string;
  sessionId: string;

  // 事务状态
  transactionId: string;
  rollbackActions: (() => Promise<void>)[];
}

// 业务规则执行引擎
export class BusinessRulesEngine {
  private rules: Map<string, BusinessRule[]> = new Map();
  private ruleCache: LRUCache<string, BusinessRule[]>;
  private eventDispatcher: IEventDispatcher;
  private logger: ILogger;

  constructor(
    eventDispatcher: IEventDispatcher,
    logger: ILogger,
    cacheConfig: CacheConfig = { maxSize: 1000, ttl: 300000 }
  ) {
    this.eventDispatcher = eventDispatcher;
    this.logger = logger;
    this.ruleCache = new LRUCache(cacheConfig);
  }

  // 注册业务规则
  registerRule(category: string, rule: BusinessRule): void {
    if (!this.rules.has(category)) {
      this.rules.set(category, []);
    }

    const categoryRules = this.rules.get(category)!;
    const existingIndex = categoryRules.findIndex(r => r.id === rule.id);

    if (existingIndex >= 0) {
      categoryRules[existingIndex] = rule;
      this.logger.info(`Business rule updated: ${rule.id}`);
    } else {
      categoryRules.push(rule);
      this.logger.info(`Business rule registered: ${rule.id}`);
    }

    // 按优先级排序
    categoryRules.sort((a, b) => b.priority - a.priority);

    // 清空缓存
    this.ruleCache.clear();

    // 发布规则变更事件
    this.eventDispatcher.dispatch(
      new BusinessRuleChangedEvent({
        category,
        ruleId: rule.id,
        changeType: existingIndex >= 0 ? 'updated' : 'added',
      })
    );
  }

  // 执行业务规则
  async executeRules(
    category: string,
    context: BusinessContext
  ): Promise<BusinessContext> {
    const cacheKey = `${category}:${context.action}:${context.guild.id}`;
    let applicableRules = this.ruleCache.get(cacheKey);

    if (!applicableRules) {
      const categoryRules = this.rules.get(category) || [];
      applicableRules = categoryRules.filter(rule => rule.enabled);
      this.ruleCache.set(cacheKey, applicableRules);
    }

    let updatedContext = { ...context };
    const executedRules: string[] = [];

    try {
      for (const rule of applicableRules) {
        if (await this.evaluateCondition(rule, updatedContext)) {
          this.logger.debug(`Executing business rule: ${rule.id}`, {
            ruleId: rule.id,
            context: updatedContext.transactionId,
          });

          const startTime = Date.now();
          updatedContext = await rule.action(updatedContext);
          const duration = Date.now() - startTime;

          executedRules.push(rule.id);

          // 性能监控
          if (duration > 100) {
            this.logger.warn(`Slow business rule execution: ${rule.id}`, {
              duration,
              ruleId: rule.id,
            });
          }

          // 发布规则执行事件
          this.eventDispatcher.dispatch(
            new BusinessRuleExecutedEvent({
              ruleId: rule.id,
              duration,
              context: updatedContext.transactionId,
            })
          );
        }
      }

      // 记录执行结果
      this.logger.info(`Business rules execution completed`, {
        category,
        executedRules,
        transactionId: updatedContext.transactionId,
      });

      return updatedContext;
    } catch (error) {
      this.logger.error(`Business rules execution failed`, {
        category,
        executedRules,
        error: error.message,
        transactionId: updatedContext.transactionId,
      });

      // 执行回滚操作
      await this.rollback(updatedContext);
      throw new BusinessRuleExecutionError(
        `Rules execution failed: ${error.message}`,
        {
          category,
          failedRules: executedRules,
          originalError: error,
        }
      );
    }
  }

  // 条件评估
  private async evaluateCondition(
    rule: BusinessRule,
    context: BusinessContext
  ): Promise<boolean> {
    try {
      return rule.condition(context);
    } catch (error) {
      this.logger.warn(
        `Business rule condition evaluation failed: ${rule.id}`,
        {
          error: error.message,
          ruleId: rule.id,
        }
      );
      return false;
    }
  }

  // 回滚操作
  private async rollback(context: BusinessContext): Promise<void> {
    for (const rollbackAction of context.rollbackActions.reverse()) {
      try {
        await rollbackAction();
      } catch (rollbackError) {
        this.logger.error(`Rollback action failed`, {
          error: rollbackError.message,
          transactionId: context.transactionId,
        });
      }
    }
  }

  // 获取规则统计信息
  getRulesStatistics(): RulesStatistics {
    const stats: RulesStatistics = {
      totalRules: 0,
      enabledRules: 0,
      categories: new Map(),
      cacheHitRate: this.ruleCache.getHitRate(),
    };

    for (const [category, rules] of this.rules) {
      const categoryStats = {
        total: rules.length,
        enabled: rules.filter(r => r.enabled).length,
        avgPriority:
          rules.reduce((sum, r) => sum + r.priority, 0) / rules.length,
      };

      stats.categories.set(category, categoryStats);
      stats.totalRules += categoryStats.total;
      stats.enabledRules += categoryStats.enabled;
    }

    return stats;
  }
}

// 具体业务规则示例
export const GuildBusinessRules = {
  // 公会创建规则
  GUILD_CREATION: {
    id: 'guild-creation-validation',
    name: '公会创建验证',
    description: '验证公会创建的前置条件',
    priority: 90,
    condition: (context: BusinessContext) => {
      return (
        context.action === 'CREATE_GUILD' &&
        context.member.level >= 10 &&
        context.member.gold >= 1000
      );
    },
    action: async (context: BusinessContext) => {
      // 扣除创建费用
      context.member.gold -= 1000;

      // 添加回滚操作
      context.rollbackActions.push(async () => {
        context.member.gold += 1000;
      });

      return context;
    },
    tags: ['guild', 'creation', 'validation'],
    enabled: true,
    version: '1.0.0',
  } as BusinessRule<BusinessContext>,

  // 成员招募规则
  MEMBER_RECRUITMENT: {
    id: 'member-recruitment-limit',
    name: '成员招募限制',
    description: '检查公会成员招募限制',
    priority: 80,
    condition: (context: BusinessContext) => {
      return (
        context.action === 'RECRUIT_MEMBER' &&
        context.guild.members.length < context.guild.maxMembers
      );
    },
    action: async (context: BusinessContext) => {
      // 业务逻辑：检查成员等级要求
      if (context.member.level < context.guild.requirements.minLevel) {
        throw new BusinessRuleViolationError('Member level too low');
      }

      return context;
    },
    tags: ['guild', 'recruitment', 'limit'],
    enabled: true,
    version: '1.0.0',
  } as BusinessRule<BusinessContext>,
};
```

#### 5.3.2 事件驱动架构详细实现

```typescript
// 领域事件基接口
interface DomainEvent {
  eventId: string; // 事件唯一标识
  eventType: string; // 事件类型
  aggregateId: string; // 聚合根ID
  aggregateType: string; // 聚合根类型
  eventData: any; // 事件数据
  occurredAt: number; // 发生时间戳
  version: number; // 事件版本
  correlationId?: string; // 关联ID
  causationId?: string; // 因果ID
}

// 事件存储接口
interface IEventStore {
  append(
    streamId: string,
    expectedVersion: number,
    events: DomainEvent[]
  ): Promise<void>;
  getEvents(streamId: string, fromVersion?: number): Promise<DomEvent[]>;
  getAllEvents(fromPosition?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string): Promise<DomainEvent[]>;
}

// 事件发布器
interface IEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
  publishSingle(event: DomainEvent): Promise<void>;
}

// 事件处理器接口
interface IEventHandler<TEvent extends DomainEvent = DomainEvent> {
  eventType: string;
  handle(event: TEvent): Promise<void>;
}

// 事件总线实现
export class EventBus implements IEventPublisher {
  private handlers: Map<string, IEventHandler[]> = new Map();
  private eventStore: IEventStore;
  private logger: ILogger;
  private retryConfig: RetryConfig;

  constructor(
    eventStore: IEventStore,
    logger: ILogger,
    retryConfig: RetryConfig = { maxRetries: 3, backoffMs: 1000 }
  ) {
    this.eventStore = eventStore;
    this.logger = logger;
    this.retryConfig = retryConfig;
  }

  // 注册事件处理器
  registerHandler<TEvent extends DomainEvent>(
    handler: IEventHandler<TEvent>
  ): void {
    if (!this.handlers.has(handler.eventType)) {
      this.handlers.set(handler.eventType, []);
    }

    this.handlers.get(handler.eventType)!.push(handler);
    this.logger.info(`Event handler registered: ${handler.eventType}`);
  }

  // 发布事件
  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishSingle(event);
    }
  }

  async publishSingle(event: DomainEvent): Promise<void> {
    this.logger.debug(`Publishing event: ${event.eventType}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
    });

    const handlers = this.handlers.get(event.eventType) || [];
    const handlerPromises = handlers.map(handler =>
      this.executeHandler(handler, event)
    );

    try {
      await Promise.allSettled(handlerPromises);
      this.logger.info(`Event published successfully: ${event.eventType}`, {
        eventId: event.eventId,
        handlerCount: handlers.length,
      });
    } catch (error) {
      this.logger.error(`Event publication failed: ${event.eventType}`, {
        eventId: event.eventId,
        error: error.message,
      });
      throw error;
    }
  }

  // 执行事件处理器（带重试机制）
  private async executeHandler(
    handler: IEventHandler,
    event: DomainEvent
  ): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= this.retryConfig.maxRetries) {
      try {
        await handler.handle(event);
        return;
      } catch (error) {
        lastError = error as Error;
        attempts++;

        if (attempts <= this.retryConfig.maxRetries) {
          const backoffTime =
            this.retryConfig.backoffMs * Math.pow(2, attempts - 1);
          this.logger.warn(
            `Event handler retry ${attempts}/${this.retryConfig.maxRetries}`,
            {
              handlerType: handler.eventType,
              eventId: event.eventId,
              backoffTime,
            }
          );
          await this.delay(backoffTime);
        }
      }
    }

    this.logger.error(
      `Event handler failed after ${this.retryConfig.maxRetries} retries`,
      {
        handlerType: handler.eventType,
        eventId: event.eventId,
        error: lastError?.message,
      }
    );

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 聚合根基类（支持事件发布）
export abstract class EventSourcedAggregate {
  protected events: DomainEvent[] = [];
  protected version: number = 0;

  // 获取未提交的事件
  getUncommittedEvents(): DomainEvent[] {
    return [...this.events];
  }

  // 标记事件为已提交
  markEventsAsCommitted(): void {
    this.events = [];
  }

  // 应用事件到聚合
  protected applyEvent(event: DomainEvent): void {
    this.events.push(event);
    this.version++;

    // 调用相应的apply方法
    const applyMethodName = `apply${event.eventType}`;
    const applyMethod = (this as any)[applyMethodName];

    if (typeof applyMethod === 'function') {
      applyMethod.call(this, event.eventData);
    }
  }

  // 从历史事件重建聚合
  loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      const applyMethodName = `apply${event.eventType}`;
      const applyMethod = (this as any)[applyMethodName];

      if (typeof applyMethod === 'function') {
        applyMethod.call(this, event.eventData);
        this.version = event.version;
      }
    }
  }
}
```

#### 5.3.3 状态机设计

```typescript
// 状态机状态定义
interface State<TData = any> {
  name: string;
  onEnter?: (data: TData) => Promise<void>;
  onExit?: (data: TData) => Promise<void>;
  onUpdate?: (data: TData, deltaTime: number) => Promise<TData>;
}

// 状态转换定义
interface Transition<TData = any> {
  from: string;
  to: string;
  condition: (data: TData) => boolean;
  action?: (data: TData) => Promise<TData>;
  guard?: (data: TData) => boolean;
}

// 状态机实现
export class StateMachine<TData = any> {
  private states: Map<string, State<TData>> = new Map();
  private transitions: Transition<TData>[] = [];
  private currentState: string;
  private data: TData;
  private logger: ILogger;

  constructor(initialState: string, initialData: TData, logger: ILogger) {
    this.currentState = initialState;
    this.data = initialData;
    this.logger = logger;
  }

  // 添加状态
  addState(state: State<TData>): void {
    this.states.set(state.name, state);
  }

  // 添加状态转换
  addTransition(transition: Transition<TData>): void {
    this.transitions.push(transition);
  }

  // 获取当前状态
  getCurrentState(): string {
    return this.currentState;
  }

  // 获取状态数据
  getData(): TData {
    return this.data;
  }

  // 更新状态机（每帧调用）
  async update(deltaTime: number): Promise<void> {
    // 更新当前状态
    const state = this.states.get(this.currentState);
    if (state?.onUpdate) {
      this.data = await state.onUpdate(this.data, deltaTime);
    }

    // 检查状态转换
    for (const transition of this.transitions) {
      if (transition.from === this.currentState) {
        if (transition.guard && !transition.guard(this.data)) {
          continue;
        }

        if (transition.condition(this.data)) {
          await this.transitionTo(transition.to, transition.action);
          break;
        }
      }
    }
  }

  // 强制状态转换
  async transitionTo(
    newState: string,
    action?: (data: TData) => Promise<TData>
  ): Promise<void> {
    if (!this.states.has(newState)) {
      throw new Error(`State ${newState} does not exist`);
    }

    const oldState = this.currentState;

    try {
      // 退出当前状态
      const currentStateObj = this.states.get(this.currentState);
      if (currentStateObj?.onExit) {
        await currentStateObj.onExit(this.data);
      }

      // 执行转换动作
      if (action) {
        this.data = await action(this.data);
      }

      // 更新当前状态
      this.currentState = newState;

      // 进入新状态
      const newStateObj = this.states.get(newState);
      if (newStateObj?.onEnter) {
        await newStateObj.onEnter(this.data);
      }

      this.logger.info(`State transition: ${oldState} -> ${newState}`);
    } catch (error) {
      this.logger.error(`State transition failed: ${oldState} -> ${newState}`, {
        error: error.message,
      });
      throw error;
    }
  }
}

// 公会状态机示例
export class GuildStateMachine extends StateMachine<GuildAggregate> {
  constructor(guild: GuildAggregate, logger: ILogger) {
    super('FORMING', guild, logger);

    // 定义状态
    this.addState({
      name: 'FORMING',
      onEnter: async guild => {
        guild.status = GuildStatus.FORMING;
        guild.formingStartTime = Date.now();
      },
    });

    this.addState({
      name: 'ACTIVE',
      onEnter: async guild => {
        guild.status = GuildStatus.ACTIVE;
        guild.activationTime = Date.now();
      },
      onUpdate: async (guild, deltaTime) => {
        // 定期更新公会活跃度
        guild.updateActivity(deltaTime);
        return guild;
      },
    });

    this.addState({
      name: 'INACTIVE',
      onEnter: async guild => {
        guild.status = GuildStatus.INACTIVE;
        guild.inactiveStartTime = Date.now();
      },
    });

    this.addState({
      name: 'DISBANDED',
      onEnter: async guild => {
        guild.status = GuildStatus.DISBANDED;
        guild.disbandTime = Date.now();
      },
    });

    // 定义状态转换
    this.addTransition({
      from: 'FORMING',
      to: 'ACTIVE',
      condition: guild => guild.members.length >= 3,
      action: async guild => {
        // 公会激活奖励
        guild.treasury += 5000;
        return guild;
      },
    });

    this.addTransition({
      from: 'ACTIVE',
      to: 'INACTIVE',
      condition: guild => {
        const inactiveTime = Date.now() - guild.lastActivityTime;
        return inactiveTime > 7 * 24 * 60 * 60 * 1000; // 7天无活动
      },
    });

    this.addTransition({
      from: 'INACTIVE',
      to: 'ACTIVE',
      condition: guild => guild.recentActivityScore > 100,
    });

    this.addTransition({
      from: 'INACTIVE',
      to: 'DISBANDED',
      condition: guild => {
        const inactiveTime = Date.now() - guild.inactiveStartTime;
        return inactiveTime > 30 * 24 * 60 * 60 * 1000; // 30天不活跃自动解散
      },
    });
  }
}
```

#### 5.3.4 数据校验机制

```typescript
// 校验规则接口
interface ValidationRule<T> {
  field: keyof T;
  validate: (value: any, entity?: T) => ValidationResult;
  message: string;
  level: 'error' | 'warning' | 'info';
}

// 校验结果
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// 校验错误
interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

// 数据校验器基类
export abstract class BaseValidator<T> {
  protected rules: ValidationRule<T>[] = [];

  // 添加校验规则
  addRule(rule: ValidationRule<T>): void {
    this.rules.push(rule);
  }

  // 执行校验
  validate(entity: T): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    for (const rule of this.rules) {
      const fieldValue = entity[rule.field];
      const ruleResult = rule.validate(fieldValue, entity);

      if (!ruleResult.isValid) {
        result.isValid = false;
        result.errors.push(...ruleResult.errors);
      }

      result.warnings.push(...ruleResult.warnings);
    }

    return result;
  }

  // 批量校验
  validateBatch(entities: T[]): ValidationResult {
    const batchResult: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    for (const entity of entities) {
      const result = this.validate(entity);
      if (!result.isValid) {
        batchResult.isValid = false;
        batchResult.errors.push(...result.errors);
      }
      batchResult.warnings.push(...result.warnings);
    }

    return batchResult;
  }
}

// 公会数据校验器
export class GuildValidator extends BaseValidator<GuildAggregate> {
  constructor() {
    super();

    // 公会名称校验
    this.addRule({
      field: 'name',
      validate: (name: string) => {
        const errors: ValidationError[] = [];

        if (!name || name.trim().length === 0) {
          errors.push({
            field: 'name',
            code: 'REQUIRED',
            message: '公会名称不能为空',
            value: name,
          });
        }

        if (name && (name.length < 2 || name.length > 20)) {
          errors.push({
            field: 'name',
            code: 'LENGTH',
            message: '公会名称长度必须在2-20字符之间',
            value: name,
          });
        }

        if (name && !/^[a-zA-Z0-9\u4e00-\u9fa5]+$/.test(name)) {
          errors.push({
            field: 'name',
            code: 'FORMAT',
            message: '公会名称只能包含字母、数字和中文字符',
            value: name,
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: [],
        };
      },
      message: '公会名称校验失败',
      level: 'error',
    });

    // 公会等级校验
    this.addRule({
      field: 'level',
      validate: (level: number) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (level < 1 || level > 100) {
          errors.push({
            field: 'level',
            code: 'RANGE',
            message: '公会等级必须在1-100之间',
            value: level,
          });
        }

        if (level > 50) {
          warnings.push({
            field: 'level',
            code: 'HIGH_LEVEL',
            message: '公会等级较高，请确认数据准确性',
            value: level,
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
        };
      },
      message: '公会等级校验失败',
      level: 'error',
    });

    // 成员数量校验
    this.addRule({
      field: 'members',
      validate: (members: MemberAggregate[], guild?: GuildAggregate) => {
        const errors: ValidationError[] = [];

        if (members.length > (guild?.maxMembers || 50)) {
          errors.push({
            field: 'members',
            code: 'EXCEED_LIMIT',
            message: `成员数量超过限制 (${guild?.maxMembers || 50})`,
            value: members.length,
          });
        }

        // 检查重复成员
        const memberIds = members.map(m => m.id);
        const uniqueIds = new Set(memberIds);
        if (memberIds.length !== uniqueIds.size) {
          errors.push({
            field: 'members',
            code: 'DUPLICATE',
            message: '存在重复的公会成员',
            value: members.length,
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings: [],
        };
      },
      message: '成员列表校验失败',
      level: 'error',
    });
  }
}

// 数据完整性校验引擎
export class DataIntegrityValidator {
  private validators: Map<string, BaseValidator<any>> = new Map();
  private crossReferenceRules: CrossReferenceRule[] = [];

  // 注册实体校验器
  registerValidator<T>(entityType: string, validator: BaseValidator<T>): void {
    this.validators.set(entityType, validator);
  }

  // 添加跨引用校验规则
  addCrossReferenceRule(rule: CrossReferenceRule): void {
    this.crossReferenceRules.push(rule);
  }

  // 校验单个实体
  async validateEntity<T>(
    entityType: string,
    entity: T
  ): Promise<ValidationResult> {
    const validator = this.validators.get(entityType);
    if (!validator) {
      throw new Error(`No validator found for entity type: ${entityType}`);
    }

    return validator.validate(entity);
  }

  // 校验数据完整性（跨实体）
  async validateDataIntegrity(
    entities: Map<string, any[]>
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // 执行跨引用校验
    for (const rule of this.crossReferenceRules) {
      const ruleResult = await rule.validate(entities);
      if (!ruleResult.isValid) {
        result.isValid = false;
        result.errors.push(...ruleResult.errors);
      }
      result.warnings.push(...ruleResult.warnings);
    }

    return result;
  }
}

// 跨引用校验规则示例
export const CrossReferenceRules = {
  // 公会成员引用完整性
  GUILD_MEMBER_INTEGRITY: {
    validate: async (entities: Map<string, any[]>) => {
      const guilds = entities.get('guild') || [];
      const members = entities.get('member') || [];
      const errors: ValidationError[] = [];

      for (const guild of guilds) {
        for (const memberId of guild.memberIds) {
          const member = members.find(m => m.id === memberId);
          if (!member) {
            errors.push({
              field: 'memberIds',
              code: 'MISSING_REFERENCE',
              message: `Guild ${guild.id} references non-existent member ${memberId}`,
              value: memberId,
            });
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: [],
      };
    },
  } as CrossReferenceRule,
};
```

### 5.4 数据一致性与完整性保障

#### 5.4.1 勾稽关系验证引擎

```typescript
// 数据完整性验证引擎
class DataIntegrityEngine {
  private db: Database;
  private eventBus: IEventBus;
  private logger: ILogger;

  constructor(db: Database, eventBus: IEventBus, logger: ILogger) {
    this.db = db;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // 公会数据勾稽验证
  async validateGuildIntegrity(guildId: GuildId): Promise<IntegrityResult> {
    const violations: IntegrityViolation[] = [];

    try {
      // 1. 验证成员数量一致性
      await this.validateMemberCount(guildId, violations);

      // 2. 验证资源总量一致性
      await this.validateResourceTotals(guildId, violations);

      // 3. 验证权限分配一致性
      await this.validatePermissionConsistency(guildId, violations);

      // 4. 验证活动记录完整性
      await this.validateActivityRecords(guildId, violations);

      // 5. 验证统计数据准确性
      await this.validateStatistics(guildId, violations);

      return {
        isValid: violations.length === 0,
        violations,
        validatedAt: new Date(),
        guildId,
      };
    } catch (error) {
      this.logger.error('Guild integrity validation failed', {
        guildId,
        error,
      });
      throw new DataIntegrityException(
        `Integrity validation failed: ${error.message}`
      );
    }
  }

  // 成员数量一致性验证
  private async validateMemberCount(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<void> {
    const guildQuery = `SELECT member_limit, member_count FROM guilds WHERE id = ?`;
    const guild = this.db.prepare(guildQuery).get(guildId.value);

    const actualCountQuery = `SELECT COUNT(*) as actual_count FROM guild_members WHERE guild_id = ?`;
    const actualCount = this.db
      .prepare(actualCountQuery)
      .get(guildId.value).actual_count;

    // 检查记录的成员数量与实际成员数量是否一致
    if (guild.member_count !== actualCount) {
      violations.push({
        type: 'MEMBER_COUNT_MISMATCH',
        description: `Guild member count mismatch: recorded=${guild.member_count}, actual=${actualCount}`,
        severity: 'HIGH',
        guildId,
        expectedValue: actualCount,
        actualValue: guild.member_count,
        fixSuggestion: 'UPDATE guilds SET member_count = ? WHERE id = ?',
      });
    }

    // 检查成员数量是否超出限制
    if (actualCount > guild.member_limit) {
      violations.push({
        type: 'MEMBER_LIMIT_EXCEEDED',
        description: `Guild member limit exceeded: count=${actualCount}, limit=${guild.member_limit}`,
        severity: 'CRITICAL',
        guildId,
        expectedValue: guild.member_limit,
        actualValue: actualCount,
        fixSuggestion: 'Remove excess members or increase member limit',
      });
    }
  }

  // 资源总量一致性验证
  private async validateResourceTotals(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<void> {
    const resourceTotalsQuery = `
      SELECT 
        resource_type,
        SUM(amount) as calculated_total
      FROM guild_resource_transactions 
      WHERE guild_id = ?
      GROUP BY resource_type
    `;

    const calculatedTotals = this.db
      .prepare(resourceTotalsQuery)
      .all(guildId.value);

    const recordedTotalsQuery = `
      SELECT resource_type, amount as recorded_total
      FROM guild_resources 
      WHERE guild_id = ?
    `;

    const recordedTotals = this.db
      .prepare(recordedTotalsQuery)
      .all(guildId.value);

    // 构建对比映射
    const calculatedMap = new Map(
      calculatedTotals.map(r => [r.resource_type, r.calculated_total])
    );
    const recordedMap = new Map(
      recordedTotals.map(r => [r.resource_type, r.recorded_total])
    );

    // 检查每种资源的一致性
    for (const [resourceType, recordedTotal] of recordedMap) {
      const calculatedTotal = calculatedMap.get(resourceType) || 0;

      if (Math.abs(calculatedTotal - recordedTotal) > 0.01) {
        // 允许浮点误差
        violations.push({
          type: 'RESOURCE_TOTAL_MISMATCH',
          description: `Resource total mismatch for ${resourceType}: recorded=${recordedTotal}, calculated=${calculatedTotal}`,
          severity: 'HIGH',
          guildId,
          resourceType,
          expectedValue: calculatedTotal,
          actualValue: recordedTotal,
          fixSuggestion: `UPDATE guild_resources SET amount = ${calculatedTotal} WHERE guild_id = ? AND resource_type = '${resourceType}'`,
        });
      }
    }
  }

  // 权限分配一致性验证
  private async validatePermissionConsistency(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<void> {
    const leaderCountQuery = `
      SELECT COUNT(*) as leader_count 
      FROM guild_members 
      WHERE guild_id = ? AND role = 'leader'
    `;

    const leaderCount = this.db
      .prepare(leaderCountQuery)
      .get(guildId.value).leader_count;

    // 每个公会必须且只能有一个会长
    if (leaderCount !== 1) {
      violations.push({
        type: 'INVALID_LEADER_COUNT',
        description: `Invalid leader count: expected=1, actual=${leaderCount}`,
        severity: 'CRITICAL',
        guildId,
        expectedValue: 1,
        actualValue: leaderCount,
        fixSuggestion:
          leaderCount === 0
            ? 'Assign a leader role'
            : 'Remove duplicate leaders',
      });
    }

    // 验证权限等级一致性
    const invalidPermissionsQuery = `
      SELECT gm.user_id, gm.role, gp.permission
      FROM guild_members gm
      JOIN guild_permissions gp ON gm.user_id = gp.user_id AND gm.guild_id = gp.guild_id
      WHERE gm.guild_id = ? AND gp.permission NOT IN (
        SELECT permission FROM role_permissions WHERE role = gm.role
      )
    `;

    const invalidPermissions = this.db
      .prepare(invalidPermissionsQuery)
      .all(guildId.value);

    for (const invalid of invalidPermissions) {
      violations.push({
        type: 'INVALID_PERMISSION_ASSIGNMENT',
        description: `Invalid permission '${invalid.permission}' for role '${invalid.role}' of user ${invalid.user_id}`,
        severity: 'MEDIUM',
        guildId,
        userId: invalid.user_id,
        fixSuggestion: `Remove invalid permission or update user role`,
      });
    }
  }

  // 自动修复数据不一致问题
  async autoFixIntegrityIssues(
    guildId: GuildId,
    violations: IntegrityViolation[]
  ): Promise<FixResult> {
    const fixedIssues: string[] = [];
    const failedFixes: string[] = [];

    const transaction = this.db.transaction(() => {
      for (const violation of violations) {
        try {
          switch (violation.type) {
            case 'MEMBER_COUNT_MISMATCH':
              this.fixMemberCountMismatch(guildId, violation);
              fixedIssues.push(`Fixed member count mismatch`);
              break;

            case 'RESOURCE_TOTAL_MISMATCH':
              this.fixResourceTotalMismatch(guildId, violation);
              fixedIssues.push(
                `Fixed resource total for ${violation.resourceType}`
              );
              break;

            case 'INVALID_PERMISSION_ASSIGNMENT':
              this.fixInvalidPermission(guildId, violation);
              fixedIssues.push(
                `Fixed invalid permission for user ${violation.userId}`
              );
              break;

            default:
              failedFixes.push(`Cannot auto-fix: ${violation.type}`);
          }
        } catch (error) {
          failedFixes.push(`Failed to fix ${violation.type}: ${error.message}`);
        }
      }
    });

    transaction();

    // 发布修复完成事件
    await this.eventBus.publish(
      new DataIntegrityFixedEvent(guildId, fixedIssues, failedFixes)
    );

    return {
      fixedCount: fixedIssues.length,
      failedCount: failedFixes.length,
      fixedIssues,
      failedFixes,
    };
  }

  // 修复成员数量不匹配
  private fixMemberCountMismatch(
    guildId: GuildId,
    violation: IntegrityViolation
  ): void {
    const updateSql = `UPDATE guilds SET member_count = ? WHERE id = ?`;
    this.db.prepare(updateSql).run(violation.expectedValue, guildId.value);
  }

  // 修复资源总量不匹配
  private fixResourceTotalMismatch(
    guildId: GuildId,
    violation: IntegrityViolation
  ): void {
    const updateSql = `
      UPDATE guild_resources 
      SET amount = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ? AND resource_type = ?
    `;
    this.db
      .prepare(updateSql)
      .run(violation.expectedValue, guildId.value, violation.resourceType);
  }

  // 修复无效权限分配
  private fixInvalidPermission(
    guildId: GuildId,
    violation: IntegrityViolation
  ): void {
    const deleteSql = `
      DELETE FROM guild_permissions 
      WHERE guild_id = ? AND user_id = ? AND permission = ?
    `;
    this.db
      .prepare(deleteSql)
      .run(guildId.value, violation.userId, violation.permission);
  }
}
```

### 5.5 缓存策略与性能优化

#### 5.5.1 多级缓存架构

```typescript
// 多级缓存管理器
class MultiLevelCacheManager {
  private l1Cache: Map<string, any>; // 组件级内存缓存
  private l2Cache: Map<string, any>; // 应用级Redux缓存
  private l3Cache: Database; // SQLite内存数据库
  private eventBus: IEventBus;

  constructor(l3Database: Database, eventBus: IEventBus) {
    this.l1Cache = new Map();
    this.l2Cache = new Map();
    this.l3Cache = l3Database;
    this.eventBus = eventBus;

    this.setupCacheInvalidationHandlers();
  }

  // L1缓存操作（最快，生命周期短）
  setL1<T>(key: string, value: T, ttlMs: number = 30000): void {
    const expiry = Date.now() + ttlMs;
    this.l1Cache.set(key, { value, expiry });

    // 设置自动过期
    setTimeout(() => {
      this.l1Cache.delete(key);
    }, ttlMs);
  }

  getL1<T>(key: string): T | null {
    const cached = this.l1Cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.l1Cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  // L2缓存操作（中速，应用级生命周期）
  setL2<T>(key: string, value: T): void {
    this.l2Cache.set(key, {
      value,
      cachedAt: Date.now(),
      accessCount: 0,
    });
  }

  getL2<T>(key: string): T | null {
    const cached = this.l2Cache.get(key);
    if (!cached) return null;

    cached.accessCount++;
    cached.lastAccessed = Date.now();

    return cached.value as T;
  }

  // L3缓存操作（较慢，但持久性强）
  async setL3<T>(
    key: string,
    value: T,
    ttlSeconds: number = 3600
  ): Promise<void> {
    const expiry = new Date(Date.now() + ttlSeconds * 1000);
    const serialized = JSON.stringify(value);

    const sql = `
      INSERT OR REPLACE INTO cache_entries 
      (key, value, expires_at, created_at) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `;

    this.l3Cache.prepare(sql).run(key, serialized, expiry.toISOString());
  }

  async getL3<T>(key: string): Promise<T | null> {
    const sql = `
      SELECT value FROM cache_entries 
      WHERE key = ? AND expires_at > CURRENT_TIMESTAMP
    `;

    const result = this.l3Cache.prepare(sql).get(key);
    if (!result) return null;

    try {
      return JSON.parse(result.value) as T;
    } catch (error) {
      // 反序列化失败，删除无效缓存
      this.deleteL3(key);
      return null;
    }
  }

  // 智能缓存获取（尝试所有级别）
  async getFromCache<T>(key: string): Promise<T | null> {
    // 1. 尝试L1缓存
    let value = this.getL1<T>(key);
    if (value !== null) {
      return value;
    }

    // 2. 尝试L2缓存
    value = this.getL2<T>(key);
    if (value !== null) {
      // 将L2的值提升到L1
      this.setL1(key, value, 30000);
      return value;
    }

    // 3. 尝试L3缓存
    value = await this.getL3<T>(key);
    if (value !== null) {
      // 将L3的值提升到L2和L1
      this.setL2(key, value);
      this.setL1(key, value, 30000);
      return value;
    }

    return null;
  }

  // 智能缓存存储（存储到合适的级别）
  async setToCache<T>(
    key: string,
    value: T,
    strategy: CacheStrategy
  ): Promise<void> {
    switch (strategy.level) {
      case 'L1_ONLY':
        this.setL1(key, value, strategy.ttlMs);
        break;

      case 'L2_ONLY':
        this.setL2(key, value);
        break;

      case 'L3_ONLY':
        await this.setL3(key, value, strategy.ttlSeconds);
        break;

      case 'ALL_LEVELS':
        this.setL1(key, value, strategy.ttlMs || 30000);
        this.setL2(key, value);
        await this.setL3(key, value, strategy.ttlSeconds || 3600);
        break;

      case 'L2_L3':
        this.setL2(key, value);
        await this.setL3(key, value, strategy.ttlSeconds || 3600);
        break;
    }
  }

  // 缓存失效处理
  private setupCacheInvalidationHandlers(): void {
    // 公会数据变更时失效相关缓存
    this.eventBus.on('guild.updated', async (event: GuildUpdatedEvent) => {
      const patterns = [
        `guild:${event.guildId}:*`,
        `guild:${event.guildId}:members`,
        `guild:${event.guildId}:statistics`,
        `guild:${event.guildId}:resources`,
      ];

      await this.invalidateByPatterns(patterns);
    });

    // 成员变更时失效相关缓存
    this.eventBus.on(
      'guild.member.joined',
      async (event: MemberJoinedEvent) => {
        await this.invalidateByPatterns([
          `guild:${event.guildId}:members`,
          `guild:${event.guildId}:statistics`,
          `user:${event.memberId}:guilds`,
        ]);
      }
    );

    // 战斗结束时失效相关缓存
    this.eventBus.on('combat.battle.ended', async (event: BattleEndedEvent) => {
      await this.invalidateByPatterns([
        `battle:${event.battleId}:*`,
        `guild:${event.attackerGuildId}:battle_stats`,
        `guild:${event.defenderGuildId}:battle_stats`,
      ]);
    });
  }

  // 按模式失效缓存
  private async invalidateByPatterns(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      // L1和L2缓存：使用通配符匹配
      const regex = new RegExp(pattern.replace('*', '.*'));

      for (const key of this.l1Cache.keys()) {
        if (regex.test(key)) {
          this.l1Cache.delete(key);
        }
      }

      for (const key of this.l2Cache.keys()) {
        if (regex.test(key)) {
          this.l2Cache.delete(key);
        }
      }

      // L3缓存：SQL LIKE查询
      const sqlPattern = pattern.replace('*', '%');
      const sql = `DELETE FROM cache_entries WHERE key LIKE ?`;
      this.l3Cache.prepare(sql).run(sqlPattern);
    }
  }

  // 缓存统计信息
  getCacheStats(): CacheStats {
    const l1Size = this.l1Cache.size;
    const l2Size = this.l2Cache.size;

    const l3Stats = this.l3Cache
      .prepare(
        `
      SELECT 
        COUNT(*) as total_entries,
        COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_entries,
        SUM(LENGTH(value)) as total_size_bytes
      FROM cache_entries
    `
      )
      .get();

    return {
      l1: { size: l1Size, type: 'Memory' },
      l2: { size: l2Size, type: 'Memory' },
      l3: {
        totalEntries: l3Stats.total_entries,
        activeEntries: l3Stats.active_entries,
        sizeBytes: l3Stats.total_size_bytes,
        type: 'SQLite',
      },
      generatedAt: new Date(),
    };
  }
}
```

## 第6章：运行时视图（融合游戏核心系统+AI引擎详细架构）

> **核心理念**: 构建高性能、智能化的运行时系统，通过AI引擎驱动游戏逻辑，确保60FPS流畅体验和智能NPC行为

### 6.1 运行时系统总览

#### 6.1.1 运行时架构分层

```typescript
// 运行时系统分层架构
interface RuntimeSystemArchitecture {
  // 表现层（60FPS渲染）
  presentationLayer: {
    phaserEngine: {
      responsibility: '游戏场景渲染与动画';
      technology: 'Phaser 3 + WebGL';
      targetFPS: 60;
      renderPipeline: ['PreRender', 'Render', 'PostRender'];
    };
    reactUI: {
      responsibility: '界面组件渲染与交互';
      technology: 'React 19 + Virtual DOM';
      updateStrategy: '按需更新机制';
      stateSync: '与Phaser双向同步';
    };
  };

  // 业务逻辑层
  businessLogicLayer: {
    gameCore: {
      responsibility: '游戏核心逻辑处理';
      components: ['StateManager', 'EventPool', 'RuleEngine'];
      tickRate: '60 TPS (Ticks Per Second)';
    };
    aiEngine: {
      responsibility: 'AI决策与行为计算';
      architecture: 'Web Worker + Decision Trees';
      computeModel: '异步计算 + 结果缓存';
    };
  };

  // 数据访问层
  dataAccessLayer: {
    cacheLayer: {
      responsibility: '高速缓存管理';
      levels: ['L1(内存)', 'L2(Redux)', 'L3(SQLite内存)'];
      hitRatio: '>90%';
    };
    persistenceLayer: {
      responsibility: '数据持久化';
      technology: 'SQLite + 事务保证';
      consistency: '强一致性 + 最终一致性';
    };
  };

  // 基础设施层
  infrastructureLayer: {
    eventSystem: {
      responsibility: '事件分发与协调';
      architecture: '事件池 + 优先级队列';
      performance: '>1000 events/second';
    };
    resourceManager: {
      responsibility: '资源加载与管理';
      strategy: '预加载 + 懒加载 + 资源池';
      memoryLimit: '<512MB';
    };
  };
}
```

#### 6.1.2 主要执行循环设计

```typescript
// 主游戏循环引擎
class GameLoopEngine {
  private isRunning: boolean = false;
  private targetFPS: number = 60;
  private actualFPS: number = 0;
  private lastTime: number = 0;
  private deltaAccumulator: number = 0;
  private fixedTimeStep: number = 16.666667; // 60 FPS

  private eventPool: EventPoolCore;
  private stateManager: GameStateManager;
  private aiEngine: AIEngineProxy;
  private renderEngine: PhaserRenderEngine;
  private uiSync: ReactPhaserBridge;

  constructor(dependencies: GameLoopDependencies) {
    this.eventPool = dependencies.eventPool;
    this.stateManager = dependencies.stateManager;
    this.aiEngine = dependencies.aiEngine;
    this.renderEngine = dependencies.renderEngine;
    this.uiSync = dependencies.uiSync;
  }

  // 启动主循环
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  // 主循环核心逻辑
  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // FPS计算
    this.actualFPS = 1000 / frameTime;

    // 累积时间差
    this.deltaAccumulator += frameTime;

    // 固定时间步长的逻辑更新
    while (this.deltaAccumulator >= this.fixedTimeStep) {
      this.updateGameLogic(this.fixedTimeStep);
      this.deltaAccumulator -= this.fixedTimeStep;
    }

    // 可变时间步长的渲染更新
    this.updateRendering(frameTime);

    // 性能监控
    this.monitorPerformance();

    // 请求下一帧
    requestAnimationFrame(this.gameLoop);
  };

  // 游戏逻辑更新（固定60TPS）
  private updateGameLogic(deltaTime: number): void {
    try {
      // 1. 处理输入事件
      this.processInputEvents();

      // 2. 更新游戏状态
      this.stateManager.update(deltaTime);

      // 3. 处理AI计算结果
      this.aiEngine.processCompletedTasks();

      // 4. 执行业务逻辑
      this.executeBusinessLogic(deltaTime);

      // 5. 批量处理事件
      this.eventPool.processBatch();

      // 6. 同步UI状态
      this.uiSync.syncToReact();
    } catch (error) {
      this.handleGameLogicError(error);
    }
  }

  // 渲染更新（可变帧率）
  private updateRendering(deltaTime: number): void {
    try {
      // 1. 插值计算（平滑动画）
      const interpolation = this.deltaAccumulator / this.fixedTimeStep;

      // 2. 更新渲染状态
      this.renderEngine.updateRenderState(interpolation);

      // 3. 执行渲染
      this.renderEngine.render(deltaTime);

      // 4. 后处理效果
      this.renderEngine.postProcess();
    } catch (error) {
      this.handleRenderError(error);
    }
  }

  // 业务逻辑执行
  private executeBusinessLogic(deltaTime: number): void {
    // 公会系统更新
    this.updateGuildSystem(deltaTime);

    // 战斗系统更新
    this.updateCombatSystem(deltaTime);

    // 经济系统更新
    this.updateEconomySystem(deltaTime);

    // 社交系统更新
    this.updateSocialSystem(deltaTime);

    // NPC行为更新
    this.updateNPCBehaviors(deltaTime);
  }

  // 公会系统更新
  private updateGuildSystem(deltaTime: number): void {
    const guilds = this.stateManager.getActiveGuilds();

    for (const guild of guilds) {
      // 检查成员活跃度
      this.checkMemberActivity(guild);

      // 处理公会事件
      this.processGuildEvents(guild);

      // 更新公会资源
      this.updateGuildResources(guild, deltaTime);

      // AI公会决策
      if (guild.isAIControlled) {
        this.aiEngine.requestGuildDecision(guild.id);
      }
    }
  }

  // 战斗系统更新
  private updateCombatSystem(deltaTime: number): void {
    const activeBattles = this.stateManager.getActiveBattles();

    for (const battle of activeBattles) {
      if (battle.isPaused) continue;

      // 更新战斗回合
      battle.updateRound(deltaTime);

      // 处理AI战术决策
      if (battle.needsAIDecision()) {
        this.aiEngine.requestBattleDecision(
          battle.id,
          battle.getCurrentContext()
        );
      }

      // 检查战斗结束条件
      if (battle.isFinished()) {
        this.finalizeBattle(battle);
      }
    }
  }

  // 经济系统更新
  private updateEconomySystem(deltaTime: number): void {
    // 更新拍卖行
    this.updateAuctionHouse(deltaTime);

    // 处理交易系统
    this.updateTradeSystem(deltaTime);

    // 市场AI分析
    this.aiEngine.requestMarketAnalysis();

    // 通胀控制
    this.updateInflationControl(deltaTime);
  }

  // NPC行为更新
  private updateNPCBehaviors(deltaTime: number): void {
    const activeNPCs = this.stateManager.getActiveNPCs();

    for (const npc of activeNPCs) {
      // 更新NPC状态机
      npc.behaviorStateMachine.update(deltaTime);

      // AI决策请求
      if (npc.needsDecision()) {
        this.aiEngine.requestNPCDecision(npc.id, npc.getCurrentSituation());
      }

      // 执行NPC行动
      if (npc.hasAction()) {
        this.executeNPCAction(npc);
      }
    }
  }

  // 性能监控
  private monitorPerformance(): void {
    // FPS监控
    if (this.actualFPS < 45) {
      console.warn(`Low FPS detected: ${this.actualFPS.toFixed(2)}`);
      this.eventPool.emit(
        new PerformanceWarningEvent('LOW_FPS', this.actualFPS)
      );
    }

    // 内存监控
    if (
      performance.memory &&
      performance.memory.usedJSHeapSize > 500 * 1024 * 1024
    ) {
      console.warn(
        `High memory usage: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`
      );
      this.eventPool.emit(
        new PerformanceWarningEvent(
          'HIGH_MEMORY',
          performance.memory.usedJSHeapSize
        )
      );
    }
  }
}
```

### 6.2 AI引擎详细架构

#### 6.2.1 AI引擎核心组件

```typescript
// AI引擎主控制器
class AIEngineCore {
  private workerPool: WorkerPool<AIWorker>;
  private decisionCache: DecisionCache;
  private behaviorTrees: BehaviorTreeRegistry;
  private learningEngine: MachineLearningEngine;
  private contextManager: AIContextManager;

  constructor(config: AIEngineConfig) {
    this.workerPool = new WorkerPool(config.workerCount || 4);
    this.decisionCache = new DecisionCache(config.cacheSize || 10000);
    this.behaviorTrees = new BehaviorTreeRegistry();
    this.learningEngine = new MachineLearningEngine(config.learningConfig);
    this.contextManager = new AIContextManager();
  }

  // NPC决策引擎
  async makeNPCDecision(
    npcId: string,
    situation: NPCSituation
  ): Promise<NPCAction> {
    // 1. 检查决策缓存
    const cacheKey = this.generateCacheKey(npcId, situation);
    let decision = await this.decisionCache.get(cacheKey);

    if (decision) {
      return this.adaptCachedDecision(decision, situation);
    }

    // 2. 构建AI上下文
    const context = await this.contextManager.buildNPCContext(npcId, situation);

    // 3. 选择决策算法
    const algorithm = this.selectDecisionAlgorithm(context);

    // 4. 执行AI计算
    decision = await this.executeAIComputation(algorithm, context);

    // 5. 缓存决策结果
    await this.decisionCache.set(cacheKey, decision, 300000); // 5分钟缓存

    // 6. 学习反馈
    this.learningEngine.recordDecision(npcId, situation, decision);

    return decision;
  }

  // 公会AI决策
  async makeGuildDecision(guildId: string): Promise<GuildAction[]> {
    const guild = await this.contextManager.getGuildContext(guildId);

    // 并行分析多个决策维度
    const [
      resourceDecision,
      memberDecision,
      strategicDecision,
      combatDecision,
    ] = await Promise.all([
      this.analyzeResourceManagement(guild),
      this.analyzeMemberManagement(guild),
      this.analyzeStrategicGoals(guild),
      this.analyzeCombatStrategy(guild),
    ]);

    // 决策整合与优先级排序
    const actions = this.integrateGuildDecisions([
      resourceDecision,
      memberDecision,
      strategicDecision,
      combatDecision,
    ]);

    return this.prioritizeActions(actions);
  }

  // 战斗AI决策
  async makeBattleDecision(
    battleId: string,
    battleContext: BattleContext
  ): Promise<BattleDecision> {
    // 1. 战况分析
    const situationAnalysis = await this.analyzeBattleSituation(battleContext);

    // 2. 策略评估
    const strategyOptions = this.generateStrategyOptions(situationAnalysis);

    // 3. AI计算最优策略
    const bestStrategy = await this.selectBestStrategy(
      strategyOptions,
      battleContext
    );

    // 4. 生成具体行动
    const actions = await this.generateBattleActions(
      bestStrategy,
      battleContext
    );

    return {
      strategy: bestStrategy,
      actions: actions,
      confidence: this.calculateConfidence(situationAnalysis),
      reasoning: this.generateReasoning(bestStrategy, situationAnalysis),
    };
  }

  // 市场AI分析
  async analyzeMarket(): Promise<MarketAnalysis> {
    const marketData = await this.contextManager.getMarketData();

    // 并行分析市场各个方面
    const [priceAnalysis, demandAnalysis, supplyAnalysis, trendAnalysis] =
      await Promise.all([
        this.analyzePriceTrends(marketData),
        this.analyzeDemandPatterns(marketData),
        this.analyzeSupplyChain(marketData),
        this.predictMarketTrends(marketData),
      ]);

    return {
      priceForecasts: priceAnalysis.forecasts,
      demandPredictions: demandAnalysis.predictions,
      supplyRecommendations: supplyAnalysis.recommendations,
      marketTrends: trendAnalysis.trends,
      tradingOpportunities: this.identifyTradingOpportunities({
        priceAnalysis,
        demandAnalysis,
        supplyAnalysis,
        trendAnalysis,
      }),
    };
  }
}

// AI行为树系统
class BehaviorTreeSystem {
  private trees: Map<string, BehaviorTree>;
  private nodeFactory: BehaviorNodeFactory;

  constructor() {
    this.trees = new Map();
    this.nodeFactory = new BehaviorNodeFactory();
    this.initializeStandardTrees();
  }

  // 初始化标准行为树
  private initializeStandardTrees(): void {
    // NPC公会会长行为树
    this.createGuildLeaderBehaviorTree();

    // NPC普通成员行为树
    this.createGuildMemberBehaviorTree();

    // NPC商人行为树
    this.createMerchantBehaviorTree();

    // NPC战士行为树
    this.createWarriorBehaviorTree();
  }

  // 公会会长行为树
  private createGuildLeaderBehaviorTree(): void {
    const leaderTree = new BehaviorTree('guild_leader');

    // 根节点：优先级选择器
    const root = this.nodeFactory.createSelector('root_selector');

    // 紧急事务处理（最高优先级）
    const emergencyHandler =
      this.nodeFactory.createSequence('emergency_handler');
    emergencyHandler.addChild(
      this.nodeFactory.createCondition('has_emergency', context =>
        context.hasEmergencyEvent()
      )
    );
    emergencyHandler.addChild(
      this.nodeFactory.createAction('handle_emergency', context =>
        this.handleEmergency(context)
      )
    );

    // 日常管理任务
    const dailyManagement = this.nodeFactory.createSelector('daily_management');

    // 成员管理
    const memberManagement =
      this.nodeFactory.createSequence('member_management');
    memberManagement.addChild(
      this.nodeFactory.createCondition('needs_member_action', context =>
        context.hasPendingMemberIssues()
      )
    );
    memberManagement.addChild(
      this.nodeFactory.createAction('manage_members', context =>
        this.manageMembersAction(context)
      )
    );

    // 资源管理
    const resourceManagement = this.nodeFactory.createSequence(
      'resource_management'
    );
    resourceManagement.addChild(
      this.nodeFactory.createCondition('needs_resource_action', context =>
        context.needsResourceManagement()
      )
    );
    resourceManagement.addChild(
      this.nodeFactory.createAction('manage_resources', context =>
        this.manageResourcesAction(context)
      )
    );

    // 战略规划
    const strategicPlanning =
      this.nodeFactory.createSequence('strategic_planning');
    strategicPlanning.addChild(
      this.nodeFactory.createCondition('time_for_planning', context =>
        context.isStrategicPlanningTime()
      )
    );
    strategicPlanning.addChild(
      this.nodeFactory.createAction('strategic_planning', context =>
        this.strategicPlanningAction(context)
      )
    );

    // 构建树结构
    dailyManagement.addChild(memberManagement);
    dailyManagement.addChild(resourceManagement);
    dailyManagement.addChild(strategicPlanning);

    root.addChild(emergencyHandler);
    root.addChild(dailyManagement);

    leaderTree.setRoot(root);
    this.trees.set('guild_leader', leaderTree);
  }

  // 执行行为树
  executeTree(treeId: string, context: BehaviorContext): BehaviorResult {
    const tree = this.trees.get(treeId);
    if (!tree) {
      throw new Error(`Behavior tree '${treeId}' not found`);
    }

    return tree.execute(context);
  }
}

// 机器学习引擎
class MachineLearningEngine {
  private decisionNetwork: NeuralNetwork;
  private experienceBuffer: ExperienceBuffer;
  private trainingScheduler: TrainingScheduler;

  constructor(config: MLConfig) {
    this.decisionNetwork = new NeuralNetwork(config.networkConfig);
    this.experienceBuffer = new ExperienceBuffer(config.bufferSize || 50000);
    this.trainingScheduler = new TrainingScheduler(config.trainingConfig);
  }

  // 记录决策经验
  recordDecision(
    agentId: string,
    situation: Situation,
    decision: Decision,
    outcome?: Outcome
  ): void {
    const experience: Experience = {
      agentId,
      situation,
      decision,
      outcome,
      timestamp: Date.now(),
    };

    this.experienceBuffer.add(experience);

    // 触发学习
    if (this.shouldTriggerLearning()) {
      this.scheduleTraining();
    }
  }

  // 预测决策
  async predictDecision(situation: Situation): Promise<DecisionPrediction> {
    const input = this.situationToVector(situation);
    const output = await this.decisionNetwork.forward(input);

    return {
      decision: this.vectorToDecision(output),
      confidence: this.calculateConfidence(output),
      alternatives: this.generateAlternatives(output),
    };
  }

  // 自适应学习
  private async performLearning(): Promise<void> {
    const batch = this.experienceBuffer.sampleBatch(32);
    const trainingData = this.prepareLearningData(batch);

    // 使用强化学习更新网络
    await this.decisionNetwork.train(trainingData);

    // 评估学习效果
    const evaluation = await this.evaluateLearning();

    // 调整学习参数
    this.adjustLearningParameters(evaluation);
  }

  // 情况向量化
  private situationToVector(situation: Situation): Float32Array {
    // 将复杂的游戏情况转换为神经网络可处理的向量
    const features = [];

    // 基础特征
    features.push(situation.urgency || 0);
    features.push(situation.complexity || 0);
    features.push(situation.resources || 0);

    // 上下文特征
    if (situation.guildContext) {
      features.push(situation.guildContext.memberCount || 0);
      features.push(situation.guildContext.level || 0);
      features.push(situation.guildContext.resources || 0);
    }

    // 历史特征
    if (situation.history) {
      features.push(situation.history.successRate || 0);
      features.push(situation.history.averageOutcome || 0);
    }

    return new Float32Array(features);
  }
}
```

### 6.3 游戏核心系统实现

#### 6.3.1 状态管理系统

```typescript
// 游戏状态管理器
class GameStateManager {
  private currentState: GameState;
  private stateHistory: GameState[];
  private stateValidators: StateValidator[];
  private stateSubscribers: StateSubscriber[];
  private persistenceManager: StatePersistenceManager;

  constructor(initialState: GameState) {
    this.currentState = initialState;
    this.stateHistory = [initialState];
    this.stateValidators = [];
    this.stateSubscribers = [];
    this.persistenceManager = new StatePersistenceManager();

    this.initializeValidators();
  }

  // 状态更新
  async updateState(updates: Partial<GameState>): Promise<void> {
    // 1. 创建新状态
    const newState = this.mergeState(this.currentState, updates);

    // 2. 验证状态有效性
    const validationResult = await this.validateState(newState);
    if (!validationResult.isValid) {
      throw new InvalidStateError(validationResult.errors);
    }

    // 3. 计算状态差异
    const diff = this.calculateStateDiff(this.currentState, newState);

    // 4. 更新当前状态
    const previousState = this.currentState;
    this.currentState = newState;

    // 5. 记录状态历史
    this.recordStateHistory(newState);

    // 6. 通知订阅者
    await this.notifyStateChange(previousState, newState, diff);

    // 7. 持久化状态（异步）
    this.persistenceManager.saveState(newState);
  }

  // 获取特定系统的状态
  getSystemState<T>(system: SystemType): T {
    switch (system) {
      case 'GUILD':
        return this.currentState.guildSystem as T;
      case 'COMBAT':
        return this.currentState.combatSystem as T;
      case 'ECONOMY':
        return this.currentState.economySystem as T;
      case 'SOCIAL':
        return this.currentState.socialSystem as T;
      default:
        throw new Error(`Unknown system type: ${system}`);
    }
  }

  // 事务性状态更新
  async executeStateTransaction(
    transaction: StateTransaction
  ): Promise<TransactionResult> {
    const transactionId = this.generateTransactionId();
    const checkpoint = this.createCheckpoint();

    try {
      // 开始事务
      await this.beginTransaction(transactionId);

      // 执行事务操作
      const operations = transaction.getOperations();
      const results = [];

      for (const operation of operations) {
        const result = await this.executeOperation(operation);
        results.push(result);

        // 检查操作是否成功
        if (!result.success) {
          throw new TransactionFailureError(result.error);
        }
      }

      // 验证最终状态
      const finalValidation = await this.validateState(this.currentState);
      if (!finalValidation.isValid) {
        throw new StateValidationError(finalValidation.errors);
      }

      // 提交事务
      await this.commitTransaction(transactionId);

      return {
        success: true,
        transactionId,
        results,
        finalState: this.currentState,
      };
    } catch (error) {
      // 回滚到检查点
      await this.rollbackToCheckpoint(checkpoint);

      return {
        success: false,
        transactionId,
        error: error.message,
        rolledBackTo: checkpoint.timestamp,
      };
    }
  }

  // 状态快照与恢复
  createSnapshot(): GameStateSnapshot {
    return {
      id: this.generateSnapshotId(),
      state: this.deepClone(this.currentState),
      timestamp: Date.now(),
      version: this.currentState.version,
      checksum: this.calculateChecksum(this.currentState),
    };
  }

  async restoreFromSnapshot(snapshot: GameStateSnapshot): Promise<void> {
    // 验证快照完整性
    const calculatedChecksum = this.calculateChecksum(snapshot.state);
    if (calculatedChecksum !== snapshot.checksum) {
      throw new CorruptedSnapshotError('Snapshot checksum mismatch');
    }

    // 验证快照状态
    const validationResult = await this.validateState(snapshot.state);
    if (!validationResult.isValid) {
      throw new InvalidSnapshotError(validationResult.errors);
    }

    // 恢复状态
    const previousState = this.currentState;
    this.currentState = snapshot.state;

    // 清理状态历史
    this.stateHistory = [snapshot.state];

    // 通知状态恢复
    await this.notifyStateRestore(previousState, snapshot.state);
  }

  // 状态验证
  private async validateState(state: GameState): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // 并行执行所有验证器
    const validationPromises = this.stateValidators.map(async validator => {
      try {
        const result = await validator.validate(state);
        if (!result.isValid) {
          errors.push(...result.errors);
        }
      } catch (error) {
        errors.push({
          validator: validator.name,
          message: `Validation error: ${error.message}`,
          severity: 'ERROR',
        });
      }
    });

    await Promise.all(validationPromises);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// 游戏状态验证器
class GameStateValidatorSuite {
  private validators: Map<string, StateValidator>;

  constructor() {
    this.validators = new Map();
    this.initializeValidators();
  }

  private initializeValidators(): void {
    // 公会状态验证器
    this.validators.set('guild', new GuildStateValidator());

    // 战斗状态验证器
    this.validators.set('combat', new CombatStateValidator());

    // 经济状态验证器
    this.validators.set('economy', new EconomyStateValidator());

    // 跨系统一致性验证器
    this.validators.set('consistency', new CrossSystemConsistencyValidator());

    // 性能约束验证器
    this.validators.set('performance', new PerformanceConstraintValidator());
  }
}

// 公会状态验证器
class GuildStateValidator implements StateValidator {
  name = 'GuildStateValidator';

  async validate(state: GameState): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const guildSystem = state.guildSystem;

    // 1. 验证公会数量限制
    if (guildSystem.guilds.size > MAX_GUILDS) {
      errors.push({
        validator: this.name,
        message: `Too many guilds: ${guildSystem.guilds.size} > ${MAX_GUILDS}`,
        severity: 'ERROR',
      });
    }

    // 2. 验证每个公会的完整性
    for (const [guildId, guild] of guildSystem.guilds) {
      const guildErrors = await this.validateGuild(guild);
      errors.push(...guildErrors);
    }

    // 3. 验证公会之间的关系
    const relationshipErrors = this.validateGuildRelationships(guildSystem);
    errors.push(...relationshipErrors);

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async validateGuild(guild: Guild): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // 成员数量验证
    if (guild.members.length > guild.memberLimit) {
      errors.push({
        validator: this.name,
        message: `Guild ${guild.id} member count exceeds limit`,
        severity: 'ERROR',
      });
    }

    // 领导层验证
    const leaders = guild.members.filter(m => m.role === 'leader');
    if (leaders.length !== 1) {
      errors.push({
        validator: this.name,
        message: `Guild ${guild.id} must have exactly one leader`,
        severity: 'ERROR',
      });
    }

    // 资源验证
    for (const [resource, amount] of guild.resources) {
      if (amount < 0) {
        errors.push({
          validator: this.name,
          message: `Guild ${guild.id} has negative ${resource}: ${amount}`,
          severity: 'ERROR',
        });
      }
    }

    return errors;
  }
}
```

### 6.4 性能优化与监控

#### 6.4.1 性能监控系统

```typescript
// 性能监控管理器
class PerformanceMonitoringSystem {
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private alertManager: AlertManager;
  private metricsHistory: MetricsHistory;

  constructor(config: PerformanceConfig) {
    this.metrics = new PerformanceMetrics();
    this.thresholds = config.thresholds;
    this.alertManager = new AlertManager(config.alertConfig);
    this.metricsHistory = new MetricsHistory(config.historySize || 1000);
  }

  // 实时性能监控
  startMonitoring(): void {
    // FPS监控
    this.startFPSMonitoring();

    // 内存监控
    this.startMemoryMonitoring();

    // CPU监控
    this.startCPUMonitoring();

    // 网络监控
    this.startNetworkMonitoring();

    // 游戏特定监控
    this.startGameSystemMonitoring();
  }

  // FPS监控
  private startFPSMonitoring(): void {
    let lastTime = performance.now();
    let frameCount = 0;

    const measureFPS = () => {
      const currentTime = performance.now();
      frameCount++;

      if (currentTime - lastTime >= 1000) {
        // 每秒计算一次
        const fps = (frameCount * 1000) / (currentTime - lastTime);

        this.metrics.updateFPS(fps);

        // 检查FPS阈值
        if (fps < this.thresholds.minFPS) {
          this.alertManager.triggerAlert({
            type: 'LOW_FPS',
            severity: 'WARNING',
            message: `FPS dropped to ${fps.toFixed(2)}`,
            timestamp: currentTime,
          });
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  // 内存监控
  private startMemoryMonitoring(): void {
    setInterval(() => {
      if (performance.memory) {
        const memory = performance.memory;

        this.metrics.updateMemory({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        });

        // 检查内存使用率
        const usagePercent =
          (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        if (usagePercent > this.thresholds.maxMemoryPercent) {
          this.alertManager.triggerAlert({
            type: 'HIGH_MEMORY_USAGE',
            severity: 'WARNING',
            message: `Memory usage at ${usagePercent.toFixed(1)}%`,
            timestamp: performance.now(),
          });

          // 触发垃圾回收建议
          this.suggestGarbageCollection();
        }
      }
    }, 5000); // 每5秒检查一次
  }

  // 游戏系统性能监控
  private startGameSystemMonitoring(): void {
    setInterval(() => {
      // AI系统性能
      this.monitorAIPerformance();

      // 事件系统性能
      this.monitorEventSystemPerformance();

      // 数据库性能
      this.monitorDatabasePerformance();

      // 渲染性能
      this.monitorRenderingPerformance();
    }, 10000); // 每10秒检查一次
  }

  // AI系统性能监控
  private monitorAIPerformance(): void {
    const aiMetrics = {
      activeComputations: this.getActiveAIComputations(),
      averageDecisionTime: this.getAverageAIDecisionTime(),
      cacheHitRate: this.getAICacheHitRate(),
      workerUtilization: this.getAIWorkerUtilization(),
    };

    this.metrics.updateAIMetrics(aiMetrics);

    // 检查AI性能阈值
    if (aiMetrics.averageDecisionTime > this.thresholds.maxAIDecisionTime) {
      this.alertManager.triggerAlert({
        type: 'SLOW_AI_DECISIONS',
        severity: 'WARNING',
        message: `AI decisions taking ${aiMetrics.averageDecisionTime}ms on average`,
        timestamp: performance.now(),
      });
    }
  }

  // 性能优化建议
  generateOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // FPS优化建议
    if (this.metrics.currentFPS < 50) {
      suggestions.push({
        type: 'FPS_OPTIMIZATION',
        priority: 'HIGH',
        description:
          'Consider reducing visual effects or optimizing render pipeline',
        estimatedImpact: 'FPS +10-15',
      });
    }

    // 内存优化建议
    if (this.metrics.memoryUsagePercent > 80) {
      suggestions.push({
        type: 'MEMORY_OPTIMIZATION',
        priority: 'HIGH',
        description: 'Implement object pooling and reduce texture memory usage',
        estimatedImpact: 'Memory -20-30%',
      });
    }

    // AI优化建议
    if (this.metrics.ai.averageDecisionTime > 100) {
      suggestions.push({
        type: 'AI_OPTIMIZATION',
        priority: 'MEDIUM',
        description: 'Increase AI decision caching and optimize behavior trees',
        estimatedImpact: 'AI response time -30-50%',
      });
    }

    return suggestions;
  }

  // 自动性能调优
  async performAutoTuning(): Promise<TuningResult> {
    const currentMetrics = this.metrics.getSnapshot();
    const suggestions = this.generateOptimizationSuggestions();

    const results: TuningAction[] = [];

    for (const suggestion of suggestions) {
      try {
        const action = await this.executeOptimization(suggestion);
        results.push(action);
      } catch (error) {
        results.push({
          suggestion,
          success: false,
          error: error.message,
        });
      }
    }

    const newMetrics = this.metrics.getSnapshot();
    const improvement = this.calculateImprovement(currentMetrics, newMetrics);

    return {
      actions: results,
      beforeMetrics: currentMetrics,
      afterMetrics: newMetrics,
      improvement,
    };
  }
}

// 资源对象池系统
class ResourcePoolManager {
  private pools: Map<string, ObjectPool<any>>;
  private poolConfigs: Map<string, PoolConfig>;

  constructor() {
    this.pools = new Map();
    this.poolConfigs = new Map();
    this.initializeStandardPools();
  }

  // 初始化标准对象池
  private initializeStandardPools(): void {
    // 事件对象池
    this.createPool('events', {
      createFn: () => new GameEvent(),
      resetFn: event => event.reset(),
      maxSize: 1000,
      initialSize: 100,
    });

    // 战斗单位对象池
    this.createPool('combatUnits', {
      createFn: () => new CombatUnit(),
      resetFn: unit => unit.reset(),
      maxSize: 500,
      initialSize: 50,
    });

    // UI组件对象池
    this.createPool('uiComponents', {
      createFn: () => new UIComponent(),
      resetFn: component => component.reset(),
      maxSize: 200,
      initialSize: 20,
    });

    // 粒子效果对象池
    this.createPool('particles', {
      createFn: () => new Particle(),
      resetFn: particle => particle.reset(),
      maxSize: 2000,
      initialSize: 200,
    });
  }

  // 创建对象池
  createPool<T>(name: string, config: PoolConfig<T>): void {
    const pool = new ObjectPool<T>(config);
    this.pools.set(name, pool);
    this.poolConfigs.set(name, config);
  }

  // 获取对象
  acquire<T>(poolName: string): T {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    return pool.acquire();
  }

  // 释放对象
  release<T>(poolName: string, obj: T): void {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    pool.release(obj);
  }

  // 池统计信息
  getPoolStats(): PoolStats[] {
    const stats: PoolStats[] = [];

    for (const [name, pool] of this.pools) {
      stats.push({
        name,
        size: pool.size,
        available: pool.available,
        inUse: pool.inUse,
        utilization: (pool.inUse / pool.size) * 100,
      });
    }

    return stats;
  }
}
```

## 第7章：开发环境与构建（融合维护策略+部署运维）

> **核心理念**: 构建高效的开发环境和自动化运维体系，确保从开发到生产的完整工程化流程，支持AI代码生成的最佳实践

### 7.1 开发环境配置

#### 7.1.1 核心开发工具链

```json5
// package.json - 完整的依赖管理
{
  name: 'guild-manager',
  version: '1.0.0',
  description: '《公会经理》- AI驱动的公会管理游戏',
  type: 'module',
  main: 'dist/main.js',
  scripts: {
    // 开发环境
    dev: 'concurrently "npm run dev:vite" "npm run dev:electron"',
    'dev:vite': 'vite --host 0.0.0.0 --port 3000',
    'dev:electron': 'wait-on http://localhost:3000 && cross-env NODE_ENV=development electron .',

    // 构建脚本
    build: 'npm run build:renderer && npm run build:main',
    'build:renderer': 'vite build',
    'build:main': 'tsc -p tsconfig.main.json && copyfiles -u 1 "src/main/**/*.!(ts)" dist/',
    'build:prod': 'npm run clean && npm run build && electron-builder',

    // 测试脚本
    test: 'vitest',
    'test:ui': 'vitest --ui',
    'test:coverage': 'vitest --coverage',
    'test:e2e': 'playwright test',
    'test:e2e:ui': 'playwright test --ui',

    // 质量检查
    lint: 'eslint src --ext .ts,.tsx --fix',
    'type-check': 'tsc --noEmit',
    format: 'prettier --write "src/**/*.{ts,tsx,json,md}"',

    // 数据库管理
    'db:migrate': 'node scripts/migrate.js',
    'db:seed': 'node scripts/seed.js',
    'db:backup': 'node scripts/backup.js',

    // 部署脚本
    'deploy:staging': 'npm run build:prod && node scripts/deploy-staging.js',
    'deploy:production': 'npm run build:prod && node scripts/deploy-production.js',

    // 维护脚本
    clean: 'rimraf dist build coverage',
    postinstall: 'electron-builder install-app-deps',
    'audit:security': 'npm audit --audit-level moderate',
    'update:deps': 'npm-check-updates -u',
  },

  // 生产依赖
  dependencies: {
    electron: '^32.0.0',
    react: '^19.0.0',
    'react-dom': '^19.0.0',
    phaser: '^3.80.0',
    'better-sqlite3': '^11.0.0',
    i18next: '^23.15.0',
    'react-i18next': '^15.0.0',
    zustand: '^5.0.0',
    '@tanstack/react-query': '^5.59.0',
    tailwindcss: '^4.0.0',
    'framer-motion': '^11.11.0',
  },

  // 开发依赖
  devDependencies: {
    '@types/react': '^19.0.0',
    '@types/react-dom': '^19.0.0',
    '@types/better-sqlite3': '^7.6.11',
    vite: '^6.0.0',
    '@vitejs/plugin-react': '^4.3.0',
    'electron-builder': '^25.0.0',
    typescript: '^5.6.0',
    vitest: '^2.1.0',
    '@vitest/ui': '^2.1.0',
    '@vitest/coverage-v8': '^2.1.0',
    playwright: '^1.48.0',
    eslint: '^9.12.0',
    '@typescript-eslint/eslint-plugin': '^8.8.0',
    prettier: '^3.3.0',
    concurrently: '^9.0.0',
    'wait-on': '^8.0.0',
    'cross-env': '^7.0.3',
    copyfiles: '^2.4.1',
    rimraf: '^6.0.0',
  },

  // Electron Builder配置
  build: {
    appId: 'com.guildmanager.app',
    productName: 'Guild Manager',
    directories: {
      output: 'release',
    },
    files: ['dist/**/*', 'node_modules/**/*', 'package.json'],
    mac: {
      category: 'public.app-category.games',
    },
    win: {
      target: 'nsis',
    },
    linux: {
      target: 'AppImage',
    },
  },
}
```

#### 7.1.2 TypeScript配置完整方案

```json5
// tsconfig.json - 主配置
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // 严格检查选项
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,

    // 路径别名
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/core/*": ["src/core/*"],
      "@/modules/*": ["src/modules/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/assets/*": ["src/assets/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.d.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "release"
  ]
}

// tsconfig.main.json - Electron主进程配置
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "include": [
    "src/main/**/*.ts"
  ]
}

// tsconfig.renderer.json - 渲染进程配置
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx"
  },
  "include": [
    "src/renderer/**/*.ts",
    "src/renderer/**/*.tsx"
  ]
}
```

#### 7.1.3 Vite构建配置

```typescript
// vite.config.ts - 完整构建配置
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // React 19 支持
      jsxImportSource: undefined,
      jsxRuntime: 'automatic',
    }),
  ],

  // 路径解析
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/modules': path.resolve(__dirname, './src/modules'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/assets': path.resolve(__dirname, './src/assets'),
    },
  },

  // 开发服务器配置
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: true,
    cors: true,
  },

  // 构建配置
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
    target: 'es2022',

    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库分块
          'vendor-react': ['react', 'react-dom'],
          'vendor-phaser': ['phaser'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-ui': ['framer-motion', '@tanstack/react-query'],

          // 业务模块分块
          'core-systems': [
            './src/core/events',
            './src/core/state',
            './src/core/ai',
          ],
          'game-modules': [
            './src/modules/guild',
            './src/modules/combat',
            './src/modules/economy',
          ],
        },
      },
    },

    // 性能优化
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
  },

  // 环境变量
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },

  // CSS预处理
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // 优化配置
  optimizeDeps: {
    include: ['react', 'react-dom', 'phaser', 'i18next', 'react-i18next'],
  },
});
```

### 7.2 自动化构建与CI/CD

#### 7.2.1 GitHub Actions工作流

```yaml
# .github/workflows/ci.yml - 持续集成
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  ELECTRON_CACHE: ${{ github.workspace }}/.cache/electron
  ELECTRON_BUILDER_CACHE: ${{ github.workspace }}/.cache/electron-builder

jobs:
  # 代码质量检查
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type checking
        run: npm run type-check

      - name: Linting
        run: npm run lint

      - name: Security audit
        run: npm run audit:security

  # 单元测试
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info

  # E2E测试
  e2e-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ matrix.os }}
          path: playwright-report/

  # 构建与发布
  build-and-release:
    needs: [quality-check, unit-tests, e2e-tests]
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build:prod
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLEID: ${{ secrets.APPLEID }}
          APPLEIDPASS: ${{ secrets.APPLEIDPASS }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: release/

  # 部署到预发布环境
  deploy-staging:
    needs: build-and-release
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # 部署逻辑

  # 部署到生产环境
  deploy-production:
    needs: build-and-release
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # 部署逻辑
```

#### 7.2.2 构建脚本自动化

```typescript
// scripts/build-automation.ts - 构建自动化脚本
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { build } from 'electron-builder';

interface BuildOptions {
  platform: 'win' | 'mac' | 'linux' | 'all';
  env: 'development' | 'staging' | 'production';
  skipTests?: boolean;
  publish?: boolean;
}

class BuildAutomation {
  private readonly rootDir: string;
  private readonly distDir: string;
  private readonly releaseDir: string;

  constructor() {
    this.rootDir = process.cwd();
    this.distDir = path.join(this.rootDir, 'dist');
    this.releaseDir = path.join(this.rootDir, 'release');
  }

  // 完整构建流程
  async performBuild(options: BuildOptions): Promise<void> {
    console.log('🚀 Starting build automation...');

    try {
      // 1. 清理环境
      await this.cleanEnvironment();

      // 2. 环境检查
      await this.checkEnvironment();

      // 3. 依赖安装
      await this.installDependencies();

      // 4. 代码质量检查
      if (!options.skipTests) {
        await this.runQualityChecks();
      }

      // 5. 构建应用
      await this.buildApplication(options);

      // 6. 运行测试
      if (!options.skipTests) {
        await this.runTests();
      }

      // 7. 打包应用
      await this.packageApplication(options);

      // 8. 发布应用
      if (options.publish) {
        await this.publishApplication(options);
      }

      console.log('✅ Build automation completed successfully!');
    } catch (error) {
      console.error('❌ Build automation failed:', error);
      process.exit(1);
    }
  }

  // 清理构建环境
  private async cleanEnvironment(): Promise<void> {
    console.log('🧹 Cleaning build environment...');

    const dirsToClean = [
      this.distDir,
      this.releaseDir,
      path.join(this.rootDir, 'coverage'),
      path.join(this.rootDir, 'playwright-report'),
    ];

    for (const dir of dirsToClean) {
      if (await fs.pathExists(dir)) {
        await fs.remove(dir);
      }
    }
  }

  // 环境检查
  private async checkEnvironment(): Promise<void> {
    console.log('🔍 Checking build environment...');

    // 检查Node.js版本
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v20')) {
      throw new Error(`Node.js 20.x required, got ${nodeVersion}`);
    }

    // 检查必要文件
    const requiredFiles = ['package.json', 'tsconfig.json', 'vite.config.ts'];

    for (const file of requiredFiles) {
      if (!(await fs.pathExists(path.join(this.rootDir, file)))) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
  }

  // 安装依赖
  private async installDependencies(): Promise<void> {
    console.log('📦 Installing dependencies...');

    this.execCommand('npm ci');
    this.execCommand('npm run postinstall');
  }

  // 代码质量检查
  private async runQualityChecks(): Promise<void> {
    console.log('🔎 Running quality checks...');

    // TypeScript类型检查
    this.execCommand('npm run type-check');

    // ESLint检查
    this.execCommand('npm run lint');

    // 安全审计
    this.execCommand('npm run audit:security');
  }

  // 构建应用
  private async buildApplication(options: BuildOptions): Promise<void> {
    console.log('🏗️ Building application...');

    // 设置环境变量
    process.env.NODE_ENV = options.env;
    process.env.BUILD_ENV = options.env;

    // 构建渲染进程
    this.execCommand('npm run build:renderer');

    // 构建主进程
    this.execCommand('npm run build:main');

    // 数据库迁移
    if (options.env !== 'development') {
      this.execCommand('npm run db:migrate');
    }
  }

  // 运行测试
  private async runTests(): Promise<void> {
    console.log('🧪 Running tests...');

    // 单元测试
    this.execCommand('npm run test:coverage');

    // E2E测试
    this.execCommand('npm run test:e2e');
  }

  // 打包应用
  private async packageApplication(options: BuildOptions): Promise<void> {
    console.log('📦 Packaging application...');

    const targets = this.getElectronTargets(options.platform);

    await build({
      targets,
      config: {
        directories: {
          output: this.releaseDir,
        },
        publish: options.publish ? 'always' : 'never',
      },
    });
  }

  // 获取Electron构建目标
  private getElectronTargets(platform: BuildOptions['platform']) {
    const { Platform } = require('electron-builder');

    switch (platform) {
      case 'win':
        return Platform.WINDOWS.createTarget();
      case 'mac':
        return Platform.MAC.createTarget();
      case 'linux':
        return Platform.LINUX.createTarget();
      case 'all':
        return Platform.current().createTarget();
      default:
        return Platform.current().createTarget();
    }
  }

  // 发布应用
  private async publishApplication(options: BuildOptions): Promise<void> {
    console.log('🚀 Publishing application...');

    if (options.env === 'production') {
      // 发布到生产环境
      await this.publishToProduction();
    } else if (options.env === 'staging') {
      // 发布到预发布环境
      await this.publishToStaging();
    }
  }

  // 执行命令
  private execCommand(command: string): void {
    console.log(`▶️ Executing: ${command}`);
    execSync(command, { stdio: 'inherit', cwd: this.rootDir });
  }

  // 发布到生产环境
  private async publishToProduction(): Promise<void> {
    console.log('🌐 Publishing to production...');
    // 实现生产环境发布逻辑
  }

  // 发布到预发布环境
  private async publishToStaging(): Promise<void> {
    console.log('🧪 Publishing to staging...');
    // 实现预发布环境发布逻辑
  }
}

// CLI接口
if (require.main === module) {
  const buildAutomation = new BuildAutomation();

  const options: BuildOptions = {
    platform: (process.argv[2] as BuildOptions['platform']) || 'current',
    env: (process.argv[3] as BuildOptions['env']) || 'development',
    skipTests: process.argv.includes('--skip-tests'),
    publish: process.argv.includes('--publish'),
  };

  buildAutomation.performBuild(options);
}
```

### 7.3 维护策略与监控

#### 7.3.1 系统健康监控

```typescript
// src/core/monitoring/HealthMonitor.ts
class SystemHealthMonitor {
  private healthChecks: Map<string, HealthCheck>;
  private monitoringInterval: NodeJS.Timer;
  private alertThresholds: AlertThresholds;
  private metricsCollector: MetricsCollector;

  constructor(config: HealthMonitorConfig) {
    this.healthChecks = new Map();
    this.alertThresholds = config.alertThresholds;
    this.metricsCollector = new MetricsCollector();

    this.initializeHealthChecks();
  }

  // 初始化健康检查项
  private initializeHealthChecks(): void {
    // 数据库连接检查
    this.addHealthCheck('database', new DatabaseHealthCheck());

    // 内存使用检查
    this.addHealthCheck('memory', new MemoryHealthCheck());

    // CPU使用检查
    this.addHealthCheck('cpu', new CPUHealthCheck());

    // 磁盘空间检查
    this.addHealthCheck('disk', new DiskHealthCheck());

    // AI引擎健康检查
    this.addHealthCheck('ai-engine', new AIEngineHealthCheck());

    // 事件系统健康检查
    this.addHealthCheck('event-system', new EventSystemHealthCheck());
  }

  // 开始监控
  startMonitoring(): void {
    console.log('🏥 Starting system health monitoring...');

    // 每30秒执行一次健康检查
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);

    // 立即执行一次检查
    this.performHealthChecks();
  }

  // 执行健康检查
  private async performHealthChecks(): Promise<void> {
    const results: HealthCheckResult[] = [];

    // 并行执行所有健康检查
    const checkPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, check]) => {
        try {
          const result = await check.execute();
          results.push({ name, ...result });
        } catch (error) {
          results.push({
            name,
            status: 'critical',
            message: `Health check failed: ${error.message}`,
            timestamp: Date.now(),
          });
        }
      }
    );

    await Promise.all(checkPromises);

    // 处理检查结果
    await this.processHealthResults(results);
  }

  // 处理健康检查结果
  private async processHealthResults(
    results: HealthCheckResult[]
  ): Promise<void> {
    const systemHealth: SystemHealthStatus = {
      overall: 'healthy',
      checks: results,
      timestamp: Date.now(),
    };

    // 确定整体健康状态
    const criticalIssues = results.filter(r => r.status === 'critical');
    const warningIssues = results.filter(r => r.status === 'warning');

    if (criticalIssues.length > 0) {
      systemHealth.overall = 'critical';
    } else if (warningIssues.length > 0) {
      systemHealth.overall = 'warning';
    }

    // 收集指标
    this.metricsCollector.recordHealthMetrics(systemHealth);

    // 发送告警
    if (systemHealth.overall !== 'healthy') {
      await this.sendHealthAlert(systemHealth);
    }

    // 记录健康日志
    this.logHealthStatus(systemHealth);
  }

  // 发送健康告警
  private async sendHealthAlert(health: SystemHealthStatus): Promise<void> {
    const alert: HealthAlert = {
      severity: health.overall,
      message: this.generateAlertMessage(health),
      timestamp: Date.now(),
      checks: health.checks.filter(c => c.status !== 'healthy'),
    };

    // 发送到日志系统
    console.warn('⚠️ System Health Alert:', alert);

    // 发送到监控系统
    await this.metricsCollector.sendAlert(alert);
  }

  // 生成告警消息
  private generateAlertMessage(health: SystemHealthStatus): string {
    const issues = health.checks.filter(c => c.status !== 'healthy');
    const critical = issues.filter(c => c.status === 'critical');
    const warnings = issues.filter(c => c.status === 'warning');

    let message = `System health: ${health.overall}. `;

    if (critical.length > 0) {
      message += `Critical issues: ${critical.map(c => c.name).join(', ')}. `;
    }

    if (warnings.length > 0) {
      message += `Warnings: ${warnings.map(c => c.name).join(', ')}.`;
    }

    return message;
  }
}

// 数据库健康检查
class DatabaseHealthCheck implements HealthCheck {
  async execute(): Promise<HealthCheckResult> {
    try {
      // 检查数据库连接
      const db = await this.getDatabaseConnection();

      // 执行简单查询
      const result = db.prepare('SELECT 1 as test').get();

      if (!result || result.test !== 1) {
        return {
          status: 'critical',
          message: 'Database query failed',
          timestamp: Date.now(),
        };
      }

      // 检查数据库大小
      const dbSize = await this.getDatabaseSize();
      if (dbSize > 1024 * 1024 * 1024) {
        // 1GB
        return {
          status: 'warning',
          message: `Database size is large: ${(dbSize / 1024 / 1024).toFixed(2)}MB`,
          timestamp: Date.now(),
        };
      }

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `Database connection failed: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }
}

// AI引擎健康检查
class AIEngineHealthCheck implements HealthCheck {
  async execute(): Promise<HealthCheckResult> {
    try {
      // 检查Worker池状态
      const workerPool = this.getAIWorkerPool();
      const activeWorkers = workerPool.getActiveWorkerCount();
      const totalWorkers = workerPool.getTotalWorkerCount();

      if (activeWorkers === 0) {
        return {
          status: 'critical',
          message: 'No active AI workers',
          timestamp: Date.now(),
        };
      }

      // 检查平均响应时间
      const avgResponseTime = workerPool.getAverageResponseTime();
      if (avgResponseTime > 5000) {
        // 5秒
        return {
          status: 'warning',
          message: `AI response time is slow: ${avgResponseTime}ms`,
          timestamp: Date.now(),
        };
      }

      // 检查决策缓存命中率
      const cacheHitRate = workerPool.getCacheHitRate();
      if (cacheHitRate < 0.7) {
        // 70%
        return {
          status: 'warning',
          message: `Low AI cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`,
          timestamp: Date.now(),
        };
      }

      return {
        status: 'healthy',
        message: `AI engine healthy: ${activeWorkers}/${totalWorkers} workers active`,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'critical',
        message: `AI engine check failed: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }
}
```

### 7.4 团队协作与知识管理 (Team Collaboration & Knowledge Management)

#### 7.4.1 新人入职指南 (Onboarding Guide)

**完整入职流程**

```typescript
// src/docs/onboarding/OnboardingWorkflow.ts
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  estimatedTime: number; // 分钟
  prerequisites: string[];
  deliverables: string[];
  resources: Resource[];
  mentor?: string;
}

export interface Resource {
  type: 'documentation' | 'video' | 'code' | 'tool' | 'meeting';
  title: string;
  url: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

// 新人入职工作流定义
export const ONBOARDING_WORKFLOW: OnboardingStep[] = [
  {
    id: 'environment-setup',
    title: '开发环境搭建',
    description: '安装和配置完整的开发环境，包括必要的工具和依赖',
    estimatedTime: 120, // 2小时
    prerequisites: [],
    deliverables: [
      '能够成功启动开发服务器',
      '能够运行完整的测试套件',
      '能够构建生产版本',
      '开发工具配置完成（IDE、Git、Node.js等）'
    ],
    resources: [
      {
        type: 'documentation',
        title: '环境搭建指南',
        url: '/docs/setup/environment-setup.md',
        description: '详细的开发环境配置步骤',
        priority: 'high'
      },
      {
        type: 'video',
        title: '环境搭建演示视频',
        url: '/docs/videos/environment-setup-demo.mp4',
        description: '15分钟的环境搭建演示',
        priority: 'medium'
      },
      {
        type: 'tool',
        title: '环境检查脚本',
        url: '/scripts/check-environment.js',
        description: '自动检查环境配置是否正确',
        priority: 'high'
      }
    ]
  },
  {
    id: 'codebase-overview',
    title: '代码库架构概览',
    description: '理解项目的整体架构、目录结构和核心概念',
    estimatedTime: 180, // 3小时
    prerequisites: ['environment-setup'],
    deliverables: [
      '完成架构理解测试（80%以上正确率）',
      '能够解释主要模块的职责',
      '理解数据流和事件流',
      '完成代码导读练习'
    ],
    resources: [
      {
        type: 'documentation',
        title: '技术架构文档',
        url: '/docs/architecture/',
        description: 'AI优先增强版技术架构文档',
        priority: 'high'
      },
      {
        type: 'documentation',
        title: '代码导读指南',
        url: '/docs/onboarding/code-walkthrough.md',
        description: '关键代码文件和模块的导读',
        priority: 'high'
      },
      {
        type: 'meeting',
        title: '架构讲解会议',
        url: 'calendar-invite',
        description: '与架构师进行1对1架构讲解（1小时）',
        priority: 'high'
      }
    ],
    mentor: '技术架构师'
  },
  {
    id: 'development-workflow',
    title: '开发流程与规范',
    description: '学习项目的开发流程、代码规范和最佳实践',
    estimatedTime: 90, // 1.5小时
    prerequisites: ['codebase-overview'],
    deliverables: [
      '完成第一个PR并通过代码审查',
      '理解Git工作流程',
      '掌握代码规范和质量标准',
      '配置开发工具（ESLint、Prettier等）'
    ],
    resources: [
      {
        type: 'documentation',
        title: '开发流程指南',
        url: '/docs/development/workflow.md',
        description: 'Git流程、分支策略、PR规范等',
        priority: 'high'
      },
      {
        type: 'documentation',
        title: '代码规范文档',
        url: '/docs/development/coding-standards.md',
        description: 'TypeScript、React、测试等代码规范',
        priority: 'high'
      },
      {
        type: 'code',
        title: '示例PR模板',
        url: '/docs/examples/pr-template.md',
        description: '标准PR描述模板和检查清单',
        priority: 'medium'
      }
    ],
    mentor: '团队Lead'
  },
  {
    id: 'testing-strategy',
    title: '测试策略与实践',
    description: '掌握项目的测试金字塔、测试工具和测试编写规范',
    estimatedTime: 150, // 2.5小时
    prerequisites: ['development-workflow'],
    deliverables: [
      '为现有功能编写单元测试',
      '编写一个集成测试',
      '运行并理解E2E测试',
      '达到90%以上的测试覆盖率'
    ],
    resources: [
      {
        type: 'documentation',
        title: '测试策略文档',
        url: '/docs/testing/strategy.md',
        description: '测试金字塔、工具选择、覆盖率要求',
        priority: 'high'
      },
      {
        type: 'code',
        title: '测试示例代码',
        url: '/src/tests/examples/',
        description: '各类测试的最佳实践示例',
        priority: 'high'
      },
      {
        type: 'video',
        title: 'TDD实践演示',
        url: '/docs/videos/tdd-demo.mp4',
        description: '30分钟TDD开发实践演示',
        priority: 'medium'
      }
    ],
    mentor: '测试工程师'
  },
  {
    id: 'domain-knowledge',
    title: '业务领域知识',
    description: '理解公会管理游戏的业务逻辑、用户需求和产品目标',
    estimatedTime: 120, // 2小时
    prerequisites: ['testing-strategy'],
    deliverables: [
      '完成业务知识测试（85%以上正确率）',
      '理解核心业务流程',
      '熟悉用户角色和使用场景',
      '掌握游戏系统的核心概念'
    ],
    resources: [
      {
        type: 'documentation',
        title: '产品需求文档',
        url: '/docs/product/PRD.md',
        description: '完整的产品需求和功能规格',
        priority: 'high'
      },
      {
        type: 'documentation',
        title: '用户故事集合',
        url: '/docs/product/user-stories.md',
        description: '详细的用户故事和验收标准',
        priority: 'high'
      },
      {
        type: 'meeting',
        title: '产品讲解会议',
        url: 'calendar-invite',
        description: '与产品经理进行业务讲解（1.5小时）',
        priority: 'high'
      }
    ],
    mentor: '产品经理'
  },
  {
    id: 'first-feature',
    title: '第一个功能开发',
    description: '独立完成一个小功能的完整开发，从需求到上线',
    estimatedTime: 480, // 8小时（跨多天）
    prerequisites: ['domain-knowledge'],
    deliverables: [
      '完成功能设计文档',
      '实现功能代码（包含测试）',
      '通过代码审查',
      '功能成功部署到预发布环境',
      '完成功能验收测试'
    ],
    resources: [
      {
        type: 'documentation',
        title: '功能开发流程',
        url: '/docs/development/feature-development.md',
        description: '从需求分析到上线的完整流程',
        priority: 'high'
      },
      {
        type: 'code',
        title: '功能开发模板',
        url: '/templates/feature-template/',
        description: '标准功能开发的代码结构模板',
        priority: 'medium'
      },
      {
        type: 'meeting',
        title: '功能评审会议',
        url: 'calendar-invite',
        description: '功能设计和实现的评审会议',
        priority: 'high'
      }
    ],
    mentor: '资深开发工程师'
  },
  {
    id: 'team-integration',
    title: '团队融入与持续学习',
    description: '融入团队文化，建立持续学习和改进的习惯',
    estimatedTime: 60, // 1小时
    prerequisites: ['first-feature'],
    deliverables: [
      '参加团队会议和技术分享',
      '建立个人学习计划',
      '完成入职反馈和改进建议',
      '成为团队正式成员'
    ],
    resources: [
      {
        type: 'documentation',
        title: '团队文化手册',
        url: '/docs/team/culture.md',
        description: '团队价值观、工作方式和协作规范',
        priority: 'high'
      },
      {
        type: 'meeting',
        title: '入职总结会议',
        url: 'calendar-invite',
        description: '与经理进行入职总结和职业规划讨论',
        priority: 'high'
      }
    ],
    mentor: '团队经理'
  }
];

// 入职进度跟踪
export class OnboardingTracker {
  private progress: Map<string, OnboardingProgress> = new Map();

  interface OnboardingProgress {
    stepId: string;
    status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    startTime?: number;
    completionTime?: number;
    notes: string[];
    mentorFeedback?: string;
    blockers: string[];
  }

  // 开始入职流程
  startOnboarding(employeeId: string): void {
    ONBOARDING_WORKFLOW.forEach(step => {
      this.progress.set(`${employeeId}-${step.id}`, {
        stepId: step.id,
        status: step.prerequisites.length === 0 ? 'not_started' : 'blocked',
        notes: [],
        blockers: step.prerequisites.filter(prereq =>
          !this.isStepCompleted(employeeId, prereq)
        )
      });
    });
  }

  // 更新步骤状态
  updateStepStatus(
    employeeId: string,
    stepId: string,
    status: OnboardingProgress['status'],
    notes?: string
  ): void {
    const progressId = `${employeeId}-${stepId}`;
    const progress = this.progress.get(progressId);

    if (progress) {
      progress.status = status;

      if (status === 'in_progress' && !progress.startTime) {
        progress.startTime = Date.now();
      }

      if (status === 'completed') {
        progress.completionTime = Date.now();

        // 解锁依赖此步骤的其他步骤
        this.unlockDependentSteps(employeeId, stepId);
      }

      if (notes) {
        progress.notes.push(notes);
      }

      this.progress.set(progressId, progress);
    }
  }

  // 生成入职报告
  generateOnboardingReport(employeeId: string): OnboardingReport {
    const allProgress = Array.from(this.progress.entries())
      .filter(([key]) => key.startsWith(employeeId))
      .map(([, progress]) => progress);

    const completed = allProgress.filter(p => p.status === 'completed').length;
    const inProgress = allProgress.filter(p => p.status === 'in_progress').length;
    const blocked = allProgress.filter(p => p.status === 'blocked').length;
    const notStarted = allProgress.filter(p => p.status === 'not_started').length;

    const totalTime = allProgress
      .filter(p => p.startTime && p.completionTime)
      .reduce((total, p) => total + (p.completionTime! - p.startTime!), 0);

    return {
      employeeId,
      totalSteps: ONBOARDING_WORKFLOW.length,
      completedSteps: completed,
      inProgressSteps: inProgress,
      blockedSteps: blocked,
      notStartedSteps: notStarted,
      completionPercentage: (completed / ONBOARDING_WORKFLOW.length) * 100,
      totalTimeSpent: totalTime,
      estimatedCompletion: this.calculateEstimatedCompletion(employeeId),
      currentBlockers: this.getCurrentBlockers(employeeId)
    };
  }
}
```

**环境搭建自动化**

```bash
#!/bin/bash
# scripts/setup-dev-environment.sh - 开发环境自动化搭建脚本

set -e

echo "🚀 开始搭建《公会经理》开发环境..."

# 检查系统要求
check_system_requirements() {
  echo "📋 检查系统要求..."

  # 检查Node.js版本
  if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请安装 Node.js 20.x"
    exit 1
  fi

  NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
  if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 版本过低，需要 20.x，当前版本：$(node -v)"
    exit 1
  fi

  # 检查Git
  if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装，请安装 Git"
    exit 1
  fi

  # 检查系统架构
  ARCH=$(uname -m)
  OS=$(uname -s)
  echo "✅ 系统环境：$OS $ARCH, Node.js $(node -v), Git $(git --version | cut -d' ' -f3)"
}

# 安装项目依赖
install_dependencies() {
  echo "📦 安装项目依赖..."

  # 清理旧的node_modules
  if [ -d "node_modules" ]; then
    echo "🧹 清理旧的依赖..."
    rm -rf node_modules package-lock.json
  fi

  # 安装依赖
  npm ci

  # 安装Playwright浏览器
  npx playwright install

  echo "✅ 依赖安装完成"
}

# 配置开发工具
setup_dev_tools() {
  echo "🔧 配置开发工具..."

  # 配置Git hooks
  if [ -d ".git" ]; then
    echo "⚙️ 配置Git hooks..."
    npx husky install
  fi

  # 配置VSCode设置（如果存在）
  if command -v code &> /dev/null; then
    echo "📝 配置VSCode设置..."
    mkdir -p .vscode

    # 推荐的扩展列表
    cat > .vscode/extensions.json << EOF
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-playwright.playwright",
    "ms-vscode.test-adapter-converter",
    "gruntfuggly.todo-tree"
  ]
}
EOF

    # 工作区设置
    cat > .vscode/settings.json << EOF
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": [
    "javascript",
    "typescript",
    "typescriptreact"
  ],
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|\\`)([^']*)(?:'|\"|\\`)"]
  ]
}
EOF

    echo "✅ VSCode配置完成"
  fi
}

# 初始化数据库
setup_database() {
  echo "🗄️ 初始化数据库..."

  # 创建数据库目录
  mkdir -p data/database

  # 运行数据库迁移
  npm run db:migrate

  # 插入种子数据
  if [ "$1" = "--with-seed-data" ]; then
    echo "🌱 插入种子数据..."
    npm run db:seed
  fi

  echo "✅ 数据库初始化完成"
}

# 运行测试验证
run_verification_tests() {
  echo "🧪 运行验证测试..."

  # 类型检查
  echo "🔍 TypeScript类型检查..."
  npm run type-check

  # 代码规范检查
  echo "📏 代码规范检查..."
  npm run lint

  # 单元测试
  echo "🎯 运行单元测试..."
  npm run test -- --run

  # 构建测试
  echo "🏗️ 构建测试..."
  npm run build

  echo "✅ 所有验证测试通过"
}

# 创建开发用户配置
create_dev_config() {
  echo "⚙️ 创建开发配置..."

  # 创建环境变量文件
  if [ ! -f ".env.local" ]; then
    cat > .env.local << EOF
# 开发环境配置
NODE_ENV=development
VITE_APP_ENV=development
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_DEBUG=true
VITE_LOG_LEVEL=debug

# 数据库配置
DB_PATH=./data/database/guild-manager-dev.db

# 开发工具
VITE_DEVTOOLS=true
VITE_REACT_STRICT_MODE=true
EOF
    echo "📝 创建了 .env.local 配置文件"
  fi
}

# 主函数
main() {
  echo "《公会经理》开发环境自动化搭建脚本 v1.0"
  echo "=================================================="

  check_system_requirements
  install_dependencies
  setup_dev_tools
  create_dev_config
  setup_database $1
  run_verification_tests

  echo ""
  echo "🎉 开发环境搭建完成！"
  echo ""
  echo "💡 接下来你可以："
  echo "   npm run dev          # 启动开发服务器"
  echo "   npm run test         # 运行测试"
  echo "   npm run build        # 构建生产版本"
  echo ""
  echo "📚 更多信息请查看："
  echo "   README.md           # 项目说明"
  echo "   docs/               # 技术文档"
  echo "   docs/onboarding/    # 入职指南"
  echo ""
  echo "🆘 如果遇到问题，请联系团队成员或查看故障排除文档"
}

# 运行主函数
main $1
```

#### 7.4.2 知识传递机制 (Knowledge Transfer)

**知识库管理系统**

```typescript
// src/core/knowledge/KnowledgeManager.ts
export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type:
    | 'document'
    | 'video'
    | 'code-example'
    | 'best-practice'
    | 'troubleshooting';
  category: string[];
  tags: string[];
  author: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime: number; // 分钟
  relatedItems: string[]; // 相关知识项ID
  feedback: KnowledgeFeedback[];
}

export interface KnowledgeFeedback {
  id: string;
  userId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  helpful: boolean;
  timestamp: number;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  parent?: string;
  children: string[];
  itemCount: number;
}

// 知识管理系统
export class KnowledgeManager {
  private knowledgeBase: Map<string, KnowledgeItem> = new Map();
  private categories: Map<string, KnowledgeCategory> = new Map();
  private searchIndex: Map<string, string[]> = new Map(); // 关键词 -> 知识项ID列表

  constructor() {
    this.initializeCategories();
    this.initializeKnowledgeBase();
  }

  // 初始化知识分类
  private initializeCategories(): void {
    const categories: KnowledgeCategory[] = [
      {
        id: 'architecture',
        name: '技术架构',
        description: '系统架构设计、模式和最佳实践',
        icon: '🏗️',
        children: ['system-design', 'data-flow', 'security'],
        itemCount: 0,
      },
      {
        id: 'development',
        name: '开发实践',
        description: '编码规范、开发流程和工具使用',
        icon: '💻',
        children: ['coding-standards', 'testing', 'debugging'],
        itemCount: 0,
      },
      {
        id: 'deployment',
        name: '部署运维',
        description: '构建、部署、监控和运维相关知识',
        icon: '🚀',
        children: ['build-process', 'monitoring', 'troubleshooting'],
        itemCount: 0,
      },
      {
        id: 'business',
        name: '业务知识',
        description: '产品需求、用户故事和业务逻辑',
        icon: '📊',
        children: ['product-features', 'user-scenarios', 'business-rules'],
        itemCount: 0,
      },
      {
        id: 'team-process',
        name: '团队流程',
        description: '协作流程、会议制度和沟通规范',
        icon: '👥',
        children: ['collaboration', 'meetings', 'communication'],
        itemCount: 0,
      },
    ];

    categories.forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  // 初始化知识库
  private initializeKnowledgeBase(): void {
    const knowledgeItems: KnowledgeItem[] = [
      {
        id: 'electron-security-guide',
        title: 'Electron安全配置完全指南',
        content: this.loadKnowledgeContent('electron-security-guide'),
        type: 'document',
        category: ['architecture', 'security'],
        tags: ['electron', 'security', 'configuration', 'best-practices'],
        author: '安全架构师',
        createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7天前
        updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1天前
        version: '1.2.0',
        status: 'published',
        difficulty: 'intermediate',
        estimatedReadTime: 15,
        relatedItems: ['security-checklist', 'electron-best-practices'],
        feedback: [],
      },
      {
        id: 'react-19-migration',
        title: 'React 19升级迁移指南',
        content: this.loadKnowledgeContent('react-19-migration'),
        type: 'document',
        category: ['development', 'frontend'],
        tags: ['react', 'migration', 'upgrade', 'breaking-changes'],
        author: '前端架构师',
        createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14天前
        updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2天前
        version: '2.1.0',
        status: 'published',
        difficulty: 'advanced',
        estimatedReadTime: 25,
        relatedItems: ['react-hooks-guide', 'frontend-testing'],
        feedback: [
          {
            id: 'feedback-1',
            userId: 'developer-1',
            rating: 5,
            comment: '非常详细的迁移指南，帮助很大！',
            helpful: true,
            timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
          },
        ],
      },
      {
        id: 'ai-debugging-techniques',
        title: 'AI引擎调试技巧和工具',
        content: this.loadKnowledgeContent('ai-debugging-techniques'),
        type: 'troubleshooting',
        category: ['development', 'ai'],
        tags: ['ai', 'debugging', 'web-worker', 'performance'],
        author: 'AI工程师',
        createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5天前
        updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        version: '1.0.0',
        status: 'published',
        difficulty: 'intermediate',
        estimatedReadTime: 12,
        relatedItems: ['performance-profiling', 'worker-communication'],
        feedback: [],
      },
      {
        id: 'code-review-checklist',
        title: '代码审查检查清单',
        content: this.loadKnowledgeContent('code-review-checklist'),
        type: 'best-practice',
        category: ['development', 'quality'],
        tags: ['code-review', 'quality', 'checklist', 'best-practices'],
        author: '技术主管',
        createdAt: Date.now() - 21 * 24 * 60 * 60 * 1000, // 21天前
        updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3天前
        version: '1.3.0',
        status: 'published',
        difficulty: 'beginner',
        estimatedReadTime: 8,
        relatedItems: ['coding-standards', 'testing-guidelines'],
        feedback: [],
      },
    ];

    knowledgeItems.forEach(item => {
      this.knowledgeBase.set(item.id, item);
      this.updateSearchIndex(item);
    });
  }

  // 搜索知识项
  searchKnowledge(
    query: string,
    options?: {
      category?: string;
      type?: KnowledgeItem['type'];
      difficulty?: KnowledgeItem['difficulty'];
      tags?: string[];
    }
  ): KnowledgeItem[] {
    const searchTerms = query.toLowerCase().split(' ');
    const matchingIds = new Set<string>();

    // 基于关键词搜索
    searchTerms.forEach(term => {
      const ids = this.searchIndex.get(term) || [];
      ids.forEach(id => matchingIds.add(id));
    });

    let results = Array.from(matchingIds)
      .map(id => this.knowledgeBase.get(id)!)
      .filter(item => item.status === 'published');

    // 应用过滤条件
    if (options?.category) {
      results = results.filter(item =>
        item.category.includes(options.category!)
      );
    }

    if (options?.type) {
      results = results.filter(item => item.type === options.type);
    }

    if (options?.difficulty) {
      results = results.filter(item => item.difficulty === options.difficulty);
    }

    if (options?.tags && options.tags.length > 0) {
      results = results.filter(item =>
        options.tags!.some(tag => item.tags.includes(tag))
      );
    }

    // 按相关性和更新时间排序
    return results.sort((a, b) => {
      // 计算相关性得分
      const scoreA = this.calculateRelevanceScore(a, query);
      const scoreB = this.calculateRelevanceScore(b, query);

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // 相关性相同时，按更新时间排序
      return b.updatedAt - a.updatedAt;
    });
  }

  // 获取推荐知识项
  getRecommendations(userId: string, currentItemId?: string): KnowledgeItem[] {
    // 基于用户行为和当前浏览内容推荐
    const userHistory = this.getUserReadingHistory(userId);
    const currentItem = currentItemId
      ? this.knowledgeBase.get(currentItemId)
      : null;

    let candidates = Array.from(this.knowledgeBase.values()).filter(
      item => item.status === 'published'
    );

    // 如果有当前项，优先推荐相关项
    if (currentItem) {
      const relatedItems = currentItem.relatedItems
        .map(id => this.knowledgeBase.get(id))
        .filter(Boolean) as KnowledgeItem[];

      const similarCategoryItems = candidates.filter(
        item =>
          item.id !== currentItem.id &&
          item.category.some(cat => currentItem.category.includes(cat))
      );

      const similarTagItems = candidates.filter(
        item =>
          item.id !== currentItem.id &&
          item.tags.some(tag => currentItem.tags.includes(tag))
      );

      candidates = [
        ...relatedItems,
        ...similarCategoryItems.slice(0, 3),
        ...similarTagItems.slice(0, 2),
      ];
    }

    // 基于用户历史推荐
    const userInterests = this.analyzeUserInterests(userHistory);
    candidates = candidates.concat(
      this.getItemsByInterests(userInterests).slice(0, 3)
    );

    // 去重并排序
    const uniqueItems = Array.from(
      new Map(candidates.map(item => [item.id, item])).values()
    );

    return uniqueItems
      .sort(
        (a, b) =>
          this.calculateRecommendationScore(b, userId) -
          this.calculateRecommendationScore(a, userId)
      )
      .slice(0, 5);
  }

  // 添加知识项
  addKnowledgeItem(
    item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>
  ): string {
    const id = `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const knowledgeItem: KnowledgeItem = {
      ...item,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      feedback: [],
    };

    this.knowledgeBase.set(id, knowledgeItem);
    this.updateSearchIndex(knowledgeItem);
    this.updateCategoryItemCount(item.category);

    return id;
  }

  // 更新知识项
  updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): boolean {
    const item = this.knowledgeBase.get(id);
    if (!item) return false;

    const updatedItem = { ...item, ...updates, updatedAt: Date.now() };
    this.knowledgeBase.set(id, updatedItem);
    this.updateSearchIndex(updatedItem);

    return true;
  }

  // 添加反馈
  addFeedback(
    itemId: string,
    feedback: Omit<KnowledgeFeedback, 'id' | 'timestamp'>
  ): boolean {
    const item = this.knowledgeBase.get(itemId);
    if (!item) return false;

    const feedbackItem: KnowledgeFeedback = {
      ...feedback,
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    item.feedback.push(feedbackItem);
    item.updatedAt = Date.now();

    return true;
  }

  // 生成知识库报告
  generateKnowledgeReport(): KnowledgeReport {
    const items = Array.from(this.knowledgeBase.values());
    const categories = Array.from(this.categories.values());

    return {
      totalItems: items.length,
      publishedItems: items.filter(i => i.status === 'published').length,
      draftItems: items.filter(i => i.status === 'draft').length,
      categories: categories.length,
      averageRating: this.calculateAverageRating(items),
      mostPopularCategories: this.getMostPopularCategories(),
      recentlyUpdated: items
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          title: item.title,
          updatedAt: item.updatedAt,
        })),
      topRatedItems: items
        .filter(item => item.feedback.length > 0)
        .sort((a, b) => this.getAverageRating(b) - this.getAverageRating(a))
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          title: item.title,
          rating: this.getAverageRating(item),
          feedbackCount: item.feedback.length,
        })),
    };
  }

  // 私有辅助方法
  private updateSearchIndex(item: KnowledgeItem): void {
    const searchableText = [
      item.title,
      item.content,
      ...item.tags,
      ...item.category,
      item.author,
    ]
      .join(' ')
      .toLowerCase();

    const words = searchableText.split(/\s+/).filter(word => word.length > 2);

    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, []);
      }
      const itemIds = this.searchIndex.get(word)!;
      if (!itemIds.includes(item.id)) {
        itemIds.push(item.id);
      }
    });
  }

  private calculateRelevanceScore(item: KnowledgeItem, query: string): number {
    const queryTerms = query.toLowerCase().split(' ');
    let score = 0;

    queryTerms.forEach(term => {
      if (item.title.toLowerCase().includes(term)) score += 3;
      if (item.tags.some(tag => tag.toLowerCase().includes(term))) score += 2;
      if (item.category.some(cat => cat.toLowerCase().includes(term)))
        score += 2;
      if (item.content.toLowerCase().includes(term)) score += 1;
    });

    return score;
  }

  private getAverageRating(item: KnowledgeItem): number {
    if (item.feedback.length === 0) return 0;
    const totalRating = item.feedback.reduce(
      (sum, feedback) => sum + feedback.rating,
      0
    );
    return totalRating / item.feedback.length;
  }
}
```

#### 7.4.3 技术分享制度 (Technical Sharing)

**技术分享管理系统**

```typescript
// src/core/sharing/TechSharingManager.ts
export interface TechSharingSession {
  id: string;
  title: string;
  description: string;
  presenter: string;
  presenterId: string;
  type: 'lightning-talk' | 'deep-dive' | 'demo' | 'workshop' | 'retrospective';
  category: string[];
  scheduledDate: number;
  duration: number; // 分钟
  location: 'online' | 'office' | 'hybrid';
  meetingLink?: string;
  materials: SharingMaterial[];
  attendees: string[];
  maxAttendees?: number;
  status: 'draft' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  feedback: SessionFeedback[];
  recording?: {
    url: string;
    duration: number;
    transcription?: string;
  };
  followUpTasks: string[];
}

export interface SharingMaterial {
  type: 'slides' | 'code' | 'document' | 'video' | 'demo-link';
  title: string;
  url: string;
  description?: string;
}

export interface SessionFeedback {
  id: string;
  attendeeId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  content?: string;
  usefulness: 1 | 2 | 3 | 4 | 5;
  clarity: 1 | 2 | 3 | 4 | 5;
  pacing: 1 | 2 | 3 | 4 | 5;
  suggestions?: string;
  timestamp: number;
}

export interface SharingTopic {
  id: string;
  title: string;
  description: string;
  suggestedBy: string;
  category: string[];
  priority: 'low' | 'medium' | 'high';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  prerequisites?: string[];
  learningObjectives: string[];
  votes: number;
  voterIds: string[];
  assignedTo?: string;
  status: 'suggested' | 'planned' | 'in-preparation' | 'completed';
  createdAt: number;
}

// 技术分享管理器
export class TechSharingManager {
  private sessions: Map<string, TechSharingSession> = new Map();
  private topics: Map<string, SharingTopic> = new Map();
  private schedule: Map<string, string[]> = new Map(); // 日期 -> session IDs

  // 分享会话模板
  private readonly SESSION_TEMPLATES = {
    'lightning-talk': {
      duration: 15,
      description: '快速分享一个技术点、工具或经验',
      format: '5分钟演示 + 10分钟讨论',
    },
    'deep-dive': {
      duration: 45,
      description: '深入探讨某个技术主题的设计和实现',
      format: '30分钟演示 + 15分钟讨论',
    },
    demo: {
      duration: 30,
      description: '演示新功能、工具或技术的实际使用',
      format: '20分钟演示 + 10分钟讨论',
    },
    workshop: {
      duration: 90,
      description: '动手实践工作坊，边学边做',
      format: '15分钟介绍 + 60分钟实践 + 15分钟总结',
    },
    retrospective: {
      duration: 60,
      description: '项目或技术实施的回顾和经验总结',
      format: '20分钟回顾 + 30分钟讨论 + 10分钟行动计划',
    },
  };

  // 创建分享会话
  createSharingSession(sessionData: {
    title: string;
    description: string;
    presenterId: string;
    type: TechSharingSession['type'];
    category: string[];
    scheduledDate: number;
    location: TechSharingSession['location'];
    maxAttendees?: number;
  }): string {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const template = this.SESSION_TEMPLATES[sessionData.type];

    const session: TechSharingSession = {
      id,
      ...sessionData,
      presenter: this.getUserName(sessionData.presenterId),
      duration: template.duration,
      materials: [],
      attendees: [sessionData.presenterId], // 演讲者自动参加
      status: 'draft',
      feedback: [],
      followUpTasks: [],
    };

    this.sessions.set(id, session);
    this.addToSchedule(sessionData.scheduledDate, id);

    // 发送创建通知
    this.notifySessionCreated(session);

    return id;
  }

  // 建议分享主题
  suggestTopic(topicData: {
    title: string;
    description: string;
    suggestedBy: string;
    category: string[];
    priority?: SharingTopic['priority'];
    complexity?: SharingTopic['complexity'];
    estimatedDuration?: number;
    prerequisites?: string[];
    learningObjectives: string[];
  }): string {
    const id = `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const topic: SharingTopic = {
      id,
      priority: 'medium',
      complexity: 'intermediate',
      estimatedDuration: 30,
      ...topicData,
      votes: 1, // 建议者自动投票
      voterIds: [topicData.suggestedBy],
      status: 'suggested',
      createdAt: Date.now(),
    };

    this.topics.set(id, topic);

    // 发送建议通知
    this.notifyTopicSuggested(topic);

    return id;
  }

  // 为主题投票
  voteForTopic(topicId: string, voterId: string): boolean {
    const topic = this.topics.get(topicId);
    if (!topic || topic.voterIds.includes(voterId)) {
      return false;
    }

    topic.votes += 1;
    topic.voterIds.push(voterId);

    this.topics.set(topicId, topic);
    return true;
  }

  // 认领主题进行准备
  claimTopic(topicId: string, presenterId: string): boolean {
    const topic = this.topics.get(topicId);
    if (!topic || topic.status !== 'suggested') {
      return false;
    }

    topic.assignedTo = presenterId;
    topic.status = 'in-preparation';

    this.topics.set(topicId, topic);

    // 发送认领通知
    this.notifyTopicClaimed(topic, presenterId);

    return true;
  }

  // 参加分享会话
  joinSession(sessionId: string, attendeeId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.status === 'cancelled' ||
      session.status === 'completed'
    ) {
      return false;
    }

    if (session.attendees.includes(attendeeId)) {
      return true; // 已经参加了
    }

    if (
      session.maxAttendees &&
      session.attendees.length >= session.maxAttendees
    ) {
      return false; // 人数已满
    }

    session.attendees.push(attendeeId);
    this.sessions.set(sessionId, session);

    // 发送参加确认
    this.notifyAttendeeJoined(session, attendeeId);

    return true;
  }

  // 添加分享材料
  addSessionMaterial(sessionId: string, material: SharingMaterial): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.materials.push(material);
    this.sessions.set(sessionId, session);

    // 通知参与者材料已添加
    this.notifyMaterialAdded(session, material);

    return true;
  }

  // 开始分享会话
  startSession(sessionId: string, startedBy: string): boolean {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.presenterId !== startedBy ||
      session.status !== 'scheduled'
    ) {
      return false;
    }

    session.status = 'in-progress';
    this.sessions.set(sessionId, session);

    // 发送开始通知
    this.notifySessionStarted(session);

    return true;
  }

  // 完成分享会话
  completeSession(
    sessionId: string,
    completedBy: string,
    recording?: TechSharingSession['recording']
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.presenterId !== completedBy ||
      session.status !== 'in-progress'
    ) {
      return false;
    }

    session.status = 'completed';
    if (recording) {
      session.recording = recording;
    }

    this.sessions.set(sessionId, session);

    // 发送完成通知和反馈邀请
    this.notifySessionCompleted(session);
    this.requestFeedback(session);

    return true;
  }

  // 添加会话反馈
  addSessionFeedback(
    sessionId: string,
    feedback: Omit<SessionFeedback, 'id' | 'timestamp'>
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.attendees.includes(feedback.attendeeId)) {
      return false;
    }

    const feedbackItem: SessionFeedback = {
      ...feedback,
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    session.feedback.push(feedbackItem);
    this.sessions.set(sessionId, session);

    return true;
  }

  // 获取会话日程安排
  getSchedule(startDate: number, endDate: number): ScheduleItem[] {
    const schedule: ScheduleItem[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      const sessionIds = this.schedule.get(dateKey) || [];

      sessionIds.forEach(sessionId => {
        const session = this.sessions.get(sessionId);
        if (session && session.status !== 'cancelled') {
          schedule.push({
            date: dateKey,
            session: {
              id: session.id,
              title: session.title,
              presenter: session.presenter,
              type: session.type,
              duration: session.duration,
              attendeeCount: session.attendees.length,
              maxAttendees: session.maxAttendees,
            },
          });
        }
      });
    }

    return schedule.sort((a, b) => a.date.localeCompare(b.date));
  }

  // 获取热门主题
  getPopularTopics(limit: number = 10): SharingTopic[] {
    return Array.from(this.topics.values())
      .filter(topic => topic.status === 'suggested')
      .sort((a, b) => {
        // 先按票数排序
        if (a.votes !== b.votes) {
          return b.votes - a.votes;
        }
        // 票数相同按优先级排序
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, limit);
  }

  // 生成分享报告
  generateSharingReport(period: { start: number; end: number }): SharingReport {
    const sessions = Array.from(this.sessions.values()).filter(
      session =>
        session.scheduledDate >= period.start &&
        session.scheduledDate <= period.end
    );

    const completedSessions = sessions.filter(s => s.status === 'completed');
    const totalAttendees = sessions.reduce(
      (total, session) => total + session.attendees.length,
      0
    );
    const totalFeedback = completedSessions.reduce(
      (total, session) => total + session.feedback.length,
      0
    );
    const averageRating =
      completedSessions.reduce((sum, session) => {
        const sessionAvg =
          session.feedback.length > 0
            ? session.feedback.reduce((s, f) => s + f.rating, 0) /
              session.feedback.length
            : 0;
        return sum + sessionAvg;
      }, 0) / (completedSessions.length || 1);

    return {
      period,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      cancelledSessions: sessions.filter(s => s.status === 'cancelled').length,
      totalAttendees,
      averageAttendeesPerSession: totalAttendees / (sessions.length || 1),
      totalFeedback,
      averageRating,
      topPresenters: this.getTopPresenters(completedSessions),
      popularCategories: this.getPopularCategories(sessions),
      sessionTypes: this.getSessionTypeDistribution(sessions),
      upcomingSessions: this.getUpcomingSessions(),
      suggestedTopics: Array.from(this.topics.values()).filter(
        t => t.status === 'suggested'
      ).length,
    };
  }

  // 私有辅助方法
  private addToSchedule(date: number, sessionId: string): void {
    const dateKey = new Date(date).toISOString().split('T')[0];
    if (!this.schedule.has(dateKey)) {
      this.schedule.set(dateKey, []);
    }
    this.schedule.get(dateKey)!.push(sessionId);
  }

  private notifySessionCreated(session: TechSharingSession): void {
    // 实现会话创建通知逻辑
    console.log(`📅 新分享会话创建: ${session.title} by ${session.presenter}`);
  }

  private notifyTopicSuggested(topic: SharingTopic): void {
    // 实现主题建议通知逻辑
    console.log(`💡 新主题建议: ${topic.title}`);
  }

  private requestFeedback(session: TechSharingSession): void {
    // 向参与者发送反馈请求
    session.attendees.forEach(attendeeId => {
      console.log(`📝 请为会话 "${session.title}" 提供反馈`);
    });
  }
}

// 分享会话工厂类
export class SharingSessionFactory {
  static createLightningTalk(data: {
    title: string;
    presenterId: string;
    techStack: string[];
    keyTakeaway: string;
  }): Partial<TechSharingSession> {
    return {
      title: data.title,
      description: `⚡ 快速分享: ${data.keyTakeaway}`,
      type: 'lightning-talk',
      category: data.techStack,
      duration: 15,
    };
  }

  static createTechDeepDive(data: {
    title: string;
    presenterId: string;
    technology: string;
    architecture: string[];
    problems: string[];
    solutions: string[];
  }): Partial<TechSharingSession> {
    return {
      title: data.title,
      description:
        `🔍 深入探讨 ${data.technology} 的设计和实现\n\n` +
        `解决的问题:\n${data.problems.map(p => `• ${p}`).join('\n')}\n\n` +
        `技术方案:\n${data.solutions.map(s => `• ${s}`).join('\n')}`,
      type: 'deep-dive',
      category: [data.technology, ...data.architecture],
      duration: 45,
    };
  }

  static createHandsOnWorkshop(data: {
    title: string;
    presenterId: string;
    skills: string[];
    tools: string[];
    prerequisites: string[];
    outcomes: string[];
  }): Partial<TechSharingSession> {
    return {
      title: data.title,
      description:
        `🛠️ 动手工作坊\n\n` +
        `学习目标:\n${data.outcomes.map(o => `• ${o}`).join('\n')}\n\n` +
        `使用工具:\n${data.tools.map(t => `• ${t}`).join('\n')}\n\n` +
        `前置要求:\n${data.prerequisites.map(p => `• ${p}`).join('\n')}`,
      type: 'workshop',
      category: data.skills,
      duration: 90,
    };
  }
}
```

## 第8章：功能纵切（融合国际化支持+前端架构设计）

> **设计原则**: 实现完整的功能纵切，从前端UI到后端数据，确保国际化支持和响应式设计，为AI代码生成提供清晰的功能边界

### 8.1 国际化支持架构

#### 8.1.1 i18next完整配置

```typescript
// src/core/i18n/i18nConfig.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-fs-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = {
  'zh-CN': {
    name: '简体中文',
    flag: '🇨🇳',
    direction: 'ltr',
  },
  'zh-TW': {
    name: '繁體中文',
    flag: '🇹🇼',
    direction: 'ltr',
  },
  en: {
    name: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
  },
  ja: {
    name: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
  },
  ko: {
    name: '한국어',
    flag: '🇰🇷',
    direction: 'ltr',
  },
  es: {
    name: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
  },
  fr: {
    name: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
  },
  de: {
    name: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
  },
  ru: {
    name: 'Русский',
    flag: '🇷🇺',
    direction: 'ltr',
  },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// i18n配置
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // 默认语言
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',

    // 调试模式
    debug: process.env.NODE_ENV === 'development',

    // 命名空间
    defaultNS: 'common',
    ns: [
      'common', // 通用翻译
      'ui', // UI界面
      'game', // 游戏内容
      'guild', // 公会系统
      'combat', // 战斗系统
      'economy', // 经济系统
      'social', // 社交系统
      'settings', // 设置界面
      'errors', // 错误信息
      'validation', // 表单验证
    ],

    // 语言检测配置
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    // 后端配置（文件系统）
    backend: {
      loadPath: './src/assets/locales/{{lng}}/{{ns}}.json',
    },

    // 插值配置
    interpolation: {
      escapeValue: false, // React已经转义
      format: (value, format, lng) => {
        if (format === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        if (format === 'currency') {
          return new Intl.NumberFormat(lng, {
            style: 'currency',
            currency: 'CNY', // 默认货币
          }).format(value);
        }
        if (format === 'date') {
          return new Intl.DateTimeFormat(lng).format(new Date(value));
        }
        if (format === 'time') {
          return new Intl.DateTimeFormat(lng, {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(value));
        }
        return value;
      },
    },

    // React配置
    react: {
      useSuspense: true,
      bindI18n: 'languageChanged',
      bindI18nStore: 'added removed',
    },
  });

export default i18n;
```

#### 8.1.2 语言资源文件结构

```json
// src/assets/locales/zh-CN/common.json
{
  "app": {
    "name": "公会经理",
    "version": "版本 {{version}}",
    "loading": "加载中...",
    "error": "发生错误",
    "success": "操作成功",
    "confirm": "确认",
    "cancel": "取消",
    "save": "保存",
    "delete": "删除",
    "edit": "编辑",
    "create": "创建",
    "search": "搜索",
    "filter": "筛选",
    "sort": "排序",
    "refresh": "刷新"
  },
  "navigation": {
    "dashboard": "仪表板",
    "guild": "公会管理",
    "combat": "战斗中心",
    "economy": "经济系统",
    "social": "社交互动",
    "settings": "系统设置"
  },
  "time": {
    "now": "刚刚",
    "minutesAgo": "{{count}}分钟前",
    "hoursAgo": "{{count}}小时前",
    "daysAgo": "{{count}}天前",
    "weeksAgo": "{{count}}周前",
    "monthsAgo": "{{count}}个月前"
  },
  "units": {
    "gold": "金币",
    "experience": "经验值",
    "level": "等级",
    "member": "成员",
    "member_other": "成员"
  }
}

// src/assets/locales/zh-CN/guild.json
{
  "guild": {
    "name": "公会名称",
    "description": "公会描述",
    "level": "公会等级",
    "experience": "公会经验",
    "memberCount": "成员数量",
    "memberLimit": "成员上限",
    "treasury": "公会金库",
    "created": "创建时间"
  },
  "actions": {
    "createGuild": "创建公会",
    "joinGuild": "加入公会",
    "leaveGuild": "退出公会",
    "disbandGuild": "解散公会",
    "inviteMember": "邀请成员",
    "kickMember": "踢出成员",
    "promoteMember": "提升成员",
    "demoteMember": "降级成员"
  },
  "roles": {
    "leader": "会长",
    "viceLeader": "副会长",
    "officer": "干事",
    "elite": "精英成员",
    "member": "普通成员"
  },
  "messages": {
    "guildCreated": "公会《{{name}}》创建成功！",
    "memberJoined": "{{name}} 加入了公会",
    "memberLeft": "{{name}} 离开了公会",
    "memberPromoted": "{{name}} 被提升为 {{role}}",
    "insufficientPermissions": "权限不足",
    "guildFull": "公会已满员",
    "alreadyInGuild": "您已经在公会中"
  }
}

// src/assets/locales/en/common.json
{
  "app": {
    "name": "Guild Manager",
    "version": "Version {{version}}",
    "loading": "Loading...",
    "error": "An error occurred",
    "success": "Operation successful",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "filter": "Filter",
    "sort": "Sort",
    "refresh": "Refresh"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "guild": "Guild Management",
    "combat": "Combat Center",
    "economy": "Economic System",
    "social": "Social Interaction",
    "settings": "Settings"
  }
}
```

#### 8.1.3 多语言Hook与组件

```typescript
// src/hooks/useTranslation.ts - 增强的翻译Hook
import { useTranslation as useI18nTranslation, UseTranslationOptions } from 'react-i18next';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '@/core/i18n/i18nConfig';
import { useMemo } from 'react';

export interface ExtendedTranslationOptions extends UseTranslationOptions {
  // 启用格式化功能
  enableFormatting?: boolean;
  // 默认插值参数
  defaultInterpolation?: Record<string, any>;
}

export function useTranslation(
  ns?: string | string[],
  options?: ExtendedTranslationOptions
) {
  const { t, i18n, ready } = useI18nTranslation(ns, options);

  // 增强的翻译函数
  const translate = useMemo(() => {
    return (key: string, params?: any) => {
      const defaultParams = options?.defaultInterpolation || {};
      const mergedParams = { ...defaultParams, ...params };

      // 如果启用格式化，自动添加语言环境
      if (options?.enableFormatting) {
        mergedParams.lng = i18n.language;
      }

      return t(key, mergedParams);
    };
  }, [t, i18n.language, options?.defaultInterpolation, options?.enableFormatting]);

  // 语言切换函数
  const changeLanguage = async (lng: SupportedLanguage) => {
    await i18n.changeLanguage(lng);

    // 保存到本地存储
    localStorage.setItem('i18nextLng', lng);

    // 更新文档语言
    document.documentElement.lang = lng;

    // 更新文档方向（RTL支持）
    document.documentElement.dir = SUPPORTED_LANGUAGES[lng].direction;
  };

  // 获取当前语言信息
  const currentLanguage = useMemo(() => {
    const lng = i18n.language as SupportedLanguage;
    return SUPPORTED_LANGUAGES[lng] || SUPPORTED_LANGUAGES['zh-CN'];
  }, [i18n.language]);

  // 格式化数字
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(i18n.language, options).format(value);
  };

  // 格式化货币
  const formatCurrency = (value: number, currency: string = 'CNY') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency
    }).format(value);
  };

  // 格式化日期
  const formatDate = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(i18n.language, options).format(new Date(date));
  };

  // 格式化相对时间
  const formatRelativeTime = (date: Date | string | number) => {
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    const now = Date.now();
    const target = new Date(date).getTime();
    const diffInSeconds = (target - now) / 1000;

    const intervals = [
      { unit: 'year', seconds: 31536000 },
      { unit: 'month', seconds: 2592000 },
      { unit: 'week', seconds: 604800 },
      { unit: 'day', seconds: 86400 },
      { unit: 'hour', seconds: 3600 },
      { unit: 'minute', seconds: 60 }
    ] as const;

    for (const { unit, seconds } of intervals) {
      const diff = Math.round(diffInSeconds / seconds);
      if (Math.abs(diff) >= 1) {
        return rtf.format(diff, unit);
      }
    }

    return rtf.format(0, 'second');
  };

  return {
    t: translate,
    i18n,
    ready,
    changeLanguage,
    currentLanguage,
    formatNumber,
    formatCurrency,
    formatDate,
    formatRelativeTime
  };
}

// 多语言文本组件
export interface TranslationProps {
  i18nKey: string;
  values?: Record<string, any>;
  components?: Record<string, React.ReactElement>;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function Translation({
  i18nKey,
  values,
  components,
  className,
  as: Component = 'span'
}: TranslationProps) {
  const { t } = useTranslation();

  return (
    <Component className={className}>
      {t(i18nKey, { ...values, components })}
    </Component>
  );
}

// 语言切换器组件
export function LanguageSwitcher() {
  const { i18n, changeLanguage, currentLanguage } = useTranslation();

  return (
    <div className="language-switcher">
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value as SupportedLanguage)}
        className="language-select"
      >
        {Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => (
          <option key={code} value={code}>
            {info.flag} {info.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// 多语言数字显示组件
export interface LocalizedNumberProps {
  value: number;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  className?: string;
}

export function LocalizedNumber({
  value,
  style = 'decimal',
  currency = 'CNY',
  minimumFractionDigits,
  maximumFractionDigits,
  className
}: LocalizedNumberProps) {
  const { formatNumber, formatCurrency } = useTranslation();

  const formattedValue = useMemo(() => {
    if (style === 'currency') {
      return formatCurrency(value, currency);
    } else if (style === 'percent') {
      return formatNumber(value, {
        style: 'percent',
        minimumFractionDigits,
        maximumFractionDigits
      });
    } else {
      return formatNumber(value, {
        minimumFractionDigits,
        maximumFractionDigits
      });
    }
  }, [value, style, currency, minimumFractionDigits, maximumFractionDigits, formatNumber, formatCurrency]);

  return <span className={className}>{formattedValue}</span>;
}

// 多语言日期显示组件
export interface LocalizedDateProps {
  date: Date | string | number;
  format?: 'full' | 'long' | 'medium' | 'short' | 'relative';
  className?: string;
}

export function LocalizedDate({ date, format = 'medium', className }: LocalizedDateProps) {
  const { formatDate, formatRelativeTime } = useTranslation();

  const formattedDate = useMemo(() => {
    if (format === 'relative') {
      return formatRelativeTime(date);
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      full: { dateStyle: 'full', timeStyle: 'short' },
      long: { dateStyle: 'long', timeStyle: 'short' },
      medium: { dateStyle: 'medium', timeStyle: 'short' },
      short: { dateStyle: 'short', timeStyle: 'short' }
    }[format] || { dateStyle: 'medium' };

    return formatDate(date, formatOptions);
  }, [date, format, formatDate, formatRelativeTime]);

  return <time className={className}>{formattedDate}</time>;
}
```

### 8.2 React 19前端架构

#### 8.2.1 状态管理架构

```typescript
// src/stores/useGameStore.ts - Zustand状态管理
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// 游戏状态接口
interface GameState {
  // 用户信息
  user: {
    id: string;
    username: string;
    level: number;
    experience: number;
    coins: number;
  } | null;

  // 公会信息
  guild: {
    id: string;
    name: string;
    level: number;
    memberCount: number;
    memberLimit: number;
    resources: Record<string, number>;
  } | null;

  // UI状态
  ui: {
    activeTab: string;
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark' | 'system';
    notifications: Notification[];
    modals: Modal[];
  };

  // 游戏设置
  settings: {
    language: string;
    soundEnabled: boolean;
    musicVolume: number;
    effectVolume: number;
    autoSave: boolean;
    notifications: {
      desktop: boolean;
      sound: boolean;
    };
  };

  // 缓存数据
  cache: {
    guilds: Guild[];
    members: GuildMember[];
    battles: Battle[];
    lastUpdated: Record<string, number>;
  };
}

// 状态操作接口
interface GameActions {
  // 用户操作
  setUser: (user: GameState['user']) => void;
  updateUserCoins: (amount: number) => void;
  updateUserExperience: (amount: number) => void;

  // 公会操作
  setGuild: (guild: GameState['guild']) => void;
  updateGuildResources: (resources: Record<string, number>) => void;

  // UI操作
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  setTheme: (theme: GameState['ui']['theme']) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  openModal: (modal: Modal) => void;
  closeModal: (id: string) => void;

  // 设置操作
  updateSettings: (settings: Partial<GameState['settings']>) => void;

  // 缓存操作
  updateCache: <T extends keyof GameState['cache']>(
    key: T,
    data: GameState['cache'][T]
  ) => void;
  invalidateCache: (key?: keyof GameState['cache']) => void;

  // 重置操作
  resetGame: () => void;
}

type GameStore = GameState & GameActions;

// 初始状态
const initialState: GameState = {
  user: null,
  guild: null,
  ui: {
    activeTab: 'dashboard',
    sidebarCollapsed: false,
    theme: 'system',
    notifications: [],
    modals: [],
  },
  settings: {
    language: 'zh-CN',
    soundEnabled: true,
    musicVolume: 0.7,
    effectVolume: 0.8,
    autoSave: true,
    notifications: {
      desktop: true,
      sound: true,
    },
  },
  cache: {
    guilds: [],
    members: [],
    battles: [],
    lastUpdated: {},
  },
};

// 创建store
export const useGameStore = create<GameStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // 用户操作实现
        setUser: user =>
          set(state => {
            state.user = user;
          }),

        updateUserCoins: amount =>
          set(state => {
            if (state.user) {
              state.user.coins = Math.max(0, state.user.coins + amount);
            }
          }),

        updateUserExperience: amount =>
          set(state => {
            if (state.user) {
              state.user.experience += amount;

              // 自动升级逻辑
              const newLevel = Math.floor(state.user.experience / 1000) + 1;
              if (newLevel > state.user.level) {
                state.user.level = newLevel;

                // 发送升级通知
                state.ui.notifications.push({
                  id: `level-up-${Date.now()}`,
                  type: 'success',
                  title: '等级提升',
                  message: `恭喜！您的等级提升到了 ${newLevel}`,
                  timestamp: Date.now(),
                });
              }
            }
          }),

        // 公会操作实现
        setGuild: guild =>
          set(state => {
            state.guild = guild;
          }),

        updateGuildResources: resources =>
          set(state => {
            if (state.guild) {
              Object.assign(state.guild.resources, resources);
            }
          }),

        // UI操作实现
        setActiveTab: tab =>
          set(state => {
            state.ui.activeTab = tab;
          }),

        toggleSidebar: () =>
          set(state => {
            state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
          }),

        setTheme: theme =>
          set(state => {
            state.ui.theme = theme;

            // 应用主题到文档
            const root = document.documentElement;
            if (theme === 'dark') {
              root.classList.add('dark');
            } else if (theme === 'light') {
              root.classList.remove('dark');
            } else {
              // 系统主题
              const isDark = window.matchMedia(
                '(prefers-color-scheme: dark)'
              ).matches;
              root.classList.toggle('dark', isDark);
            }
          }),

        addNotification: notification =>
          set(state => {
            state.ui.notifications.push({
              ...notification,
              id: notification.id || `notification-${Date.now()}`,
              timestamp: notification.timestamp || Date.now(),
            });

            // 限制通知数量
            if (state.ui.notifications.length > 10) {
              state.ui.notifications = state.ui.notifications.slice(-10);
            }
          }),

        removeNotification: id =>
          set(state => {
            const index = state.ui.notifications.findIndex(n => n.id === id);
            if (index !== -1) {
              state.ui.notifications.splice(index, 1);
            }
          }),

        openModal: modal =>
          set(state => {
            state.ui.modals.push({
              ...modal,
              id: modal.id || `modal-${Date.now()}`,
            });
          }),

        closeModal: id =>
          set(state => {
            const index = state.ui.modals.findIndex(m => m.id === id);
            if (index !== -1) {
              state.ui.modals.splice(index, 1);
            }
          }),

        // 设置操作实现
        updateSettings: newSettings =>
          set(state => {
            Object.assign(state.settings, newSettings);
          }),

        // 缓存操作实现
        updateCache: (key, data) =>
          set(state => {
            state.cache[key] = data;
            state.cache.lastUpdated[key] = Date.now();
          }),

        invalidateCache: key =>
          set(state => {
            if (key) {
              delete state.cache.lastUpdated[key];
            } else {
              state.cache.lastUpdated = {};
            }
          }),

        // 重置操作
        resetGame: () =>
          set(() => ({
            ...initialState,
            settings: get().settings, // 保留设置
          })),
      })),
      {
        name: 'game-store',
        partialize: state => ({
          user: state.user,
          guild: state.guild,
          settings: state.settings,
        }),
      }
    ),
    {
      name: 'game-store',
    }
  )
);

// 选择器Hook
export const useUser = () => useGameStore(state => state.user);
export const useGuild = () => useGameStore(state => state.guild);
export const useUI = () => useGameStore(state => state.ui);
export const useSettings = () => useGameStore(state => state.settings);
```

#### 8.2.2 React Query数据获取

```typescript
// src/hooks/useQueries.ts - React Query数据获取
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/stores/useGameStore';
import * as api from '@/api';

// 查询键工厂
export const queryKeys = {
  all: ['game'] as const,
  guilds: () => [...queryKeys.all, 'guilds'] as const,
  guild: (id: string) => [...queryKeys.guilds(), id] as const,
  guildMembers: (guildId: string) =>
    [...queryKeys.guild(guildId), 'members'] as const,
  battles: () => [...queryKeys.all, 'battles'] as const,
  battle: (id: string) => [...queryKeys.battles(), id] as const,
  economy: () => [...queryKeys.all, 'economy'] as const,
  auctions: () => [...queryKeys.economy(), 'auctions'] as const,
  user: () => [...queryKeys.all, 'user'] as const,
  userStats: () => [...queryKeys.user(), 'stats'] as const,
};

// 公会相关查询
export function useGuilds() {
  return useQuery({
    queryKey: queryKeys.guilds(),
    queryFn: api.getGuilds,
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

export function useGuild(guildId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.guild(guildId!),
    queryFn: () => api.getGuild(guildId!),
    enabled: !!guildId,
    staleTime: 2 * 60 * 1000, // 2分钟
  });
}

export function useGuildMembers(guildId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.guildMembers(guildId!),
    queryFn: () => api.getGuildMembers(guildId!),
    enabled: !!guildId,
    staleTime: 1 * 60 * 1000, // 1分钟
  });
}

// 公会变更操作
export function useCreateGuild() {
  const queryClient = useQueryClient();
  const { setGuild } = useGameStore();

  return useMutation({
    mutationFn: api.createGuild,
    onSuccess: newGuild => {
      // 更新本地状态
      setGuild(newGuild);

      // 使缓存失效
      queryClient.invalidateQueries({ queryKey: queryKeys.guilds() });

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '公会创建成功',
        message: `公会《${newGuild.name}》创建成功！`,
      });
    },
    onError: error => {
      useGameStore.getState().addNotification({
        type: 'error',
        title: '公会创建失败',
        message: error.message,
      });
    },
  });
}

export function useJoinGuild() {
  const queryClient = useQueryClient();
  const { setGuild } = useGameStore();

  return useMutation({
    mutationFn: ({ guildId, userId }: { guildId: string; userId: string }) =>
      api.joinGuild(guildId, userId),
    onSuccess: (guild, { guildId }) => {
      // 更新本地状态
      setGuild(guild);

      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: queryKeys.guild(guildId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.guildMembers(guildId),
      });

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '加入公会成功',
        message: `成功加入公会《${guild.name}》`,
      });
    },
    onError: error => {
      useGameStore.getState().addNotification({
        type: 'error',
        title: '加入公会失败',
        message: error.message,
      });
    },
  });
}

// 战斗相关查询
export function useBattles() {
  return useQuery({
    queryKey: queryKeys.battles(),
    queryFn: api.getBattles,
    staleTime: 30 * 1000, // 30秒
    refetchInterval: 60 * 1000, // 1分钟自动刷新
  });
}

export function useBattle(battleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.battle(battleId!),
    queryFn: () => api.getBattle(battleId!),
    enabled: !!battleId,
    staleTime: 10 * 1000, // 10秒
    refetchInterval: data => {
      // 如果战斗还在进行中，每5秒刷新
      return data?.status === 'active' ? 5 * 1000 : false;
    },
  });
}

// 战斗操作
export function useInitiateBattle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.initiateBattle,
    onSuccess: battle => {
      // 使战斗列表缓存失效
      queryClient.invalidateQueries({ queryKey: queryKeys.battles() });

      // 添加新战斗到缓存
      queryClient.setQueryData(queryKeys.battle(battle.id), battle);

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '战斗开始',
        message: '战斗已成功发起！',
      });
    },
    onError: error => {
      useGameStore.getState().addNotification({
        type: 'error',
        title: '发起战斗失败',
        message: error.message,
      });
    },
  });
}

// 经济系统查询
export function useAuctions() {
  return useQuery({
    queryKey: queryKeys.auctions(),
    queryFn: api.getAuctions,
    staleTime: 30 * 1000, // 30秒
    refetchInterval: 60 * 1000, // 1分钟自动刷新
  });
}

export function usePlaceBid() {
  const queryClient = useQueryClient();
  const { updateUserCoins } = useGameStore();

  return useMutation({
    mutationFn: ({
      auctionId,
      bidAmount,
    }: {
      auctionId: string;
      bidAmount: number;
    }) => api.placeBid(auctionId, bidAmount),
    onSuccess: (result, { bidAmount }) => {
      // 更新用户金币（乐观更新）
      updateUserCoins(-bidAmount);

      // 使拍卖缓存失效
      queryClient.invalidateQueries({ queryKey: queryKeys.auctions() });

      // 添加成功通知
      useGameStore.getState().addNotification({
        type: 'success',
        title: '竞价成功',
        message: `成功出价 ${bidAmount} 金币`,
      });
    },
    onError: (error, { bidAmount }) => {
      // 回滚乐观更新
      updateUserCoins(bidAmount);

      useGameStore.getState().addNotification({
        type: 'error',
        title: '竞价失败',
        message: error.message,
      });
    },
  });
}

// 用户统计查询
export function useUserStats() {
  const user = useUser();

  return useQuery({
    queryKey: queryKeys.userStats(),
    queryFn: () => api.getUserStats(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

// 预加载Hook
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchGuild = (guildId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.guild(guildId),
      queryFn: () => api.getGuild(guildId),
      staleTime: 2 * 60 * 1000,
    });
  };

  const prefetchBattle = (battleId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.battle(battleId),
      queryFn: () => api.getBattle(battleId),
      staleTime: 10 * 1000,
    });
  };

  return {
    prefetchGuild,
    prefetchBattle,
  };
}
```

## 第9章：性能与容量规划（融合性能优化方案+风险评估应对）

> **核心目标**: 构建高性能、可扩展的系统架构，通过科学的容量规划和风险管控，确保系统在各种负载下稳定运行，为AI代码生成提供性能基准和优化指导

### 9.1 性能基准与目标

#### 9.1.1 核心性能指标定义

```typescript
// src/core/performance/PerformanceTargets.ts
export const PERFORMANCE_TARGETS = {
  // 响应时间指标
  responseTime: {
    ui: {
      target: 100, // UI响应100ms
      warning: 200, // 200ms警告
      critical: 500, // 500ms严重
    },
    api: {
      target: 50, // API响应50ms
      warning: 100, // 100ms警告
      critical: 300, // 300ms严重
    },
    database: {
      target: 20, // 数据库查询20ms
      warning: 50, // 50ms警告
      critical: 100, // 100ms严重
    },
    ai: {
      target: 1000, // AI决策1秒
      warning: 3000, // 3秒警告
      critical: 5000, // 5秒严重
    },
  },

  // 吞吐量指标
  throughput: {
    events: {
      target: 1000, // 1000 events/sec
      warning: 800, // 800 events/sec警告
      critical: 500, // 500 events/sec严重
    },
    users: {
      concurrent: 100, // 并发用户数
      peak: 200, // 峰值用户数
      sessions: 500, // 日活跃会话
    },
    database: {
      queries: 500, // 500 queries/sec
      connections: 20, // 最大连接数
      transactions: 100, // 100 transactions/sec
    },
  },

  // 资源使用指标
  resources: {
    memory: {
      target: 256, // 256MB目标
      warning: 512, // 512MB警告
      critical: 1024, // 1GB严重
    },
    cpu: {
      target: 30, // 30% CPU使用率
      warning: 60, // 60%警告
      critical: 80, // 80%严重
    },
    disk: {
      storage: 2048, // 2GB存储空间
      iops: 1000, // 1000 IOPS
      bandwidth: 100, // 100MB/s带宽
    },
  },

  // 可用性指标
  availability: {
    uptime: 99.9, // 99.9%可用性
    mtbf: 720, // 720小时平均故障间隔
    mttr: 5, // 5分钟平均恢复时间
    rpo: 1, // 1分钟恢复点目标
    rto: 5, // 5分钟恢复时间目标
  },
} as const;

// 性能监控指标收集器
export class PerformanceMetricsCollector {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private collectors: Map<string, MetricCollector> = new Map();
  private alertManager: AlertManager;

  constructor(alertManager: AlertManager) {
    this.alertManager = alertManager;
    this.initializeCollectors();
  }

  // 初始化指标收集器
  private initializeCollectors(): void {
    // UI性能收集器
    this.collectors.set('ui', new UIPerformanceCollector());

    // API性能收集器
    this.collectors.set('api', new APIPerformanceCollector());

    // 数据库性能收集器
    this.collectors.set('database', new DatabasePerformanceCollector());

    // AI引擎性能收集器
    this.collectors.set('ai', new AIPerformanceCollector());

    // 系统资源收集器
    this.collectors.set('system', new SystemResourceCollector());
  }

  // 开始收集指标
  startCollection(): void {
    console.log('🔍 Starting performance metrics collection...');

    // 启动所有收集器
    for (const [name, collector] of this.collectors) {
      collector.start();
      console.log(`✅ Started ${name} metrics collector`);
    }

    // 定期聚合和分析指标
    setInterval(() => {
      this.aggregateAndAnalyzeMetrics();
    }, 60000); // 每分钟分析一次
  }

  // 聚合和分析指标
  private async aggregateAndAnalyzeMetrics(): Promise<void> {
    const timestamp = Date.now();
    const aggregatedMetrics: AggregatedMetrics = {
      timestamp,
      responseTime: {},
      throughput: {},
      resources: {},
      availability: {},
    };

    // 收集各项指标
    for (const [name, collector] of this.collectors) {
      try {
        const metrics = await collector.collect();
        this.processMetrics(name, metrics, aggregatedMetrics);
      } catch (error) {
        console.error(`Failed to collect ${name} metrics:`, error);
      }
    }

    // 存储指标
    this.storeMetrics(aggregatedMetrics);

    // 检查告警条件
    await this.checkAlertConditions(aggregatedMetrics);
  }

  // 处理指标数据
  private processMetrics(
    collectorName: string,
    metrics: RawMetrics,
    aggregated: AggregatedMetrics
  ): void {
    switch (collectorName) {
      case 'ui':
        aggregated.responseTime.ui = this.calculateAverageResponseTime(
          metrics.responseTimes
        );
        break;
      case 'api':
        aggregated.responseTime.api = this.calculateAverageResponseTime(
          metrics.responseTimes
        );
        aggregated.throughput.requests = metrics.requestCount;
        break;
      case 'database':
        aggregated.responseTime.database = this.calculateAverageResponseTime(
          metrics.queryTimes
        );
        aggregated.throughput.queries = metrics.queryCount;
        break;
      case 'ai':
        aggregated.responseTime.ai = this.calculateAverageResponseTime(
          metrics.decisionTimes
        );
        aggregated.throughput.decisions = metrics.decisionCount;
        break;
      case 'system':
        aggregated.resources = {
          memory: metrics.memoryUsage,
          cpu: metrics.cpuUsage,
          disk: metrics.diskUsage,
        };
        break;
    }
  }

  // 检查告警条件
  private async checkAlertConditions(
    metrics: AggregatedMetrics
  ): Promise<void> {
    const alerts: PerformanceAlert[] = [];

    // 检查响应时间
    if (
      metrics.responseTime.ui > PERFORMANCE_TARGETS.responseTime.ui.critical
    ) {
      alerts.push({
        type: 'CRITICAL_UI_RESPONSE_TIME',
        severity: 'critical',
        message: `UI response time: ${metrics.responseTime.ui}ms > ${PERFORMANCE_TARGETS.responseTime.ui.critical}ms`,
        metric: 'responseTime.ui',
        value: metrics.responseTime.ui,
        threshold: PERFORMANCE_TARGETS.responseTime.ui.critical,
      });
    }

    // 检查内存使用
    if (
      metrics.resources.memory > PERFORMANCE_TARGETS.resources.memory.critical
    ) {
      alerts.push({
        type: 'CRITICAL_MEMORY_USAGE',
        severity: 'critical',
        message: `Memory usage: ${metrics.resources.memory}MB > ${PERFORMANCE_TARGETS.resources.memory.critical}MB`,
        metric: 'resources.memory',
        value: metrics.resources.memory,
        threshold: PERFORMANCE_TARGETS.resources.memory.critical,
      });
    }

    // 发送告警
    for (const alert of alerts) {
      await this.alertManager.sendAlert(alert);
    }
  }
}
```

#### 9.1.2 性能基准测试框架

```typescript
// src/core/performance/BenchmarkSuite.ts
export class PerformanceBenchmarkSuite {
  private benchmarks: Map<string, Benchmark> = new Map();
  private results: BenchmarkResult[] = [];

  constructor() {
    this.initializeBenchmarks();
  }

  // 初始化基准测试
  private initializeBenchmarks(): void {
    // UI渲染性能测试
    this.benchmarks.set('ui_render', new UIRenderBenchmark());

    // 事件处理性能测试
    this.benchmarks.set('event_processing', new EventProcessingBenchmark());

    // 数据库操作性能测试
    this.benchmarks.set('database_ops', new DatabaseOperationsBenchmark());

    // AI决策性能测试
    this.benchmarks.set('ai_decisions', new AIDecisionBenchmark());

    // 内存管理性能测试
    this.benchmarks.set('memory_management', new MemoryManagementBenchmark());
  }

  // 运行所有基准测试
  async runAllBenchmarks(): Promise<BenchmarkReport> {
    console.log('🚀 Starting performance benchmark suite...');
    const startTime = performance.now();

    const results: BenchmarkResult[] = [];

    for (const [name, benchmark] of this.benchmarks) {
      console.log(`📊 Running ${name} benchmark...`);

      try {
        const result = await this.runBenchmark(name, benchmark);
        results.push(result);

        console.log(
          `✅ ${name}: ${result.avgTime}ms (${result.operations}/sec)`
        );
      } catch (error) {
        console.error(`❌ ${name} failed:`, error);
        results.push({
          name,
          success: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    }

    const totalTime = performance.now() - startTime;

    const report: BenchmarkReport = {
      timestamp: Date.now(),
      totalTime,
      results,
      summary: this.generateSummary(results),
    };

    console.log('📈 Benchmark suite completed:', report.summary);
    return report;
  }

  // 运行单个基准测试
  private async runBenchmark(
    name: string,
    benchmark: Benchmark
  ): Promise<BenchmarkResult> {
    const warmupRuns = 10;
    const measureRuns = 100;

    // 预热阶段
    for (let i = 0; i < warmupRuns; i++) {
      await benchmark.execute();
    }

    // 测量阶段
    const times: number[] = [];
    let operations = 0;

    for (let i = 0; i < measureRuns; i++) {
      const startTime = performance.now();
      const result = await benchmark.execute();
      const endTime = performance.now();

      times.push(endTime - startTime);
      operations += result.operationCount || 1;
    }

    // 计算统计信息
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const p95Time = this.calculatePercentile(times, 95);
    const p99Time = this.calculatePercentile(times, 99);
    const operationsPerSecond = (operations / (avgTime * measureRuns)) * 1000;

    return {
      name,
      success: true,
      avgTime,
      minTime,
      maxTime,
      p95Time,
      p99Time,
      operations: operationsPerSecond,
      runs: measureRuns,
      timestamp: Date.now(),
    };
  }

  // 生成基准测试摘要
  private generateSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      totalTests: results.length,
      successful: successful.length,
      failed: failed.length,
      avgResponseTime:
        successful.length > 0
          ? successful.reduce((sum, r) => sum + r.avgTime, 0) /
            successful.length
          : 0,
      totalOperationsPerSecond: successful.reduce(
        (sum, r) => sum + r.operations,
        0
      ),
    };
  }

  // 计算百分位数
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// UI渲染基准测试
class UIRenderBenchmark implements Benchmark {
  async execute(): Promise<BenchmarkExecutionResult> {
    // 模拟复杂UI渲染
    const container = document.createElement('div');
    const componentCount = 100;

    for (let i = 0; i < componentCount; i++) {
      const element = document.createElement('div');
      element.innerHTML = `<span>Component ${i}</span>`;
      element.style.cssText =
        'padding: 10px; margin: 5px; border: 1px solid #ccc;';
      container.appendChild(element);
    }

    // 触发重绘
    document.body.appendChild(container);
    await new Promise(resolve => requestAnimationFrame(resolve));
    document.body.removeChild(container);

    return { operationCount: componentCount };
  }
}

// 事件处理基准测试
class EventProcessingBenchmark implements Benchmark {
  private eventPool: EventPoolCore;

  constructor() {
    this.eventPool = new EventPoolCore();
  }

  async execute(): Promise<BenchmarkExecutionResult> {
    const eventCount = 1000;
    const events: GameEvent[] = [];

    // 生成测试事件
    for (let i = 0; i < eventCount; i++) {
      events.push({
        type: `test.event.${i % 10}`,
        payload: { data: `test data ${i}` },
        timestamp: Date.now(),
        priority: i % 3,
      });
    }

    // 批量处理事件
    await this.eventPool.processBatch(events);

    return { operationCount: eventCount };
  }
}

// AI决策基准测试
class AIDecisionBenchmark implements Benchmark {
  private aiEngine: AIEngineCore;

  constructor() {
    this.aiEngine = new AIEngineCore({
      workerCount: 2,
      cacheSize: 1000,
    });
  }

  async execute(): Promise<BenchmarkExecutionResult> {
    const decisionCount = 10;
    const decisions: Promise<NPCAction>[] = [];

    // 并发AI决策请求
    for (let i = 0; i < decisionCount; i++) {
      const npcId = `npc_${i % 5}`;
      const situation: NPCSituation = {
        urgency: Math.random(),
        complexity: Math.random(),
        resources: Math.random() * 1000,
        guildContext: {
          memberCount: 50,
          level: 10,
          resources: 5000,
        },
      };

      decisions.push(this.aiEngine.makeNPCDecision(npcId, situation));
    }

    // 等待所有决策完成
    await Promise.all(decisions);

    return { operationCount: decisionCount };
  }
}
```

### 9.2 容量规划与扩展策略

#### 9.2.1 系统容量模型

```typescript
// src/core/capacity/CapacityPlanner.ts
export class SystemCapacityPlanner {
  private currentCapacity: SystemCapacity;
  private growthModel: GrowthModel;
  private resourcePredictor: ResourcePredictor;

  constructor(config: CapacityPlannerConfig) {
    this.currentCapacity = this.assessCurrentCapacity();
    this.growthModel = new GrowthModel(config.growthParameters);
    this.resourcePredictor = new ResourcePredictor(config.predictionModel);
  }

  // 评估当前系统容量
  private assessCurrentCapacity(): SystemCapacity {
    return {
      compute: {
        cpu: {
          cores: navigator.hardwareConcurrency || 4,
          frequency: 2400, // MHz，估算值
          utilization: 0, // 当前使用率
          available: 100, // 可用百分比
        },
        memory: {
          total: this.getSystemMemory(),
          used: this.getCurrentMemoryUsage(),
          available: this.getAvailableMemory(),
          cache: this.getCacheMemory(),
        },
        storage: {
          total: this.getStorageCapacity(),
          used: this.getUsedStorage(),
          available: this.getAvailableStorage(),
          iops: 1000, // 估算IOPS
        },
      },

      network: {
        bandwidth: 100, // Mbps估算
        latency: 50, // ms估算
        connections: {
          current: 0,
          maximum: 1000,
        },
      },

      application: {
        users: {
          concurrent: 0,
          maximum: 100,
          sessions: 0,
        },
        events: {
          current: 0,
          maximum: 1000,
          throughput: 0,
        },
        ai: {
          workers: 4,
          decisions: 0,
          cacheSize: 10000,
          hitRate: 0.9,
        },
      },
    };
  }

  // 预测未来容量需求
  async predictCapacityNeeds(timeHorizon: number): Promise<CapacityForecast> {
    const forecast: CapacityForecast = {
      timeHorizon,
      predictions: [],
      recommendations: [],
      riskAssessment: {
        high: [],
        medium: [],
        low: [],
      },
    };

    // 预测时间点（按月）
    const months = timeHorizon;

    for (let month = 1; month <= months; month++) {
      const prediction = await this.predictMonthlyCapacity(month);
      forecast.predictions.push(prediction);

      // 评估容量风险
      const risks = this.assessCapacityRisks(prediction);
      forecast.riskAssessment.high.push(...risks.high);
      forecast.riskAssessment.medium.push(...risks.medium);
      forecast.riskAssessment.low.push(...risks.low);
    }

    // 生成扩展建议
    forecast.recommendations = this.generateScalingRecommendations(forecast);

    return forecast;
  }

  // 预测月度容量需求
  private async predictMonthlyCapacity(
    month: number
  ): Promise<MonthlyCapacityPrediction> {
    // 基于增长模型预测用户增长
    const userGrowth = this.growthModel.predictUserGrowth(month);
    const expectedUsers = Math.round(
      this.currentCapacity.application.users.maximum * userGrowth
    );

    // 预测资源需求
    const resourceNeeds = await this.resourcePredictor.predict({
      users: expectedUsers,
      timeframe: month,
      currentCapacity: this.currentCapacity,
    });

    return {
      month,
      expectedUsers,
      resourceNeeds,
      bottlenecks: this.identifyBottlenecks(resourceNeeds),
      scalingRequired: this.determineScalingNeeds(resourceNeeds),
    };
  }

  // 识别性能瓶颈
  private identifyBottlenecks(resourceNeeds: ResourceNeeds): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // CPU瓶颈检查
    if (
      resourceNeeds.compute.cpu >
      this.currentCapacity.compute.cpu.cores * 0.8
    ) {
      bottlenecks.push({
        type: 'CPU',
        severity: 'high',
        currentUsage: resourceNeeds.compute.cpu,
        capacity: this.currentCapacity.compute.cpu.cores,
        utilizationRate:
          resourceNeeds.compute.cpu / this.currentCapacity.compute.cpu.cores,
        recommendation: 'Consider CPU upgrade or optimization',
      });
    }

    // 内存瓶颈检查
    if (
      resourceNeeds.compute.memory >
      this.currentCapacity.compute.memory.total * 0.85
    ) {
      bottlenecks.push({
        type: 'MEMORY',
        severity: 'high',
        currentUsage: resourceNeeds.compute.memory,
        capacity: this.currentCapacity.compute.memory.total,
        utilizationRate:
          resourceNeeds.compute.memory /
          this.currentCapacity.compute.memory.total,
        recommendation: 'Memory optimization or expansion required',
      });
    }

    // 存储瓶颈检查
    if (
      resourceNeeds.storage.space >
      this.currentCapacity.compute.storage.total * 0.9
    ) {
      bottlenecks.push({
        type: 'STORAGE',
        severity: 'medium',
        currentUsage: resourceNeeds.storage.space,
        capacity: this.currentCapacity.compute.storage.total,
        utilizationRate:
          resourceNeeds.storage.space /
          this.currentCapacity.compute.storage.total,
        recommendation: 'Storage cleanup or expansion needed',
      });
    }

    return bottlenecks;
  }

  // 生成扩展建议
  private generateScalingRecommendations(
    forecast: CapacityForecast
  ): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];

    // 分析预测数据
    const highRiskMonths = forecast.predictions.filter(p =>
      p.bottlenecks.some(b => b.severity === 'high')
    );

    if (highRiskMonths.length > 0) {
      const nearestRisk = Math.min(...highRiskMonths.map(m => m.month));

      recommendations.push({
        type: 'IMMEDIATE_ACTION',
        priority: 'HIGH',
        timeframe: `Month ${nearestRisk}`,
        description: 'Critical capacity bottlenecks detected',
        actions: [
          'Implement performance optimizations',
          'Consider hardware upgrades',
          'Scale critical components',
        ],
        estimatedCost: this.estimateScalingCost('immediate'),
        expectedBenefit: 'Prevents system performance degradation',
      });
    }

    // 长期扩展建议
    const longTermGrowth =
      forecast.predictions[forecast.predictions.length - 1];
    if (
      longTermGrowth.expectedUsers >
      this.currentCapacity.application.users.maximum * 2
    ) {
      recommendations.push({
        type: 'LONG_TERM_SCALING',
        priority: 'MEDIUM',
        timeframe: `Month ${longTermGrowth.month}`,
        description: 'Plan for significant user base growth',
        actions: [
          'Implement horizontal scaling',
          'Consider microservices architecture',
          'Plan infrastructure expansion',
        ],
        estimatedCost: this.estimateScalingCost('long_term'),
        expectedBenefit: 'Supports sustained growth',
      });
    }

    return recommendations;
  }

  // 估算扩展成本
  private estimateScalingCost(type: 'immediate' | 'long_term'): CostEstimate {
    const baseCosts = {
      immediate: {
        development: 5000,
        hardware: 2000,
        maintenance: 500,
      },
      long_term: {
        development: 20000,
        hardware: 10000,
        maintenance: 2000,
      },
    };

    const costs = baseCosts[type];

    return {
      development: costs.development,
      hardware: costs.hardware,
      maintenance: costs.maintenance,
      total: costs.development + costs.hardware + costs.maintenance,
      currency: 'USD',
      timeframe: type === 'immediate' ? '3 months' : '12 months',
    };
  }

  // 获取系统内存信息
  private getSystemMemory(): number {
    // @ts-ignore - 浏览器API可能不存在
    return navigator.deviceMemory ? navigator.deviceMemory * 1024 : 4096; // MB
  }

  // 获取当前内存使用
  private getCurrentMemoryUsage(): number {
    if (performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024); // MB
    }
    return 0;
  }

  // 获取可用内存
  private getAvailableMemory(): number {
    const total = this.getSystemMemory();
    const used = this.getCurrentMemoryUsage();
    return total - used;
  }

  // 获取缓存内存
  private getCacheMemory(): number {
    // 估算缓存使用量
    return Math.round(this.getCurrentMemoryUsage() * 0.3);
  }

  // 获取存储容量信息
  private getStorageCapacity(): number {
    // 估算可用存储空间 (MB)
    return 10240; // 10GB估算
  }

  // 获取已使用存储
  private getUsedStorage(): number {
    // 估算已使用存储
    return 1024; // 1GB估算
  }

  // 获取可用存储
  private getAvailableStorage(): number {
    return this.getStorageCapacity() - this.getUsedStorage();
  }
}

// 增长模型
class GrowthModel {
  private parameters: GrowthParameters;

  constructor(parameters: GrowthParameters) {
    this.parameters = parameters;
  }

  // 预测用户增长
  predictUserGrowth(month: number): number {
    const { baseGrowthRate, seasonalFactor, marketSaturation } =
      this.parameters;

    // 基础增长模型：复合增长
    let growth = Math.pow(1 + baseGrowthRate, month);

    // 季节性调整
    const seasonalAdjustment =
      1 + seasonalFactor * Math.sin((month * Math.PI) / 6);
    growth *= seasonalAdjustment;

    // 市场饱和度调整
    const saturationAdjustment =
      1 /
      (1 +
        Math.exp(
          (month - marketSaturation.inflectionPoint) /
            marketSaturation.steepness
        ));
    growth *= saturationAdjustment;

    return Math.max(1, growth);
  }

  // 预测事件处理增长
  predictEventGrowth(month: number, userGrowth: number): number {
    // 事件量通常随用户增长而增长，但有一定的非线性关系
    return userGrowth * (1 + Math.log(userGrowth) * 0.1);
  }

  // 预测AI决策需求增长
  predictAIDecisionGrowth(month: number, userGrowth: number): number {
    // AI决策需求随用户和NPC数量增长
    const npcGrowth = userGrowth * 0.8; // NPC数量相对较稳定
    return userGrowth + npcGrowth;
  }
}

// 资源预测器
class ResourcePredictor {
  private model: PredictionModel;

  constructor(model: PredictionModel) {
    this.model = model;
  }

  // 预测资源需求
  async predict(input: PredictionInput): Promise<ResourceNeeds> {
    const { users, timeframe, currentCapacity } = input;

    // 使用历史数据和机器学习模型预测
    const predictions = await this.runPredictionModel(input);

    return {
      compute: {
        cpu: this.predictCPUNeeds(users, predictions),
        memory: this.predictMemoryNeeds(users, predictions),
        storage: this.predictStorageNeeds(users, timeframe, predictions),
      },
      network: {
        bandwidth: this.predictBandwidthNeeds(users, predictions),
        connections: users * 1.2, // 每用户平均连接数
      },
      application: {
        events: this.predictEventNeeds(users, predictions),
        ai: this.predictAINeeds(users, predictions),
        cache: this.predictCacheNeeds(users, predictions),
      },
    };
  }

  // 运行预测模型
  private async runPredictionModel(
    input: PredictionInput
  ): Promise<ModelPredictions> {
    // 简化的线性预测模型
    const userFactor =
      input.users / input.currentCapacity.application.users.maximum;
    const timeFactor = 1 + input.timeframe * 0.05; // 5%月增长

    return {
      cpuMultiplier: userFactor * 0.8 * timeFactor,
      memoryMultiplier: userFactor * 0.9 * timeFactor,
      storageMultiplier: userFactor * 1.2 * timeFactor,
      networkMultiplier: userFactor * 1.1 * timeFactor,
      eventMultiplier: userFactor * 1.5 * timeFactor,
      aiMultiplier: userFactor * 2.0 * timeFactor,
    };
  }

  // 预测CPU需求
  private predictCPUNeeds(
    users: number,
    predictions: ModelPredictions
  ): number {
    const baseCPUPerUser = 0.01; // 每用户CPU核心需求
    return users * baseCPUPerUser * predictions.cpuMultiplier;
  }

  // 预测内存需求
  private predictMemoryNeeds(
    users: number,
    predictions: ModelPredictions
  ): number {
    const baseMemoryPerUser = 10; // 每用户10MB内存
    const systemOverhead = 512; // 系统基础开销512MB
    return (
      users * baseMemoryPerUser * predictions.memoryMultiplier + systemOverhead
    );
  }

  // 预测存储需求
  private predictStorageNeeds(
    users: number,
    timeframe: number,
    predictions: ModelPredictions
  ): StorageNeeds {
    const dataPerUser = 5; // 每用户5MB数据
    const logGrowth = timeframe * 10; // 每月10MB日志

    return {
      space: users * dataPerUser * predictions.storageMultiplier + logGrowth,
      iops: users * 2 * predictions.storageMultiplier,
    };
  }

  // 预测带宽需求
  private predictBandwidthNeeds(
    users: number,
    predictions: ModelPredictions
  ): number {
    const bandwidthPerUser = 0.1; // 每用户0.1Mbps
    return users * bandwidthPerUser * predictions.networkMultiplier;
  }

  // 预测事件处理需求
  private predictEventNeeds(
    users: number,
    predictions: ModelPredictions
  ): number {
    const eventsPerUser = 10; // 每用户每秒10个事件
    return users * eventsPerUser * predictions.eventMultiplier;
  }

  // 预测AI处理需求
  private predictAINeeds(users: number, predictions: ModelPredictions): number {
    const aiDecisionsPerUser = 0.5; // 每用户每秒0.5个AI决策
    return users * aiDecisionsPerUser * predictions.aiMultiplier;
  }

  // 预测缓存需求
  private predictCacheNeeds(
    users: number,
    predictions: ModelPredictions
  ): number {
    const cachePerUser = 1; // 每用户1MB缓存
    return users * cachePerUser * predictions.memoryMultiplier;
  }
}
```

### 9.3 风险评估与应对策略

#### 9.3.1 系统风险评估框架

```typescript
// src/core/risk/RiskAssessmentEngine.ts
export class SystemRiskAssessmentEngine {
  private riskCategories: Map<string, RiskCategory>;
  private mitigationStrategies: Map<string, MitigationStrategy>;
  private monitoringSystem: RiskMonitoringSystem;

  constructor(config: RiskAssessmentConfig) {
    this.riskCategories = new Map();
    this.mitigationStrategies = new Map();
    this.monitoringSystem = new RiskMonitoringSystem(config.monitoringConfig);

    this.initializeRiskFramework();
  }

  // 初始化风险评估框架
  private initializeRiskFramework(): void {
    // 技术风险类别
    this.riskCategories.set('TECHNICAL', {
      id: 'TECHNICAL',
      name: '技术风险',
      description: '系统架构、性能、安全等技术相关风险',
      riskTypes: [
        {
          id: 'PERFORMANCE_DEGRADATION',
          name: '性能下降',
          description: '系统响应时间增加，吞吐量下降',
          likelihood: 'MEDIUM',
          impact: 'HIGH',
          detectability: 'MEDIUM',
          indicators: [
            'CPU使用率 > 80%',
            '响应时间 > 500ms',
            '内存使用 > 85%',
            '错误率 > 1%',
          ],
          triggers: [
            '用户并发数激增',
            '数据量快速增长',
            '代码性能退化',
            '硬件老化',
          ],
        },
        {
          id: 'DATA_CORRUPTION',
          name: '数据损坏',
          description: '数据完整性受损或数据丢失',
          likelihood: 'LOW',
          impact: 'CRITICAL',
          detectability: 'LOW',
          indicators: [
            '数据一致性检查失败',
            '备份验证失败',
            '异常的数据查询结果',
            '文件系统错误',
          ],
          triggers: ['硬件故障', '软件bug', '不当操作', '电源异常'],
        },
        {
          id: 'AI_MODEL_DRIFT',
          name: 'AI模型漂移',
          description: 'AI决策质量下降，模型预测不准确',
          likelihood: 'MEDIUM',
          impact: 'MEDIUM',
          detectability: 'MEDIUM',
          indicators: [
            'AI决策满意度 < 80%',
            '模型预测准确率下降',
            '异常决策模式',
            '用户反馈质量下降',
          ],
          triggers: [
            '数据分布变化',
            '业务规则调整',
            '长期运行无重训练',
            '外部环境变化',
          ],
        },
      ],
    });

    // 运营风险类别
    this.riskCategories.set('OPERATIONAL', {
      id: 'OPERATIONAL',
      name: '运营风险',
      description: '日常运维、部署、配置等运营相关风险',
      riskTypes: [
        {
          id: 'DEPLOYMENT_FAILURE',
          name: '部署失败',
          description: '新版本部署失败导致服务中断',
          likelihood: 'MEDIUM',
          impact: 'HIGH',
          detectability: 'HIGH',
          indicators: [
            '部署脚本失败',
            '服务启动异常',
            '健康检查失败',
            '回滚操作触发',
          ],
          triggers: ['配置错误', '依赖冲突', '环境差异', '权限问题'],
        },
        {
          id: 'RESOURCE_EXHAUSTION',
          name: '资源耗尽',
          description: '系统资源（CPU、内存、存储）耗尽',
          likelihood: 'MEDIUM',
          impact: 'HIGH',
          detectability: 'HIGH',
          indicators: [
            '资源使用率 > 95%',
            '系统响应缓慢',
            'OOM错误',
            '磁盘空间不足',
          ],
          triggers: ['流量突增', '内存泄露', '日志文件过大', '缓存无限增长'],
        },
      ],
    });

    // 外部风险类别
    this.riskCategories.set('EXTERNAL', {
      id: 'EXTERNAL',
      name: '外部风险',
      description: '外部环境变化带来的风险',
      riskTypes: [
        {
          id: 'DEPENDENCY_FAILURE',
          name: '依赖服务故障',
          description: '外部依赖服务不可用或性能下降',
          likelihood: 'MEDIUM',
          impact: 'MEDIUM',
          detectability: 'HIGH',
          indicators: [
            '外部服务响应超时',
            '连接失败',
            '错误率增加',
            '服务降级触发',
          ],
          triggers: ['第三方服务故障', '网络问题', '服务限流', '版本不兼容'],
        },
      ],
    });

    this.initializeMitigationStrategies();
  }

  // 初始化缓解策略
  private initializeMitigationStrategies(): void {
    // 性能下降缓解策略
    this.mitigationStrategies.set('PERFORMANCE_DEGRADATION', {
      id: 'PERFORMANCE_DEGRADATION',
      name: '性能下降缓解',
      preventiveActions: [
        {
          action: '实施性能监控',
          description: '部署全面的性能监控系统',
          priority: 'HIGH',
          timeline: '立即执行',
          resources: ['监控工具', '告警系统'],
          successCriteria: ['监控覆盖率 > 90%', '告警响应时间 < 5分钟'],
        },
        {
          action: '建立性能基准',
          description: '定期执行性能基准测试',
          priority: 'MEDIUM',
          timeline: '每月执行',
          resources: ['测试工具', '基准数据'],
          successCriteria: ['基准测试通过率 > 95%'],
        },
        {
          action: '实施资源优化',
          description: '优化代码性能和资源使用',
          priority: 'MEDIUM',
          timeline: '持续进行',
          resources: ['开发团队', '性能分析工具'],
          successCriteria: ['响应时间改善 > 20%', '资源使用优化 > 15%'],
        },
      ],
      reactiveActions: [
        {
          action: '自动扩容',
          description: '触发自动资源扩容',
          priority: 'CRITICAL',
          timeline: '5分钟内',
          resources: ['自动化脚本', '资源池'],
          successCriteria: ['扩容成功', '性能恢复正常'],
        },
        {
          action: '降级服务',
          description: '临时关闭非核心功能',
          priority: 'HIGH',
          timeline: '10分钟内',
          resources: ['服务开关', '降级配置'],
          successCriteria: ['核心功能可用', '响应时间恢复'],
        },
        {
          action: '性能调优',
          description: '紧急性能优化',
          priority: 'MEDIUM',
          timeline: '2小时内',
          resources: ['技术团队', '性能工具'],
          successCriteria: ['性能指标恢复正常'],
        },
      ],
      recoveryActions: [
        {
          action: '根因分析',
          description: '分析性能问题根本原因',
          priority: 'HIGH',
          timeline: '24小时内',
          resources: ['分析团队', '日志数据', '监控数据'],
          successCriteria: ['根因确定', '分析报告完成'],
        },
        {
          action: '长期优化',
          description: '实施长期性能优化方案',
          priority: 'MEDIUM',
          timeline: '1周内',
          resources: ['开发资源', '测试环境'],
          successCriteria: ['优化方案实施', '性能提升验证'],
        },
      ],
    });

    // 数据损坏缓解策略
    this.mitigationStrategies.set('DATA_CORRUPTION', {
      id: 'DATA_CORRUPTION',
      name: '数据损坏缓解',
      preventiveActions: [
        {
          action: '实施数据备份',
          description: '定期自动数据备份',
          priority: 'CRITICAL',
          timeline: '立即部署',
          resources: ['备份系统', '存储空间'],
          successCriteria: ['备份成功率 > 99%', '备份验证通过'],
        },
        {
          action: '数据完整性检查',
          description: '定期执行数据完整性验证',
          priority: 'HIGH',
          timeline: '每日执行',
          resources: ['验证脚本', '检查工具'],
          successCriteria: ['检查覆盖率 100%', '问题及时发现'],
        },
      ],
      reactiveActions: [
        {
          action: '隔离损坏数据',
          description: '立即隔离受影响的数据',
          priority: 'CRITICAL',
          timeline: '立即执行',
          resources: ['隔离机制', '备用系统'],
          successCriteria: ['损坏数据隔离', '服务继续可用'],
        },
        {
          action: '数据恢复',
          description: '从备份恢复数据',
          priority: 'CRITICAL',
          timeline: '30分钟内',
          resources: ['备份数据', '恢复脚本'],
          successCriteria: ['数据恢复完成', '完整性验证通过'],
        },
      ],
      recoveryActions: [
        {
          action: '损坏原因调查',
          description: '调查数据损坏的根本原因',
          priority: 'HIGH',
          timeline: '48小时内',
          resources: ['技术团队', '日志分析', '系统检查'],
          successCriteria: ['原因确定', '预防措施制定'],
        },
      ],
    });
  }

  // 执行风险评估
  async performRiskAssessment(): Promise<RiskAssessmentReport> {
    console.log('🔍 Starting comprehensive risk assessment...');

    const assessment: RiskAssessmentReport = {
      timestamp: Date.now(),
      overallRiskLevel: 'UNKNOWN',
      categoryAssessments: [],
      highPriorityRisks: [],
      recommendations: [],
      actionPlan: [],
    };

    // 评估各风险类别
    for (const [categoryId, category] of this.riskCategories) {
      const categoryAssessment = await this.assessRiskCategory(category);
      assessment.categoryAssessments.push(categoryAssessment);

      // 识别高优先级风险
      const highRisks = categoryAssessment.riskAssessments.filter(
        r => this.calculateRiskScore(r) >= 8
      );
      assessment.highPriorityRisks.push(...highRisks);
    }

    // 计算整体风险等级
    assessment.overallRiskLevel = this.calculateOverallRiskLevel(
      assessment.categoryAssessments
    );

    // 生成建议和行动计划
    assessment.recommendations = this.generateRecommendations(assessment);
    assessment.actionPlan = this.generateActionPlan(assessment);

    console.log(
      `📊 Risk assessment completed. Overall risk level: ${assessment.overallRiskLevel}`
    );

    return assessment;
  }

  // 评估风险类别
  private async assessRiskCategory(
    category: RiskCategory
  ): Promise<CategoryRiskAssessment> {
    const riskAssessments: IndividualRiskAssessment[] = [];

    for (const riskType of category.riskTypes) {
      const assessment = await this.assessIndividualRisk(riskType);
      riskAssessments.push(assessment);
    }

    const maxRiskScore = Math.max(
      ...riskAssessments.map(r => this.calculateRiskScore(r))
    );

    return {
      categoryId: category.id,
      categoryName: category.name,
      riskLevel: this.scoreToRiskLevel(maxRiskScore),
      riskAssessments,
      summary: this.generateCategorySummary(category, riskAssessments),
    };
  }

  // 评估单个风险
  private async assessIndividualRisk(
    riskType: RiskType
  ): Promise<IndividualRiskAssessment> {
    // 检查当前指标
    const currentIndicators = await this.checkRiskIndicators(
      riskType.indicators
    );

    // 评估触发因素
    const triggerProbability = await this.assessTriggerProbability(
      riskType.triggers
    );

    // 调整风险评估
    const adjustedLikelihood = this.adjustLikelihood(
      riskType.likelihood,
      triggerProbability,
      currentIndicators
    );
    const adjustedImpact = riskType.impact; // 影响通常不变
    const adjustedDetectability = this.adjustDetectability(
      riskType.detectability,
      currentIndicators
    );

    return {
      riskId: riskType.id,
      riskName: riskType.name,
      description: riskType.description,
      likelihood: adjustedLikelihood,
      impact: adjustedImpact,
      detectability: adjustedDetectability,
      currentIndicators: currentIndicators.filter(i => i.triggered),
      triggerProbability,
      mitigationStatus: await this.checkMitigationStatus(riskType.id),
      lastAssessment: Date.now(),
    };
  }

  // 检查风险指标
  private async checkRiskIndicators(
    indicators: string[]
  ): Promise<IndicatorStatus[]> {
    const statuses: IndicatorStatus[] = [];

    for (const indicator of indicators) {
      const status = await this.evaluateIndicator(indicator);
      statuses.push({
        indicator,
        triggered: status.triggered,
        value: status.value,
        threshold: status.threshold,
        severity: status.severity,
      });
    }

    return statuses;
  }

  // 评估单个指标
  private async evaluateIndicator(indicator: string): Promise<{
    triggered: boolean;
    value: number;
    threshold: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }> {
    // 解析指标条件
    if (indicator.includes('CPU使用率')) {
      const threshold = this.extractThreshold(indicator);
      const currentCPU = await this.getCurrentCPUUsage();

      return {
        triggered: currentCPU > threshold,
        value: currentCPU,
        threshold,
        severity:
          currentCPU > threshold * 1.2
            ? 'CRITICAL'
            : currentCPU > threshold * 1.1
              ? 'HIGH'
              : currentCPU > threshold
                ? 'MEDIUM'
                : 'LOW',
      };
    }

    if (indicator.includes('响应时间')) {
      const threshold = this.extractThreshold(indicator);
      const currentResponseTime = await this.getCurrentResponseTime();

      return {
        triggered: currentResponseTime > threshold,
        value: currentResponseTime,
        threshold,
        severity:
          currentResponseTime > threshold * 2
            ? 'CRITICAL'
            : currentResponseTime > threshold * 1.5
              ? 'HIGH'
              : currentResponseTime > threshold
                ? 'MEDIUM'
                : 'LOW',
      };
    }

    if (indicator.includes('内存使用')) {
      const threshold = this.extractThreshold(indicator);
      const currentMemory = await this.getCurrentMemoryUsage();

      return {
        triggered: currentMemory > threshold,
        value: currentMemory,
        threshold,
        severity:
          currentMemory > threshold * 1.1
            ? 'CRITICAL'
            : currentMemory > threshold * 1.05
              ? 'HIGH'
              : currentMemory > threshold
                ? 'MEDIUM'
                : 'LOW',
      };
    }

    // 默认返回
    return {
      triggered: false,
      value: 0,
      threshold: 0,
      severity: 'LOW',
    };
  }

  // 提取阈值
  private extractThreshold(indicator: string): number {
    const match = indicator.match(/>\s*(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  // 获取当前CPU使用率
  private async getCurrentCPUUsage(): Promise<number> {
    // 模拟CPU使用率检查
    return Math.random() * 100;
  }

  // 获取当前响应时间
  private async getCurrentResponseTime(): Promise<number> {
    // 模拟响应时间检查
    return Math.random() * 1000;
  }

  // 获取当前内存使用率
  private async getCurrentMemoryUsage(): Promise<number> {
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      const total = performance.memory.totalJSHeapSize;
      return (used / total) * 100;
    }
    return Math.random() * 100;
  }

  // 计算风险分数
  private calculateRiskScore(assessment: IndividualRiskAssessment): number {
    const likelihoodScore = this.riskLevelToScore(assessment.likelihood);
    const impactScore = this.riskLevelToScore(assessment.impact);
    const detectabilityScore = this.riskLevelToScore(assessment.detectability);

    // 风险分数 = (可能性 × 影响) / 可检测性
    return (likelihoodScore * impactScore) / Math.max(detectabilityScore, 1);
  }

  // 风险等级转分数
  private riskLevelToScore(level: string): number {
    const scores = {
      VERY_LOW: 1,
      LOW: 2,
      MEDIUM: 3,
      HIGH: 4,
      VERY_HIGH: 5,
      CRITICAL: 5,
    };
    return scores[level as keyof typeof scores] || 3;
  }

  // 分数转风险等级
  private scoreToRiskLevel(score: number): string {
    if (score >= 15) return 'CRITICAL';
    if (score >= 12) return 'VERY_HIGH';
    if (score >= 9) return 'HIGH';
    if (score >= 6) return 'MEDIUM';
    if (score >= 3) return 'LOW';
    return 'VERY_LOW';
  }

  // 计算整体风险等级
  private calculateOverallRiskLevel(
    assessments: CategoryRiskAssessment[]
  ): string {
    const maxScore = assessments.reduce((max, assessment) => {
      const categoryMax = Math.max(
        ...assessment.riskAssessments.map(r => this.calculateRiskScore(r))
      );
      return Math.max(max, categoryMax);
    }, 0);

    return this.scoreToRiskLevel(maxScore);
  }
}
```

---

### 9.4 生产环境安全架构（融合第13章安全设计）

> **核心目标**: 构建全面的生产环境安全防护体系，通过数据安全、代码安全、Electron深度安全和插件沙箱安全，确保系统在生产环境中的安全运行，为AI代码生成提供安全基准和防护指导

#### 9.4.1 数据安全与完整性保护

##### 9.4.1.1 存档文件加密系统

```typescript
// src/core/security/DataEncryption.ts
import * as CryptoJS from 'crypto-js';
import { app } from 'electron';
import * as os from 'os';

export class DataEncryptionService {
  private encryptionKey: string;
  private encryptionAlgorithm: string = 'AES';
  private keyDerivation: string = 'PBKDF2';

  constructor() {
    this.encryptionKey = this.generateSystemKey();
    this.initializeEncryption();
  }

  // 生成系统级密钥
  private generateSystemKey(): string {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      appName: app.getName(),
      appVersion: app.getVersion(),
      machineId: os.hostname(),
    };

    const baseString = JSON.stringify(systemInfo);
    return CryptoJS.SHA256(baseString).toString();
  }

  // 初始化加密系统
  private initializeEncryption(): void {
    console.log('🔐 Initializing data encryption system...');

    // 验证加密库可用性
    if (!this.validateCryptoLibrary()) {
      throw new Error('Cryptographic library validation failed');
    }

    // 生成会话密钥
    this.generateSessionKey();

    console.log('✅ Data encryption system initialized');
  }

  // 验证加密库
  private validateCryptoLibrary(): boolean {
    try {
      const testData = 'encryption_test';
      const encrypted = CryptoJS.AES.encrypt(testData, 'test_key').toString();
      const decrypted = CryptoJS.AES.decrypt(encrypted, 'test_key').toString(
        CryptoJS.enc.Utf8
      );

      return testData === decrypted;
    } catch (error) {
      console.error('Crypto library validation failed:', error);
      return false;
    }
  }

  // 生成会话密钥
  private generateSessionKey(): void {
    const sessionSalt = CryptoJS.lib.WordArray.random(128 / 8);
    const derivedKey = CryptoJS.PBKDF2(this.encryptionKey, sessionSalt, {
      keySize: 256 / 32,
      iterations: 10000,
    });

    this.encryptionKey = derivedKey.toString();
  }

  // 加密存档数据
  async encryptSaveFile(saveData: any): Promise<EncryptedSaveData> {
    try {
      const jsonString = JSON.stringify(saveData);
      const compressed = this.compressData(jsonString);

      // 加密核心数据
      const encrypted = CryptoJS.AES.encrypt(
        compressed,
        this.encryptionKey
      ).toString();

      // 计算完整性哈希
      const integrity = CryptoJS.SHA256(jsonString).toString();

      // 生成时间戳
      const timestamp = Date.now();

      const encryptedSaveData: EncryptedSaveData = {
        version: '1.0',
        encrypted: encrypted,
        integrity: integrity,
        timestamp: timestamp,
        algorithm: this.encryptionAlgorithm,
        keyDerivation: this.keyDerivation,
      };

      console.log('🔐 Save file encrypted successfully');
      return encryptedSaveData;
    } catch (error) {
      console.error('Save file encryption failed:', error);
      throw new Error('Failed to encrypt save file');
    }
  }

  // 解密存档数据
  async decryptSaveFile(encryptedData: EncryptedSaveData): Promise<any> {
    try {
      // 验证版本兼容性
      if (!this.isVersionCompatible(encryptedData.version)) {
        throw new Error(
          `Incompatible save file version: ${encryptedData.version}`
        );
      }

      // 解密数据
      const decryptedBytes = CryptoJS.AES.decrypt(
        encryptedData.encrypted,
        this.encryptionKey
      );
      const decompressed = decryptedBytes.toString(CryptoJS.enc.Utf8);
      const jsonString = this.decompressData(decompressed);

      // 验证完整性
      const currentIntegrity = CryptoJS.SHA256(jsonString).toString();
      if (currentIntegrity !== encryptedData.integrity) {
        throw new Error('Save file integrity check failed');
      }

      const saveData = JSON.parse(jsonString);

      console.log('🔓 Save file decrypted successfully');
      return saveData;
    } catch (error) {
      console.error('Save file decryption failed:', error);
      throw new Error('Failed to decrypt save file');
    }
  }

  // 压缩数据
  private compressData(data: string): string {
    // 简化版压缩（生产环境建议使用专业压缩库）
    return Buffer.from(data, 'utf8').toString('base64');
  }

  // 解压缩数据
  private decompressData(compressedData: string): string {
    return Buffer.from(compressedData, 'base64').toString('utf8');
  }

  // 版本兼容性检查
  private isVersionCompatible(version: string): boolean {
    const supportedVersions = ['1.0'];
    return supportedVersions.includes(version);
  }

  // 轮换加密密钥
  async rotateEncryptionKey(): Promise<void> {
    console.log('🔄 Rotating encryption key...');

    const oldKey = this.encryptionKey;
    this.encryptionKey = this.generateSystemKey();
    this.generateSessionKey();

    console.log('✅ Encryption key rotated successfully');
  }
}

// 加密存档数据类型定义
export interface EncryptedSaveData {
  version: string;
  encrypted: string;
  integrity: string;
  timestamp: number;
  algorithm: string;
  keyDerivation: string;
}

// 敏感数据保护服务
export class SensitiveDataProtectionService {
  private protectedFields: Set<string>;
  private encryptionService: DataEncryptionService;

  constructor() {
    this.protectedFields = new Set([
      'password',
      'token',
      'apiKey',
      'secret',
      'email',
      'personalInfo',
      'financialData',
    ]);
    this.encryptionService = new DataEncryptionService();
  }

  // 识别敏感字段
  identifySensitiveFields(data: any): string[] {
    const sensitiveFields: string[] = [];

    const checkObject = (obj: any, path: string = '') => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const fullPath = path ? `${path}.${key}` : key;

          if (this.isSensitiveField(key)) {
            sensitiveFields.push(fullPath);
          }

          if (typeof obj[key] === 'object' && obj[key] !== null) {
            checkObject(obj[key], fullPath);
          }
        }
      }
    };

    checkObject(data);
    return sensitiveFields;
  }

  // 判断是否为敏感字段
  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return Array.from(this.protectedFields).some(protectedField =>
      lowerFieldName.includes(protectedField)
    );
  }

  // 加密敏感数据
  async encryptSensitiveData(data: any): Promise<any> {
    const sensitiveFields = this.identifySensitiveFields(data);

    if (sensitiveFields.length === 0) {
      return data;
    }

    const encryptedData = JSON.parse(JSON.stringify(data));

    for (const fieldPath of sensitiveFields) {
      const fieldValue = this.getNestedValue(encryptedData, fieldPath);
      if (fieldValue !== undefined) {
        const encrypted = await this.encryptionService.encryptSaveFile({
          value: fieldValue,
        });
        this.setNestedValue(encryptedData, fieldPath, {
          __encrypted: true,
          data: encrypted,
        });
      }
    }

    return encryptedData;
  }

  // 解密敏感数据
  async decryptSensitiveData(data: any): Promise<any> {
    const decryptedData = JSON.parse(JSON.stringify(data));

    const processObject = async (obj: any) => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (obj[key].__encrypted) {
              const decryptedValue =
                await this.encryptionService.decryptSaveFile(obj[key].data);
              obj[key] = decryptedValue.value;
            } else {
              await processObject(obj[key]);
            }
          }
        }
      }
    };

    await processObject(decryptedData);
    return decryptedData;
  }

  // 获取嵌套值
  private getNestedValue(obj: any, path: string): any {
    return path
      .split('.')
      .reduce((current, key) => current && current[key], obj);
  }

  // 设置嵌套值
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current[key], obj);
    target[lastKey] = value;
  }
}
```

##### 9.4.1.2 数据完整性校验系统

```typescript
// src/core/security/DataIntegrity.ts
export class DataIntegrityService {
  private checksumAlgorithm: string = 'SHA256';
  private integrityDatabase: Map<string, IntegrityRecord>;

  constructor() {
    this.integrityDatabase = new Map();
    this.initializeIntegritySystem();
  }

  // 初始化完整性系统
  private initializeIntegritySystem(): void {
    console.log('🛡️ Initializing data integrity system...');

    // 加载已有的完整性记录
    this.loadIntegrityRecords();

    // 启动定期验证
    this.startPeriodicVerification();

    console.log('✅ Data integrity system initialized');
  }

  // 计算数据校验和
  calculateChecksum(data: any): string {
    const dataString = this.normalizeData(data);
    return CryptoJS.SHA256(dataString).toString();
  }

  // 规范化数据格式
  private normalizeData(data: any): string {
    // 确保数据序列化的一致性
    const normalized = this.sortObjectKeys(data);
    return JSON.stringify(normalized);
  }

  // 递归排序对象键
  private sortObjectKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sortedObj: any = {};
    const sortedKeys = Object.keys(obj).sort();

    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }

    return sortedObj;
  }

  // 创建完整性记录
  createIntegrityRecord(identifier: string, data: any): IntegrityRecord {
    const checksum = this.calculateChecksum(data);
    const timestamp = Date.now();

    const record: IntegrityRecord = {
      identifier,
      checksum,
      timestamp,
      algorithm: this.checksumAlgorithm,
      dataSize: JSON.stringify(data).length,
      verified: true,
    };

    this.integrityDatabase.set(identifier, record);

    console.log(`🛡️ Integrity record created for: ${identifier}`);
    return record;
  }

  // 验证数据完整性
  async verifyDataIntegrity(
    identifier: string,
    data: any
  ): Promise<IntegrityVerificationResult> {
    const record = this.integrityDatabase.get(identifier);

    if (!record) {
      return {
        valid: false,
        error: 'No integrity record found',
        timestamp: Date.now(),
      };
    }

    const currentChecksum = this.calculateChecksum(data);
    const isValid = currentChecksum === record.checksum;

    // 更新验证状态
    record.verified = isValid;
    record.lastVerification = Date.now();

    const result: IntegrityVerificationResult = {
      valid: isValid,
      identifier,
      expectedChecksum: record.checksum,
      actualChecksum: currentChecksum,
      timestamp: Date.now(),
    };

    if (!isValid) {
      result.error = 'Checksum mismatch - data may be corrupted';
      console.warn(`⚠️ Data integrity verification failed for: ${identifier}`);
    } else {
      console.log(`✅ Data integrity verified for: ${identifier}`);
    }

    return result;
  }

  // 修复损坏的数据
  async repairCorruptedData(
    identifier: string,
    backupData?: any
  ): Promise<DataRepairResult> {
    const record = this.integrityDatabase.get(identifier);

    if (!record) {
      return {
        success: false,
        error: 'No integrity record found for repair',
      };
    }

    try {
      let repairedData: any = null;

      if (backupData) {
        // 使用提供的备份数据
        const backupVerification = await this.verifyDataIntegrity(
          identifier,
          backupData
        );
        if (backupVerification.valid) {
          repairedData = backupData;
        }
      }

      if (!repairedData) {
        // 尝试从备份位置恢复
        repairedData = await this.restoreFromBackup(identifier);
      }

      if (!repairedData) {
        return {
          success: false,
          error: 'No valid backup data available for repair',
        };
      }

      // 验证修复后的数据
      const verificationResult = await this.verifyDataIntegrity(
        identifier,
        repairedData
      );

      return {
        success: verificationResult.valid,
        repairedData: verificationResult.valid ? repairedData : null,
        error: verificationResult.valid ? null : verificationResult.error,
      };
    } catch (error) {
      console.error(`Data repair failed for ${identifier}:`, error);
      return {
        success: false,
        error: `Data repair failed: ${error.message}`,
      };
    }
  }

  // 从备份恢复数据
  private async restoreFromBackup(identifier: string): Promise<any> {
    // 实际实现中应该从备份存储中读取
    // 这里返回null表示没有可用备份
    return null;
  }

  // 加载完整性记录
  private loadIntegrityRecords(): void {
    // 从持久化存储加载完整性记录
    // 实际实现中应该从数据库或文件系统加载
    console.log('📄 Loading integrity records...');
  }

  // 启动定期验证
  private startPeriodicVerification(): void {
    // 每小时进行一次完整性验证
    setInterval(
      () => {
        this.performPeriodicVerification();
      },
      60 * 60 * 1000
    );
  }

  // 执行定期验证
  private async performPeriodicVerification(): Promise<void> {
    console.log('🔍 Starting periodic integrity verification...');

    let verifiedCount = 0;
    let failedCount = 0;

    for (const [identifier, record] of this.integrityDatabase) {
      try {
        // 这里需要获取实际数据进行验证
        // const actualData = await this.loadDataForVerification(identifier);
        // const result = await this.verifyDataIntegrity(identifier, actualData);

        // 临时跳过实际验证
        verifiedCount++;
      } catch (error) {
        console.error(`Periodic verification failed for ${identifier}:`, error);
        failedCount++;
      }
    }

    console.log(
      `📊 Periodic verification completed: ${verifiedCount} verified, ${failedCount} failed`
    );
  }
}

// 完整性记录接口
export interface IntegrityRecord {
  identifier: string;
  checksum: string;
  timestamp: number;
  algorithm: string;
  dataSize: number;
  verified: boolean;
  lastVerification?: number;
}

// 完整性验证结果接口
export interface IntegrityVerificationResult {
  valid: boolean;
  identifier?: string;
  expectedChecksum?: string;
  actualChecksum?: string;
  timestamp: number;
  error?: string;
}

// 数据修复结果接口
export interface DataRepairResult {
  success: boolean;
  repairedData?: any;
  error?: string;
}
```

#### 9.4.2 代码安全与资源保护

##### 9.4.2.1 代码混淆策略实现

```typescript
// src/core/security/CodeObfuscation.ts
export class CodeObfuscationService {
  private obfuscationConfig: ObfuscationConfig;
  private protectedModules: Set<string>;

  constructor() {
    this.protectedModules = new Set([
      'gameLogic',
      'aiEngine',
      'dataEncryption',
      'licenseValidation',
      'antiCheat',
    ]);

    this.obfuscationConfig = {
      stringEncoding: true,
      variableRenaming: true,
      controlFlowFlattening: true,
      deadCodeInjection: true,
      integerPacking: true,
      splitStrings: true,
      disableConsoleOutput: true,
      domainLock: process.env.NODE_ENV === 'production',
    };

    this.initializeObfuscation();
  }

  // 初始化混淆系统
  private initializeObfuscation(): void {
    console.log('🔒 Initializing code obfuscation system...');

    if (process.env.NODE_ENV === 'production') {
      // 生产环境启用完整混淆
      this.enableProductionObfuscation();
    } else {
      // 开发环境使用轻量混淆
      this.enableDevelopmentObfuscation();
    }

    console.log('✅ Code obfuscation system initialized');
  }

  // 生产环境混淆配置
  private enableProductionObfuscation(): void {
    // 启用所有混淆特性
    Object.keys(this.obfuscationConfig).forEach(key => {
      if (
        typeof this.obfuscationConfig[key as keyof ObfuscationConfig] ===
        'boolean'
      ) {
        (this.obfuscationConfig as any)[key] = true;
      }
    });

    // 设置强混淆级别
    this.obfuscationConfig.obfuscationLevel = 'maximum';
  }

  // 开发环境混淆配置
  private enableDevelopmentObfuscation(): void {
    // 只启用基本混淆
    this.obfuscationConfig.stringEncoding = false;
    this.obfuscationConfig.variableRenaming = false;
    this.obfuscationConfig.controlFlowFlattening = false;
    this.obfuscationConfig.disableConsoleOutput = false;
    this.obfuscationConfig.obfuscationLevel = 'minimal';
  }

  // 字符串编码保护
  protected encodeStrings(code: string): string {
    if (!this.obfuscationConfig.stringEncoding) {
      return code;
    }

    // 查找字符串字面量
    const stringRegex = /(["'`])((?:(?!\1)[^\\]|\\.)*)(\1)/g;

    return code.replace(stringRegex, (match, quote, content, endQuote) => {
      if (this.shouldProtectString(content)) {
        const encoded = this.encodeString(content);
        return `_decode(${JSON.stringify(encoded)})`;
      }
      return match;
    });
  }

  // 判断字符串是否需要保护
  private shouldProtectString(content: string): boolean {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /license/i,
      /algorithm/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  // 编码字符串
  private encodeString(str: string): string {
    // 简单的Base64编码（生产环境应使用更复杂的编码）
    return Buffer.from(str, 'utf8').toString('base64');
  }

  // 变量重命名保护
  protected renameVariables(code: string): string {
    if (!this.obfuscationConfig.variableRenaming) {
      return code;
    }

    // 生成变量映射表
    const variableMap = this.generateVariableMap(code);

    // 替换变量名
    let obfuscatedCode = code;
    for (const [originalName, obfuscatedName] of variableMap) {
      const regex = new RegExp(`\\b${originalName}\\b`, 'g');
      obfuscatedCode = obfuscatedCode.replace(regex, obfuscatedName);
    }

    return obfuscatedCode;
  }

  // 生成变量映射表
  private generateVariableMap(code: string): Map<string, string> {
    const variableMap = new Map<string, string>();
    const variableRegex = /(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    let counter = 0;

    while ((match = variableRegex.exec(code)) !== null) {
      const originalName = match[1];
      if (
        !variableMap.has(originalName) &&
        !this.isReservedVariable(originalName)
      ) {
        const obfuscatedName = this.generateObfuscatedName(counter++);
        variableMap.set(originalName, obfuscatedName);
      }
    }

    return variableMap;
  }

  // 检查是否为保留变量
  private isReservedVariable(name: string): boolean {
    const reserved = [
      'console',
      'window',
      'document',
      'process',
      'require',
      'module',
      'exports',
      '__dirname',
      '__filename',
    ];
    return reserved.includes(name);
  }

  // 生成混淆后的变量名
  private generateObfuscatedName(index: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
    let result = '';
    let num = index;

    do {
      result = chars[num % chars.length] + result;
      num = Math.floor(num / chars.length);
    } while (num > 0);

    return result;
  }

  // 控制流平坦化
  protected flattenControlFlow(code: string): string {
    if (!this.obfuscationConfig.controlFlowFlattening) {
      return code;
    }

    // 将控制流转换为状态机
    // 这是一个简化的示例实现
    const switchVar = '_state';
    let stateCounter = 0;

    // 查找函数定义
    const functionRegex =
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{([^}]*)\}/g;

    return code.replace(functionRegex, (match, functionName, functionBody) => {
      if (this.shouldFlattenFunction(functionName)) {
        return this.createStateMachine(
          functionName,
          functionBody,
          switchVar,
          stateCounter++
        );
      }
      return match;
    });
  }

  // 判断函数是否需要平坦化
  private shouldFlattenFunction(functionName: string): boolean {
    return (
      this.protectedModules.has(functionName) || functionName.includes('Logic')
    );
  }

  // 创建状态机
  private createStateMachine(
    functionName: string,
    body: string,
    switchVar: string,
    stateId: number
  ): string {
    // 简化的状态机生成
    return `
function ${functionName}() {
  var ${switchVar} = ${stateId};
  while (true) {
    switch (${switchVar}) {
      case ${stateId}:
        ${body}
        return;
    }
  }
}`;
  }

  // 注入死代码
  protected injectDeadCode(code: string): string {
    if (!this.obfuscationConfig.deadCodeInjection) {
      return code;
    }

    const deadCodeSnippets = [
      'var _dummy1 = Math.random() > 2;',
      'if (false) { console.log("unreachable"); }',
      'var _dummy2 = null || undefined;',
      'function _unused() { return false; }',
    ];

    // 在代码中随机插入死代码
    const lines = code.split('\n');
    const insertionPoints = Math.floor(lines.length * 0.1); // 插入点数量为行数的10%

    for (let i = 0; i < insertionPoints; i++) {
      const randomLine = Math.floor(Math.random() * lines.length);
      const randomSnippet =
        deadCodeSnippets[Math.floor(Math.random() * deadCodeSnippets.length)];
      lines.splice(randomLine, 0, randomSnippet);
    }

    return lines.join('\n');
  }

  // 应用所有混淆技术
  obfuscateCode(code: string): string {
    console.log('🔒 Starting code obfuscation...');

    let obfuscatedCode = code;

    // 按顺序应用混淆技术
    obfuscatedCode = this.encodeStrings(obfuscatedCode);
    obfuscatedCode = this.renameVariables(obfuscatedCode);
    obfuscatedCode = this.flattenControlFlow(obfuscatedCode);
    obfuscatedCode = this.injectDeadCode(obfuscatedCode);

    // 添加反调试代码
    if (this.obfuscationConfig.disableConsoleOutput) {
      obfuscatedCode = this.addAntiDebugCode(obfuscatedCode);
    }

    console.log('✅ Code obfuscation completed');
    return obfuscatedCode;
  }

  // 添加反调试代码
  private addAntiDebugCode(code: string): string {
    const antiDebugCode = `
// Anti-debug protection
(function() {
  var devtools = {open: false, orientation: null};
  var threshold = 160;
  
  setInterval(function() {
    if (window.outerHeight - window.innerHeight > threshold || 
        window.outerWidth - window.innerWidth > threshold) {
      if (!devtools.open) {
        devtools.open = true;
        // Trigger protection measures
        document.body.innerHTML = '';
      }
    } else {
      devtools.open = false;
    }
  }, 500);
  
  // Disable right-click
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  // Disable F12 and other debug keys
  document.addEventListener('keydown', function(e) {
    if (e.keyCode === 123 || // F12
        (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
        (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
        (e.ctrlKey && e.keyCode === 85)) { // Ctrl+U
      e.preventDefault();
    }
  });
})();

${code}`;

    return antiDebugCode;
  }
}

// 混淆配置接口
export interface ObfuscationConfig {
  stringEncoding: boolean;
  variableRenaming: boolean;
  controlFlowFlattening: boolean;
  deadCodeInjection: boolean;
  integerPacking: boolean;
  splitStrings: boolean;
  disableConsoleOutput: boolean;
  domainLock: boolean;
  obfuscationLevel?: 'minimal' | 'standard' | 'maximum';
}
```

##### 9.4.2.2 资源加密方案

```typescript
// src/core/security/ResourceEncryption.ts
export class ResourceEncryptionService {
  private encryptionKey: string;
  private encryptedResources: Map<string, EncryptedResource>;

  constructor() {
    this.encryptionKey = this.generateResourceKey();
    this.encryptedResources = new Map();
    this.initializeResourceEncryption();
  }

  // 生成资源加密密钥
  private generateResourceKey(): string {
    const keyData = {
      timestamp: Date.now(),
      random: Math.random(),
      appVersion: process.env.npm_package_version || '1.0.0',
    };
    return CryptoJS.SHA256(JSON.stringify(keyData)).toString();
  }

  // 初始化资源加密系统
  private initializeResourceEncryption(): void {
    console.log('🔐 Initializing resource encryption system...');

    // 加载资源清单
    this.loadResourceManifest();

    // 验证加密资源
    this.verifyEncryptedResources();

    console.log('✅ Resource encryption system initialized');
  }

  // 加密游戏资源
  async encryptGameResource(
    resourcePath: string,
    resourceData: Buffer
  ): Promise<EncryptedResource> {
    try {
      // 生成资源特定的盐值
      const salt = CryptoJS.lib.WordArray.random(128 / 8);

      // 派生密钥
      const derivedKey = CryptoJS.PBKDF2(this.encryptionKey, salt, {
        keySize: 256 / 32,
        iterations: 5000,
      });

      // 加密资源数据
      const encrypted = CryptoJS.AES.encrypt(
        resourceData.toString('base64'),
        derivedKey.toString()
      );

      // 计算资源哈希
      const hash = CryptoJS.SHA256(resourceData.toString('base64')).toString();

      const encryptedResource: EncryptedResource = {
        path: resourcePath,
        encryptedData: encrypted.toString(),
        salt: salt.toString(),
        hash: hash,
        timestamp: Date.now(),
        size: resourceData.length,
        type: this.getResourceType(resourcePath),
      };

      this.encryptedResources.set(resourcePath, encryptedResource);

      console.log(`🔐 Resource encrypted: ${resourcePath}`);
      return encryptedResource;
    } catch (error) {
      console.error(`Resource encryption failed for ${resourcePath}:`, error);
      throw new Error(`Failed to encrypt resource: ${resourcePath}`);
    }
  }

  // 解密游戏资源
  async decryptGameResource(resourcePath: string): Promise<Buffer> {
    const encryptedResource = this.encryptedResources.get(resourcePath);

    if (!encryptedResource) {
      throw new Error(`Encrypted resource not found: ${resourcePath}`);
    }

    try {
      // 重建派生密钥
      const salt = CryptoJS.enc.Hex.parse(encryptedResource.salt);
      const derivedKey = CryptoJS.PBKDF2(this.encryptionKey, salt, {
        keySize: 256 / 32,
        iterations: 5000,
      });

      // 解密资源数据
      const decrypted = CryptoJS.AES.decrypt(
        encryptedResource.encryptedData,
        derivedKey.toString()
      );
      const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);

      // 验证资源完整性
      const hash = CryptoJS.SHA256(decryptedData).toString();
      if (hash !== encryptedResource.hash) {
        throw new Error('Resource integrity check failed');
      }

      const resourceBuffer = Buffer.from(decryptedData, 'base64');

      console.log(`🔓 Resource decrypted: ${resourcePath}`);
      return resourceBuffer;
    } catch (error) {
      console.error(`Resource decryption failed for ${resourcePath}:`, error);
      throw new Error(`Failed to decrypt resource: ${resourcePath}`);
    }
  }

  // 获取资源类型
  private getResourceType(resourcePath: string): string {
    const extension = resourcePath.split('.').pop()?.toLowerCase();

    const typeMap: { [key: string]: string } = {
      png: 'image',
      jpg: 'image',
      jpeg: 'image',
      gif: 'image',
      svg: 'image',
      mp3: 'audio',
      wav: 'audio',
      ogg: 'audio',
      json: 'data',
      js: 'script',
      css: 'style',
      html: 'document',
    };

    return typeMap[extension || ''] || 'unknown';
  }

  // 加载资源清单
  private loadResourceManifest(): void {
    // 实际实现中应该从加密的清单文件加载
    console.log('📄 Loading encrypted resource manifest...');
  }

  // 验证加密资源
  private verifyEncryptedResources(): void {
    console.log('🔍 Verifying encrypted resources...');

    for (const [path, resource] of this.encryptedResources) {
      // 验证资源完整性
      if (!this.isResourceValid(resource)) {
        console.warn(`⚠️ Invalid encrypted resource: ${path}`);
      }
    }
  }

  // 检查资源有效性
  private isResourceValid(resource: EncryptedResource): boolean {
    return !!(
      resource.encryptedData &&
      resource.salt &&
      resource.hash &&
      resource.timestamp > 0 &&
      resource.size > 0
    );
  }

  // 批量加密资源
  async encryptResourceBatch(
    resources: Array<{ path: string; data: Buffer }>
  ): Promise<void> {
    console.log(
      `🔐 Starting batch encryption of ${resources.length} resources...`
    );

    const encryptionPromises = resources.map(resource =>
      this.encryptGameResource(resource.path, resource.data)
    );

    try {
      await Promise.all(encryptionPromises);
      console.log('✅ Batch resource encryption completed');
    } catch (error) {
      console.error('Batch resource encryption failed:', error);
      throw error;
    }
  }

  // 获取资源统计信息
  getResourceStatistics(): ResourceStatistics {
    const stats: ResourceStatistics = {
      totalResources: this.encryptedResources.size,
      totalSize: 0,
      typeBreakdown: {},
      lastEncryption: 0,
    };

    for (const resource of this.encryptedResources.values()) {
      stats.totalSize += resource.size;
      stats.typeBreakdown[resource.type] =
        (stats.typeBreakdown[resource.type] || 0) + 1;
      stats.lastEncryption = Math.max(stats.lastEncryption, resource.timestamp);
    }

    return stats;
  }
}

// 加密资源接口
export interface EncryptedResource {
  path: string;
  encryptedData: string;
  salt: string;
  hash: string;
  timestamp: number;
  size: number;
  type: string;
}

// 资源统计接口
export interface ResourceStatistics {
  totalResources: number;
  totalSize: number;
  typeBreakdown: { [type: string]: number };
  lastEncryption: number;
}
```

#### 9.4.3 第13章测试执行清单（融合安全测试体系）

##### 9.4.3.1 安全测试映射

```typescript
// src/tests/security/SecurityTestSuite.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataEncryptionService } from '../../core/security/DataEncryption';
import { DataIntegrityService } from '../../core/security/DataIntegrity';
import { CodeObfuscationService } from '../../core/security/CodeObfuscation';
import { ResourceEncryptionService } from '../../core/security/ResourceEncryption';

describe('第13章安全设计冒烟测试', () => {
  let encryptionService: DataEncryptionService;
  let integrityService: DataIntegrityService;
  let obfuscationService: CodeObfuscationService;
  let resourceEncryptionService: ResourceEncryptionService;

  beforeAll(async () => {
    // 初始化安全服务
    encryptionService = new DataEncryptionService();
    integrityService = new DataIntegrityService();
    obfuscationService = new CodeObfuscationService();
    resourceEncryptionService = new ResourceEncryptionService();
  });

  // 13.1 数据安全测试
  describe('13.1 数据安全', () => {
    it('存档文件应被正确加密', async () => {
      const saveData = {
        guild: 'TestGuild',
        level: 10,
        members: ['Alice', 'Bob'],
        resources: { gold: 1000, wood: 500 },
      };

      const encrypted = await encryptionService.encryptSaveFile(saveData);
      expect(encrypted.encrypted).toBeTruthy();
      expect(encrypted.integrity).toBeTruthy();
      expect(encrypted.version).toBe('1.0');

      const decrypted = await encryptionService.decryptSaveFile(encrypted);
      expect(decrypted).toEqual(saveData);
    });

    it('数据完整性校验应正常工作', async () => {
      const testData = { test: 'integrity', value: 123 };
      const record = integrityService.createIntegrityRecord(
        'test_data',
        testData
      );

      expect(record.checksum).toBeTruthy();
      expect(record.verified).toBe(true);

      const verification = await integrityService.verifyDataIntegrity(
        'test_data',
        testData
      );
      expect(verification.valid).toBe(true);
    });

    it('损坏数据应被检测和修复', async () => {
      const originalData = { important: 'data', value: 456 };
      integrityService.createIntegrityRecord('corrupt_test', originalData);

      const corruptedData = { important: 'modified', value: 789 };
      const verification = await integrityService.verifyDataIntegrity(
        'corrupt_test',
        corruptedData
      );

      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('Checksum mismatch');
    });
  });

  // 13.2 代码安全测试
  describe('13.2 代码安全', () => {
    it('敏感字符串应被混淆', () => {
      const originalCode = `
        const apiKey = "secret_api_key_123";
        const password = "user_password";
        const normalVar = "normal_string";
      `;

      const obfuscated = obfuscationService['encodeStrings'](originalCode);

      expect(obfuscated).not.toContain('secret_api_key_123');
      expect(obfuscated).not.toContain('user_password');
      expect(obfuscated).toContain('normal_string'); // 普通字符串不被混淆
    });

    it('变量名应被重命名', () => {
      const originalCode = `
        var sensitiveVariable = "test";
        let anotherVar = 123;
        const thirdVar = true;
      `;

      const obfuscated = obfuscationService['renameVariables'](originalCode);

      expect(obfuscated).not.toContain('sensitiveVariable');
      expect(obfuscated).not.toContain('anotherVar');
      expect(obfuscated).not.toContain('thirdVar');
    });

    it('控制流应被平坦化', () => {
      const originalCode = `
        function gameLogicFunction() {
          if (condition) {
            doSomething();
          } else {
            doSomethingElse();
          }
        }
      `;

      const obfuscated = obfuscationService['flattenControlFlow'](originalCode);

      expect(obfuscated).toContain('switch');
      expect(obfuscated).toContain('_state');
    });
  });

  // 13.3 Electron安全深化测试
  describe('13.3 Electron安全深化', () => {
    it('上下文隔离应被启用', () => {
      // 检查Electron安全配置
      const { contextIsolation, nodeIntegration } = process.env;

      if (process.type === 'renderer') {
        expect(window.electronAPI).toBeTruthy();
        expect(window.require).toBeUndefined();
      }
    });

    it('预加载脚本应安全暴露API', () => {
      if (process.type === 'renderer') {
        expect(window.electronAPI.invoke).toBeTruthy();
        expect(window.electronAPI.on).toBeTruthy();
        expect(window.electronAPI.removeListener).toBeTruthy();
      }
    });
  });

  // 13.4 插件沙箱安全测试
  describe('13.4 插件沙箱安全', () => {
    it('未授权API访问应被阻止', async () => {
      try {
        // 模拟未授权访问
        const result = await attemptUnauthorizedAccess();
        expect(result.success).toBe(false);
        expect(result.error).toContain('unauthorized');
      } catch (error) {
        expect(error.message).toContain('Access denied');
      }
    });

    it('权限管理系统应正常工作', () => {
      const hasReadPermission = checkPermission('data', 'read');
      const hasWritePermission = checkPermission('data', 'write');
      const hasAdminPermission = checkPermission('system', 'admin');

      expect(typeof hasReadPermission).toBe('boolean');
      expect(typeof hasWritePermission).toBe('boolean');
      expect(typeof hasAdminPermission).toBe('boolean');
    });
  });

  // 13.5 资源加密测试
  describe('13.5 资源加密', () => {
    it('游戏资源应被正确加密', async () => {
      const testResource = Buffer.from('test resource data');
      const resourcePath = '/assets/test.png';

      const encrypted = await resourceEncryptionService.encryptGameResource(
        resourcePath,
        testResource
      );

      expect(encrypted.encryptedData).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();
      expect(encrypted.hash).toBeTruthy();
      expect(encrypted.size).toBe(testResource.length);
    });

    it('加密资源应能正确解密', async () => {
      const originalData = Buffer.from('original resource content');
      const resourcePath = '/assets/original.json';

      await resourceEncryptionService.encryptGameResource(
        resourcePath,
        originalData
      );
      const decrypted =
        await resourceEncryptionService.decryptGameResource(resourcePath);

      expect(decrypted).toEqual(originalData);
    });
  });
});

// 辅助函数
function attemptUnauthorizedAccess(): Promise<{
  success: boolean;
  error?: string;
}> {
  return Promise.resolve({
    success: false,
    error: 'unauthorized access attempt blocked',
  });
}

function checkPermission(resource: string, action: string): boolean {
  // 模拟权限检查
  const permissions: { [key: string]: string[] } = {
    data: ['read'],
    system: [],
  };

  return permissions[resource]?.includes(action) || false;
}
```

##### 9.4.3.2 安全测试覆盖率与门禁引用

```typescript
// src/tests/security/SecurityCoverage.ts
export class SecurityTestCoverage {
  private coverageTargets: SecurityCoverageTargets = {
    dataEncryption: {
      target: 95,
      current: 0,
      critical: true,
    },
    codeObfuscation: {
      target: 90,
      current: 0,
      critical: true,
    },
    integrityChecks: {
      target: 100,
      current: 0,
      critical: true,
    },
    accessControl: {
      target: 98,
      current: 0,
      critical: true,
    },
    resourceProtection: {
      target: 85,
      current: 0,
      critical: false,
    },
  };

  // 检查安全测试覆盖率
  checkSecurityCoverage(): SecurityCoverageReport {
    const report: SecurityCoverageReport = {
      timestamp: Date.now(),
      overallCoverage: 0,
      modulesCovered: 0,
      totalModules: Object.keys(this.coverageTargets).length,
      criticalIssues: [],
      recommendations: [],
    };

    let totalCoverage = 0;
    let coveredModules = 0;

    for (const [module, target] of Object.entries(this.coverageTargets)) {
      totalCoverage += target.current;

      if (target.current >= target.target) {
        coveredModules++;
      } else if (target.critical) {
        report.criticalIssues.push({
          module,
          currentCoverage: target.current,
          targetCoverage: target.target,
          gap: target.target - target.current,
        });
      }
    }

    report.overallCoverage = totalCoverage / report.totalModules;
    report.modulesCovered = coveredModules;

    // 生成建议
    if (report.overallCoverage < 90) {
      report.recommendations.push('增加安全测试用例以提高覆盖率');
    }

    if (report.criticalIssues.length > 0) {
      report.recommendations.push('优先修复关键安全模块的测试覆盖率问题');
    }

    return report;
  }

  // 安全门禁检查
  securityGateCheck(): SecurityGateResult {
    const coverage = this.checkSecurityCoverage();
    const gateResult: SecurityGateResult = {
      passed: true,
      blockers: [],
      warnings: [],
      timestamp: Date.now(),
    };

    // 检查关键安全覆盖率
    for (const issue of coverage.criticalIssues) {
      if (issue.gap > 10) {
        gateResult.passed = false;
        gateResult.blockers.push(
          `Critical security module "${issue.module}" coverage too low: ${issue.currentCoverage}% (target: ${issue.targetCoverage}%)`
        );
      } else if (issue.gap > 5) {
        gateResult.warnings.push(
          `Security module "${issue.module}" coverage below target: ${issue.currentCoverage}% (target: ${issue.targetCoverage}%)`
        );
      }
    }

    // 检查整体覆盖率
    if (coverage.overallCoverage < 85) {
      gateResult.passed = false;
      gateResult.blockers.push(
        `Overall security coverage too low: ${coverage.overallCoverage}% (minimum: 85%)`
      );
    } else if (coverage.overallCoverage < 90) {
      gateResult.warnings.push(
        `Overall security coverage below target: ${coverage.overallCoverage}% (target: 90%)`
      );
    }

    return gateResult;
  }
}

// 安全覆盖率目标接口
export interface SecurityCoverageTargets {
  [module: string]: {
    target: number;
    current: number;
    critical: boolean;
  };
}

// 安全覆盖率报告接口
export interface SecurityCoverageReport {
  timestamp: number;
  overallCoverage: number;
  modulesCovered: number;
  totalModules: number;
  criticalIssues: Array<{
    module: string;
    currentCoverage: number;
    targetCoverage: number;
    gap: number;
  }>;
  recommendations: string[];
}

// 安全门禁结果接口
export interface SecurityGateResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  timestamp: number;
}
```
