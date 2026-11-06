# 안드로이드 출시 작업서 — 하루수학 (Google Play)

Windows PC(Ryzen 5600 / RAM 32GB / RTX 3050)의 Claude Code 세션이 이 문서 순서대로 진행한다. 먼저 루트 `CLAUDE.md` 규칙을 읽을 것.
각 단계는 **실제 실행 출력으로 확인한 뒤** 다음으로 넘어가고, 끝날 때마다 커밋 + `docs/kit/Log.md` 기록.
사람만 할 수 있는 단계는 **[사람]** 으로 표시했다. 그 단계에 도달하면 멈추고 무엇을 해야 하는지 정확히 안내한다.

## 이미 되어 있는 것 (iOS 1.0.2 기준 — 문제 유형 140개, 난이도 하·중·상)
- 웹 앱(`www/`)은 플랫폼 공통. 네이티브 차이는 `www/platform.js` 한 곳에 모여 있다.
- Android 대응 코드가 이미 들어가 있음:
  - 뒤로 가기 버튼: 모달 닫기 → 홈 탭 → 앱 종료 (`app.js` `initBackButton`)
  - 새 버전 팝업: Android는 Play 인앱 즉시 업데이트(`performImmediateUpdate`) — 업데이트 후 새 버전으로 재실행 (`@capawesome/capacitor-app-update`)
  - "평가하기" 버튼: Android에서는 Play 스토어 페이지로 이동 (`platform.js` `review`)
- 사용 중인 Capacitor 플러그인: app, filesystem, haptics, local-notifications, share, splash-screen, status-bar, @capawesome/capacitor-app-update
- 아이콘·스플래시 원본: `resources/icon.png`(1024, 알파 없음), `resources/splash.png`
- 개인정보 처리방침: https://kim-hakseong.github.io/harusuhak_pwa/privacy.html (Android 문구 포함)
- 지원 페이지: https://kim-hakseong.github.io/harusuhak_pwa/support.html
- 스토어 문안: `store/metadata.ko.md`, `store/metadata.en.md` (App Store용 — Play용 길이로 줄여 써야 함, 아래 7단계)

## 확정값
| 항목 | 값 |
|---|---|
| applicationId | `kr.harusuhak.app` (iOS 번들 ID와 동일) |
| 앱 이름 | 하루수학 |
| versionName / versionCode | iOS `MARKETING_VERSION`과 같은 이름(현재 1.0.2) / Android는 1부터 시작, 업로드마다 +1 |
| 기본 언어 | 한국어(ko-KR), 추가 언어 영어(en-US) |
| 가격 / 판매 국가 | 무료 / **대한민국만** (한국 교육과정 전용) |
| 카테고리 | 교육 |
| 개발자 표기 | TECHSENSE |

## 0. 환경 준비 (Windows)
- Git, Node LTS, `pnpm`(Corepack), Android Studio 최신 안정판(번들 JDK 사용), Android SDK Platform·Build-Tools·Platform-Tools.
- Capacitor 8이 요구하는 JDK·SDK·Gradle 버전은 **Capacitor 공식 문서(Android 환경 설정)를 확인해서 맞춘다.** 추측으로 버전을 적지 않는다.
- 환경 변수: `JAVA_HOME`(Android Studio 번들 JBR), `ANDROID_HOME`(SDK 경로), `platform-tools`를 PATH에.
- 폰: 개발자 옵션 → USB 디버깅 켜기. `adb devices`에 기기가 보이면 OK.
- 확인: `node -v`, `pnpm -v`, `java -version`, `adb devices` 출력을 `logs/env-android.txt`에 저장.

## 1. 리포 준비와 기준선
```
git clone https://github.com/Kim-Hakseong/harusuhak_pwa.git
cd harusuhak_pwa
pnpm install
pnpm test
```
- `pnpm test`가 통과해야 시작한다(문제은행 140×50, 동결 검증기·난이도 확장 검증기 FAIL 0 / AMBIG 0, 그림 누출 0).
- 검증기 해시 확인: PowerShell `Get-FileHash verify\verify-answers.js -Algorithm SHA256` → `8D9F3967…`

## 2. Android 플랫폼 추가
```
pnpm add @capacitor/android@<@capacitor/core와 같은 메이저·마이너>
pnpm cap add android
pnpm cap sync android
```
- `android/app/build.gradle`: `applicationId "kr.harusuhak.app"`, `versionCode`, `versionName` 설정.
- `android/app/src/main/res/values/strings.xml`: `app_name`·`title_activity_main` = 하루수학.
- 화면 방향 세로 고정: `AndroidManifest.xml`의 MainActivity에 `android:screenOrientation="portrait"`.
- 아이콘·스플래시: `pnpm dlx @capacitor/assets generate --android` (원본은 `resources/`). 다크 스플래시 변형은 쓰지 않는다(iOS와 동일).

## 3. 빌드 스크립트 (Windows에서도 도는 Node 스크립트로)
`scripts/archive.sh`는 macOS 전용이다. Android용으로 `scripts/android.mjs`를 새로 만든다.
- `config`: `~/.haku-env`에서 `SUPPORT_EMAIL`만 꺼내 `www/config.js` 생성(iOS `gen_config`와 같은 형식). 다른 값은 절대 쓰지 않는다.
- `sync`: `pnpm cap sync android` → `android/app/src/main/assets/public/index.html`에 `<script src="config.js"></script>`를 `platform.js` 앞에 주입 → `_figure_preview.html` 삭제 (iOS `sync_web`과 같은 처리).
- `debug`: `gradlew assembleDebug` → `adb install -r` → `adb shell monkey -p kr.harusuhak.app 1`(실행).
- `release`: `gradlew bundleRelease` → `build/HaruSuhak-release.aab`로 복사.

## 4. Android 전용 확인 (실기기, `adb`)
화면을 눌러 확인할 항목은 사람에게 체크리스트로 넘기고, 자동화할 수 있는 것은 `adb`·로그로 확인한다.
- 앱 실행·문제 풀이·변형 문제·교육과정 탭·기록·설정이 동작하는지 (`adb logcat`에서 크래시·JS 에러 없음)
- **상단 상태바·하단 내비게이션 바와 겹침**: Android 15(targetSdk 35+)는 edge-to-edge가 강제된다. 헤더·하단 탭이 시스템 바에 가리지 않는지 확인하고, 가리면 Capacitor 8 문서의 edge-to-edge/안전 영역 처리 방법으로 맞춘다(CSS는 `env(safe-area-inset-*)`를 이미 사용).
- **매일 알림**: Android 13+는 알림 권한 팝업이 떠야 한다(LocalNotifications `requestPermissions`). 2분 뒤로 설정 → 알림 도착 → 탭하면 앱 열림 → 끄면 안 옴. 정확한 시각 알람 권한(`SCHEDULE_EXACT_ALARM`)은 요청하지 않는다(몇 분 오차 허용).
- **뒤로 가기**: 모달 열린 상태 → 닫힘, 다른 탭 → 홈, 홈 → 앱 종료.
- **백업**: 설정 → JSON 백업 → 공유 시트가 뜨고 파일이 첨부됨.
- **햅틱**: 정답/오답 진동.
- **업데이트 팝업**: Play에서 설치한 앱에서만 동작한다. 내부 테스트 트랙에 낮은 versionCode → 높은 versionCode를 차례로 올려 확인(사람 확인).
- 웹 회귀(`scripts/web-smoke.js`)도 다시 통과해야 한다.

## 5. 서명 키 **[사람 + Claude]**
- 업로드 키 생성(Claude가 명령 실행, 비밀번호는 사람이 정해서 `~/.haku-env`에 저장):
  `keytool -genkeypair -v -keystore %USERPROFILE%\.haku\harusuhak-upload.jks -alias harusuhak -keyalg RSA -keysize 2048 -validity 10000`
- `~/.haku-env`에 `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Gradle은 이 값을 환경 변수로 읽게 한다(`build.gradle`에 값 하드코딩 금지).
- **[사람] 키스토어 파일과 비밀번호를 리포 밖 두 곳 이상에 백업.** 잃어버리면 업데이트를 올릴 수 없다(Play 앱 서명을 쓰더라도 업로드 키 재설정은 번거롭다).
- Play Console에서 **Play 앱 서명** 사용(기본값).

## 6. Play Console 준비 **[사람]**
1. 앱 만들기: 이름 하루수학, 기본 언어 한국어, 앱(게임 아님), 무료.
2. **계정 종류: 사업자(조직) 계정** — 개인 계정의 "비공개 테스트 12명 × 14일" 요건은 해당 없음. 내부 테스트로 확인한 뒤 바로 프로덕션 출시 신청 가능.
3. 앱 콘텐츠(정책) 설문:
   - 개인정보처리방침 URL: 위 privacy.html
   - 광고: 없음 / 앱 액세스: 모든 기능 제한 없음(로그인 없음)
   - 콘텐츠 등급(IARC) 설문: 폭력·성적·도박 등 전부 없음
   - **타겟층**: 초5~6(13세 미만)을 포함하면 Google Play **가족 정책** 요건이 적용된다(광고·데이터 수집 없음이라 대부분 충족하지만 설문이 늘어난다). 포함할지 사람이 결정.
   - **데이터 보안**: 수집·공유 데이터 없음. (업데이트 확인은 Google Play 라이브러리 자체 기능, 학습 기록은 기기에만 저장)
   - 금융·건강·정부 기능: 해당 없음
4. 판매 국가: 대한민국만.
5. API 액세스(자동화를 원하면): Google Cloud에서 서비스 계정 생성 → JSON 키 다운로드 → Play Console **사용자 및 권한**에 서비스 계정 이메일을 초대하고 앱 권한 부여. JSON은 리포 밖에 두고 경로를 `~/.haku-env`의 `PLAY_SERVICE_ACCOUNT_JSON`에.

## 7. 스토어 등록정보
- 앱 이름(30자): 하루수학
- 간단한 설명(**80자**): `store/metadata.ko.md` 부제·홍보 문구에서 80자 이내로 새로 쓴다.
- 자세한 설명(4000자): `store/metadata.ko.md` 설명을 그대로 쓰되 "App Store" 언급은 "Google Play"로.
- 앱 아이콘 512×512(32비트 PNG): `resources/icon.png`에서 축소.
- 그래픽 이미지 1024×500: `store/screenshots` 편집기의 Feature Graphic 레이아웃으로 생성.
- 휴대전화 스크린샷 2~8장: **iPhone용 1320×2868은 비율(2:1 초과) 때문에 못 쓴다.** 편집기의 Android Phone 디바이스로 같은 6장을 다시 내보낸다(`scripts/export-shots.js`를 Android 해상도로 확장). raw 캡처는 `scripts/capture-raw.js`를 Android 스텁(`getPlatform: () => 'android'`)으로 돌리면 된다.
- 영어(en-US) 등록정보도 같은 방식으로.

## 8. 업로드와 출시
- 첫 AAB는 Play Console 화면에서 직접 올려야 할 수 있다(새 앱의 첫 업로드 제약). 이후는 서비스 계정 + Google Play Developer API(`androidpublisher` v3: edits → bundles.upload → tracks.update → commit)로 자동화 가능.
- 순서: 내부 테스트 → 프로덕션 출시 신청 (사업자 계정이라 비공개 테스트 요건 없음).
- 심사 결과·거절 사유는 `BLOCKED.md`와 `RELEASE_REPORT.md`에 기록.

## 9. 끝낼 때
- `RELEASE_REPORT.md`에 Android 섹션 추가(버전·versionCode·트랙·상태, 실행 출력 근거).
- `android/app/build/`, `build/` 임시 산출물 삭제. 키스토어·JSON은 리포에 없는지 `git status`로 확인.
- `README.md`의 빌드·배포 섹션에 Android 방법 추가.
