#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <image-path>" >&2
  exit 1
fi

IMAGE="$1"
if [[ ! -f "$IMAGE" ]]; then
  echo "File not found: $IMAGE" >&2
  exit 1
fi

curl -s -F "reqtype=fileupload" -F "fileToUpload=@$IMAGE" https://catbox.moe/user/api.php
