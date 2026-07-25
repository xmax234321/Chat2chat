#!/usr/bin/env bash
# DEPRECATED: IP-only relay without TLS (ws://IP:3847). Use deploy-domain-to-vps.sh + api.chat2chat.org instead.
# Запуск с вашего Mac:
#   export VPS_HOST=80.78.245.103
#   export VPS_USER=root
#   export VPS_PASSWORD='ваш-пароль'
#   bash deploy/regru/deploy-to-vps.sh
set -euo pipefail

VPS_HOST="${VPS_HOST:?Укажите VPS_HOST}"
VPS_USER="${VPS_USER:-root}"
APP_DIR="${APP_DIR:-/opt/chat2chat}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if ! command -v sshpass &>/dev/null; then
  echo "Установите sshpass: brew install hudochenkov/sshpass/sshpass"
  echo "Или подключитесь по SSH-ключу без пароля."
  exit 1
fi

if [[ -z "${VPS_PASSWORD:-}" ]]; then
  echo "Укажите VPS_PASSWORD в окружении (пароль не сохраняется в файлы)"
  exit 1
fi

SSH="sshpass -p \"$VPS_PASSWORD\" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
RSYNC="sshpass -p \"$VPS_PASSWORD\" rsync -az --delete"

echo "==> Проверка SSH..."
eval "$SSH" "echo OK && uname -a"

echo "==> Установка Docker (если нет)..."
eval "$SSH" "command -v docker >/dev/null || (apt-get update -qq && apt-get install -y docker.io docker-compose-plugin)"
eval "$SSH" "systemctl enable --now docker 2>/dev/null || service docker start 2>/dev/null || true"

echo "==> Копирование проекта..."
eval "$RSYNC" \
  --exclude node_modules --exclude .git --exclude dist --exclude '*.db' \
  "$REPO_ROOT/" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/"

echo "==> Сборка и запуск relay..."
eval "$SSH" "cd ${APP_DIR} && docker compose -f deploy/regru/docker-compose.ip.yml up -d --build"

echo "==> Проверка API..."
sleep 5
curl -sf "http://${VPS_HOST}:3847/api/v1/health" && echo ""

echo ""
echo "============================================"
echo "  DEPRECATED: plain HTTP relay on port 3847"
echo "  Prefer wss://api.chat2chat.org/ws (see deploy-domain-to-vps.sh)"
echo "============================================"
echo "  Relay:     http://${VPS_HOST}:3847"
echo "  Health:    http://${VPS_HOST}:3847/api/v1/health"
echo "  WebSocket: ws://${VPS_HOST}:3847/ws"
echo ""
echo "  Old clients below 1.4.2 (build 50) are rejected at register."
echo "============================================"
