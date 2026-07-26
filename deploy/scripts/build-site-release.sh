#!/usr/bin/env bash
# Собирает статику для chat2chat.org: PWA (/app) и файлы загрузки (/downloads).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LANDING="$REPO_ROOT/deploy/landing"
ALTSTORE_SRC="$REPO_ROOT/apps/mobile/altstore/dist"
DESKTOP_ZIP="$REPO_ROOT/apps/desktop/release/Chat2Chat-0.1.0-arm64-mac.zip"

echo "==> Downloads → deploy/landing/downloads/"
mkdir -p "$LANDING/downloads"
if [[ -f "$DESKTOP_ZIP" ]]; then
  cp "$DESKTOP_ZIP" "$LANDING/downloads/Chat2Chat-mac-arm64.zip"
else
  echo "  (skip) нет $DESKTOP_ZIP — запусти pnpm build:desktop"
fi

echo "==> AltStore → deploy/altstore/"
mkdir -p "$REPO_ROOT/deploy/altstore"
if [[ -f "$ALTSTORE_SRC/Chat2Chat-public-build-1.ipa" ]]; then
  cp "$ALTSTORE_SRC/"* "$REPO_ROOT/deploy/altstore/"
else
  echo "  (skip) нет IPA — запусти pnpm ios:altstore"
fi

echo "==> Versions page → deploy/landing/download/versions/"
node "$REPO_ROOT/deploy/scripts/generate-versions-page.mjs"

echo "==> Готово: downloads/, altstore/, versions/"
