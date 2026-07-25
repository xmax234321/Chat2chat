#!/usr/bin/env bash
# Деплой relay + Caddy (HTTPS) на VPS REG.RU с доменом api.chat2chat.org
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/deploy/regru/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi

VPS_HOST="${VPS_HOST:?Укажите VPS_HOST в deploy/regru/.env}"
VPS_USER="${VPS_USER:-root}"
DOMAIN="${DOMAIN:?Укажите DOMAIN}"
ACME_EMAIL="${ACME_EMAIL:?Укажите ACME_EMAIL}"
APP_DIR="${APP_DIR:-/opt/chat2chat}"
SITE_DOMAIN="${SITE_DOMAIN:-chat2chat.org}"

SMTP_HOST="${SMTP_HOST:-smtp.mail.ru}"
SMTP_PORT="${SMTP_PORT:-465}"
SMTP_SECURE="${SMTP_SECURE:-true}"
SMTP_USER="${SMTP_USER:-code@chat2chat.org}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_FROM="${SMTP_FROM:-no-reply@chat2chat.org}"
MAX_BLOB_SIZE="${MAX_BLOB_SIZE:-536870912}"
MIN_CLIENT_VERSION="${MIN_CLIENT_VERSION:-1.5}"
MIN_CLIENT_BUILD="${MIN_CLIENT_BUILD:-52}"
ENFORCE_MIN_CLIENT_VERSION="${ENFORCE_MIN_CLIENT_VERSION:-true}"

USE_EXPECT=""
if ! command -v sshpass &>/dev/null; then
  if command -v expect &>/dev/null; then
    USE_EXPECT=1
  else
    echo "Установите sshpass или expect"
    exit 1
  fi
fi

if [[ -z "${VPS_PASSWORD:-}" ]]; then
  if command -v osascript &>/dev/null; then
    VPS_PASSWORD="$(osascript -e 'Tell application "System Events" to display dialog "Пароль root для VPS ('"${VPS_HOST}"'):" default answer "" with hidden answer buttons {"Отмена", "OK"} default button "OK"' -e 'text returned of result' 2>/dev/null || true)"
  fi
fi

if [[ -z "${VPS_PASSWORD:-}" ]]; then
  echo "Укажите VPS_PASSWORD в deploy/regru/.env"
  exit 1
fi

export VPS_PASSWORD

rsync_with_auth() {
  local src="$1" dest="$2"
  shift 2
  if [[ -n "$USE_EXPECT" ]]; then
    export _RSYNC_SRC="$src" _RSYNC_DEST="$dest" _RSYNC_EXTRA="${*:-}"
    expect <<'EOF'
set timeout 600
set cmd [list rsync -az --delete]
if {[info exists env(_RSYNC_EXTRA)] && $env(_RSYNC_EXTRA) ne ""} {
  foreach flag [split $env(_RSYNC_EXTRA) " "] {
    if {$flag ne ""} { lappend cmd $flag }
  }
}
lappend cmd $env(_RSYNC_SRC) $env(_RSYNC_DEST)
spawn {*}$cmd
expect {
  "password:" { send "$env(VPS_PASSWORD)\r"; exp_continue }
  "Password:" { send "$env(VPS_PASSWORD)\r"; exp_continue }
  eof
}
EOF
  else
    sshpass -p "$VPS_PASSWORD" rsync -az --delete "$@" "$src" "$dest"
  fi
}

ssh_with_auth() {
  local remote_cmd="$1"
  if [[ -n "$USE_EXPECT" ]]; then
    expect <<EOF
set timeout 600
spawn ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} bash -lc {$remote_cmd}
expect {
  "password:" { send "$VPS_PASSWORD\r"; exp_continue }
  "Password:" { send "$VPS_PASSWORD\r"; exp_continue }
  eof
}
EOF
  else
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" bash -lc "$remote_cmd"
  fi
}

echo "==> DNS: $DOMAIN → $(dig +short "$DOMAIN" A | tail -1) (VPS $VPS_HOST)"

echo "==> Копирование проекта..."
rsync_with_auth "$REPO_ROOT/" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/" \
  --exclude node_modules --exclude .git --exclude dist --exclude '*.db'

REMOTE_CMD="set -euo pipefail
cd ${APP_DIR}/deploy/regru
cat > .env <<ENVEOF
DOMAIN=${DOMAIN}
SITE_DOMAIN=${SITE_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
CORS_ORIGIN=true
MESSAGE_TTL_MS=86400000
BLOB_TTL_MS=86400000
MAX_BLOB_SIZE=${MAX_BLOB_SIZE}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}
DATA_DIR=/app/data
MIN_CLIENT_VERSION=${MIN_CLIENT_VERSION}
MIN_CLIENT_BUILD=${MIN_CLIENT_BUILD}
ENFORCE_MIN_CLIENT_VERSION=${ENFORCE_MIN_CLIENT_VERSION}
ENVEOF
docker compose -f docker-compose.ip.yml down 2>/dev/null || true
docker compose -f docker-compose.relay-only.yml --env-file .env up -d --build"

echo "==> Сборка и запуск relay + Caddy..."
ssh_with_auth "$REMOTE_CMD"

echo "==> Ожидание HTTPS..."
for i in $(seq 1 12); do
  HEALTH="$(curl -sf "https://${DOMAIN}/api/v1/health" 2>/dev/null || true)"
  if [[ -n "$HEALTH" ]]; then
    echo "$HEALTH"
    if echo "$HEALTH" | grep -q minClientVersion; then
      echo ""
      echo "============================================"
      echo "  Relay:     https://${DOMAIN}"
      echo "  WebSocket: wss://${DOMAIN}/ws"
      echo "  Min client: ${MIN_CLIENT_VERSION} build ${MIN_CLIENT_BUILD}"
      echo "============================================"
      exit 0
    fi
    echo "(health ok, waiting for new relay image...)"
  fi
  sleep 5
done

echo "Деплой завершён, но minClientVersion ещё не в health — проверьте логи:"
echo "  ssh ${VPS_USER}@${VPS_HOST} docker compose -f ${APP_DIR}/deploy/regru/docker-compose.relay-only.yml logs relay"
exit 1
