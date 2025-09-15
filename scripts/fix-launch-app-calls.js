/**
 * 批量修复 launchApp() 调用以适配新的返回格式
 * 从 `electronApp = await launchApp()`
 * 改为 `const { app, page } = await launchApp(); electronApp = app;`
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 搜索所有测试文件
const testFiles = glob.sync('tests/**/*.spec.ts', { cwd: process.cwd() });

let updatedFiles = 0;
const errors = [];

console.log(`Found ${testFiles.length} test files to check...`);

testFiles.forEach(filePath => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // 修复模式1: electronApp = await launchApp();
    const pattern1 = /(\s*)(electronApp\s*=\s*await\s+launchApp\(\);)/g;
    if (pattern1.test(content)) {
      content = content.replace(pattern1, (match, indent, assignment) => {
        modified = true;
        return `${indent}const { app, page } = await launchApp();\n${indent}electronApp = app;`;
      });
    }

    // 修复模式2: const electronApp = await launchApp();
    const pattern2 = /(\s*)(const\s+electronApp\s*=\s*await\s+launchApp\(\);)/g;
    if (pattern2.test(content)) {
      content = content.replace(pattern2, (match, indent, assignment) => {
        modified = true;
        return `${indent}const { app, page } = await launchApp();\n${indent}const electronApp = app;`;
      });
    }

    // 修复模式3: firstWindow = await electronApp.firstWindow(); 紧跟在launchApp后面
    const pattern3 =
      /(const { app, page } = await launchApp\(\);\s*(?:const\s+)?electronApp = app;)\s*((?:const\s+)?firstWindow\s*=\s*await\s+electronApp\.firstWindow\(\);)/g;
    if (pattern3.test(content)) {
      content = content.replace(
        pattern3,
        (match, launchPart, firstWindowPart) => {
          modified = true;
          // 如果是const firstWindow，保持const；否则假设是变量赋值
          const isConst = firstWindowPart.includes('const');
          const windowAssignment = isConst
            ? 'const firstWindow = page;'
            : 'firstWindow = page;';
          return `${launchPart}\n  ${windowAssignment}`;
        }
      );
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      updatedFiles++;
      console.log(`✅ Updated: ${filePath}`);
    }
  } catch (error) {
    errors.push({ file: filePath, error: error.message });
    console.error(`❌ Error processing ${filePath}: ${error.message}`);
  }
});

console.log(`\n📊 Summary:`);
console.log(`- Files checked: ${testFiles.length}`);
console.log(`- Files updated: ${updatedFiles}`);
console.log(`- Errors: ${errors.length}`);

if (errors.length > 0) {
  console.log('\n❌ Errors:');
  errors.forEach(({ file, error }) => {
    console.log(`  ${file}: ${error}`);
  });
  process.exit(1);
}

console.log('\n✅ Launch app calls fixed successfully!');
