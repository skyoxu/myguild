---
description: Rebuild indexes only
allowed-tools: Bash(node scripts/rebuild_indexes.mjs:*), Bash(mkdir:*), Bash(ls:*)
---

## Pre-flight (run)
- !`mkdir -p shards`
- If missing, create scripts/rebuild_indexes.mjs (cross-platform walker)
- !`node scripts/rebuild_indexes.mjs`

## Context
- @architecture_base.index
- @prd_chunks.index

## Your task
Only confirm the first 10 lines of each index for sanity; **do not write any files**.
***不允许删除任何文件***