#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

if [[ -f "${SKILL_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${SKILL_DIR}/.env"
  set +a
fi

WINDOW_ID=${1:-}
if [[ -z "${WINDOW_ID}" ]]; then
  cat <<'USAGE'
Usage:
  record-window-video.sh <window-id> [output-file.mp4] [extra flags]

Example:
  record-window-video.sh 1234 /tmp/openwork-artifacts/videos/openwork-flow.mp4 --duration 60 --fps 30 --show-cursor 1
USAGE
  exit 1
fi

shift

OUT_DIR=${OW_WINDOW_RECORDER_OUT_DIR:-/tmp/openwork-artifacts/videos}
DURATION=${OW_WINDOW_RECORDER_DURATION:-45}
FPS=${OW_WINDOW_RECORDER_FPS:-30}
SHOW_CURSOR=${OW_WINDOW_RECORDER_SHOW_CURSOR:-1}

OUTPUT_PATH=${1:-"${OUT_DIR}/flow-$(date +%Y%m%d-%H%M%S).mp4"}
if [[ $# -gt 0 ]]; then
  shift
fi

mkdir -p "$(dirname "${OUTPUT_PATH}")"

bash "${SCRIPT_DIR}/run-window-recorder.sh" \
  record \
  --window-id "${WINDOW_ID}" \
  --out "${OUTPUT_PATH}" \
  --duration "${DURATION}" \
  --fps "${FPS}" \
  --show-cursor "${SHOW_CURSOR}" \
  "$@"
