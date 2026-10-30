# BLOCKED.md

## B-001 App Store 배포 서명 — Apple Developer PLA 미동의 (사람 필요)
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
- 진행: 독립 단계(1~7)는 계속 진행. 7단계에서 export 재시도.

## B-002 고유 문항 ≥ 20종 — 16개 템플릿 미달 (헌법 충돌, 하한 고정으로 처리)
- 측정: templateId 기반 50변형(test-bank.js) — BAS-10 5, MID-03 17, MID-06 14, MID-10 15, MID-13 5, MID-14 5, HIG-05 17, HIG-08 12, HIG-11 3, HIG-13 11, LIF-07 16, LIF-10 6, LIF-11 6, LIF-12 14, LIF-13 9→6(2단계에서 명목=물가 조합 제거, 남은 조합 6개 전부), LIF-14 6.
- 원인: 매개변수 공간이 본래 작음(특수각 3종, 명제 몇 개, 주사위 합 등). 이전 test-bank는 dayIdx%7 매핑 탓에 이 템플릿들을 제대로 검사하지 않아 드러나지 않았음.
- 충돌: 다양성을 늘리려면 problem-bank 수학 로직 수정이 필요하나, CLAUDE.md는 검증기가 FAIL/AMBIG로 잡은 템플릿만 수정 허용.
- 처리: test-bank.js에 `UNIQUE_FLOOR`(현재 값 = 회귀 하한) 명시, 나머지 40개는 ≥20 유지. 확장 여부는 사람 결정(1.1 후보).
