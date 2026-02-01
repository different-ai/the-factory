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

DEFAULT_AVAILABILITY_ID=${1:-""}
if [ -z "$DEFAULT_AVAILABILITY_ID" ]; then
  echo "Usage: delete-default-availability.sh <availability-id>" >&2
  exit 1
fi

curl -sS -X DELETE "https://api.cal.com/v1/availabilities/${DEFAULT_AVAILABILITY_ID}?apiKey=${CAL_API_KEY}"
