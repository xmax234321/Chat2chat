#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
ALTSTORE_DIR="$ROOT/deploy/altstore"
MANIFEST="$ALTSTORE_DIR/versions.manifest.json"
BASE_URL="${ALTSTORE_BASE_URL:-https://api.chat2chat.org/altstore}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing $MANIFEST" >&2
  exit 1
fi

LATEST_VERSION="$(python3 -c "import json; m=json.load(open('$MANIFEST')); print(m['latest'])")"
LATEST_IPA="$(python3 -c "
import json
m=json.load(open('$MANIFEST'))
v=next(x for x in m['versions'] if x.get('channel','public')=='public' and x['version']=='$LATEST_VERSION')
print(v['ipaFile'])
")"
LATEST_LABEL="$(python3 -c "
import json
m=json.load(open('$MANIFEST'))
v=next(x for x in m['versions'] if x.get('channel','public')=='public' and x['version']=='$LATEST_VERSION')
print(v['label'])
")"

echo "==> Build IPA ($LATEST_LABEL)"
export BUILD_LABEL="Chat2Chat"
bash "$MOBILE/scripts/build-public-ios.sh"

IPA_SRC="$MOBILE/releases/public-build-1/Chat2Chat-public-build-1.ipa"
if [[ ! -f "$IPA_SRC" ]]; then
  IPA_SRC="$(find "$MOBILE/releases/public-build-1" -maxdepth 1 -name '*.ipa' | head -n 1)"
fi
if [[ ! -f "$IPA_SRC" ]]; then
  echo "IPA not found after build" >&2
  exit 1
fi

echo "==> App icon"
pnpm --filter chat2chat icons >/dev/null 2>&1 || pnpm icons
ICON_SRC="$ROOT/apps/web/public/brand/apple-touch-icon.png"

mkdir -p "$ALTSTORE_DIR"
cp "$IPA_SRC" "$ALTSTORE_DIR/$LATEST_IPA"
cp "$ICON_SRC" "$ALTSTORE_DIR/icon.png"

# Preserve archived builds listed in manifest (copy 1.0 from dist if missing)
OLD_IPA="$MOBILE/altstore/dist/Chat2Chat-public-build-1.ipa"
if [[ -f "$OLD_IPA" && ! -f "$ALTSTORE_DIR/Chat2Chat-1.0-build1.ipa" ]]; then
  cp "$OLD_IPA" "$ALTSTORE_DIR/Chat2Chat-1.0-build1.ipa"
  echo "Archived: Chat2Chat-1.0-build1.ipa"
fi

echo "==> Generate source.json"
node "$MOBILE/scripts/generate-altstore-source.mjs"

echo "==> Verify IPA SHA256 checksums"
node -e "
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const source = JSON.parse(fs.readFileSync('$ALTSTORE_DIR/source.json', 'utf8'));
const versions = source.apps[0].versions;
let ok = true;
for (const v of versions) {
  const ipaName = path.basename(v.downloadURL);
  const ipaPath = path.join('$ALTSTORE_DIR', ipaName);
  if (!fs.existsSync(ipaPath)) {
    console.error('Missing IPA:', ipaName);
    ok = false;
    continue;
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(ipaPath)).digest('hex');
  if (hash !== v.sha256) {
    console.error('SHA256 mismatch for', ipaName);
    console.error('  expected:', v.sha256);
    console.error('  actual:  ', hash);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('All IPA SHA256 checksums verified');
"

echo ""
echo "AltStore bundle ready: $ALTSTORE_DIR/"
ls -lh "$ALTSTORE_DIR"/*.ipa 2>/dev/null || true
echo ""
echo "Source: $BASE_URL/source.json"
echo "Deploy: bash deploy/regru/deploy-landing.sh"
