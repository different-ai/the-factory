#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTERPRISE_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
REPO_ROOT="${REPO_ROOT:-$ENTERPRISE_ROOT/_repos/openwork}"
DEV_SERVER_PORT="${DEV_SERVER_PORT:-5173}"

cd "$REPO_ROOT"
if [[ ! -d "node_modules" ]]; then
  pnpm install
fi

pnpm --filter @different-ai/openwork-ui dev --host 127.0.0.1 --port "$DEV_SERVER_PORT" \
  > /tmp/openwork-dev-web.log 2>&1 &

echo "Vite dev server started on http://127.0.0.1:$DEV_SERVER_PORT"
