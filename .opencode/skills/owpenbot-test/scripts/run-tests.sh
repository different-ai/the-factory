#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${SKILL_DIR}/.env"
REPO_ROOT="$(cd "${SKILL_DIR}/../../.." && pwd)"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing ${name}. Set it in ${ENV_FILE} or your environment." >&2
    exit 1
  fi
}

pick_latest_dir() {
  local dir="$1"
  local latest=""
  if [[ -d "${dir}" ]]; then
    latest=$(ls -td "${dir}"/* 2>/dev/null | head -n 1 || true)
  fi
  if [[ -n "${latest}" && -d "${latest}" ]]; then
    echo "${latest}"
    return 0
  fi
  return 1
}

if [[ -z "${OWPENBOT_DIR:-}" ]]; then
  if latest=$(pick_latest_dir "${REPO_ROOT}/_repos/owpenbot/_worktrees"); then
    OWPENBOT_DIR="${latest}"
  elif [[ -d "${REPO_ROOT}/_repos/owpenbot" ]]; then
    OWPENBOT_DIR="${REPO_ROOT}/_repos/owpenbot"
  fi
fi

if [[ -z "${OPENWORK_DIR:-}" ]]; then
  if latest=$(pick_latest_dir "${REPO_ROOT}/_worktrees"); then
    if [[ -f "${latest}/pnpm-workspace.yaml" ]]; then
      OPENWORK_DIR="${latest}"
    elif [[ -d "${latest}/_repos/openwork" ]]; then
      OPENWORK_DIR="${latest}/_repos/openwork"
    fi
  fi
  if [[ -z "${OPENWORK_DIR:-}" && -d "${REPO_ROOT}/_repos/openwork" ]]; then
    OPENWORK_DIR="${REPO_ROOT}/_repos/openwork"
  fi
fi

require_var OWPENBOT_DIR
require_var OPENWORK_DIR
require_var OWPENBOT_TEST_TOKEN_ENV
require_var OWPENBOT_TEST_TOKEN_CLI

if [[ ! -d "${OWPENBOT_DIR}" ]]; then
  echo "OWPENBOT_DIR not found: ${OWPENBOT_DIR}" >&2
  exit 1
fi

if [[ ! -d "${OPENWORK_DIR}" ]]; then
  echo "OPENWORK_DIR not found: ${OPENWORK_DIR}" >&2
  exit 1
fi

echo "Running owpenbot tests..."
echo "Using owpenbot repo: ${OWPENBOT_DIR}"
pnpm -C "${OWPENBOT_DIR}" test:unit
pnpm -C "${OWPENBOT_DIR}" test:cli
pnpm -C "${OWPENBOT_DIR}" test:npx
pnpm -C "${OWPENBOT_DIR}" test:smoke

echo "Running openwrk tests..."
echo "Using openwork repo: ${OPENWORK_DIR}"
pnpm -C "${OPENWORK_DIR}" test:openwrk
