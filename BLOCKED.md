# BLOCKED.md

## B-001 App Store 배포 서명 — Apple Developer PLA 미동의 → **해결 2026-10-31 10:28**
- 일시: 2026-10-30 23:26
- 명령: `scripts/archive.sh app-store`
- 결과: `** ARCHIVE SUCCEEDED **` → `-exportArchive` 실패
  ```
  error: exportArchive Unable to process request - PLA Update available
  error: exportArchive No profiles for 'kr.harusuhak.app' were found
  error: exportArchive No signing certificate "iOS Distribution" found
    No "iOS Distribution" signing certificate matching team ID "HFDSR2HFT4" with a private key was found.
  ```
- 원인: 개정된 Apple Developer Program License Agreement(PLA)를 계정 소유자가 동의하지 않아 Apple이 배포 인증서·App Store 프로파일 발급을 거부.
- 사람 조치(1분): https://developer.apple.com/account 로그인 → 상단 배너의 약관 동의. 그 뒤 `scripts/archive.sh app-store` 재실행.
- 재시도: 23:26, 23:41(try1), 23:49(try2) 모두 동일 오류(logs/step0-appstore.log, step7-appstore-try1.log, step7-appstore-try2.log). 3회 실패 → 독립 단계 계속.
- 자동 재시도 감시: 2026-10-30 23:48 ~ 10-31 07:31, 20분 간격 24회(`archives/HaruSuhak.xcarchive` → `-exportArchive`) 모두 `PLA Update available` → `** EXPORT FAILED **`(logs/export-watch.log). **여전히 미해결.**
- 해결: 사람이 PLA 동의 → `scripts/archive.sh app-store` → `** ARCHIVE SUCCEEDED **` / `** EXPORT SUCCEEDED **`, `build/HaruSuhak-appstore.ipa` 1087071 B. 서명 `Apple Distribution: Hakseong Kim (HFDSR2HFT4)`, 프로파일 `iOS Team Store Provisioning Profile: kr.harusuhak.app`, get-task-allow false, 1.0.0 (1) (logs/appstore-after-pla.log). 단 B-003·B-004 미반영 빌드.
- archive 는 성공: `archives/HaruSuhak.xcarchive`(1.0.0 (1)). PLA 동의 후 export 만 다시 하면 됨:
  `xcodebuild -exportArchive -archivePath archives/HaruSuhak.xcarchive -exportPath build/export -exportOptionsPlist build/ExportOptions.plist -allowProvisioningUpdates && cp build/export/*.ipa build/HaruSuhak-appstore.ipa`  (또는 `scripts/archive.sh app-store` 전체 재실행)

## B-002 고유 문항 ≥ 20종 — 16개 템플릿 미달 (헌법 충돌, 하한 고정으로 처리)
- 측정: templateId 기반 50변형(test-bank.js) — BAS-10 5, MID-03 17, MID-06 14, MID-10 15, MID-13 5, MID-14 5, HIG-05 17, HIG-08 12, HIG-11 3, HIG-13 11, LIF-07 16, LIF-10 6, LIF-11 6, LIF-12 14, LIF-13 9→6(2단계에서 명목=물가 조합 제거, 남은 조합 6개 전부), LIF-14 6.
- 원인: 매개변수 공간이 본래 작음(특수각 3종, 명제 몇 개, 주사위 합 등). 이전 test-bank는 dayIdx%7 매핑 탓에 이 템플릿들을 제대로 검사하지 않아 드러나지 않았음.
- 충돌: 다양성을 늘리려면 problem-bank 수학 로직 수정이 필요하나, CLAUDE.md는 검증기가 FAIL/AMBIG로 잡은 템플릿만 수정 허용.
- 처리: test-bank.js에 `UNIQUE_FLOOR`(현재 값 = 회귀 하한) 명시, 나머지 40개는 ≥20 유지. 확장 여부는 사람 결정(1.1 후보).

## B-003 `SUPPORT_EMAIL` 없음 — 앱 정보 카드의 "피드백 보내기" 버튼 숨김 상태로 빌드
- `~/.haku-env`에 `SUPPORT_EMAIL` 키가 없음(값 미출력, 존재 여부만 확인 — logs/env-detected.txt).
- 처리: 버튼은 값이 있을 때만 표시. App Store 심사는 "지원 URL"이 필수이므로 ASC 입력 시 지원 연락처 필요.
- 사람 조치: `echo 'SUPPORT_EMAIL=you@example.com' >> ~/.haku-env` 후 `scripts/archive.sh app-store` 재실행.

## B-004 앱 정보 카드 크레딧의 `[원작자 이름]` 자리표시자 (사람 입력 필요)
- PRD F7·PROMPT 4단계 지시대로 이름 자리를 비워 둠: `www/index.html` `#about-card` "아이디어: 중학생 [원작자 이름]".
- **이대로 출시하면 앱에 대괄호 문구가 그대로 보임.** 제출 전 사람이 실제 이름(또는 줄 삭제)으로 바꾸고 재빌드.
