#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 3 ]]; then
  cat <<'USAGE' >&2
Usage:
  make-video-preview.sh <input-video> [preview.gif] [poster.png]

Example:
  make-video-preview.sh /tmp/openwork-artifacts/videos/flow.mp4 \
    /tmp/openwork-artifacts/videos/flow-preview.gif \
    /tmp/openwork-artifacts/videos/flow-poster.png
USAGE
  exit 1
fi

INPUT="$1"
GIF_OUT="${2:-${INPUT%.*}-preview.gif}"
POSTER_OUT="${3:-${INPUT%.*}-poster.png}"

if [[ ! -f "$INPUT" ]]; then
  echo "File not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to generate GIF and poster previews" >&2
  exit 1
fi

mkdir -p "$(dirname "$GIF_OUT")" "$(dirname "$POSTER_OUT")"

ffmpeg -y -i "$INPUT" \
  -vf "fps=10,scale=960:-2:flags=lanczos:force_original_aspect_ratio=decrease" \
  "$GIF_OUT" >/dev/null 2>&1

ffmpeg -y -i "$INPUT" \
  -vf "thumbnail,scale=1280:-2:flags=lanczos:force_original_aspect_ratio=decrease" \
  -frames:v 1 \
  "$POSTER_OUT" >/dev/null 2>&1

printf 'gif: %s\nposter: %s\n' "$GIF_OUT" "$POSTER_OUT"
