이 세션은 `claude --dangerously-skip-permissions` 로 시작됐다. 아래를 순서대로 자율 수행한다. 먼저 킷 파일을 읽어라: 같은 폴더의 CLAUDE.md(헌법), PRD.md, DESIGN.md, DECISIONS.md, verify/verify-answers.js, verify/VERIFY_REPORT_baseline.md, store/ASC_CHECKLIST.md. CLAUDE.md의 절대 규칙 10개가 이 프롬프트보다 우선한다. 실행하지 않은 것을 성공으로 쓰지 마라.

환경: macOS(Mac mini), Xcode 설치, 실물 iPhone USB 연결·개발자 모드 ON·자동잠금 해제. Apple Developer 계정·Xcode Apple ID 로그인·gh CLI 로그인 완료. 시뮬레이터 금지. Node는 pnpm만. 로그는 `$HOME/Haku/harusuhak_pwa/logs/`에만.

===== S. 시작(아무것도 없는 상태) =====
S-1. `mkdir -p $HOME/Haku && cd $HOME/Haku`. `gh auth status` 확인(미로그인이면 say "깃허브 로그인이 필요합니다" 후 대기 — 이것도 0단계 사람 구간).
S-2. `gh repo fork jaesang-jeong/harusuhak_pwa --clone --remote` → origin=내 포크, upstream=원본. upstream push 금지. `cd harusuhak_pwa`.
S-3. 이 킷 폴더의 파일을 리포에 복사: CLAUDE.md, PRD.md, DESIGN.md, DECISIONS.md, Log.md, PROMPT_ralph.md → 리포 루트 `docs/kit/`; `verify/` → 리포 루트 `verify/`; `store/ASC_CHECKLIST.md` → `store/`. `sha256sum verify/verify-answers.js`가 CLAUDE.md의 해시와 일치하는지 확인하고 Log.md에 기록.
S-4. 기준선: `node test-bank.js`(원본) 통과 확인, `node verify/verify-answers.js --rounds 50` 실행 → 출력 tail을 `logs/verify-baseline.txt`에 저장. VERIFY_REPORT_baseline.md와 합계가 같은지 확인(PASS 2708 / FAIL 83 / AMBIG 9).
S-5. LICENSE(MIT, "Copyright (c) 2026 jaesang-jeong (original) · TECHSENSE (iOS release)") 추가, README 하단 크레딧 1줄, `.gitignore`에 `www/config.js`, `logs/`, `build/`, `ios/App/Pods`, `DerivedData` 추가. commit "chore: kit, license, verifier baseline".

===== 0. 사람 개입 구간 — S 직후 15분 안에 몰아서 =====
목적: 키체인 비밀번호·기기 신뢰·서명 인증서 접근 허용 프롬프트를 지금 전부 발생시킨다. 코드 품질 작업은 여기서 하지 않는다.
0-1. 환경 출력: `xcodebuild -version`, `xcrun devicectl list devices`(iPhone UDID → `DEVICE_UDID`), `security find-identity -v -p codesigning`(Development·Distribution 인증서, 괄호 안 10자리 → `APPLE_TEAM_ID`), `gh api user -q .login`(→ `GITHUB_USER`), `source ~/.haku-env` 후 `SUPPORT_EMAIL`·`ASC_KEY_ID`·`ASC_ISSUER_ID`·`ASC_KEY_PATH` 존재 여부(값은 출력하지 말고 있음/없음만). 찾은 값은 `logs/env-detected.txt`(gitignore)에.
0-2. 키체인: `security unlock-keychain ~/Library/Keychains/login.keychain-db`(비밀번호 1회) → `security set-keychain-settings ~/Library/Keychains/login.keychain-db`(자동 잠금 해제).
0-3. Capacitor 최소 도입: 웹 자산을 `www/`로 `git mv`, `pnpm init` 보강, `pnpm add -D @capacitor/cli` `pnpm add @capacitor/core @capacitor/ios`, `capacitor.config.json` webDir "www"·appId "kr.harusuhak.app", `pnpm cap add ios`, `pnpm cap sync ios`. `test-bank.js`·verify 경로를 www/ 기준으로 고치고 둘 다 다시 통과 확인.
0-4. 실기기 Debug 1회 완주: `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -destination "id=$DEVICE_UDID" -allowProvisioningUpdates -allowProvisioningDeviceRegistration -derivedDataPath build/DerivedData build` → `.app` 경로 찾아 `xcrun devicectl device install app --device $DEVICE_UDID <app>` → `xcrun devicectl device process launch --device $DEVICE_UDID kr.harusuhak.app`. codesign 키체인 팝업이 뜨면 터미널에 "팝업에서 '항상 허용'을 눌러 주세요" 출력.
0-5. Release 서명 경로 1회 완주: `xcodebuild archive -workspace ios/App/App.xcworkspace -scheme App -destination "generic/platform=iOS" -archivePath build/HaruSuhak.xcarchive -allowProvisioningUpdates` → `build/ExportOptions.plist`(method app-store-connect, destination export, teamID, signingStyle automatic) → `xcodebuild -exportArchive -archivePath build/HaruSuhak.xcarchive -exportPath build/export -exportOptionsPlist build/ExportOptions.plist -allowProvisioningUpdates`. .ipa 생성 확인. 이 두 흐름을 `scripts/archive.sh debug-device | app-store`로 스크립트화.
0-6. 전부 성공 시 배너 "✅ 사람 개입 구간 종료 — 자리를 떠나셔도 됩니다. 이후 입력 요청 없음" + `say "사람 개입 구간이 끝났습니다. 주무셔도 됩니다"`. 실패 항목이 있으면 `say "확인이 필요합니다"` 후 필요한 것 한 줄 출력하고 대기. 결과 `STEP0_REPORT.md`, commit.

===== 1. 테스트 하네스 교정 =====
- `test-bank.js` 재작성: `generateProblem({templateId})`로 56개 템플릿 각각 50변형(현재는 dayIdx%7 매핑 때문에 템플릿별 검증이 안 됨 — 주석으로 기록). 4지선다 중복 0, 풀이 ≥2단계, 결정론(같은 시드 → 같은 문제), 고유 문항 ≥ 20종.
- `pnpm test` = test-bank + verify(`--rounds 50`) 둘 다. commit.

===== 2. 문항 교정 — 검증기가 잡은 것만 =====
검증기(verify/verify-answers.js)는 **절대 수정하지 않는다.** 고치는 대상은 FAIL/AMBIG 템플릿과 lint 항목뿐. 수정 전후 `node verify/verify-answers.js --rounds 100` 출력을 `VERIFY_REPORT.md`에 붙인다.
- `www/ko.js` 신규(DESIGN §2). problem-bank.js의 `을(를)`·`(으)로`·하드코딩 조사(BAS-01 "분수 a/b와/가", BAS-02 "권와", MID-14 "합이 N이")를 `HaruKo.josa`로 교체. 지문·보기·풀이 전부 적용.
- HIG-08 복소수: 분자를 `(realPart + imagPart·i) × (denReal + i)`로 생성(현재는 `× norm`으로 잘못 생성되어 정답이 전부 틀림). 표기: `1i`→`i`, 허수부 0이면 실수만, `+ -`→`−`.
- HIG-09 내분점: m≠n이고 gcd(m,n)=1인 비만 선택, 좌표가 정수가 되도록 A·B 생성(또는 분수 표기 `a/b`), 보기 3번 `toFixed(0)` 빈 괄호 버그 수정.
- LIF-09: 지문 "(1,000 MB)"를 실제 MB로, 초가 정수가 되는 속도·용량 조합만 선택(또는 "약 N초" 소수 1자리).
- BAS-06: `Math.round` 적용(62.999…개 → 63개).
- LIF-13: 명목=물가일 때 보기 중복 → 동일 비율 조합 제외 또는 보기 재설계.
- MID-11 `(x + -12)` → `(x − 12)`. LIF-10 숫자 동일 보기 2개 → 하나를 다른 오개념 값으로.
- 완료 기준: `--rounds 100` FAIL 0, AMBIG 0, 정답 보기 lint 0, 지문 lint 0(조사 포함). 달성 못 한 템플릿은 BLOCKED.md에 근거와 함께 기록. commit.

===== 3. SVG 피겨 모듈 =====
- `www/figure.js` 신규(DESIGN §3, 13개 타입, 의존성 0, CSS 변수만). 해당 13개 템플릿 generate() 반환값에 `figure` 스펙 추가(수학 로직은 건드리지 않음). 다른 템플릿 금지.
- `verify/figure-leak-check.js` 신규(이건 Ralph가 작성 가능): 13×50 생성 → 정답 보기의 숫자 토큰이 SVG `<text>`에 등장하면 FAIL. 0건까지.
- app.js: `#question-figure` 렌더/숨김, 풀이 영역 재사용(DESIGN §3). index.html 로드 순서 `ko.js → figure.js → platform.js → problem-bank.js → app.js`.
- `www/_figure_preview.html`(개발용, 배포 제외): 13×6 SVG 그리드. 캡처하지 말 것 — 사람이 브라우저로 연다. commit.

===== 4. 네이티브 어댑터·숨김·앱 정보 =====
- `pnpm add @capacitor/local-notifications @capacitor/haptics @capacitor/share @capacitor/filesystem @capacitor/status-bar @capacitor/splash-screen @capacitor/app`, `pnpm cap sync ios`.
- `www/platform.js`(DESIGN §4). alert/confirm → 커스텀 모달. 토스트 반말("저장했어","초기화했어") → 존댓말.
- isNative: `#pwa-install-btn`·`#frame-mode-btn`·`#sw-status` 카드 DOM 제거, SW 등록 생략, 🧪 버튼 숨김·로고 7탭 표시(웹은 `?dev=1`도).
- 백업: native → Filesystem(Cache) + Share. 정답/오답 Haptics. 설정 탭 "매일 알림" 카드(기본 08:00, 토글 켤 때만 권한, `hs_notify_on/hs_notify_time`). `App.appStateChange`로 날짜 바뀌면 renderAll.
- 설정 탭 "앱 정보" 카드(DESIGN §5): 크레딧(이름 자리는 `[원작자 이름]`으로 비워 둠), `by TECHSENSE`, 평가 버튼(APP_STORE_ID 없으면 숨김), 피드백 mailto(SUPPORT_EMAIL). `www/config.js`는 `scripts/archive.sh`가 `~/.haku-env`에서 생성.
- StatusBar Light, SplashScreen #f6f7f1 1초, `overscroll-behavior:none`, safe-area inset, 세로 고정, `TARGETED_DEVICE_FAMILY=1`, Info.plist `NSUserNotificationsUsageDescription`(한국어)·`ITSAppUsesNonExemptEncryption=false`.
- 웹 회귀 0: `www/index.html`을 `pnpm dlx serve www`로 띄워 콘솔 에러 0, 기존 기능 동작(curl + node 스크립트로 DOM 존재 확인, 스크린샷 금지). commit.

===== 5. 아이콘·스플래시 =====
- `resources/icon.png` 1024×1024(∑, 배경 #d9f36a, 글자 #24300d — icon.svg 그대로 sharp로 렌더), `resources/splash.png` 2732×2732. `pnpm dlx @capacitor/assets generate --ios`. `pnpm cap sync ios`. commit.

===== 6. 실기기 재빌드·스모크 =====
- `scripts/archive.sh debug-device` → 설치·실행 성공 로그 `DEVICE_SMOKE.md`. 기기 잠김으로 실패 시 1분 간격 10회 재시도 후 BLOCKED.md.

===== 7. 스토어 산출물 =====
- `docs/privacy.html`(ko+en, 수집 없음) → `gh api -X POST repos/$GITHUB_USER/harusuhak_pwa/pages -f source[branch]=main -f source[path]=/docs`(이미 있으면 PUT) → `https://$GITHUB_USER.github.io/harusuhak_pwa/privacy.html` 200 확인(최대 5분 폴링).
- `store/metadata.ko.md`, `store/metadata.en.md`(DESIGN §7). 심사 노트 포함.
- 스크린샷: raw 6장(홈·변형 문제·그림 문제·교육과정·오답노트·설정) → app-store-screenshots 스킬 → `store/screenshots/output/` 6.9"(1320×2868) 6장. raw 캡처 방식은 `$HOME/Haku`·`$HOME/Projects` 안 기존 TECHSENSE 앱 프로젝트의 `store/screenshots` 파이프라인을 grep해서 재사용, 없으면 Playwright(chromium)로 `www/`를 1320×2868 렌더(샘플 기록 주입, `?dev=1` 금지). 출력 12장 `sips -g pixelWidth -g pixelHeight`로 크기 확인해 보고.
- `scripts/archive.sh app-store` → `build/HaruSuhak-appstore.ipa`. commit(스크린샷 output은 커밋, raw는 gitignore).

===== 8. 업로드(조건부) =====
- `~/.haku-env`에 `ASC_KEY_ID`·`ASC_ISSUER_ID`·`ASC_KEY_PATH`가 **모두 있으면**: `brew list fastlane || brew install fastlane`, `fastlane/Appfile`·`Fastfile`(lane :upload — `app_store_connect_api_key` + `upload_to_testflight`(skip_waiting_for_build_processing:false) + `deliver`(metadata·screenshots·privacy_url, submit_for_review:false)) 직접 작성(대화형 init 금지) → 실행 → TestFlight 처리 완료까지 최대 30분 폴링. 제출 버튼은 누르지 않는다(D-010, 사람 결정).
- 키가 하나라도 없으면 이 단계는 건너뛰고 `store/ASC_CHECKLIST.md`를 RELEASE_REPORT 맨 위에 그대로 넣는다. 사용자에게 키를 묻지 않는다.

===== 9. 마무리 =====
- `RELEASE_REPORT.md`: 빌드 번호·.ipa 경로·Pages URL·검증 합계(수정 전/후)·수정한 템플릿과 diff 요약·BLOCKED 항목·TestFlight 상태(8단계 수행 시)·ASC 체크리스트. README에 "iOS 빌드·배포" 절 추가. 임시 산출물(`build/DerivedData`, `build/export` 중 .ipa 외) 삭제, 7일 지난 logs 삭제. 전부 commit + `git push origin main`. `say "하루수학 배포 준비가 끝났습니다"`.
