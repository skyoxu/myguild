import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { execSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe('Release Feed Management', () => {
  const testDistDir = 'test-dist';
  const testFeedFile = path.join(testDistDir, 'latest.yml');
  const testManifestFile = path.join(testDistDir, 'manifest.json');

  beforeEach(() => {
    // 创建测试目录
    if (!fs.existsSync(testDistDir)) {
      fs.mkdirSync(testDistDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(testDistDir)) {
      fs.rmSync(testDistDir, { recursive: true, force: true });
    }
  });

  describe('patch-staging-percentage', () => {
    test('should set stagingPercentage to specified value', () => {
      // 准备测试 feed 文件
      const initialFeed = {
        version: '1.2.3',
        path: 'app.exe',
        sha512: 'sha512-testHash123==',
        releaseDate: '2025-08-29T10:00:00.000Z',
      };
      fs.writeFileSync(testFeedFile, yaml.dump(initialFeed), 'utf8');

      // 执行分阶段发布设置
      const result = execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 25`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // 验证结果
      const updatedFeed = yaml.load(
        fs.readFileSync(testFeedFile, 'utf8')
      ) as any;
      expect(updatedFeed.stagingPercentage).toBe(25);
      expect(updatedFeed.version).toBe('1.2.3');
      expect(updatedFeed.path).toBe('app.exe');
      expect(updatedFeed.sha512).toBe('sha512-testHash123==');

      // 验证 JSON 输出
      const jsonResult = JSON.parse(result);
      expect(jsonResult.ok).toBe(true);
      expect(jsonResult.stagingPercentage).toBe(25);
      expect(jsonResult.feedFile).toBe(testFeedFile);
      expect(jsonResult.timestamp).toBeDefined();
    });

    test('should handle percentage boundary values', () => {
      const initialFeed = { version: '1.0.0', path: 'app.exe', sha512: 'test' };
      fs.writeFileSync(testFeedFile, yaml.dump(initialFeed), 'utf8');

      // 测试 0%
      execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 0`
      );
      let feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(0);

      // 测试 100%
      execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 100`
      );
      feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(100);

      // 测试超出范围的值会被夹紧
      execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 150`
      );
      feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(100);

      execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} -10`
      );
      feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(0);
    });

    test('should create feed file if it does not exist', () => {
      expect(fs.existsSync(testFeedFile)).toBe(false);

      const result = execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 50`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      expect(fs.existsSync(testFeedFile)).toBe(true);
      const feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(50);

      const jsonResult = JSON.parse(result);
      expect(jsonResult.ok).toBe(true);
    });
  });

  describe('rollback-feed', () => {
    beforeEach(() => {
      // 创建测试版本清单
      const testManifest = {
        '1.1.0': {
          path: 'app-1.1.0.exe',
          sha512: 'sha512-oldHash123==',
          size: 50331648,
          releaseDate: '2025-08-28T10:00:00.000Z',
          files: [
            {
              url: 'app-1.1.0.exe',
              sha512: 'sha512-oldHash123==',
              size: 50331648,
            },
          ],
        },
        '1.2.0': {
          path: 'app-1.2.0.exe',
          sha512: 'sha512-newHash456==',
          size: 52428800,
          releaseDate: '2025-08-29T09:00:00.000Z',
          files: [
            {
              url: 'app-1.2.0.exe',
              sha512: 'sha512-newHash456==',
              size: 52428800,
            },
          ],
        },
      };
      fs.writeFileSync(
        testManifestFile,
        JSON.stringify(testManifest, null, 2),
        'utf8'
      );
    });

    test('should rollback feed to specified version', () => {
      // 准备当前 feed 文件（1.2.0）
      const currentFeed = {
        version: '1.2.0',
        path: 'app-1.2.0.exe',
        sha512: 'sha512-newHash456==',
        releaseDate: '2025-08-29T09:00:00.000Z',
        stagingPercentage: 50,
        files: [
          {
            url: 'app-1.2.0.exe',
            sha512: 'sha512-newHash456==',
            size: 52428800,
          },
        ],
      };
      fs.writeFileSync(testFeedFile, yaml.dump(currentFeed), 'utf8');

      // 执行回滚到 1.1.0
      const result = execSync(
        `node scripts/release/rollback-feed.mjs ${testFeedFile} ${testManifestFile} 1.1.0`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // 验证回滚结果
      const rolledBackFeed = yaml.load(
        fs.readFileSync(testFeedFile, 'utf8')
      ) as any;
      expect(rolledBackFeed.version).toBe('1.1.0');
      expect(rolledBackFeed.path).toBe('app-1.1.0.exe');
      expect(rolledBackFeed.sha512).toBe('sha512-oldHash123==');
      expect(rolledBackFeed.stagingPercentage).toBe(0); // 回滚后立即停止分发
      expect(rolledBackFeed.files).toBeDefined();
      expect(rolledBackFeed.files[0].url).toBe('app-1.1.0.exe');

      // 验证 JSON 输出
      const jsonResult = JSON.parse(result);
      expect(jsonResult.ok).toBe(true);
      expect(jsonResult.rolledBackTo).toBe('1.1.0');
      expect(jsonResult.feedFile).toBe(testFeedFile);
      expect(jsonResult.timestamp).toBeDefined();
    });

    test('should fail when target version not found in manifest', () => {
      const currentFeed = { version: '1.2.0', path: 'app.exe', sha512: 'test' };
      fs.writeFileSync(testFeedFile, yaml.dump(currentFeed), 'utf8');

      // 尝试回滚到不存在的版本
      expect(() => {
        execSync(
          `node scripts/release/rollback-feed.mjs ${testFeedFile} ${testManifestFile} 0.9.0`,
          { stdio: 'pipe' }
        );
      }).toThrow();
    });
  });

  describe('manage-manifest integration', () => {
    test('should add version to manifest and be usable for rollback', () => {
      // 创建虚拟应用文件用于测试
      const testAppFile = path.join(testDistDir, 'app-1.3.0.exe');
      fs.writeFileSync(testAppFile, 'dummy app content for testing', 'utf8');

      // 添加新版本到清单
      execSync(
        `node scripts/release/manage-manifest.mjs add --manifest=${testManifestFile} --version=1.3.0 --path=${testAppFile}`,
        { stdio: 'pipe' }
      );

      // 验证版本已添加
      const manifest = JSON.parse(fs.readFileSync(testManifestFile, 'utf8'));
      expect(manifest['1.3.0']).toBeDefined();
      expect(manifest['1.3.0'].path).toBe('app-1.3.0.exe'); // 脚本只保存文件名
      expect(manifest['1.3.0'].sha512).toBeDefined();

      // 创建 feed 文件并回滚到新版本
      const testFeed = {
        version: '1.4.0',
        path: 'app-1.4.0.exe',
        sha512: 'temp',
      };
      fs.writeFileSync(testFeedFile, yaml.dump(testFeed), 'utf8');

      execSync(
        `node scripts/release/rollback-feed.mjs ${testFeedFile} ${testManifestFile} 1.3.0`,
        { stdio: 'pipe' }
      );

      const rolledBackFeed = yaml.load(
        fs.readFileSync(testFeedFile, 'utf8')
      ) as any;
      expect(rolledBackFeed.version).toBe('1.3.0');
      expect(rolledBackFeed.path).toBe('app-1.3.0.exe'); // 应该使用清单中的文件名
      expect(rolledBackFeed.sha512).toBe(manifest['1.3.0'].sha512);
    });
  });

  describe('execute-rollback integration', () => {
    beforeEach(() => {
      // 准备测试清单
      const testManifest = {
        '1.0.0': {
          path: 'app-1.0.0.exe',
          sha512: 'sha512-stableHash==',
          size: 48234496,
          releaseDate: '2025-08-27T10:00:00.000Z',
          files: [
            {
              url: 'app-1.0.0.exe',
              sha512: 'sha512-stableHash==',
              size: 48234496,
            },
          ],
        },
      };
      fs.writeFileSync(
        testManifestFile,
        JSON.stringify(testManifest, null, 2),
        'utf8'
      );
    });

    test('should execute emergency rollback (stop only)', () => {
      // 准备活跃发布的 feed 文件
      const activeFeed = {
        version: '1.1.0',
        path: 'app-1.1.0.exe',
        sha512: 'sha512-currentHash==',
        stagingPercentage: 25,
      };
      fs.writeFileSync(testFeedFile, yaml.dump(activeFeed), 'utf8');

      // 执行紧急停止（不指定版本回退）
      const result = execSync(
        `node scripts/release/execute-rollback.mjs --feed=${testFeedFile} --reason="Test emergency stop"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // 验证紧急停止结果
      const stoppedFeed = yaml.load(
        fs.readFileSync(testFeedFile, 'utf8')
      ) as any;
      expect(stoppedFeed.stagingPercentage).toBe(0);
      expect(stoppedFeed.version).toBe('1.1.0'); // 版本不变，只是停止分发

      const jsonResult = JSON.parse(result);
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.steps).toBeDefined();
      expect(
        jsonResult.steps.some((step: any) => step.step === 'emergency_stop')
      ).toBe(true);
    });

    test('should execute complete rollback with version revert', () => {
      // 准备当前 feed 文件
      const currentFeed = {
        version: '1.1.0',
        path: 'app-1.1.0.exe',
        sha512: 'sha512-currentHash==',
        stagingPercentage: 50,
      };
      fs.writeFileSync(testFeedFile, yaml.dump(currentFeed), 'utf8');

      // 执行完整回滚（紧急停止 + 版本回退）
      const result = execSync(
        `node scripts/release/execute-rollback.mjs --feed=${testFeedFile} --previous-version=1.0.0 --manifest=${testManifestFile} --reason="Test complete rollback"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // 验证完整回滚结果
      const rolledBackFeed = yaml.load(
        fs.readFileSync(testFeedFile, 'utf8')
      ) as any;
      expect(rolledBackFeed.stagingPercentage).toBe(0);
      expect(rolledBackFeed.version).toBe('1.0.0'); // 版本已回退
      expect(rolledBackFeed.path).toBe('app-1.0.0.exe');
      expect(rolledBackFeed.sha512).toBe('sha512-stableHash==');

      const jsonResult = JSON.parse(result);
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.steps).toBeDefined();
      expect(
        jsonResult.steps.some((step: any) => step.step === 'emergency_stop')
      ).toBe(true);
      expect(
        jsonResult.steps.some((step: any) => step.step === 'version_rollback')
      ).toBe(true);
    });
  });

  describe('Staged Rollout Integration', () => {
    test('should handle full staged rollout lifecycle', () => {
      // 1. 创建初始 feed (5% staging)
      const initialFeed = {
        version: '1.3.0',
        path: 'app-1.3.0.exe',
        sha512: 'sha512-newVersionHash==',
        releaseDate: '2025-08-29T12:00:00.000Z',
        stagingPercentage: 5,
      };
      fs.writeFileSync(testFeedFile, yaml.dump(initialFeed), 'utf8');

      // 2. 验证初始状态
      let feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(5);

      // 3. 模拟健康检查通过，进展到 25%
      execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 25`
      );
      feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(25);

      // 4. 继续进展到 50%
      execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 50`
      );
      feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(50);

      // 5. 最终全量发布 100%
      execSync(
        `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 100`
      );
      feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.stagingPercentage).toBe(100);
      expect(feed.version).toBe('1.3.0'); // 版本保持不变
    });

    test('should support emergency rollback during staged rollout', () => {
      // 准备部分发布状态的 feed (25% staging)
      const partialFeed = {
        version: '1.4.0',
        path: 'app-1.4.0.exe',
        sha512: 'sha512-problematicVersion==',
        stagingPercentage: 25,
      };
      fs.writeFileSync(testFeedFile, yaml.dump(partialFeed), 'utf8');

      // 执行紧急停止（模拟 Crash-Free Sessions 下降）
      const result = execSync(
        `node scripts/release/execute-rollback.mjs --feed=${testFeedFile} --reason="Crash-Free Sessions below threshold"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      // 验证紧急停止成功
      const stoppedFeed = yaml.load(
        fs.readFileSync(testFeedFile, 'utf8')
      ) as any;
      expect(stoppedFeed.stagingPercentage).toBe(0); // 停止分发
      expect(stoppedFeed.version).toBe('1.4.0'); // 版本保持，但不再分发

      const jsonResult = JSON.parse(result);
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.reason).toContain('Crash-Free Sessions');
    });

    test('should validate feed file integrity during operations', () => {
      // 创建损坏的 feed 文件
      fs.writeFileSync(testFeedFile, 'invalid yaml content: [', 'utf8');

      // 测试脚本是否能优雅处理损坏的文件
      expect(() => {
        execSync(
          `node scripts/release/patch-staging-percentage.mjs ${testFeedFile} 50`,
          { stdio: 'pipe' }
        );
      }).toThrow();
    });
  });

  describe('Release Health Monitoring', () => {
    test('should track release metrics in feed metadata', () => {
      const feedWithMetrics = {
        version: '1.5.0',
        path: 'app-1.5.0.exe',
        sha512: 'sha512-metricsVersion==',
        stagingPercentage: 10,
        releaseDate: '2025-08-29T14:00:00.000Z',
        healthMetrics: {
          crashFreeSessions: 0.98,
          crashFreeUsers: 0.95,
          lastUpdated: '2025-08-29T14:30:00.000Z',
        },
      };
      fs.writeFileSync(testFeedFile, yaml.dump(feedWithMetrics), 'utf8');

      // 验证健康指标保存和读取
      const feed = yaml.load(fs.readFileSync(testFeedFile, 'utf8')) as any;
      expect(feed.healthMetrics).toBeDefined();
      expect(feed.healthMetrics.crashFreeSessions).toBe(0.98);
      expect(feed.healthMetrics.crashFreeUsers).toBe(0.95);
    });

    test('should support rollback triggers based on health thresholds', () => {
      // 模拟健康指标低于阈值的场景
      const unhealthyFeed = {
        version: '1.6.0',
        path: 'app-1.6.0.exe',
        sha512: 'sha512-unhealthyVersion==',
        stagingPercentage: 15,
        healthMetrics: {
          crashFreeSessions: 0.85, // 低于 90% 阈值
          crashFreeUsers: 0.82, // 低于 88% 阈值
        },
      };
      fs.writeFileSync(testFeedFile, yaml.dump(unhealthyFeed), 'utf8');

      // 在真实场景中，这里会有自动监控脚本检测健康指标
      // 并触发回滚，这里我们手动模拟这个过程
      const result = execSync(
        `node scripts/release/execute-rollback.mjs --feed=${testFeedFile} --reason="Health metrics below threshold: Sessions=85%, Users=82%"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      const jsonResult = JSON.parse(result);
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.reason).toContain('Health metrics below threshold');
    });
  });
});
