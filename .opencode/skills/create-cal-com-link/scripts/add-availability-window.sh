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

SCHEDULE_ID=${1:-""}
if [ -z "$SCHEDULE_ID" ]; then
  echo "Usage: add-availability-window.sh <schedule-id> [days-json] [start-time] [end-time]" >&2
  exit 1
fi

DAYS_JSON=${2:-"[1,2,3,4,5]"}
START_TIME=${3:-"09:00:00"}
END_TIME=${4:-"17:00:00"}

payload=$(cat <<EOF
{"scheduleId":${SCHEDULE_ID},"days":${DAYS_JSON},"startTime":"1970-01-01T${START_TIME}.000Z","endTime":"1970-01-01T${END_TIME}.000Z"}
EOF
)

curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$payload"
