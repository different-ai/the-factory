#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_env PSCALE_ORG

pscale_api GET "/organizations/${PSCALE_ORG}/databases"
