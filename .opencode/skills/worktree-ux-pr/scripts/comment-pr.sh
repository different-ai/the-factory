#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <pr-number> <comment-body>" >&2
  exit 1
fi

PR_NUMBER="$1"
shift
COMMENT_BODY="$*"

gh pr comment "$PR_NUMBER" -R different-ai/openwork --body "$COMMENT_BODY"
