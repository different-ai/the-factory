#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

timestamp() {
  date "+%Y-%m-%dT%H:%M:%S%z"
}

has_origin() {
  git -C "$1" remote get-url origin >/dev/null 2>&1
}

current_branch() {
  git -C "$1" symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

is_dirty() {
  [[ -n "$(git -C "$1" status --porcelain)" ]]
}

update_repo() {
  local repo_path="$1"
  local branch

  printf '\n==> %s\n' "$repo_path"

  if [[ ! -e "$repo_path/.git" ]]; then
    printf 'skip: not an initialized git repo\n'
    return 0
  fi

  if ! has_origin "$repo_path"; then
    printf 'skip: no origin remote\n'
    return 0
  fi

  git -C "$repo_path" fetch origin --prune

  branch=$(current_branch "$repo_path")
  if [[ -z "$branch" ]]; then
    printf 'skip: detached HEAD\n'
    return 0
  fi

  if ! git -C "$repo_path" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    printf 'skip: origin/%s does not exist\n' "$branch"
    return 0
  fi

  if is_dirty "$repo_path"; then
    printf 'skip: dirty working tree\n'
    return 0
  fi

  git -C "$repo_path" pull --ff-only origin "$branch"
}

printf 'Start: %s\n' "$(timestamp)"

git fetch origin --prune
git submodule update --init --recursive

repos=(".")
while IFS= read -r submodule_path; do
  repos+=("$submodule_path")
done < <(git config --file .gitmodules --get-regexp path | while read -r _ path; do printf '%s\n' "$path"; done)

for repo in "${repos[@]}"; do
  update_repo "$repo"
done

printf '\nEnd: %s\n' "$(timestamp)"
