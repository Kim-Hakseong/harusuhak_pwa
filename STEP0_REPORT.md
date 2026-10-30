# STEP0_REPORT — 사람 개입 구간

| 항목 | 결과 | 근거(로그) |
|---|---|---|
| 0-1 환경 | Xcode 27.0 (27A266a), iPhone 16 `00008140-001611222E2B001C` available(paired), Team `HFDSR2HFT4`, gh `Kim-Hakseong`. `~/.haku-env`: SUPPORT_EMAIL·ASC_KEY_ID·ASC_ISSUER_ID·ASC_KEY_PATH·APP_STORE_ID **없음** | `logs/env-detected.txt` |
| 0-2 키체인 | login.keychain `no-timeout` 이미 설정. 비밀번호 입력 불필요 — 실기기 UI 테스트(타 프로젝트 1건, `** TEST SUCCEEDED **`) 및 Debug 서명이 팝업 없이 통과 | — |
| 0-3 Capacitor | @capacitor/cli·core·ios 8.6.0, webDir www, `pnpm cap add ios` (SPM 기반 → `.xcworkspace` 없음, `ios/App/App.xcodeproj` 사용). test-bank·verify(`--bank www/problem-bank.js`) 재통과, 합계 동일 2708/83/9 | — |
| 0-4 Debug 실기기 | `** BUILD SUCCEEDED **` → install `kr.harusuhak.app` → `Launched application with kr.harusuhak.app bundle identifier.` | `logs/step0-debug.log` |
| 0-5 App Store | `** ARCHIVE SUCCEEDED **` / `** EXPORT FAILED **` — **PLA Update available**, iOS Distribution 인증서 없음 | `logs/step0-appstore.log`, BLOCKED.md B-001 |

결론: 0-5 실패 1건(사람: developer.apple.com 약관 동의). 나머지 독립 단계는 계속 진행.
