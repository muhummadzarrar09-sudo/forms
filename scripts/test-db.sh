#!/usr/bin/env bash
set -euo pipefail

# Isolated PostgreSQL lifecycle for local/CI integration tests.
# This script intentionally uses Prisma db push only against the disposable
# tmpfs database declared in docker-compose.test.yml — never production.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the isolated integration database." >&2
  exit 1
fi

case "${1:-up}" in
  up)
    docker compose -f docker-compose.test.yml up -d --wait
    export DATABASE_URL="postgresql://forms_test:forms_test@127.0.0.1:54329/forms_test?schema=public"
    export DIRECT_URL="$DATABASE_URL"
    bunx prisma db push --skip-generate
    ;;
  down)
    docker compose -f docker-compose.test.yml down --volumes --remove-orphans
    ;;
  reset)
    "$0" down
    "$0" up
    ;;
  *)
    echo "Usage: $0 [up|down|reset]" >&2
    exit 2
    ;;
esac
