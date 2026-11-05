# CLAUDE.md — 하루수학 (HaruSuhak) 작업 규칙

이 리포를 받은 Claude Code 세션이 가장 먼저 읽는 문서. iOS 1.0은 App Store에 출시됨(앱 ID 6829197013, 대한민국 전용, 무료).
**안드로이드 출시 작업이면 `docs/android/ANDROID_RELEASE.md`를 이어서 읽고 그 순서대로 진행한다.**

## 프로젝트
- 바닐라 HTML/CSS/JS 앱(`www/`) + Capacitor 8 네이티브 래퍼. 원작: 정한결, 정재상(MIT). iOS 출시: TECHSENSE.
- 56개 파라메트릭 수학 템플릿(`www/problem-bank.js`), 2022 개정 수학과 교육과정 성취기준(`CURRICULUM_AUDIT.md`).
- 리모트: `origin` = Kim-Hakseong/harusuhak_pwa(작업용). 원본(jaesang-jeong/harusuhak_pwa)으로는 절대 push 금지.

## 절대 규칙
1. **실행하지 않은 것을 성공으로 쓰지 않는다.** 보고는 실제 실행한 명령과 출력 끝부분으로만.
2. **실기기에서만 확인한다.** iOS는 `xcrun devicectl`, Android는 `adb`로 USB 연결된 실제 폰. 시뮬레이터·에뮬레이터로 "확인됨"이라고 쓰지 않는다.
3. **검증기 동결.** `verify/verify-answers.js`(sha256 `8d9f3967726a8c390859458e7de26742696ea7c6936db0b7b8dfff9be12554e8`)는 독립 오라클이다. 고치지 않는다. 틀렸다고 판단되면 근거를 `BLOCKED.md`에 적는다.
4. **문항 수학 로직 동결.** `problem-bank.js`의 문제 생성 로직은 검증기가 FAIL/AMBIG로 잡은 것만 고친다. 메타데이터(성취기준 코드·문안·단원 표기)는 공식 교육과정 기준으로 고칠 수 있다.
5. **외형 보존.** 색·레이아웃·카드 구조·∑ 로고 변경 금지. 추가는 기존 CSS 변수와 카드 스타일로만.
6. **빌드 도구 도입 금지.** 바닐라 JS(IIFE, 한국어 주석) 유지. Node 패키지는 `pnpm`만.
7. **스크린샷으로 검증하지 않는다.** 확인용 캡처 금지. 스토어 스크린샷(산출물)만 예외.
8. **비밀값은 `~/.haku-env`(Windows는 `%USERPROFILE%\.haku-env`)에서만 읽는다.** 키스토어 비밀번호·서비스 계정 JSON 경로·ASC 키 등. 코드·git에 절대 기록 금지. 키스토어(.jks)와 서비스 계정 JSON은 리포 밖에 둔다.
9. **유료 LLM API 사용 금지.** 앱·스크립트 어디에도 종량제 API 키 없음.
10. **로그는 `logs/`에만**(gitignore). 빌드 산출물(`build/`, `android/app/build/`, `DerivedData`)은 검증이 끝나면 지운다.

## 완료 기준 (매 변경 후)
- `pnpm test` → test-bank 56×50 통과 + 검증기 50회 FAIL 0 / AMBIG 0 + 그림 노출 검사 FAIL 0
- 출시 전: `node verify/verify-answers.js --rounds 100 --bank www/problem-bank.js` → 5600 / 0 / 0, lint 0
- 웹 회귀: `python -m http.server 8081`(www 폴더에서) + `node scripts/web-smoke.js http://localhost:8081` → 전부 PASS
  (Playwright는 리포 밖 임시 폴더에 설치하고 `NODE_PATH`로 지정. `channel: 'chrome'` 사용)

## 기록 규율
변경마다 `git commit` → `docs/kit/Log.md`에 날짜·단계·결과 3줄 추가. 판단이 필요한 결정은 `docs/kit/DECISIONS.md`에 D-번호로. 막힌 것은 `BLOCKED.md`.

## 주요 파일
| 경로 | 내용 |
|---|---|
| `www/platform.js` | 네이티브/웹 차이 어댑터(햅틱·공유·모달·알림·업데이트 확인·스토어 평가·뒤로 가기) |
| `www/app.js` | 화면 로직. `initUpdateCheck`(새 버전 팝업), `initBackButton`(Android 뒤로 가기) |
| `scripts/archive.sh` | iOS 빌드(macOS 전용) |
| `scripts/asc/` | App Store Connect API 자동화(macOS에서 사용) |
| `scripts/capture-raw.js`, `scripts/export-shots.js` | 스토어 스크린샷 산출 |
| `store/` | 스토어 메타데이터(ko/en), 스크린샷 편집기·산출물 |
| `docs/privacy.html`, `docs/support.html` | GitHub Pages 공개 페이지(개인정보 처리방침·지원) |
