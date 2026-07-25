#!/usr/bin/env bash
# Обновление на уже настроенном сервере REG.RU
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-full}"  # full | relay

if [[ ! -f .env ]]; then
  echo "Создайте .env из .env.example"
  exit 1
fi

# shellcheck source=/dev/null
source .env

if [[ -d ../../.git ]]; then
  git -C ../.. pull --ff-only || true
fi

case "$MODE" in
  full)
    docker compose -f docker-compose.prod.yml --env-file .env --profile full up -d --build
    ;;
  relay)
    docker compose -f docker-compose.relay-only.yml --env-file .env up -d --build
    ;;
  *)
    echo "Usage: ./deploy.sh [full|relay]"
    exit 1
    ;;
esac

echo "OK — https://${DOMAIN}/api/v1/health"
