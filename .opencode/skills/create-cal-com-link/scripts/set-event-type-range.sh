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

EVENT_TYPE_ID=${1:-""}
if [ -z "$EVENT_TYPE_ID" ]; then
  echo "Usage: set-event-type-range.sh <event-type-id> [days] [time-zone]" >&2
  exit 1
fi

DAYS=${2:-3}
TIME_ZONE=${3:-"America/Los_Angeles"}

START_UTC=$(date -u "+%Y-%m-%dT%H:%M:%S.000Z")
END_LOCAL=$(TZ="$TIME_ZONE" date -v+"${DAYS}"d "+%Y-%m-%dT23:59:59")
END_UTC=$(TZ="$TIME_ZONE" date -j -f "%Y-%m-%dT%H:%M:%S" "$END_LOCAL" -u "+%Y-%m-%dT%H:%M:%S.000Z")

payload=$(cat <<EOF
{"periodType":"RANGE","periodStartDate":"${START_UTC}","periodEndDate":"${END_UTC}"}
EOF
)

curl -sS -X PATCH "https://api.cal.com/v1/event-types/${EVENT_TYPE_ID}?apiKey=${CAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$payload"
