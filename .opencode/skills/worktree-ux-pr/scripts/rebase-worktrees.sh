#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <worktree-name> [worktree-name ...]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTERPRISE_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

REPO_ROOT="${REPO_ROOT:-$ENTERPRISE_ROOT/_repos/openwork}"
BASE_BRANCH="${BASE_BRANCH:-dev}"
WORKTREE_BASE="${WORKTREE_BASE:-$ENTERPRISE_ROOT/_worktrees}"

cd "$REPO_ROOT"
git fetch origin

for WT in "$@"; do
  WT_PATH="$WORKTREE_BASE/$WT"
  if [[ ! -d "$WT_PATH" ]]; then
    echo "Missing worktree: $WT_PATH" >&2
    exit 1
  fi
  echo "== Rebase $WT =="
  git -C "$WT_PATH" rebase "origin/$BASE_BRANCH"
  git -C "$WT_PATH" push --force-with-lease
  echo
  done
