# ✅ 1.0.2 심사 제출 — 2026-11-06 11:01 KST (WAITING_FOR_REVIEW)
- 1.0.2 (4): 문제 유형 56 → 140(수준당 35), 모든 유형 난이도 하·중·상 버튼, 고등에 확률과 통계 추가, HIG-04 등 보기 깨짐 수정, 배지 줄바꿈 수정, 스크린샷 재생성
- 검증: verify-tiers 140×3×100 = 42000 PASS / 0 FAIL / 0 AMBIG / lint 0 · 동결 검증기 5600 PASS(해시 불변) · test-bank 140×50 · 웹 스모크 30/30 · 실기기 TierUITests TEST SUCCEEDED

## 1.0.1 출시 — 2026-11-05 제출, 2026-11-06 확인 READY_FOR_SALE
- 1.0.1 (3): 성취기준 코드 2022 개정 정정(CURRICULUM_AUDIT.md), 새 버전 알림 팝업(D-017), 평가 버튼, 개인정보 처리방침 정정, 스크린샷 재생성
- 보류: 업데이트 팝업 실기기 XCUITest(`AppUITests/UpdateUITests`, MARKETING_VERSION=0.9.0 로 실행) — 폰 잠금
- 안드로이드: `docs/android/ANDROID_RELEASE.md`

# ✅ 심사 제출 완료 — 2026-10-31 21:40 KST (WAITING_FOR_REVIEW)
- 앱: 하루수학 · ASC 앱 ID 6829197013 · 1.0.0 (2) · 판매 지역 대한민국만 · 무료 · 교육 · 4+
- 자동화: `scripts/asc/upload.sh`(altool) + `node scripts/asc/release.mjs setup|media|attach|submit|check` (키는 ~/.haku-env)
- 사람이 한 것: ASC 앱 레코드 생성, App Privacy "데이터 미수집" 게시
- 남은 사람 일: 가격 및 사용 가능 여부 → "새로운 국가 또는 지역에서 자동으로 사용 가능" 해제(API 불가)
- 다음 업데이트: APP_STORE_ID=6829197013 을 ~/.haku-env 에 넣어 "App Store에서 평가하기" 활성화, SUPPORT_EMAIL(선택)

# ASC_CHECKLIST.md — 사람이 하는 15분 (Ralph 완료 후)

전제: Ralph가 `build/HaruSuhak-appstore.ipa`, `store/metadata.ko.md`, `store/metadata.en.md`, `store/screenshots/output/*.png`, `docs/privacy.html` URL을 RELEASE_REPORT.md에 기록해 둔 상태.

1. App Store Connect → 나의 앱 → ＋ → 신규 앱: 이름 **하루수학**(충돌 시 RELEASE_REPORT의 대체명), 기본 언어 한국어, 번들 ID `kr.harusuhak.app`, SKU `harusuhak-ios`. → Apple ID 숫자 확인
2. (선택) `~/.haku-env`에 `APP_STORE_ID=<숫자>` 추가 후 `scripts/archive.sh app-store` 재실행 → 설정 탭 "App Store에서 평가" 버튼 활성화된 .ipa
3. Transporter 앱(또는 Xcode Organizer)으로 `.ipa` 업로드 → 처리 완료 대기(5~30분)
4. 앱 정보: 카테고리 Education, 연령 등급 설문 전부 "없음" → 4+. **Kids 카테고리 체크 안 함**
5. 1.0 준비: 스크린샷 6.9" 6장 드래그, `store/metadata.ko.md`에서 부제·설명·키워드·홍보 문구 붙여넣기, 영어 현지화 추가 후 `metadata.en.md`
6. 개인정보 처리방침 URL: RELEASE_REPORT의 Pages URL. App Privacy → **데이터 미수집**
7. 심사 정보 → 메모: metadata.ko.md의 "심사 노트" 단락 붙여넣기. 로그인 불필요 체크
8. 빌드 선택 → 수출 규정: 암호화 사용 안 함(Info.plist에 이미 선언) → **수동 출시** 선택
9. 제출. (제출 규칙: 다른 TECHSENSE 유틸리티가 심사 중이어도 교육 장르라 예외 — D-010)

---

# RELEASE_REPORT — 하루수학 iOS 1.0 (2026-10-30)

## ⚠️ 사람이 먼저 할 일 (이것 없이는 제출 불가)
1. ~~developer.apple.com 개정 약관(PLA) 동의~~ — 완료(2026-10-31), 배포 서명 정상
2. ~~`[원작자 이름]` 채우기~~ — 완료: "원작: 정한결, 정재상" + by TECHSENSE (사용자 지정)
3. **`SUPPORT_EMAIL`** 을 `~/.haku-env`에 추가 (B-003) — 피드백 버튼, ASC 지원 연락처
4. 위 2·3 반영 후 `scripts/archive.sh app-store` 재실행 → `build/HaruSuhak-appstore.ipa`. (2 반영 시 설정 스크린샷도 `scripts/capture-raw.js` → 편집기 export 로 재생성 권장)

## 빌드
| 항목 | 값 |
|---|---|
| 번들 ID | `kr.harusuhak.app` · Team `HFDSR2HFT4` |
| 버전 / 빌드 | 1.0.0 / 1 (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`) |
| 대상 | iPhone 전용(`TARGETED_DEVICE_FAMILY=1`), 세로 고정, iOS 15+ |
| 실기기 Debug | 성공 — iPhone 16 설치·실행 (`DEVICE_SMOKE.md`) |
| Release archive | 성공 — `archives/HaruSuhak.xcarchive` |
| App Store .ipa | `build/HaruSuhak-appstore.ipa` (2026-10-31 19:05, 1.0.0 (1), Apple Distribution 서명·App Store 프로파일, 원작자 이름 반영). SUPPORT_EMAIL 없음 → 피드백 버튼 숨김(B-003) |
| TestFlight | 미수행 — `~/.haku-env`에 ASC_KEY_ID·ASC_ISSUER_ID·ASC_KEY_PATH 없음 (8단계 건너뜀, 지시대로) |

## 공개 URL
- 개인정보 처리방침: https://kim-hakseong.github.io/harusuhak_pwa/privacy.html — `HTTP 200` 확인(23:43)
- 리포(포크): https://github.com/Kim-Hakseong/harusuhak_pwa (upstream push URL 비활성화)

## 검증 합계 — `node verify/verify-answers.js --rounds 100` (검증기 sha256 `8d9f3967…2554e8` 불변)
| | PASS | FAIL | AMBIG | lint(지문) | lint(보기) |
|---|---|---|---|---|---|
| 수정 전 | 5418 | 165 | 17 | 666 | 674 |
| 수정 후 | **5600** | **0** | **0** | **0** | **0** |

- `node test-bank.js`: 56유형 × 50변형 = 2800문항 통과 (templateId 기반, 결정론·보기 중복·풀이 ≥2단계)
- `node verify/figure-leak-check.js`: 13템플릿 × 50 = 650건 FAIL 0 (마스크를 끄면 33건 검출 → 검사가 실제로 잡음을 확인)
- 웹 회귀 `scripts/web-smoke.js`: 21/21 PASS, 콘솔 에러 0
- 상세: `VERIFY_REPORT.md`

## 수정한 템플릿 (problem-bank.js 153+/100−)
| 템플릿 | 수정 |
|---|---|
| 전체 65곳 | `을(를)`·`(으)로`·하드코딩 조사 → `www/ko.js` `HaruKo` |
| HIG-08 | 분자 = 정답 × (d + i) 로 생성(기존 정답 100% 오류), `cx()` 표기 |
| HIG-09 | 서로소 m≠n, 정수 내분점, n:m 오답 정확 계산(빈 괄호 버그 제거) |
| LIF-09 | 지문 MB = GB×1000, 정수 초 조합만, 오답 소수 1자리 |
| BAS-06 | `Math.round` |
| LIF-13 | 물가 > 명목 조합만(중복 보기 제거) |
| MID-11 | `(x + -12)` → `(x − 12)` |
| LIF-10 | 숫자 겹치던 오답 → "총액 5% 오인" |
| HIG-02·LIF-08 | **풀이 문장 표기만**(`(k + -1)`, `3.999999999999999원`) — 검증기 lint 대상 밖. 수학 로직 불변이지만 헌법상 회색지대라 명시 |

## 새로 만든 것
- `www/ko.js`(조사), `www/figure.js`(SVG 12타입·13템플릿), `www/platform.js`(햅틱·공유·모달·알림·포그라운드), `www/_figure_preview.html`(개발용, iOS 번들 제외)
- 설정 탭: 매일 알림 카드(iOS만, 기본 08:00, 토글 시에만 권한), 앱 정보 카드. 토스트 존댓말, alert/confirm → 커스텀 모달
- 네이티브: PWA 설치·프레임·SW 카드 제거, SW 미등록, 🧪 숨김(로고 7탭 / 웹 `?dev=1`)
- 아이콘 1024(알파 없음)·스플래시(라이트만), Info.plist(세로·암호화 false·알림 설명·arm64)
- `scripts/archive.sh`, `scripts/web-smoke.js`, `scripts/capture-raw.js`, `verify/figure-leak-check.js`

## 스토어 산출물
- `store/metadata.ko.md`, `store/metadata.en.md` (글자 수 한도 확인, 심사 노트 포함)
- `store/screenshots/output/ko/01~06.png`, `output/en/01~06.png` — 12장 모두 `sips` 1320×2868, RGB(알파 없음)

## BLOCKED (BLOCKED.md)
- ~~B-001 PLA 미동의~~ → 해결(2026-10-31), .ipa 생성
- B-002 16개 템플릿 고유 문항 < 20 (수학 로직 동결과 충돌 → 현재 값을 회귀 하한으로)
- B-003 SUPPORT_EMAIL 없음
- ~~B-004 `[원작자 이름]` 자리표시자~~ → 해결(정한결)

## 결정 기록 추가 (docs/kit/DECISIONS.md)
D-011 safe-area(contentInset never + env), D-012 config.js iOS 번들에만 주입, D-013 그림 라벨(p·q, 눈금, 구간), D-014 아이콘 알파 제거·다크 스플래시 제거

## 사람이 실기기에서 볼 것 (DEVICE_SMOKE.md 하단)
상단 여백(노치), 그림 표시, 햅틱, 알림 권한 타이밍, 공유 시트, 로고 7탭
