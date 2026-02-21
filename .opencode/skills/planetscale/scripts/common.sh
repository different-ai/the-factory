#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$SKILL_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SKILL_DIR/.env"
  set +a
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require_auth() {
  require_env PSCALE_SERVICE_TOKEN_ID
  require_env PSCALE_SERVICE_TOKEN
}

pscale_auth_header() {
  printf '%s:%s' "$PSCALE_SERVICE_TOKEN_ID" "$PSCALE_SERVICE_TOKEN"
}

pscale_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  require_auth

  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "https://api.planetscale.com/v1$path" \
      -H "Authorization: $(pscale_auth_header)" \
      -H "Content-Type: application/json" \
      --data "$body"
    return
  fi

  curl -sS -X "$method" "https://api.planetscale.com/v1$path" \
    -H "Authorization: $(pscale_auth_header)"
}
