#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
IOS_APP="$MOBILE/ios/App"
WORKSPACE="$IOS_APP/App.xcworkspace"
SCHEME="App"
BUILD_LABEL="${BUILD_LABEL:-Chat2Chat}"
ARCHIVE_PATH="$MOBILE/build/Chat2Chat-public-build-1.xcarchive"
EXPORT_DIR="$MOBILE/releases/public-build-1"
EXPORT_TESTFLIGHT="$MOBILE/ios/ExportOptions.plist"
EXPORT_DEV="$MOBILE/ios/ExportOptions-development.plist"
IPA_OUT="$EXPORT_DIR/Chat2Chat-public-build-1.ipa"

echo "==> Sync web assets (build: $BUILD_LABEL)"
cd "$ROOT"
export VITE_APP_BUILD_ID="$BUILD_LABEL"
pnpm --filter @chat2chat/mobile build:public

echo "==> Install CocoaPods"
cd "$IOS_APP"
pod install

echo "==> Archive iOS app"
rm -rf "$ARCHIVE_PATH"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  archive

echo "==> Export IPA"
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

# xcodebuild export fails when the archive path contains spaces (ditto realpath).
ARCHIVE_FOR_EXPORT="$ARCHIVE_PATH"
if [[ "$ARCHIVE_PATH" == *" "* ]]; then
  ARCHIVE_FOR_EXPORT="/tmp/Chat2Chat-public-build-1.xcarchive"
  echo "Archive path has spaces — copying to $ARCHIVE_FOR_EXPORT for export"
  rm -rf "$ARCHIVE_FOR_EXPORT"
  cp -R "$ARCHIVE_PATH" "$ARCHIVE_FOR_EXPORT"
fi

if xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_FOR_EXPORT" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_TESTFLIGHT" 2>/dev/null; then
  echo "Exported with TestFlight profile."
else
  echo "TestFlight export needs an iOS Distribution certificate."
  echo "Falling back to development export (install on registered devices)."
  xcodebuild \
    -exportArchive \
    -archivePath "$ARCHIVE_FOR_EXPORT" \
    -exportPath "$EXPORT_DIR" \
    -exportOptionsPlist "$EXPORT_DEV"
fi

IPA="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -n 1)"
if [[ -z "$IPA" ]]; then
  echo "Export finished but no .ipa was found in $EXPORT_DIR" >&2
  exit 1
fi

cp "$IPA" "$IPA_OUT"
DESKTOP_IPA="$HOME/Desktop/Chat2Chat-1.4.ipa"
cp "$IPA" "$DESKTOP_IPA"
echo ""
echo "Done: $IPA_OUT"
echo "Desktop: $DESKTOP_IPA"
echo "Build label in app: $BUILD_LABEL"
echo ""
echo "Install on a registered iPhone: AirDrop the .ipa or use Apple Configurator."
echo "AltStore (free Apple ID): see apps/mobile/docs/ALTSTORE.md — pnpm ios:altstore"
echo "For TestFlight: upload after adding an iOS Distribution certificate."
