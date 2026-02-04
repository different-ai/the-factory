#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/Users/benjaminshafii/openwork-enterprise/_repos/openwork}"
WORKSPACE_PATH="${OPENWORK_HEADLESS_WORKSPACE:-/tmp/openwork-headless-test}"

cd "$REPO_ROOT"

pnpm --filter openwork-server build:bin

pnpm --filter openwrk dev -- start \
  --workspace "$WORKSPACE_PATH" \
  --allow-external \
  --openwork-server-bin "$REPO_ROOT/packages/server/dist/bin/openwork-server" \
  --no-owpenbot \
  > /tmp/openwrk-headless.log 2>&1 &

echo "Headless OpenWork started. Logs: /tmp/openwrk-headless.log"
