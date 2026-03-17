#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

set -a
. "$ROOT_DIR/.env.e2e"
set +a

JEST_E2E_CONFIG="${JEST_E2E_CONFIG:-./test/jest-e2e.json}"

pnpm exec jest --config "$JEST_E2E_CONFIG" --runInBand "$@"
