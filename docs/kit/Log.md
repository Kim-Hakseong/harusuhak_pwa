# Log.md (append-only)

- 2026-10-30 | kit | 인계 시점 독립 검증 56×50: PASS 2708 / FAIL 83 / AMBIG 9. 실패 템플릿: HIG-08(정답 자체 오류 50/50), HIG-09(빈 괄호·소수·m:m 24/50), LIF-09(8/50 + 지문 불일치 39), BAS-06(1/50), LIF-13(AMBIG 9/50). 상세 verify/VERIFY_REPORT_baseline.md
- 2026-10-30 | S | 포크·클론, 킷 복사. verify-answers.js sha256 8d9f3967726a8c39…2554e8 = CLAUDE.md 해시 일치
- 2026-10-30 | S-4 | 기준선 node test-bank.js 통과(56유형/1400), verify --rounds 50: PASS 2708 / FAIL 83 / AMBIG 9 (baseline 일치)
- 2026-10-30 | 0 | Capacitor iOS 추가, 실기기 Debug 설치·실행 성공. App Store export는 PLA 미동의로 실패(BLOCKED B-001)
- 2026-10-30 | 2 | 문항 교정: verify --rounds 100 수정 전 PASS 5418/FAIL 165/AMBIG 17/lint 666+674 → 수정 후 PASS 5600/FAIL 0/AMBIG 0/lint 0. 검증기 미수정
- 2026-10-30 | 3 | www/figure.js 12타입·13템플릿, figure-leak-check 650건 FAIL 0(마스크 없이 돌리면 33건 검출 → 검사 유효), 라벨 viewBox 이탈 0
- 2026-10-30 | 4 | platform.js(햅틱·공유·모달·알림·포그라운드), 네이티브 DOM 정리, 토스트 존댓말, 매일 알림·앱 정보 카드, Info.plist(세로·암호화·알림 설명·arm64). 웹 스모크 21/21, 콘솔 에러 0
- 2026-10-30 | 5 | resources/icon.png 1024 RGB(알파 없음), splash 2732, @capacitor/assets --ios 생성, 다크 스플래시 제거
- 2026-10-30 | 6 | 실기기 Debug 재빌드·설치·실행 성공(DEVICE_SMOKE.md), DerivedData 삭제
- 2026-10-30 | 7-9 | Pages privacy 200, 메타데이터 ko/en, 스크린샷 12장 1320×2868 RGB. App Store export 3회 PLA로 실패(B-001), 8단계 키 없어 건너뜀. RELEASE_REPORT 작성, 임시 산출물 정리

## 2026-10-31 · B-001 감시 종료
- 20분 간격 24회 -exportArchive 재시도(23:48~07:31) 모두 PLA Update available
- .ipa 미생성 유지 — 사람이 PLA 동의 후 scripts/archive.sh app-store 재실행 필요

## 2026-10-31 · B-001 해결
- PLA 동의 후 archive.sh app-store: ARCHIVE/EXPORT SUCCEEDED, build/HaruSuhak-appstore.ipa (Apple Distribution, App Store 프로파일)
- B-003·B-004 미반영 상태 빌드 — 반영 후 재빌드

## 2026-10-31 · B-004 해결
- 원작자 이름 "정한결" 반영, test-bank 2800 · 검증기 100회 5600/0/0 · 웹 스모크 21/21
- 설정 스크린샷 ko/en 재생성, archive.sh app-store → EXPORT SUCCEEDED (Apple Distribution)

## 2026-10-31 · 하단 탭 아이콘 통일 (D-015)
- 인라인 SVG 4개 22×22, 웹 스모크 22/22, 스토어 스크린샷 재생성(10장 변경)
- app-store .ipa 재빌드(EXPORT SUCCEEDED), 실기기 Debug 설치

## 2026-10-31 · 앱 정보 크레딧 변경
- "원작: 정한결, 정재상" 한 줄, by TECHSENSE 유지. 웹 스모크 22/22
- .ipa 재빌드(EXPORT SUCCEEDED), 실기기 Debug 설치·실행

## 2026-10-31 · 매일 알림 E2E
- AppUITests 타깃 추가, 실기기 XCUITest TEST SUCCEEDED (도착 20:10:06, 탭→앱, 끈 뒤 미도착)
- app-store 재빌드 EXPORT SUCCEEDED (테스트 번들 미포함)
- 정정: 위 "app-store 재빌드 EXPORT SUCCEEDED"는 확인 전 기록 — 실제로는 공유 스킴 추가로 자동 생성 App 스킴이 사라져 실패(exit 65, "does not contain a scheme named App"). 공유 App 스킴 추가 후 재실행 → ARCHIVE/EXPORT SUCCEEDED, 20:14, 테스트 번들 미포함

## 2026-10-31 · ASC 등록
- 앱 레코드(사람) → 메타데이터·가격 무료·판매 대한민국만·스크린샷 12장 API 반영, 빌드 1 업로드·연결
- 제출 시 App Privacy 미게시·가격 미설정(스크립트 버그) 409 → 수정
- 오픈소스 라이선스 고지(D-016) 추가, 빌드 2 업로드(UPLOAD SUCCEEDED), 웹 스모크 24/24

## 2026-10-31 · 심사 제출
- 빌드 2 VALID → 1.0.0 연결, reviewSubmission 제출 → WAITING_FOR_REVIEW (12:40:46Z)

## 2026-11-05 · 교육과정 정합성 점검
- 56개 중 50개 성취기준 코드 오류 → 2022 개정 코드·공식 문안으로 수정(CURRICULUM_AUDIT.md), HIG-11 문구 수정
- 검증기 100회 5600/0/0 · test-bank 2800 · figure 650 FAIL 0 · 웹 스모크 24/24

## 2026-11-05 · 1.0.1
- 새 버전 팝업(D-017), 평가 버튼 활성화, Android 뒤로 가기·Play 평가 대비, 개인정보 처리방침 정정
- 1.0.1 (3) 아카이브·업로드(UPLOAD SUCCEEDED), ASC 1.0.1 생성·메타데이터·스크린샷 12장 재생성·빌드 연결, 웹 스모크 24/24
- 안드로이드 작업서(docs/android/ANDROID_RELEASE.md)·루트 CLAUDE.md 추가. 업데이트 팝업 실기기 테스트는 폰 잠금으로 보류
- 1.0.1 심사 제출 → WAITING_FOR_REVIEW (2026-11-05T05:39:32Z)

- 2026-11-06 · 업데이트 팝업 실기기 E2E · XCUITest(MARKETING_VERSION=0.9.0) 팝업→App Store 열림, 나중에→같은 날 재표시 없음 TEST SUCCEEDED
- 2026-11-06 · 1.0.1 심사 · ASC 상태 READY_FOR_SALE (승인·출시 완료), 폰은 1.0.1 Debug로 복구

- 2026-11-06 · 1.0.2 난이도·140유형 · verify-tiers 140×3×100 = 42000 PASS / 0 FAIL / 0 AMBIG / lint 0, 동결 검증기 5600 PASS(해시 불변), test-bank 140×50 통과, 웹 스모크 30/30
- 2026-11-06 · 1.0.2 보기 깨짐 수정 · HIG-04(중) 약 24%·BAS-11·LIF-33 예비 오답 추가, 깨지던 경우만 바뀜(스냅샷 갱신)
- 2026-11-06 · 1.0.2 실기기 · TierUITests TEST SUCCEEDED (상 전환·재실행 유지·중 복귀)
