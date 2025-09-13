name: ci

on:
push:
branches: [ main ]
pull_request:
branches: [ main ]

jobs:
lint:
runs-on: ubuntu-latest
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with: { node-version: 20 } - run: npm ci - run: npm run lint && npm run typecheck

unit:
runs-on: ubuntu-latest
needs: [ lint ]
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with: { node-version: 20 } - run: npm ci - run: npm run test:coverage:gate

e2e:
runs-on: ubuntu-latest
needs: [ unit ]
env:
SENTRY_ENVIRONMENT: staging
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with: { node-version: 20 } - run: npm ci - run: npx playwright install --with-deps - run: npm run test:e2e

bundle-gate:
runs-on: ubuntu-latest
needs: [ unit ]
env:
BUNDLE_GUARD: soft # 两周后移除此行转硬门
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with: { node-version: 20 } - run: npm ci - run: npm run build - run: npm run guard:bundle

release-health:
runs-on: ubuntu-latest
needs: [ e2e ]
env:
SENTRY_ENVIRONMENT: staging
HEALTH_GUARD_SOFT: true # 两周后移除此行转硬门 # 如已接 Sentry，可由前置 Job 生成 test-results/release-health.json
CRASH_FREE_SESSIONS: 98.5
CRASH_FREE_USERS: 98.1
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with: { node-version: 20 } - run: npm ci - run: npm run release:health-gate
