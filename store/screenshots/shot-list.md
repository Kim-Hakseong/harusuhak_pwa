# Shot list — 하루수학 (iPhone 6.9", 1320×2868, ko + en)

Raw: `scripts/capture-raw.js` (Playwright + Chrome, 440×956 @3x) renders `www/` with a Capacitor native stub,
so the screens match the iOS build (no PWA card, daily-reminder card shown). Clock fixed to 2026-11-04 09:00,
sample history (9-day streak, 2 wrong answers) generated with the real problem bank. `?dev=1` not used.
Framing: app-store-screenshots skill editor in this folder (`app-store-screenshots.json`), exported headlessly
with the "Export bundle" button, 6.9" set copied to `output/{ko,en}/` and flattened to RGB (no alpha).

| # | Raw | Layout | ko headline | en headline |
|---|---|---|---|---|
| 1 | 홈 — 오늘의 문제 | hero | 하루 한 문제로 / 수학 습관 완성 | One problem / a day |
| 2 | 변형 문제 + 단계별 풀이 | device-top (inverted) | 숫자만 바꿔 / 무한 연습 | New numbers, / endless practice |
| 3 | 그림 문제 (MID-06 피타고라스) | device-bottom | 그림으로 보면 / 바로 보여요 | See it, / then solve it |
| 4 | 교육과정 탭 | hero | 초등부터 / 고등까지 | From grade 4 / to high school |
| 5 | 오답노트 | device-top | 틀린 문제를 / 내 것으로 | Turn mistakes / into wins |
| 6 | 설정 (매일 알림 · 앱 정보) | device-bottom | 가입 없이 / 기기 안에서만 | No sign-up. / No tracking. |

Note: the app UI is Korean only, so the en set shows Korean screens under English captions.
Settings shot shows the about-card placeholder `[원작자 이름]` (BLOCKED B-004) — recapture after the name is filled.
