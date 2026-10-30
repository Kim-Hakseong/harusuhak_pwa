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
