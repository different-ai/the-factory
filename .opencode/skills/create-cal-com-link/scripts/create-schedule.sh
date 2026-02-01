#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(dirname "$SCRIPT_DIR")

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

: "${CAL_API_KEY:?CAL_API_KEY is required}"

SCHEDULE_NAME=${1:-"PST Spotty This Week"}
SCHEDULE_TIME_ZONE=${2:-"America/Los_Angeles"}

payload=$(cat <<EOF
{"name":"${SCHEDULE_NAME}","timeZone":"${SCHEDULE_TIME_ZONE}"}
EOF
)

curl -sS -X POST "https://api.cal.com/v1/schedules?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$payload"
