# CLAUDE.md — 하루수학 iOS 출시 킷 헌법

## 프로젝트
- 하루수학(HaruSuhak): 동료가 만들어 넘긴 바닐라 HTML/CSS/JS PWA(56개 파라메트릭 수학 템플릿). 원본 https://github.com/jaesang-jeong/harusuhak_pwa
- 목표: TECHSENSE 명의 **독립 iOS 앱(iPhone 전용 1.0, 무료)** 으로 App Store 제출 준비 완료 — `.ipa` + `store/` 산출물. 베리티에듀 브랜드와 무관.
- 작업 루트(절대 경로): `$HOME/Haku/harusuhak_pwa` (내 포크 clone). 원본은 `upstream` 리모트, 절대 push 금지.

## 내가 소유하는 것 / 동결된 것
| 소유(수정 가능) | 동결(수정 금지) |
|---|---|
| `www/app.js`, `www/styles.css`(레이아웃·색 불변, 추가만), `www/index.html`(요소 추가만) | **`verify/verify-answers.js`** — 독립 검증기. sha256 `8d9f3967…2554e8`. 수정 시 즉시 중단, BLOCKED.md |
| `www/figure.js`, `www/platform.js`, `www/ko.js` (신규) | `www/problem-bank.js`의 **문항 수학 로직** — 단, VERIFY가 FAIL/AMBIG로 잡은 템플릿과 lint 항목만 수정 허용 |
| `ios/`, `scripts/`, `store/`, `fastlane/`, `docs/privacy.html` | 외형: 색상 팔레트·레이아웃·문구 톤·∑ 아이콘 디자인(원작자 아이덴티티) |
| `test-bank.js`(templateId 기반으로 재작성) | 원본 리포(upstream) |

## 절대 규칙
1. **실행하지 않은 것을 성공으로 쓰지 마라.** 보고는 실제 실행 출력(명령 + 결과 tail)만. 추측 금지.
2. **시뮬레이터 금지.** `xcrun simctl` 호출 금지. 빌드·설치·실행은 연결된 실물 iPhone(`xcrun devicectl`)만.
3. **검증기 동결.** `verify/verify-answers.js`는 피고(problem-bank)가 작성한 테스트가 아니라 독립 오라클이다. 템플릿을 고친 뒤에도 검증기는 그대로 돌린다. 검증기가 틀렸다고 판단되면 고치지 말고 BLOCKED.md에 근거를 적는다.
4. **외형 보존.** 색·레이아웃·카드 구조·헤더 로고 변경 금지. 추가는 기존 CSS 변수와 카드 스타일만 사용.
5. **빌드 도구 도입 금지.** 바닐라 JS 유지(IIFE, 한국어 주석). Node 패키지는 `pnpm`만.
6. **스크린샷으로 검증하지 않는다.** 디버그·확인용 캡처 단계 금지(사람이 실기기에서 직접 확인). 스토어 스크린샷(산출물)은 예외.
7. **디스크 규칙.** 로그는 `logs/`에만, 7일 지난 로그는 루프 시작 시 삭제. 종료 시 `dist`, `DerivedData` 복사본 등 임시 산출물 정리. `node_modules`는 pnpm 스토어 사용.
8. **사람 입력 대기 금지(0단계 이후).** sudo·대화형 init 금지. `export CI=1 FASTLANE_SKIP_UPDATE_CHECK=1`. 예상 못 한 프롬프트 → 중단 → BLOCKED.md → 독립적인 다음 단계 계속.
9. **유료 LLM API 사용 금지.** 앱 런타임·스크립트 어디에도 종량제 API 키 없음.
10. 비밀값은 `~/.haku-env`(chmod 600)에서만 읽는다. `SUPPORT_EMAIL`, 있으면 `ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_KEY_PATH`. 코드·git에 절대 기록 금지.

## 루프 규율 (Ralph)
SCOPE(grep 근거) → CHANGE 선언 → ACCEPTANCE(실제 실행 출력) → `git commit` → `Log.md` append(날짜·단계·결과 3줄). 단계 실패 3회 → BLOCKED.md 기록 후 다음 독립 단계.

## 완료 정의 (Definition of Done)
- `node verify/verify-answers.js --rounds 100` → FAIL 0, AMBIG 0, 정답 보기 lint 0
- `node test-bank.js` 통과(templateId 기반 56×50)
- 실기기 Debug 설치·실행 성공 로그(`DEVICE_SMOKE.md`)
- `build/HaruSuhak-appstore.ipa` 생성(App Store 배포 서명)
- `store/metadata.ko.md`, `store/metadata.en.md`, `store/screenshots/output/`(6.9" 6장), `docs/privacy.html` 공개 URL 200
- `RELEASE_REPORT.md` + `store/ASC_CHECKLIST.md`(사람 15분 체크리스트) 완성
