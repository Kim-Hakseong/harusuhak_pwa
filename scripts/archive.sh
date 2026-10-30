#!/usr/bin/env bash
# 하루수학 iOS 빌드 스크립트
#   scripts/archive.sh debug-device   실기기 Debug 빌드 → devicectl 설치 → 실행
#   scripts/archive.sh app-store      Release archive → App Store Connect용 .ipa (build/HaruSuhak-appstore.ipa)
# 환경: DEVICE_UDID(debug-device), APPLE_TEAM_ID(기본 HFDSR2HFT4). 비밀값은 ~/.haku-env 에서만 읽는다.
set -euo pipefail
export CI=1 FASTLANE_SKIP_UPDATE_CHECK=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MODE="${1:-}"
TEAM="${APPLE_TEAM_ID:-HFDSR2HFT4}"
BUNDLE_ID="kr.harusuhak.app"
PROJECT="ios/App/App.xcodeproj"
SCHEME="App"
mkdir -p build logs

# www/config.js 생성 — ~/.haku-env 에서 필요한 값만 꺼낸다(다른 값은 절대 기록하지 않음)
gen_config() {
  local email="" store_id=""
  if [ -f "$HOME/.haku-env" ]; then
    email="$(set -a; . "$HOME/.haku-env"; printf '%s' "${SUPPORT_EMAIL:-}")"
    store_id="$(set -a; . "$HOME/.haku-env"; printf '%s' "${APP_STORE_ID:-}")"
  fi
  cat > www/config.js <<EOF
// 빌드 시 scripts/archive.sh 가 생성 (gitignore)
window.HARU_CONFIG = { SUPPORT_EMAIL: "${email}", APP_STORE_ID: "${store_id}" };
EOF
}

sync_web() {
  gen_config
  pnpm cap sync ios >/dev/null
  local pub="ios/App/App/public"
  # 개발용 미리보기는 배포 번들에서 제외
  rm -f "$pub/_figure_preview.html"
  # config.js 는 iOS 번들에만 주입 (웹 index.html 은 config.js 를 참조하지 않아 404 콘솔 에러 없음)
  if ! grep -q 'src="config.js"' "$pub/index.html"; then
    sed -i '' 's#<script src="platform.js"></script>#<script src="config.js"></script>\
  <script src="platform.js"></script>#' "$pub/index.html"
  fi
  grep -q 'src="config.js"' "$pub/index.html" || { echo "config.js 주입 실패" >&2; exit 1; }
}

case "$MODE" in
  debug-device)
    : "${DEVICE_UDID:?DEVICE_UDID 필요}"
    sync_web
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Debug \
      -destination "id=$DEVICE_UDID" -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
      -derivedDataPath build/DerivedData DEVELOPMENT_TEAM="$TEAM" build
    APP="$(find build/DerivedData/Build/Products/Debug-iphoneos -maxdepth 1 -name '*.app' | head -1)"
    echo "APP=$APP"
    xcrun devicectl device install app --device "$DEVICE_UDID" "$APP"
    xcrun devicectl device process launch --device "$DEVICE_UDID" "$BUNDLE_ID"
    ;;
  app-store)
    sync_web
    rm -rf build/HaruSuhak.xcarchive build/export
    xcodebuild archive -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
      -destination "generic/platform=iOS" -archivePath build/HaruSuhak.xcarchive \
      -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM"
    cat > build/ExportOptions.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>teamID</key><string>${TEAM}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
EOF
    xcodebuild -exportArchive -archivePath build/HaruSuhak.xcarchive -exportPath build/export \
      -exportOptionsPlist build/ExportOptions.plist -allowProvisioningUpdates
    IPA="$(find build/export -maxdepth 1 -name '*.ipa' | head -1)"
    cp "$IPA" build/HaruSuhak-appstore.ipa
    # 산출물 규칙: .xcarchive 는 build/ 밖(archives/)에 보관
    mkdir -p archives && rm -rf archives/HaruSuhak.xcarchive && mv build/HaruSuhak.xcarchive archives/
    ls -l build/HaruSuhak-appstore.ipa
    ;;
  *)
    echo "usage: $0 debug-device|app-store" >&2; exit 2 ;;
esac
