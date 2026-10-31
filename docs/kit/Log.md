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
