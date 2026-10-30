# DESIGN.md — 구현 설계

## 1. 폴더 구조(변경 후)
```
$HOME/Haku/harusuhak_pwa/
  www/              # 웹 자산 전부 이동 (index.html, app.js, problem-bank.js, styles.css, sw.js, manifest.json, icon.svg)
  www/figure.js     # [신규] SVG 피겨 렌더러
  www/platform.js   # [신규] 네이티브/웹 어댑터
  www/ko.js         # [신규] 한국어 조사 헬퍼
  verify/           # [동결] verify-answers.js, VERIFY_REPORT_baseline.md
  test-bank.js      # templateId 기반 재작성
  ios/              # Capacitor iOS 프로젝트
  scripts/archive.sh   # debug-device | app-store
  store/            # metadata.ko.md, metadata.en.md, screenshots/, ASC_CHECKLIST.md
  docs/privacy.html # GitHub Pages
  logs/
```

## 2. 조사 헬퍼 `www/ko.js`
```js
// josa('사과', '이/가') → '사과가'; josa(7, '이/가') → '7이'; josa('4/7','과/와') → '4/7과'
// 숫자: 마지막 숫자 글자로 판정. 받침 있음 = 0,1,3,6,7,8 / 없음 = 2,4,5,9
// 분수 "a/b"·"√N"은 마지막 숫자 기준. 영문은 L,M,N,R로 끝나면 받침.
window.HaruKo = { josa, withJosa: (w, pair) => `${w}${josa(w, pair)}` };
```
problem-bank.js의 `을(를)`, `(으)로`, 하드코딩 `와/가/이` 전부 이 헬퍼로 교체.

## 3. 피겨 모듈 `www/figure.js`
- 입력: `figure` 스펙 객체, 출력: SVG 문자열. 색은 CSS 변수만(`var(--ink)`, `var(--muted)`, `var(--accent)` 등 styles.css에 실제 존재하는 이름 grep 후 사용).
- `viewBox="0 0 320 200"` 기본, `width="100%"`, 라벨 폰트 `font-family: inherit; font-size: 12px`.
- 타입과 스펙:

| type | 스펙 필드 | 템플릿 |
|---|---|---|
| trapezoid | top, bottom, height, unknown:'area' | BAS-05 |
| circle | r, unknown | BAS-10 |
| cuboid | w, d, h | BAS-11 |
| rhombus | d1, d2 | BAS-12 |
| pie | percent, label | BAS-14 |
| line-graph | slope, intercept (절편은 '?') | MID-04 |
| right-triangle | sides:{a,b,c} 중 미지는 '?', angle(선택) | MID-06, MID-13 |
| parabola | a, h, k, showVertex:false(꼭짓점 좌표 '?') | MID-07 |
| parabola-interval | poly:{a,b,c}, lo, hi | HIG-04 |
| segment-division | A, B, m, n (P는 '?') | HIG-09 |
| coord-circle | center, r (중심 좌표·반지름 라벨 '?') | HIG-10 |
| cubic | poly, 극점 위치만 점으로, 값 '?' | HIG-14 |

- 규칙: **정답 문자열(options[answerIndex]에 등장하는 숫자)은 SVG 텍스트에 포함 금지.** `verify/figure-leak-check.js`(신규, Ralph 작성 가능 — 이건 피고가 아님)로 13×50 검사.
- app.js: `#question-text` 바로 아래 `<div id="question-figure" class="question-figure"></div>`; `currentProblem.figure` 있으면 innerHTML, 없으면 `display:none`. 풀이(feedback) 영역 상단에 같은 SVG를 60% 폭으로 재사용.

## 4. 네이티브 어댑터 `www/platform.js`
```js
const isNative = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
window.HaruPlatform = {
  isNative,
  haptic(kind)        // native: Haptics.notification({type}) / web: no-op
  share(name, text)   // native: Filesystem.writeFile(Cache) → Share.share({url}) / web: a.download
  dialog(opts)        // 커스텀 모달(HTML) — alert/confirm 전면 대체, Promise<boolean>
  notify: { schedule(hour, minute), cancel(), requestPermission() } // LocalNotifications id=1, 매일 반복
  onForeground(cb)    // App.addListener('appStateChange')
};
```
- 로드 순서: `ko.js` → `figure.js` → `platform.js` → `problem-bank.js` → `app.js`
- isNative일 때 DOM 제거: `#pwa-install-btn`, `#frame-mode-btn`, `#sw-status` 카드. SW 등록 건너뜀.
- 🧪 워크벤치: `.dev-toggle-btn` 숨김. `.logo` 7회 연속 탭(1.5초 내) → 표시. 웹은 `?dev=1`도 허용.

## 5. 설정 탭 "앱 정보" 카드
- 기존 `.settings-card` 스타일 그대로. 내용: 앱 버전(Capacitor App.getInfo), 원작 크레딧 2줄, `by TECHSENSE`(muted 11px), 버튼 2개(App Store 평가 — `APP_STORE_ID` 없으면 숨김 / 피드백 보내기 — `mailto:${SUPPORT_EMAIL}?subject=[하루수학] 피드백&body=앱 1.0 · iOS ${ver} · ${model}`).
- 값 주입: `www/config.js`(빌드 시 `scripts/archive.sh`가 `~/.haku-env`에서 생성, gitignore).

## 6. Capacitor / Xcode
- `capacitor.config.json`: `webDir:"www"`, `appId:"kr.harusuhak.app"`, `ios.contentInset:"always"`, `plugins.SplashScreen:{backgroundColor:"#f6f7f1",launchAutoHide:true,launchShowDuration:1000}`
- Xcode 프로젝트 설정(pbxproj 직접 편집 또는 xcodebuild -xcconfig): `TARGETED_DEVICE_FAMILY=1`, `UISupportedInterfaceOrientations=Portrait`, `MARKETING_VERSION=1.0.0`, `CURRENT_PROJECT_VERSION=1`
- Info.plist: `NSUserNotificationsUsageDescription`(한국어), `ITSAppUsesNonExemptEncryption=false`
- `scripts/archive.sh debug-device`: 빌드 → devicectl install → launch
- `scripts/archive.sh app-store`: archive(generic/platform=iOS) → ExportOptions(method app-store-connect, destination export) → `build/HaruSuhak-appstore.ipa`
- 아이콘: `resources/icon.png` 1024(∑ 디자인, 배경 #d9f36a, 글자 #24300d), `pnpm dlx @capacitor/assets generate --ios`

## 7. 스토어 산출물
- `store/metadata.ko.md`: 이름 "하루수학", 부제 "하루 한 문제, 한국 교육과정 수학", 설명(README 기반 1~4000자, 첫 두 문장에 '성취기준'·'서버 없음·수집 없음'), 키워드, 심사 노트, 카테고리 Education, 연령 4+
- `store/metadata.en.md`: 영어판(이름 "HaruSuhak – Daily Korean Math")
- 스크린샷: `store/screenshots/raw/iphone-01~06.png`(홈·변형 문제·그림 문제·교육과정·오답노트·설정) → app-store-screenshots 스킬(기존 TECHSENSE 앱 프로젝트의 config 재사용, 테마는 앱 배경 #f6f7f1 톤) → `store/screenshots/output/` 6.9"(1320×2868) 6장. raw 캡처 방법은 기존 프로젝트(Register Pocket 등)에서 쓴 방식 재사용, 없으면 Playwright로 www/를 1320×2868 렌더.
- `docs/privacy.html`: ko+en, "수집 없음". gh api로 Pages 활성화(main /docs).
