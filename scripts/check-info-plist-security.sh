#!/usr/bin/env bash
# Fail CI if production iOS Info.plist allows insecure HTTP for non-local hosts
# or references the legacy plaintext relay IP.
set -euo pipefail

PLIST="${1:-apps/mobile/ios/App/App/Info.plist}"

if [[ ! -f "$PLIST" ]]; then
  echo "Info.plist not found: $PLIST" >&2
  exit 1
fi

fail() {
  echo "SECURITY: $1" >&2
  exit 1
}

if grep -q '161\.104\.17\.85' "$PLIST"; then
  fail "Info.plist must not reference legacy relay IP 161.104.17.85"
fi

# Allow NSExceptionAllowsInsecureHTTPLoads only for localhost (Capacitor live reload).
if grep -q '<key>NSExceptionAllowsInsecureHTTPLoads</key>' "$PLIST"; then
  domain="$(awk '
    /<key>NSExceptionDomains<\/key>/ { in_domains=1; next }
    in_domains && /<key>/ {
      gsub(/[[:space:]]*<key>|<\/key>/, "", $0)
      current=$0
      next
    }
    in_domains && /<key>NSExceptionAllowsInsecureHTTPLoads<\/key>/ {
      if (current != "localhost") {
        print current
        exit 1
      }
    }
  ' "$PLIST" || true)"
  if [[ -n "${domain:-}" ]]; then
    fail "NSExceptionAllowsInsecureHTTPLoads is only allowed for localhost, found: $domain"
  fi
fi

echo "Info.plist security check passed: $PLIST"
