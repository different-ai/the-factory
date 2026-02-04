#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <worktree-name> [worktree-name ...]" >&2
  exit 1
fi

REPO_ROOT="${REPO_ROOT:-/Users/benjaminshafii/openwork-enterprise/_repos/openwork}"
BASE_BRANCH="${BASE_BRANCH:-dev}"
WORKTREE_BASE="${WORKTREE_BASE:-$REPO_ROOT/_worktrees}"

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
