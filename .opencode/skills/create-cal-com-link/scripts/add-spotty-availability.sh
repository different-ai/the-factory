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
  echo "Usage: add-spotty-availability.sh <schedule-id>" >&2
  exit 1
fi

post_availability() {
  local day="$1"
  local start="$2"
  local end="$3"
  local payload
  payload=$(cat <<EOF
{"scheduleId":${SCHEDULE_ID},"days":[${day}],"startTime":"1970-01-01T${start}.000Z","endTime":"1970-01-01T${end}.000Z"}
EOF
)

  curl -sS -X POST "https://api.cal.com/v1/availabilities?apiKey=${CAL_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

# Tuesday
post_availability 2 "08:00:00" "08:45:00"
post_availability 2 "09:30:00" "10:00:00"
post_availability 2 "11:15:00" "12:00:00"

# Wednesday
post_availability 3 "08:15:00" "09:00:00"
post_availability 3 "10:30:00" "11:00:00"
post_availability 3 "11:30:00" "12:00:00"

# Friday
post_availability 5 "08:00:00" "08:30:00"
post_availability 5 "09:45:00" "10:15:00"
post_availability 5 "11:00:00" "11:45:00"
