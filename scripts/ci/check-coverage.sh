#!/usr/bin/env bash
set -euo pipefail
LINES=${1:-90}
echo "==> Run tests with coverage threshold: ${LINES}%"
npx vitest run --coverage --coverage.enabled --coverage.thresholds.lines=${LINES}
