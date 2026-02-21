#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_env PSCALE_ORG
require_env PSCALE_DB
require_env PSCALE_BRANCH

name="${1:-den-control-plane}"
role="${2:-admin}"

body="{\"name\":\"${name}\",\"role\":\"${role}\"}"

pscale_api POST "/organizations/${PSCALE_ORG}/databases/${PSCALE_DB}/branches/${PSCALE_BRANCH}/passwords" "$body"
