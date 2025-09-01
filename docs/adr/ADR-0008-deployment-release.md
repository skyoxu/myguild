---
ADR-ID: ADR-0008
title: 部署与发布策略 - Electron Builder + GitHub Releases
status: Accepted
decision-time: '2025-08-17'
deciders: [架构团队, DevOps团队, 安全团队]
archRefs: [CH03, CH07, CH10]
verification:
  - path: scripts/release/updater-config-check.mjs
    assert: electron-updater configured with correct channel and provider
  - path: scripts/release/signing-verify.mjs
    assert: Windows Authenticode and macOS code signing/notarization succeed
  - path: scripts/release/rollout.mjs
    assert: Rollout gates on Release Health and supports pause/rollback
impact-scope:
  - build/
  - electron-builder.json
  - .github/workflows/
  - scripts/release.mjs
tech-tags:
  - electron-builder
  - github-releases
  - deployment
  - ci-cd
  - auto-update
depends-on:
  - ADR-0005
depended-by: []
test-coverage: tests/unit/adr-0008.spec.ts
monitoring-metrics:
  - implementation_coverage
  - compliance_rate
executable-deliverables:
  - electron-builder.json
  - .github/workflows/release.yml
  - scripts/release-automation.mjs
supersedes: []
---

# ADR-0008: 部署发布与自动更新策略

## Context and Problem Statement

Electron桌面应用需要建立可靠的部署发布流程和自动更新机制，支持跨平台分发（Windows、macOS、Linux），确保应用的安全性（代码签名）、可靠性（渐进式发布）和用户体验（无缝更新）。需要平衡安全性、用户体验和运维成本。

## Decision Drivers

- 需要自动更新机制，减少用户手动更新成本
- 需要代码签名确保应用安全性和用户信任
- 需要支持渐进式发布，降低大规模部署风险
- 需要跨平台兼容性（Windows/macOS/Linux）
- 需要与Release Health监控集成（继承ADR-0003）
- 需要支持快速回滚机制
- 需要满足应用商店分发要求

## Considered Options

- **electron-updater + 代码签名 + 渐进式发布** (选择方案)
- **Squirrel.Windows + 手动分发**
- **应用商店独占分发（限制灵活性）**
- **Docker容器化桌面应用（技术复杂度高）**
- **Web应用替代（功能受限）**

## Decision Outcome

选择的方案：**electron-updater + 多平台代码签名 + 渐进式发布**

### electron-updater核心配置

**自动更新配置**：

```javascript
// electron/main/auto-updater.ts
import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log';

export class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null;
  private isUpdateAvailable = false;
  private updateDownloaded = false;

  constructor() {
    this.configureUpdater();
    this.setupEventHandlers();
  }

  private configureUpdater(): void {
    // 配置更新服务器
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'buildgame',
      repo: 'vitegame',
      private: false // 或者使用token访问私有仓库
    });

    // 配置日志
    autoUpdater.logger = log;
    (autoUpdater.logger as any).transports.file.level = 'info';

    // 配置更新行为
    autoUpdater.autoDownload = false; // 手动控制下载时机
    autoUpdater.autoInstallOnAppQuit = true;

    // 允许预发布版本（可配置）
    autoUpdater.allowPrerelease = process.env.NODE_ENV === 'development';
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.sendToRenderer('update-checking');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.isUpdateAvailable = true;
      this.sendToRenderer('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
        size: info.files[0]?.size
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.sendToRenderer('update-not-available');
    });

    autoUpdater.on('error', (err) => {
      log.error('Update error:', err);
      this.sendToRenderer('update-error', err.message);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      log.info(`Download progress: ${progressObj.percent}%`);
      this.sendToRenderer('update-download-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        total: progressObj.total,
        transferred: progressObj.transferred
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.updateDownloaded = true;
      this.sendToRenderer('update-downloaded', {
        version: info.version,
        files: info.files.map(f => ({ url: f.url, size: f.size }))
      });

      // 显示安装确认对话框
      this.showInstallDialog(info);
    });
  }

  private async showInstallDialog(info: any): Promise<void> {
    const result = await dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: '更新已下载',
      message: `新版本 ${info.version} 已下载完成，是否立即安装？`,
      detail: '应用将重启以完成更新安装。',
      buttons: ['立即安装', '稍后安装'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      // 立即安装
      autoUpdater.quitAndInstall();
    }
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public async checkForUpdates(): Promise<void> {
    if (app.isPackaged) {
      await autoUpdater.checkForUpdates();
    } else {
      log.info('Skipping update check in development mode');
    }
  }

  public async downloadUpdate(): Promise<void> {
    if (this.isUpdateAvailable) {
      await autoUpdater.downloadUpdate();
    }
  }

  public quitAndInstall(): void {
    if (this.updateDownloaded) {
      autoUpdater.quitAndInstall();
    }
  }

  private sendToRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
```

### 代码签名配置

**Windows代码签名（Authenticode）**：

```javascript
// electron-builder配置
{
  "build": {
    "appId": "com.buildgame.vitegame",
    "productName": "Build Game",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist-electron/**/*",
      "dist/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "portable",
          "arch": ["x64", "ia32"]
        }
      ],
      "certificateFile": "build/certificates/windows-cert.p12",
      "certificatePassword": "${env.WINDOWS_CERT_PASSWORD}",
      "signingHashAlgorithms": ["sha256"],
      "timeStampServer": "http://timestamp.digicert.com",
      "publisherName": "Build Game Studio"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Build Game"
    },
    "publish": {
      "provider": "github",
      "owner": "buildgame",
      "repo": "vitegame",
      "releaseType": "release"
    }
  }
}
```

**macOS代码签名和公证**：

```javascript
{
  "mac": {
    "category": "public.app-category.games",
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      },
      {
        "target": "zip",
        "arch": ["x64", "arm64"]
      }
    ],
    "identity": "Developer ID Application: Build Game Studio (TEAM_ID)",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist",
    "notarize": {
      "teamId": "${env.APPLE_TEAM_ID}"
    }
  },
  "dmg": {
    "sign": false,
    "title": "Build Game ${version}",
    "background": "build/background.png",
    "window": {
      "width": 540,
      "height": 400
    },
    "contents": [
      {
        "x": 140,
        "y": 200,
        "type": "file"
      },
      {
        "x": 400,
        "y": 200,
        "type": "link",
        "path": "/Applications"
      }
    ]
  }
}
```

**macOS entitlements.mac.plist**：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

### 渐进式发布策略

**发布阶段配置**：

```typescript
// scripts/progressive-release.ts
export interface ReleaseStage {
  name: string;
  percentage: number;
  duration: number; // 小时
  criteria: ReleaseCriteria;
}

export interface ReleaseCriteria {
  crashFreeUsers: number;
  crashFreeSessions: number;
  minAdoption: number;
  maxErrorRate: number;
}

const RELEASE_STAGES: ReleaseStage[] = [
  {
    name: 'canary',
    percentage: 1,
    duration: 4,
    criteria: {
      crashFreeUsers: 99.0,
      crashFreeSessions: 99.5,
      minAdoption: 50,
      maxErrorRate: 0.01,
    },
  },
  {
    name: 'beta',
    percentage: 10,
    duration: 12,
    criteria: {
      crashFreeUsers: 99.3,
      crashFreeSessions: 99.7,
      minAdoption: 500,
      maxErrorRate: 0.005,
    },
  },
  {
    name: 'stable',
    percentage: 100,
    duration: 0,
    criteria: {
      crashFreeUsers: 99.5,
      crashFreeSessions: 99.8,
      minAdoption: 1000,
      maxErrorRate: 0.002,
    },
  },
];

export class ProgressiveReleaseManager {
  constructor(
    private readonly sentryClient: SentryClient,
    private readonly githubClient: GitHubClient
  ) {}

  async executeRelease(version: string): Promise<void> {
    let currentStage = 0;

    for (const stage of RELEASE_STAGES) {
      console.log(`Starting ${stage.name} release (${stage.percentage}%)`);

      // 更新GitHub Release为指定阶段
      await this.updateReleaseStage(version, stage);

      // 等待指定时间
      await this.waitForDuration(stage.duration);

      // 检查Release Health指标
      const metrics = await this.getReleaseHealthMetrics(version);
      const passed = this.validateCriteria(metrics, stage.criteria);

      if (!passed) {
        console.error(`Stage ${stage.name} failed criteria validation`);
        await this.rollbackRelease(version, currentStage);
        throw new Error(`Release ${version} failed at ${stage.name} stage`);
      }

      console.log(`Stage ${stage.name} completed successfully`);
      currentStage++;
    }

    console.log(`Release ${version} completed successfully`);
  }

  private async updateReleaseStage(
    version: string,
    stage: ReleaseStage
  ): Promise<void> {
    // 更新GitHub Release的标签和描述
    await this.githubClient.updateRelease(version, {
      tag_name: `v${version}`,
      name: `${version} (${stage.name})`,
      body: this.generateReleaseNotes(version, stage),
      draft: false,
      prerelease: stage.name !== 'stable',
    });
  }

  private async getReleaseHealthMetrics(
    version: string
  ): Promise<ReleaseHealthMetrics> {
    // 从Sentry获取Release Health数据
    return await this.sentryClient.getReleaseHealth(version, {
      statsPeriod: '1h',
      project: 'build-game',
    });
  }

  private validateCriteria(
    metrics: ReleaseHealthMetrics,
    criteria: ReleaseCriteria
  ): boolean {
    return (
      metrics.crashFreeUsers >= criteria.crashFreeUsers &&
      metrics.crashFreeSessions >= criteria.crashFreeSessions &&
      metrics.adoption >= criteria.minAdoption &&
      metrics.errorRate <= criteria.maxErrorRate
    );
  }

  private async rollbackRelease(
    version: string,
    stageIndex: number
  ): Promise<void> {
    console.log(`Rolling back release ${version} from stage ${stageIndex}`);

    // 标记发布为draft，停止自动更新推送
    await this.githubClient.updateRelease(version, {
      draft: true,
      prerelease: true,
    });

    // 发送回滚通知
    await this.sendRollbackNotification(version, stageIndex);
  }
}
```

### CI/CD集成配置

**GitHub Actions发布工作流**：

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run quality gates
        run: npm run guard:ci

      - name: Import Windows certificate
        if: matrix.os == 'windows-latest'
        run: |
          echo "${{ secrets.WINDOWS_CERT_P12 }}" | base64 --decode > build/certificates/windows-cert.p12
        shell: bash

      - name: Import macOS certificates
        if: matrix.os == 'macos-latest'
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
        run: |
          echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
          security create-keychain -p "" build.keychain
          security import certificate.p12 -k build.keychain -P $APPLE_CERTIFICATE_PASSWORD -T /usr/bin/codesign
          security list-keychains -s build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "" build.keychain
          security set-key-partition-list -S apple-tool:,apple: -s -k "" build.keychain

      - name: Build and release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run build:release

      - name: Upload release artifacts
        uses: actions/upload-artifact@v3
        with:
          name: release-${{ matrix.os }}
          path: dist/

      - name: Start progressive release
        if: matrix.os == 'ubuntu-latest'
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
        run: npm run release:progressive
```

**版本管理和发布脚本**：

```javascript
// scripts/release.mjs
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import semver from 'semver';

class ReleaseManager {
  constructor() {
    this.packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
  }

  async createRelease(releaseType = 'patch') {
    console.log(`Creating ${releaseType} release...`);

    // 1. 运行质量门禁
    console.log('Running quality gates...');
    execSync('npm run guard:ci', { stdio: 'inherit' });

    // 2. 更新版本号
    const oldVersion = this.packageJson.version;
    const newVersion = semver.inc(oldVersion, releaseType);

    this.packageJson.version = newVersion;
    writeFileSync('package.json', JSON.stringify(this.packageJson, null, 2));

    console.log(`Version updated: ${oldVersion} → ${newVersion}`);

    // 3. 构建应用
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    // 4. 构建安装包
    console.log('Building installers...');
    execSync('npm run build:electron', { stdio: 'inherit' });

    // 5. 创建Git标签
    console.log('Creating git tag...');
    execSync(`git add package.json`, { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${newVersion}"`, {
      stdio: 'inherit',
    });
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

    // 6. 推送到远程
    console.log('Pushing to remote...');
    execSync('git push origin main --tags', { stdio: 'inherit' });

    console.log(`Release ${newVersion} created successfully!`);
    return newVersion;
  }
}

// 命令行接口
const releaseManager = new ReleaseManager();
const releaseType = process.argv[2] || 'patch';

releaseManager
  .createRelease(releaseType)
  .then(version => {
    console.log(`\n✅ Release ${version} completed!`);
  })
  .catch(error => {
    console.error('\n❌ Release failed:', error.message);
    process.exit(1);
  });
```

### 更新UI组件

**更新进度组件**：

```tsx
// src/components/UpdateProgress.tsx
import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';

interface UpdateInfo {
  version: string;
  releaseNotes: string;
  size: number;
}

interface ProgressInfo {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export const UpdateProgress: React.FC = () => {
  const [updateState, setUpdateState] = useState<
    'idle' | 'checking' | 'available' | 'downloading' | 'downloaded'
  >('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 监听更新事件
    ipcRenderer.on('update-checking', () => {
      setUpdateState('checking');
      setError(null);
    });

    ipcRenderer.on('update-available', (_event, info: UpdateInfo) => {
      setUpdateState('available');
      setUpdateInfo(info);
    });

    ipcRenderer.on('update-not-available', () => {
      setUpdateState('idle');
    });

    ipcRenderer.on(
      'update-download-progress',
      (_event, progressObj: ProgressInfo) => {
        setProgress(progressObj);
      }
    );

    ipcRenderer.on('update-downloaded', () => {
      setUpdateState('downloaded');
    });

    ipcRenderer.on('update-error', (_event, errorMessage: string) => {
      setError(errorMessage);
      setUpdateState('idle');
    });

    // 清理监听器
    return () => {
      ipcRenderer.removeAllListeners('update-checking');
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('update-not-available');
      ipcRenderer.removeAllListeners('update-download-progress');
      ipcRenderer.removeAllListeners('update-downloaded');
      ipcRenderer.removeAllListeners('update-error');
    };
  }, []);

  const handleDownload = () => {
    setUpdateState('downloading');
    ipcRenderer.send('download-update');
  };

  const handleInstall = () => {
    ipcRenderer.send('quit-and-install');
  };

  if (error) {
    return (
      <div className="update-error">
        <h3>更新失败</h3>
        <p>{error}</p>
        <button onClick={() => setError(null)}>关闭</button>
      </div>
    );
  }

  return (
    <div className="update-container">
      {updateState === 'checking' && (
        <div className="update-checking">
          <p>正在检查更新...</p>
        </div>
      )}

      {updateState === 'available' && updateInfo && (
        <div className="update-available">
          <h3>发现新版本 {updateInfo.version}</h3>
          <div className="release-notes">
            <h4>更新内容：</h4>
            <div
              dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
            />
          </div>
          <p>大小: {(updateInfo.size / 1024 / 1024).toFixed(2)} MB</p>
          <button onClick={handleDownload} className="download-btn">
            下载更新
          </button>
        </div>
      )}

      {updateState === 'downloading' && progress && (
        <div className="update-downloading">
          <h3>正在下载更新...</h3>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p>
            {progress.percent.toFixed(1)}% -{' '}
            {(progress.bytesPerSecond / 1024).toFixed(1)} KB/s
          </p>
          <p>
            {(progress.transferred / 1024 / 1024).toFixed(2)} MB /{' '}
            {(progress.total / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}

      {updateState === 'downloaded' && (
        <div className="update-downloaded">
          <h3>更新已下载</h3>
          <p>重启应用以完成更新安装</p>
          <button onClick={handleInstall} className="install-btn">
            立即安装
          </button>
        </div>
      )}
    </div>
  );
};
```

### Positive Consequences

- 自动更新机制提供无缝的用户体验
- 代码签名确保应用安全性和用户信任度
- 渐进式发布降低大规模部署风险
- 跨平台支持覆盖主要操作系统
- 与Release Health监控集成，可快速发现问题
- 支持快速回滚，减少故障影响时间
- 满足应用商店和企业分发要求

### Negative Consequences

- 代码签名证书成本和维护复杂度
- 渐进式发布增加发布流程复杂性
- macOS公证流程较为复杂，耗时较长
- 自动更新可能在某些网络环境下失败
- 需要维护多平台构建环境
- 回滚机制需要额外的监控和告警系统

## Verification

- **测试验证**: tests/e2e/auto-update.spec.ts, tests/integration/code-signing.spec.ts
- **门禁脚本**: scripts/verify_signatures.mjs, scripts/test_update_flow.mjs
- **监控指标**: update.success_rate, release.health_score, deployment.rollback_count, signing.cert_expiry
- **部署验证**: 多平台安装测试、签名验证、更新流程验证

### 部署发布验证清单

- [ ] 代码签名配置正确且证书有效
- [ ] 自动更新机制在所有目标平台正常工作
- [ ] 渐进式发布策略配置和监控集成
- [ ] Release Health指标与发布门禁联动
- [ ] 回滚机制能够快速响应和执行
- [ ] 跨平台安装包构建和分发正常
- [ ] CI/CD工作流自动化执行完整

## Operational Playbook

### 升级步骤

1. **证书配置**: 获取和配置Windows/macOS代码签名证书
2. **构建环境**: 设置跨平台构建环境和签名工具
3. **更新集成**: 集成electron-updater到应用主进程
4. **发布流程**: 配置GitHub Actions发布工作流
5. **监控集成**: 集成Release Health监控和告警
6. **渐进式发布**: 部署渐进式发布和自动回滚机制

### 回滚步骤

1. **立即回滚**: 将有问题的版本标记为draft，停止推送
2. **版本回退**: 恢复到上一个稳定版本的GitHub Release
3. **通知机制**: 通过应用内通知告知用户回滚情况
4. **数据恢复**: 如需要，恢复与版本相关的数据状态
5. **问题分析**: 分析回滚原因并制定修复计划
6. **热修复**: 发布热修复版本解决关键问题

### 迁移指南

- **证书迁移**: 现有应用需要重新签名和分发
- **更新机制**: 集成自动更新到现有应用架构
- **用户沟通**: 提前告知用户新的更新机制和流程
- **数据备份**: 在更新前确保用户数据安全备份
- **兼容性**: 确保新版本与旧版本数据格式兼容

## References

- **CH章节关联**: CH07, CH10
- **相关ADR**: ADR-0003-observability-release-health, ADR-0005-quality-gates, ADR-0002-electron-security
- **外部文档**:
  - [electron-updater Documentation](https://www.electron.build/auto-update)
  - [Windows Code Signing Guide](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
  - [macOS Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
  - [GitHub Releases API](https://docs.github.com/en/rest/releases/releases)
- **工具链**: electron-builder, electron-updater, GitHub Actions
- **相关PRD-ID**: 适用于所有需要桌面应用分发的PRD
