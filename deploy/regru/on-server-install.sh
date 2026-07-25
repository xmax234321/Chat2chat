#!/usr/bin/env bash
# Если SSH с Mac не работает — выполните ЭТО на сервере через консоль REG.RU
# (reg.cloud → ваш сервер → Консоль / VNC)
set -euo pipefail

apt-get update -qq
apt-get install -y git docker.io docker-compose-plugin curl
systemctl enable --now docker

mkdir -p /opt/chat2chat
cd /opt/chat2chat

# Если проект ещё не загружен — создайте минимальный relay через готовый образ после rsync с Mac
# Либо вставьте сюда git clone вашего репозитория

if [[ ! -f deploy/regru/docker-compose.ip.yml ]]; then
  echo "Сначала загрузите проект с Mac:"
  echo "  rsync -avz --exclude node_modules ./Chat2chat\\ extreme/ root@80.78.245.103:/opt/chat2chat/"
  exit 1
fi

docker compose -f deploy/regru/docker-compose.ip.yml up -d --build

echo "OK: curl http://localhost:3847/api/v1/health"
