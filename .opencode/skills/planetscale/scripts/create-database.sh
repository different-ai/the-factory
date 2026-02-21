#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_env PSCALE_ORG
require_env PSCALE_DB

region="${PSCALE_REGION:-us-east}"
body="{\"name\":\"${PSCALE_DB}\",\"region\":\"${region}\"}"

pscale_api POST "/organizations/${PSCALE_ORG}/databases" "$body"
