#!/usr/bin/env bash
# Первичная настройка VPS REG.RU (Ubuntu 22.04/24.04 + шаблон Docker)
# Запуск на сервере: curl -fsSL ... | bash  ИЛИ  bash deploy/regru/bootstrap.sh
set -euo pipefail

echo "==> Chat2Chat — bootstrap REG.RU Cloud"

if ! command -v docker &>/dev/null; then
  echo "Docker не найден. Установите шаблон «Docker» при создании VPS на reg.cloud"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "==> Установка docker compose plugin..."
  apt-get update -qq
  apt-get install -y docker-compose-plugin
fi

APP_DIR="${APP_DIR:-/opt/chat2chat}"
REPO_URL="${REPO_URL:-}"

if [[ -d "$APP_DIR/.git" ]]; then
  echo "==> Обновление репозитория в $APP_DIR"
  git -C "$APP_DIR" pull --ff-only
else
  if [[ -z "$REPO_URL" ]]; then
    echo "Укажите REPO_URL или скопируйте проект в $APP_DIR вручную (scp/rsync)"
    echo "  export REPO_URL=git@github.com:you/chat2chat.git"
    echo "  export APP_DIR=/opt/chat2chat"
    exit 1
  fi
  echo "==> Клонирование $REPO_URL → $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR/deploy/regru"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ""
  echo "!!! Отредактируйте $APP_DIR/deploy/regru/.env (DOMAIN, ACME_EMAIL)"
  echo "    nano $APP_DIR/deploy/regru/.env"
  echo ""
  exit 0
fi

# shellcheck source=/dev/null
source .env

if [[ "$DOMAIN" == *example* ]]; then
  echo "!!! Замените DOMAIN в .env на ваш реальный домен"
  exit 1
fi

echo "==> Сборка и запуск (relay + web + HTTPS)..."
docker compose -f docker-compose.prod.yml --env-file .env --profile full up -d --build

echo ""
echo "Готово. Проверка:"
echo "  curl https://${DOMAIN}/api/v1/health"
echo "  curl https://${DOMAIN}/api/v1/stats"
