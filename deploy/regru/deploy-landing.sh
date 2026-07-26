#!/usr/bin/env bash
# Деплой лендинга на chat2chat.org (тот же VPS, что и api relay)
#
# Запуск с Mac:
#   bash deploy/regru/deploy-landing.sh
#
# Нужны VPS_HOST, VPS_PASSWORD в deploy/regru/.env (или в окружении).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/deploy/regru/.env"

if [[ -f "$ENV_FILE" ]]; then
  _ENV_VPS_PASSWORD="${VPS_PASSWORD:-}"
  _ENV_SMTP_USER="${SMTP_USER:-}"
  _ENV_SMTP_PASS="${SMTP_PASS:-}"
  _ENV_SMTP_FROM="${SMTP_FROM:-}"
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
  if [[ -n "$_ENV_VPS_PASSWORD" ]]; then
    VPS_PASSWORD="$_ENV_VPS_PASSWORD"
  fi
  if [[ -n "$_ENV_SMTP_USER" ]]; then SMTP_USER="$_ENV_SMTP_USER"; fi
  if [[ -n "$_ENV_SMTP_PASS" ]]; then SMTP_PASS="$_ENV_SMTP_PASS"; fi
  if [[ -n "$_ENV_SMTP_FROM" ]]; then SMTP_FROM="$_ENV_SMTP_FROM"; fi
fi

VPS_HOST="${VPS_HOST:-161.104.17.85}"
VPS_USER="${VPS_USER:-root}"
APP_DIR="${APP_DIR:-/opt/chat2chat}"
SITE_DOMAIN="${SITE_DOMAIN:-chat2chat.org}"
DOMAIN="${DOMAIN:-api.chat2chat.org}"
ACME_EMAIL="${ACME_EMAIL:?Укажите ACME_EMAIL в deploy/regru/.env}"

if ! command -v sshpass &>/dev/null; then
  if ! command -v expect &>/dev/null; then
    echo "Установите sshpass: brew install hudochenkov/sshpass/sshpass"
    exit 1
  fi
  USE_EXPECT=1
fi


rsync_with_auth() {
  local src="$1" dest="$2"
  shift 2
  local extra_flags=()
  if (($# > 0)); then
    extra_flags=("$@")
  fi
  if [[ -n "${USE_EXPECT:-}" ]]; then
  export _RSYNC_SRC="$src"
  export _RSYNC_DEST="$dest"
  if ((${#extra_flags[@]} > 0)); then
    _RSYNC_EXTRA="${extra_flags[*]}"
  else
    _RSYNC_EXTRA=""
  fi
  export _RSYNC_EXTRA
    expect <<'EOF'
set timeout 300
set src $env(_RSYNC_SRC)
set dest $env(_RSYNC_DEST)
set cmd [list rsync -az]
if {[info exists env(_RSYNC_EXTRA)] && $env(_RSYNC_EXTRA) ne ""} {
  foreach flag [split $env(_RSYNC_EXTRA) " "] {
    if {$flag ne ""} { lappend cmd $flag }
  }
}
lappend cmd $src $dest
eval spawn $cmd
expect {
  "password:" { send "$env(VPS_PASSWORD)\r"; exp_continue }
  "Password:" { send "$env(VPS_PASSWORD)\r"; exp_continue }
  eof
}
catch wait result
exit [lindex $result 3]
EOF
  else
    if ((${#extra_flags[@]} > 0)); then
      eval "$RSYNC" "${extra_flags[@]}" "$src" "$dest"
    else
      eval "$RSYNC" "$src" "$dest"
    fi
  fi
}

ssh_with_auth() {
  local remote_cmd="$1"
  if [[ -n "${USE_EXPECT:-}" ]]; then
    expect <<EOF
set timeout 120
spawn ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} $remote_cmd
expect {
  "password:" { send "$VPS_PASSWORD\r"; exp_continue }
  "Password:" { send "$VPS_PASSWORD\r"; exp_continue }
  eof
}
EOF
  else
    eval "$SSH" bash -s <<REMOTE
$remote_cmd
REMOTE
  fi
}

if [[ -z "${VPS_PASSWORD:-}" ]]; then
  if command -v osascript &>/dev/null; then
    VPS_PASSWORD="$(osascript -e 'Tell application "System Events" to display dialog "Пароль root для VPS (161.104.17.85):" default answer "" with hidden answer buttons {"Отмена", "OK"} default button "OK"' -e 'text returned of result' 2>/dev/null || true)"
  fi
fi

if [[ -z "${VPS_PASSWORD:-}" ]]; then
  echo "Укажите VPS_PASSWORD в deploy/regru/.env"
  exit 1
fi

export VPS_PASSWORD

if [[ ! -f "$REPO_ROOT/deploy/landing/index.html" ]]; then
  echo "Нет deploy/landing/index.html — сначала соберите лендинг"
  exit 1
fi

SSH="sshpass -p \"$VPS_PASSWORD\" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
RSYNC="sshpass -p \"$VPS_PASSWORD\" rsync -az"

echo "==> Сборка сайта + downloads + altstore..."
cd "$REPO_ROOT"
pnpm build:website
bash "$REPO_ROOT/deploy/scripts/build-site-release.sh"

if [[ -f "$REPO_ROOT/deploy/altstore/versions.manifest.json" ]]; then
  node "$REPO_ROOT/apps/mobile/scripts/generate-altstore-source.mjs" 2>/dev/null || true
fi

echo "==> DNS: $SITE_DOMAIN → $(dig +short "$SITE_DOMAIN" A | tail -1) (VPS $VPS_HOST)"

echo "==> Копирование лендинга, altstore и конфигов..."
rsync_with_auth \
  "$REPO_ROOT/deploy/landing/" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/deploy/landing/"
echo "==> AltStore: полная синхронизация (старые IPA удаляются с сервера)..."
rsync_with_auth \
  "$REPO_ROOT/deploy/altstore/" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/deploy/altstore/" --delete
rsync_with_auth \
  "$REPO_ROOT/deploy/regru/Caddyfile.relay-and-landing" \
  "${VPS_USER}@${VPS_HOST}:${APP_DIR}/deploy/regru/Caddyfile.relay-and-landing"
rsync_with_auth \
  "$REPO_ROOT/deploy/regru/docker-compose.relay-only.yml" \
  "${VPS_USER}@${VPS_HOST}:${APP_DIR}/deploy/regru/docker-compose.relay-only.yml"

echo "==> Sync relay source..."
rsync_with_auth \
  "$REPO_ROOT/apps/server/" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/apps/server/" \
  --exclude node_modules --exclude dist
rsync_with_auth \
  "$REPO_ROOT/packages/protocol/" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/packages/protocol/" \
  --exclude node_modules --exclude dist
rsync_with_auth \
  "$REPO_ROOT/packages/crypto/" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/packages/crypto/" \
  --exclude node_modules --exclude dist
for f in package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json; do
  rsync_with_auth "$REPO_ROOT/$f" "${VPS_USER}@${VPS_HOST}:${APP_DIR}/$f"
done

SMTP_FROM="${SMTP_FROM:-no-reply@chat2chat.org}"
SMTP_USER="${SMTP_USER:-no-reply@chat2chat.org}"
MIN_CLIENT_VERSION="${MIN_CLIENT_VERSION:-1.5.3}"
MIN_CLIENT_BUILD="${MIN_CLIENT_BUILD:-57}"
ENFORCE_MIN_CLIENT_VERSION="${ENFORCE_MIN_CLIENT_VERSION:-true}"

echo "==> Обновление .env, rebuild relay и перезапуск Caddy..."
REMOTE_CMD="set -euo pipefail; cd ${APP_DIR}/deploy/regru; touch .env; grep -q '^SITE_DOMAIN=' .env && sed -i 's/^SITE_DOMAIN=.*/SITE_DOMAIN=${SITE_DOMAIN}/' .env || echo SITE_DOMAIN=${SITE_DOMAIN} >> .env; grep -q '^DOMAIN=' .env || echo DOMAIN=${DOMAIN} >> .env; grep -q '^ACME_EMAIL=' .env || echo ACME_EMAIL=${ACME_EMAIL} >> .env; grep -q '^SMTP_HOST=' .env || echo SMTP_HOST=smtp.mail.ru >> .env; grep -q '^SMTP_PORT=' .env || echo SMTP_PORT=465 >> .env; grep -q '^SMTP_SECURE=' .env || echo SMTP_SECURE=true >> .env; sed -i 's/^SMTP_FROM=.*/SMTP_FROM=${SMTP_FROM}/' .env || echo SMTP_FROM=${SMTP_FROM} >> .env; sed -i 's/^SMTP_USER=.*/SMTP_USER=${SMTP_USER}/' .env || echo SMTP_USER=${SMTP_USER} >> .env; grep -q '^MIN_CLIENT_VERSION=' .env && sed -i 's/^MIN_CLIENT_VERSION=.*/MIN_CLIENT_VERSION=${MIN_CLIENT_VERSION}/' .env || echo MIN_CLIENT_VERSION=${MIN_CLIENT_VERSION} >> .env; grep -q '^MIN_CLIENT_BUILD=' .env && sed -i 's/^MIN_CLIENT_BUILD=.*/MIN_CLIENT_BUILD=${MIN_CLIENT_BUILD}/' .env || echo MIN_CLIENT_BUILD=${MIN_CLIENT_BUILD} >> .env; grep -q '^ENFORCE_MIN_CLIENT_VERSION=' .env && sed -i 's/^ENFORCE_MIN_CLIENT_VERSION=.*/ENFORCE_MIN_CLIENT_VERSION=${ENFORCE_MIN_CLIENT_VERSION}/' .env || echo ENFORCE_MIN_CLIENT_VERSION=${ENFORCE_MIN_CLIENT_VERSION} >> .env; grep -q '^MAX_BLOB_SIZE=' .env && sed -i 's/^MAX_BLOB_SIZE=.*/MAX_BLOB_SIZE=104857600/' .env || echo MAX_BLOB_SIZE=104857600 >> .env; grep -q '^CORS_ORIGIN=' .env && sed -i 's/^CORS_ORIGIN=.*/CORS_ORIGIN=https:\\/\\/chat2chat.org,https:\\/\\/app.chat2chat.org,capacitor:\\/\\/localhost/' .env || echo 'CORS_ORIGIN=https://chat2chat.org,https://app.chat2chat.org,capacitor://localhost' >> .env"
if [[ -n "${SMTP_PASS:-}" ]]; then
  REMOTE_CMD="${REMOTE_CMD}; sed -i 's/^SMTP_PASS=.*/SMTP_PASS=${SMTP_PASS}/' .env || echo SMTP_PASS=${SMTP_PASS} >> .env"
fi
REMOTE_CMD="${REMOTE_CMD}; docker compose -f docker-compose.relay-only.yml --env-file .env up -d --build relay; docker compose -f docker-compose.relay-only.yml --env-file .env up -d --force-recreate caddy"
if [[ -n "${USE_EXPECT:-}" ]]; then
  expect <<EOF
set timeout 180
spawn ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} bash -lc {$REMOTE_CMD}
expect {
  "password:" { send "$VPS_PASSWORD\r"; exp_continue }
  "Password:" { send "$VPS_PASSWORD\r"; exp_continue }
  eof
}
EOF
else
  eval "$SSH" bash -lc "\"$REMOTE_CMD\""
fi

echo "==> Ожидание HTTPS для $SITE_DOMAIN..."
for i in $(seq 1 18); do
  if curl -sf "https://${SITE_DOMAIN}/download/" | grep -q 'Get Chat2Chat'; then
    break
  fi
  sleep 5
done

echo "==> Проверка AltStore IPA на сервере..."
LATEST_IPA="$(python3 -c "import json; m=json.load(open('$REPO_ROOT/deploy/altstore/versions.manifest.json')); v=next(x for x in m['versions'] if x['version']==m['latest']); print(v['ipaFile'])")"
EXPECTED_SIZE="$(stat -f%z "$REPO_ROOT/deploy/altstore/$LATEST_IPA" 2>/dev/null || stat -c%s "$REPO_ROOT/deploy/altstore/$LATEST_IPA")"
ACTUAL_SIZE="$(curl -sfI "https://${DOMAIN}/altstore/${LATEST_IPA}" | awk -F': ' 'tolower($1)=="content-length" {gsub(/\r/,"",$2); print $2}')"
if [[ -z "$ACTUAL_SIZE" || "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]]; then
  echo ""
  echo "ОШИБКА: AltStore на сервере не обновился."
  echo "  Ожидался ${LATEST_IPA}: ${EXPECTED_SIZE} bytes"
  echo "  На сервере: ${ACTUAL_SIZE:-недоступен} bytes"
  echo "  SSH на ${VPS_HOST}:22 недоступен? Включите sshd в консоли REG.RU и повторите деплой."
  exit 1
fi

if curl -sf "https://${SITE_DOMAIN}/download/" | grep -q 'Get Chat2Chat'; then
  echo ""
  echo "============================================"
  echo "  Лендинг:  https://${SITE_DOMAIN}/"
  echo "  Download: https://${SITE_DOMAIN}/download/"
  echo "  Web app:  (not supported — use native apps)"
  echo "  AltStore: https://${DOMAIN}/altstore/source.json"
  echo "  Relay:    https://${DOMAIN}/api/v1/health"
  echo "  IPA:      https://${DOMAIN}/altstore/${LATEST_IPA} (${ACTUAL_SIZE} bytes)"
  echo "============================================"
  exit 0
fi

echo "Caddy ещё получает сертификат для ${SITE_DOMAIN}."
echo "Проверьте A-запись ${SITE_DOMAIN} → ${VPS_HOST} и порты 80/443."
exit 1
