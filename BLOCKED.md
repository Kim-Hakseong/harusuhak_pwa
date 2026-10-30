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
