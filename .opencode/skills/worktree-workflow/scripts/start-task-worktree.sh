#!/usr/bin/env bash
set -euo pipefail

TASK_NAME=${1:-}
if [[ -z "$TASK_NAME" ]]; then
  echo "Usage: start-task-worktree.sh \"task-name\""
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTERPRISE_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

BASE_BRANCH=${BASE_BRANCH:-main}
WORKTREES_DIR=${WORKTREES_DIR:-$ENTERPRISE_ROOT/_worktrees}

SAFE_TASK_NAME=$(echo "$TASK_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
BRANCH_NAME="task/${SAFE_TASK_NAME}"
WORKTREE_PATH="${WORKTREES_DIR}/${SAFE_TASK_NAME}"

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo "Branch already exists: ${BRANCH_NAME}"
  exit 1
fi

if git show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
  BASE_REF="origin/${BASE_BRANCH}"
else
  BASE_REF="${BASE_BRANCH}"
fi

mkdir -p "${WORKTREES_DIR}"
git worktree add "${WORKTREE_PATH}" -b "${BRANCH_NAME}" "${BASE_REF}"

git -C "${WORKTREE_PATH}" submodule update --init --recursive

echo "Worktree created at ${WORKTREE_PATH} on ${BRANCH_NAME}"
