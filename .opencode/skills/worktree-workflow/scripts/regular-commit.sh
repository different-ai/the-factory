#!/usr/bin/env bash
set -euo pipefail

MESSAGE=${1:-}
if [[ -z "$MESSAGE" ]]; then
  echo "Usage: regular-commit.sh \"message describing why\""
  exit 1
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "No changes to commit."
  exit 0
fi

git add -A
git commit -m "$MESSAGE"
git push -u origin HEAD
