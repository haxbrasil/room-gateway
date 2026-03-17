#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

set -a
. "$ROOT_DIR/.env.e2e"
set +a

cleanup() {
  docker compose -f "$ROOT_DIR/docker-compose.e2e.yml" down -v
}

trap cleanup EXIT

docker compose -f "$ROOT_DIR/docker-compose.e2e.yml" up -d

ready=false
for attempt in $(seq 1 30); do
  if docker compose -f "$ROOT_DIR/docker-compose.e2e.yml" exec -T redis-e2e redis-cli ping >/dev/null 2>&1; then
    ready=true
    break
  fi

  sleep 1
done

if [ "$ready" != "true" ]; then
  docker compose -f "$ROOT_DIR/docker-compose.e2e.yml" exec -T redis-e2e redis-cli ping
  exit 1
fi

bash ./test/run-e2e.sh "$@"
