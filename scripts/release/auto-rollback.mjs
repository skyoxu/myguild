#!/usr/bin/env node

/**
 * 自动回滚决策脚本 - 基于 Sentry Release Health
 *
 * 基于 ADR-0008 渐进发布策略和 ADR-0003 可观测性规范实现
 *
 * 功能：
 * - 检查指定版本的 Sentry Release Health 指标
 * - 对比 Crash-Free Users/Sessions 与设定阈值
 * - 根据健康度决定是否触发自动回滚
 * - 输出结构化结果用于 CI/CD 决策
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=xxx SENTRY_ORG=acme SENTRY_PROJECT=desktop APP_VERSION=1.2.3 node scripts/release/auto-rollback.mjs
 *   SENTRY_AUTH_TOKEN=xxx THRESHOLD_CF_USERS=0.99 THRESHOLD_CF_SESSIONS=0.99 APP_VERSION=1.2.3 node scripts/release/auto-rollback.mjs
 *
 * 环境变量：
 *   SENTRY_AUTH_TOKEN     - Sentry API 认证令牌 (必需)
 *   SENTRY_ORG           - Sentry 组织名称 (必需)
 *   SENTRY_PROJECT       - Sentry 项目名称 (必需)
 *   APP_VERSION          - 应用版本号 (必需)
 *   THRESHOLD_CF_USERS   - Crash-Free Users 阈值 (默认: 0.995)
 *   THRESHOLD_CF_SESSIONS- Crash-Free Sessions 阈值 (默认: 0.995)
 *   DRY_RUN             - 仅输出结果不退出失败 (默认: false)
 *
 * 退出码：
 *   0  - 健康度通过，无需回滚
 *   42 - 健康度不达标，建议回滚 (特殊退出码供 CI 识别)
 *   1  - API 错误或其他失败
 *   2  - 参数配置错误
 *
 * 输出格式：
 *   {"cfUsers":0.996,"cfSessions":0.998,"pass":true,"version":"1.2.3","timestamp":"..."}
 *
 * 相关文档：
 * - Sentry Releases API: https://docs.sentry.io/api/releases/
 * - Release Health: https://docs.sentry.io/product/releases/health/
 * - ADR-0003: 可观测性和发布健康监控
 * - ADR-0008: 渐进发布和自动回滚策略
 */

import process from 'node:process';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

// 主程序入口点检测
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

// 环境变量配置
const {
  SENTRY_AUTH_TOKEN,
  SENTRY_ORG,
  SENTRY_PROJECT,
  APP_VERSION,
  THRESHOLD_CF_USERS = '0.995',
  THRESHOLD_CF_SESSIONS = '0.995',
  DRY_RUN = 'false',
  SENTRY_API_TIMEOUT = '10000',
} = process.env;

/**
 * 发起 HTTPS GET 请求到 Sentry API
 * @param {string} path - API 路径
 * @param {number} timeout - 请求超时时间(ms)
 * @returns {Promise<{status: number, json: any}>} API 响应
 */
function sentryApiGet(path, timeout = 10000) {
  const opts = {
    hostname: 'sentry.io',
    path,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`,
      Accept: 'application/json',
      'User-Agent': 'auto-rollback-script/1.0.0',
    },
    timeout,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, json, headers: res.headers });
        } catch (parseError) {
          reject(
            new Error(`Failed to parse JSON response: ${parseError.message}`)
          );
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    req.on('error', error => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.setTimeout(timeout);
    req.end();
  });
}

/**
 * 验证必需的环境变量
 * @throws {Error} 缺少必需配置时抛出错误
 */
function validateConfig() {
  const required = [
    'SENTRY_AUTH_TOKEN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'APP_VERSION',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // 验证阈值范围
  const cfUsers = Number(THRESHOLD_CF_USERS);
  const cfSessions = Number(THRESHOLD_CF_SESSIONS);

  if (isNaN(cfUsers) || cfUsers < 0 || cfUsers > 1) {
    throw new Error(
      `Invalid THRESHOLD_CF_USERS: ${THRESHOLD_CF_USERS}. Must be 0-1.`
    );
  }

  if (isNaN(cfSessions) || cfSessions < 0 || cfSessions > 1) {
    throw new Error(
      `Invalid THRESHOLD_CF_SESSIONS: ${THRESHOLD_CF_SESSIONS}. Must be 0-1.`
    );
  }
}

/**
 * 从 Sentry API 响应中提取 Release Health 指标
 * @param {any} releaseData - Sentry release API 响应数据
 * @returns {{cfUsers: number|null, cfSessions: number|null}} 健康指标
 */
function extractHealthMetrics(releaseData) {
  // Sentry Release Health 数据结构可能因版本而异
  // 支持多种可能的数据结构
  let cfUsers = null;
  let cfSessions = null;

  // 尝试从 healthData 字段获取（新版API）
  if (releaseData.healthData) {
    cfUsers = releaseData.healthData.crashFreeUsers;
    cfSessions = releaseData.healthData.crashFreeSessions;
  }

  // 尝试从 health 字段获取（旧版API）
  if (!cfUsers && releaseData.health) {
    cfUsers = releaseData.health.crashFreeUsers;
    cfSessions = releaseData.health.crashFreeSessions;
  }

  // 尝试从顶层字段获取
  if (!cfUsers && releaseData.crashFreeUsers !== undefined) {
    cfUsers = releaseData.crashFreeUsers;
  }

  if (!cfSessions && releaseData.crashFreeSessions !== undefined) {
    cfSessions = releaseData.crashFreeSessions;
  }

  return { cfUsers, cfSessions };
}

/**
 * 检查发布健康度并决定是否回滚
 * @param {string} version - 应用版本号
 * @param {number} thresholdUsers - Crash-Free Users 阈值
 * @param {number} thresholdSessions - Crash-Free Sessions 阈值
 * @returns {Promise<{cfUsers: number, cfSessions: number, pass: boolean, version: string, timestamp: string}>} 健康检查结果
 */
export async function checkReleaseHealth(
  version,
  thresholdUsers,
  thresholdSessions
) {
  const encodedVersion = encodeURIComponent(version);
  const apiPath = `/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/releases/${encodedVersion}/`;

  console.error(`🔍 Checking release health for version ${version}...`);
  console.error(
    `📊 Thresholds: Users=${thresholdUsers}, Sessions=${thresholdSessions}`
  );

  try {
    const { status, json } = await sentryApiGet(
      apiPath,
      Number(SENTRY_API_TIMEOUT)
    );

    if (status !== 200) {
      // 检查是否是版本不存在的问题
      if (status === 404) {
        throw new Error(
          `Release ${version} not found in Sentry. Ensure release is created before health check.`
        );
      }

      throw new Error(
        `Sentry API returned status ${status}: ${JSON.stringify(json)}`
      );
    }

    const { cfUsers, cfSessions } = extractHealthMetrics(json);

    // 如果无法获取健康指标，说明数据还未准备好
    if (cfUsers === null || cfSessions === null) {
      console.error(`⚠️  Health data not available yet for version ${version}`);
      console.error(`📝 Available data: ${JSON.stringify(json, null, 2)}`);
      throw new Error(
        `Health metrics not available for release ${version}. May need more time for data collection.`
      );
    }

    // 健康度检查
    const usersPass = cfUsers >= thresholdUsers;
    const sessionsPass = cfSessions >= thresholdSessions;
    const overallPass = usersPass && sessionsPass;

    const result = {
      cfUsers,
      cfSessions,
      pass: overallPass,
      version,
      timestamp: new Date().toISOString(),
      thresholds: {
        users: thresholdUsers,
        sessions: thresholdSessions,
      },
      checks: {
        usersPass,
        sessionsPass,
      },
    };

    // 输出详细的健康检查信息
    console.error(`📈 Release Health Results:`);
    console.error(
      `   Crash-Free Users: ${(cfUsers * 100).toFixed(3)}% (threshold: ${(thresholdUsers * 100).toFixed(1)}%) ${usersPass ? '✅' : '❌'}`
    );
    console.error(
      `   Crash-Free Sessions: ${(cfSessions * 100).toFixed(3)}% (threshold: ${(thresholdSessions * 100).toFixed(1)}%) ${sessionsPass ? '✅' : '❌'}`
    );
    console.error(
      `   Overall Status: ${overallPass ? '✅ HEALTHY' : '❌ UNHEALTHY - ROLLBACK RECOMMENDED'}`
    );

    return result;
  } catch (error) {
    throw new Error(`Failed to check release health: ${error.message}`);
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
自动回滚决策脚本 - 基于 Sentry Release Health

用法:
  SENTRY_AUTH_TOKEN=xxx SENTRY_ORG=acme SENTRY_PROJECT=desktop APP_VERSION=1.2.3 node scripts/release/auto-rollback.mjs

环境变量:
  SENTRY_AUTH_TOKEN      Sentry API 认证令牌 (必需)
  SENTRY_ORG            Sentry 组织名称 (必需)  
  SENTRY_PROJECT        Sentry 项目名称 (必需)
  APP_VERSION           应用版本号 (必需)
  THRESHOLD_CF_USERS    Crash-Free Users 阈值 (默认: 0.995)
  THRESHOLD_CF_SESSIONS Crash-Free Sessions 阈值 (默认: 0.995)
  DRY_RUN              仅输出结果不退出失败 (默认: false)
  SENTRY_API_TIMEOUT    API 请求超时时间(ms) (默认: 10000)

退出码:
  0   健康度通过，无需回滚
  42  健康度不达标，建议回滚
  1   API 错误或其他失败
  2   参数配置错误

示例:
  # 检查版本 1.2.3 的健康度
  SENTRY_AUTH_TOKEN=xxx SENTRY_ORG=acme SENTRY_PROJECT=desktop APP_VERSION=1.2.3 node scripts/release/auto-rollback.mjs
  
  # 使用自定义阈值
  THRESHOLD_CF_USERS=0.99 THRESHOLD_CF_SESSIONS=0.995 APP_VERSION=1.2.3 node scripts/release/auto-rollback.mjs
  
  # 仅查看结果，不触发失败退出
  DRY_RUN=true APP_VERSION=1.2.3 node scripts/release/auto-rollback.mjs
`);
}

// 主程序执行
if (isMainModule) {
  // 显示帮助
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  (async () => {
    try {
      // 验证配置
      validateConfig();

      // 执行健康检查
      const result = await checkReleaseHealth(
        APP_VERSION,
        Number(THRESHOLD_CF_USERS),
        Number(THRESHOLD_CF_SESSIONS)
      );

      // 输出结构化结果
      console.log(JSON.stringify(result));

      // 根据健康检查结果决定退出码
      if (!result.pass && DRY_RUN !== 'true') {
        console.error(
          `💥 Release health check failed - triggering rollback signal`
        );
        process.exitCode = 42; // 特殊退出码，触发回滚 job
      } else if (!result.pass && DRY_RUN === 'true') {
        console.error(
          `⚠️  DRY_RUN mode: Would trigger rollback but exiting successfully`
        );
        process.exitCode = 0;
      } else {
        console.error(`✅ Release health check passed`);
        process.exitCode = 0;
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);

      // 输出错误结构用于下游处理
      const errorResult = {
        error: error.message,
        pass: false,
        version: APP_VERSION || 'unknown',
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(errorResult));

      if (error.message.includes('Missing required environment variables')) {
        process.exit(2);
      } else {
        process.exit(1);
      }
    }
  })();
}
