#!/usr/bin/env node

/**
 * 可观测性集成器测试脚本
 * 验证SQLite健康指标收集和暴露功能
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 开始测试可观测性集成器...');

async function testObservabilityIntegration() {
  try {
    // 导入可观测性管理器
    const { ObservabilityManager, SQLiteHealthCollector } = await import(
      './observability-integration.mjs'
    );

    console.log('✅ 成功导入可观测性模块');

    // 测试SQLite健康指标收集器
    const testDbPath = path.join(process.cwd(), 'data', 'test.db');

    // 创建测试数据库文件
    if (!fs.existsSync(path.dirname(testDbPath))) {
      fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
    }

    // 创建一个简单的测试数据库文件
    fs.writeFileSync(testDbPath, Buffer.alloc(1024 * 100)); // 100KB test file
    console.log('✅ 测试数据库文件已创建');

    // 测试健康指标收集
    const healthCollector = new SQLiteHealthCollector(testDbPath);

    console.log('📊 测试健康指标收集...');
    const metrics = await healthCollector.collectMetrics();

    console.log('✅ 指标收集完成，结果:');
    console.log(`   数据库大小: ${metrics.dbSize.toFixed(2)}MB`);
    console.log(`   WAL大小: ${metrics.walSize.toFixed(2)}MB`);
    console.log(`   可用磁盘空间: ${metrics.diskSpaceAvailable.toFixed(2)}MB`);
    console.log(`   碎片化程度: ${metrics.fragmentationLevel.toFixed(2)}%`);

    // 测试健康评估
    console.log('🏥 测试健康评估...');
    const healthAssessment = healthCollector.getHealthAssessment();

    console.log('✅ 健康评估完成，结果:');
    console.log(`   健康状态: ${healthAssessment.status}`);
    console.log(`   问题数量: ${healthAssessment.issues.length}`);
    console.log(`   建议数量: ${healthAssessment.recommendations.length}`);

    if (healthAssessment.issues.length > 0) {
      console.log('⚠️ 发现的问题:');
      healthAssessment.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. [${issue.severity}] ${issue.message}`);
      });
    }

    if (healthAssessment.recommendations.length > 0) {
      console.log('💡 改进建议:');
      healthAssessment.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    // 测试Prometheus指标生成
    console.log('📊 测试Prometheus指标生成...');
    const { PrometheusExporter } = await import(
      './observability-integration.mjs'
    );
    const prometheusExporter = new PrometheusExporter(9091); // 使用不同端口避免冲突

    prometheusExporter.updateSQLiteMetrics(healthAssessment);
    const metricsOutput = prometheusExporter.generateMetricsOutput();

    console.log('✅ Prometheus指标生成完成');
    console.log('📊 生成的指标示例:');
    console.log(metricsOutput.substring(0, 300) + '...');

    // 测试完整可观测性管理器
    console.log('🔧 测试完整可观测性管理器...');
    const manager = new ObservabilityManager({
      dbPath: testDbPath,
      metricsInterval: 5,
      prometheusPort: 9092,
    });

    // 执行一次指标收集
    await manager.collectAndExpose();
    console.log('✅ 完整可观测性管理器测试通过');

    // 清理测试文件
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
        console.log('🧹 测试数据库文件已清理');
      }
    } catch (error) {
      console.warn('⚠️ 清理测试文件失败:', error.message);
    }

    console.log('\n✅ 可观测性集成器测试完成，所有功能正常工作！');

    return {
      success: true,
      metrics,
      healthAssessment,
      metricsOutput: metricsOutput.split('\n').length,
    };
  } catch (error) {
    console.error('❌ 可观测性集成器测试失败:', error.message);
    console.error('错误堆栈:', error.stack);

    return {
      success: false,
      error: error.message,
    };
  }
}

// 运行测试
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('test-observability-integration.mjs')
) {
  testObservabilityIntegration()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 测试通过！');
        process.exit(0);
      } else {
        console.log('\n💥 测试失败！');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 测试执行异常:', error);
      process.exit(1);
    });
}

export { testObservabilityIntegration };
