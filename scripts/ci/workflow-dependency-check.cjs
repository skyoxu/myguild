#!/usr/bin/env node

/**
 * GitHub Actions Workflow Dependencies Validator
 * Prevents workflow compilation failures by validating job dependency references
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse YAML workflow file to extract job definitions and dependencies
 */
function parseWorkflowFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      error: `Workflow file not found: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const jobs = new Set();
  const dependencies = [];

  let currentJob = null;
  let inJobsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Detect jobs section
    if (line.trim() === 'jobs:') {
      inJobsSection = true;
      continue;
    }

    if (!inJobsSection) continue;

    // Job definition (starts at column 3, ends with colon)
    const jobMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (jobMatch) {
      currentJob = jobMatch[1];
      jobs.add(currentJob);
      continue;
    }

    // Dependency definition
    const needsMatch = line.match(/^\s+needs:\s*(.+)$/);
    if (needsMatch && currentJob) {
      const needsValue = needsMatch[1];

      // Handle single dependency
      if (!needsValue.includes('[')) {
        const dependency = needsValue.trim();
        dependencies.push({
          job: currentJob,
          dependency: dependency,
          line: lineNumber,
        });
      } else {
        // Handle array dependency - continue reading until closing bracket
        let fullDependency = needsValue;
        let j = i + 1;

        while (j < lines.length && !fullDependency.includes(']')) {
          fullDependency += ' ' + lines[j].trim();
          j++;
        }

        // Extract dependencies from array
        const arrayMatch = fullDependency.match(/\[(.*?)\]/);
        if (arrayMatch) {
          const depsList = arrayMatch[1].split(',');
          depsList.forEach(dep => {
            const cleanDep = dep.trim().replace(/['"]/g, '');
            if (cleanDep) {
              dependencies.push({
                job: currentJob,
                dependency: cleanDep,
                line: lineNumber,
              });
            }
          });
        }
      }
    }
  }

  return {
    jobs: Array.from(jobs),
    dependencies: dependencies,
  };
}

/**
 * Validate all dependency references
 */
function validateDependencies(workflowData) {
  const { jobs, dependencies } = workflowData;
  const issues = [];

  console.log(`🔍 Found ${jobs.length} jobs: ${jobs.join(', ')}`);
  console.log(`📋 Validating ${dependencies.length} dependency references...`);

  dependencies.forEach(({ job, dependency, line }) => {
    if (!jobs.includes(dependency)) {
      issues.push({
        type: 'missing_job',
        job: job,
        dependency: dependency,
        line: line,
        message: `Job '${job}' depends on '${dependency}' which doesn't exist`,
      });
    }
  });

  return issues;
}

/**
 * Check for circular dependencies
 */
function checkCircularDependencies(workflowData) {
  const { dependencies } = workflowData;
  const graph = {};

  // Build dependency graph
  dependencies.forEach(({ job, dependency }) => {
    if (!graph[job]) graph[job] = [];
    graph[job].push(dependency);
  });

  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function hasCycle(node, path = []) {
    if (recursionStack.has(node)) {
      cycles.push([...path, node]);
      return true;
    }

    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);

    if (graph[node]) {
      for (const neighbor of graph[node]) {
        if (hasCycle(neighbor, [...path, node])) {
          return true;
        }
      }
    }

    recursionStack.delete(node);
    return false;
  }

  // Check for cycles starting from each node
  Object.keys(graph).forEach(job => {
    if (!visited.has(job)) {
      hasCycle(job);
    }
  });

  return cycles;
}

/**
 * Main validation process
 */
async function validateWorkflow(customPath) {
  console.log('🔍 GitHub Actions Workflow Dependencies Validator');
  console.log('=================================================');

  // 支持传入自定义路径或默认使用 ci.yml
  const workflowPath =
    customPath ||
    path.join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml');
  console.log(`📁 Checking: ${workflowPath}`);

  const workflowData = parseWorkflowFile(workflowPath);

  if (workflowData.error) {
    console.log(`❌ ${workflowData.error}`);
    process.exit(1);
  }

  // Validate dependency references
  const issues = validateDependencies(workflowData);

  // Check circular dependencies
  const cycles = checkCircularDependencies(workflowData);

  console.log('\n🎯 Validation Results');
  console.log('=====================');

  if (issues.length === 0 && cycles.length === 0) {
    console.log('✅ All dependency references are valid');
    console.log('✅ No circular dependencies detected');
    console.log('🚀 Workflow is ready for deployment');
  } else {
    let hasErrors = false;

    if (issues.length > 0) {
      console.log('❌ Dependency Reference Issues:');
      issues.forEach(issue => {
        console.log(`   Line ${issue.line}: ${issue.message}`);
      });
      hasErrors = true;
    }

    if (cycles.length > 0) {
      console.log('❌ Circular Dependencies Detected:');
      cycles.forEach((cycle, index) => {
        console.log(`   Cycle ${index + 1}: ${cycle.join(' → ')}`);
      });
      hasErrors = true;
    }

    if (hasErrors) {
      console.log('\n💡 Recommended Actions:');
      console.log('1. Fix missing job references by updating job IDs');
      console.log('2. Break circular dependencies by restructuring workflow');
      console.log(
        '3. Use stable job naming convention (lowercase-with-dashes)'
      );
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const customPath = process.argv[2]; // 支持命令行参数
  validateWorkflow(customPath).catch(error => {
    console.error('❌ Workflow validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  parseWorkflowFile,
  validateDependencies,
  checkCircularDependencies,
  validateWorkflow,
};
