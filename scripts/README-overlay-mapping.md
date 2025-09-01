# Overlay 文档映射系统

## 功能概述

扫描 `docs/architecture/overlays/**/08/*.md` 文档，解析 Front-matter 元数据，生成关键词到文件路径的映射索引。

## 使用方法

### 命令行运行

```bash
# 扫描并生成映射文件
npm run docs:scan-overlays

# 或直接运行
node scripts/scan-overlays.cjs
```

### 编程调用

```javascript
const { scanOverlays } = require('./scripts/scan-overlays.cjs');

async function example() {
  const overlayMap = await scanOverlays();
  console.log('总关键词数:', overlayMap.metadata.totalKeywords);
}
```

## 输出文件

生成 `scripts/overlay-map.json`，包含：

### 结构说明

```json
{
  "metadata": {
    "generated": "2025-08-28T18:18:56.278Z",
    "totalFiles": 2,
    "pattern": "docs/architecture/overlays/**/08/*.md",
    "processedFiles": 2,
    "totalKeywords": 15
  },
  "keywords": {
    "关键词": ["文件路径1", "文件路径2"]
  },
  "files": {
    "文件路径": {
      "title": "文档标题",
      "prdId": "PRD-ID",
      "keywords": ["关键词列表"],
      "frontMatter": { "完整的front-matter数据" },
      "path": "文件路径"
    }
  }
}
```

## 关键词提取规则

### 1. Front-matter 字段

- **title**: 标题分词（中英文混合）
- **keywords/tags**: 关键词标签
- **aliases**: 别名

### 2. 文档路径信息

- **PRD-ID**: 从目录名提取（如 `PRD-Guild-Manager`）
- **文件名**: 去除前缀后分词

### 3. 分词策略

- **英文数字**: 完整保留
- **中文**: 按字符分割 + 保留完整词
- **Slug化**: 小写、连字符标准化

## 示例输出

```json
{
  "keywords": {
    "prd-guild-manager": [
      "docs/architecture/overlays/PRD-Guild-Manager/08/08-功能纵切-公会管理器.md",
      "docs/architecture/overlays/PRD-Guild-Manager/08/ACCEPTANCE_CHECKLIST.md"
    ],
    "guild-manager": [
      "docs/architecture/overlays/PRD-Guild-Manager/08/08-功能纵切-公会管理器.md",
      "docs/architecture/overlays/PRD-Guild-Manager/08/ACCEPTANCE_CHECKLIST.md"
    ]
  }
}
```

## 应用场景

1. **文档搜索**: 通过关键词快速定位相关文档
2. **内容发现**: 识别相关联的架构文档
3. **依赖分析**: 分析文档间的关联关系
4. **自动化工具**: 为其他脚本提供文档映射数据

## 扩展说明

- 支持 Hugo/Jekyll 风格的 front-matter
- 兼容 YAML/TOML 元数据格式
- 可扩展到其他文档类型（修改 glob 模式）
- 关键词按出现频率排序

## 依赖包

- `gray-matter`: Front-matter 解析
- `fast-glob`: 高性能文件匹配
