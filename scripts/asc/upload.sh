#!/usr/bin/env bash
# build/HaruSuhak-appstore.ipa → App Store Connect 업로드 (altool, ASC API 키)
# 키는 ~/.haku-env 의 ASC_KEY_ID · ASC_ISSUER_ID, .p8 은 ~/.appstoreconnect/private_keys/ 에서 altool 이 찾는다
set -euo pipefail
cd "$(dirname "$0")/../.."
IPA=build/HaruSuhak-appstore.ipa
[ -f "$IPA" ] || { echo "$IPA 없음 — scripts/archive.sh app-store 먼저" >&2; exit 1; }
KID="$(set -a; . "$HOME/.haku-env"; printf '%s' "${ASC_KEY_ID:-}")"
ISS="$(set -a; . "$HOME/.haku-env"; printf '%s' "${ASC_ISSUER_ID:-}")"
[ -n "$KID" ] && [ -n "$ISS" ] || { echo "~/.haku-env 에 ASC_KEY_ID / ASC_ISSUER_ID 필요" >&2; exit 1; }
xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$KID" --apiIssuer "$ISS"
