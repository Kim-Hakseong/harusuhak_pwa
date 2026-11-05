# DEVICE_SMOKE — 실기기 Debug 설치·실행

- 일시: 2026-10-30
- 기기: iPhone 16 (iPhone17,3) `00008140-001611222E2B001C`, Xcode 27.0 (27A266a)
- 명령: `DEVICE_UDID=00008140-001611222E2B001C scripts/archive.sh debug-device`
- 종료 코드: 0

## 출력 발췌 (logs/step6-debug.log)
```
** BUILD SUCCEEDED **
APP=build/DerivedData/Build/Products/Debug-iphoneos/App.app
• bundleID: kr.harusuhak.app
• installationURL: file:///private/var/containers/Bundle/Application/22C1FE22-ED03-4E59-8641-9FA0BD528482/App.app/
Launched application with kr.harusuhak.app bundle identifier.
```

## 번들 확인 (build/DerivedData/.../App.app)
- Info.plist: UISupportedInterfaceOrientations = [Portrait], UIDeviceFamily = [1], ITSAppUsesNonExemptEncryption = false, 버전 1.0.0 (1)
- 네이티브 플러그인 컴파일: AppPlugin, FilesystemPlugin, HapticsPlugin, LocalNotificationsPlugin, SharePlugin, SplashScreenPlugin, StatusBarPlugin
- Assets.car(아이콘·스플래시) 포함, public/에 config.js 주입 확인, _figure_preview.html 제외 확인

## 사람이 실기기에서 확인할 것 (스크린샷 검증 금지 규칙 — 자동 확인 불가 항목)
1. 상단 노치/다이내믹 아일랜드와 헤더 간격(D-011: contentInset never + env(safe-area-inset-top))
2. 그림 문제(교육과정 탭 → MID-06 등) SVG 표시, 정답 확인 후 풀이 상단 60% 그림
3. 정답/오답 햅틱, 설정 → 매일 알림 토글 시에만 권한 팝업, 백업 → 공유 시트
4. 로고 7번 탭 → 🧪 버튼 표시, 설정 탭에 PWA 설치 카드 없음

## 매일 알림 E2E — XCUITest 실기기 (2026-10-31 20:07~20:12, iPhone 16)
- 명령: `xcodebuild test -project ios/App/App.xcodeproj -scheme AppUITests -destination "id=00008140-001611222E2B001C" -allowProvisioningUpdates`
- 테스트: `ios/App/AppUITests/NotifyUITests.swift` — 설정 → 알림 켜기(권한 허용) → 시간 휠을 2분 뒤로 → 홈 → 배너 대기 → 배너 탭 → 2분 뒤로 재설정 후 끄기 → 대기
- 결과(logs/uitest-notify.log):
  ```
  NOTIFY-E2E 대기 139초 (예정 20:10)
  NOTIFY-E2E 배너 도착: 2026-10-31 11:10:06 +0000 label=하루수학, 지금, 하루수학, 오늘의 한 문제가 준비되었어요. 3분만 풀어 볼까요?
  NOTIFY-E2E 배너 탭 → 앱 포그라운드
  NOTIFY-E2E 끈 상태 대기 144초 (예정이었던 20:12)
  NOTIFY-E2E 끈 뒤 배너 없음 확인
  Executed 1 test, with 0 failures (0 unexpected) in 257.857 seconds
  ** TEST SUCCEEDED **
  ```
- 미검증: 다음 날 같은 시각 반복(UNCalendarNotificationTrigger repeats:true 코드 경로만 확인), 첫 설치 시 권한 팝업 문구(이미 허용된 상태였음)

## 새 버전 팝업 E2E (XCUITest, 2026-11-06, iPhone 16)
명령: `xcodebuild test -scheme AppUITests -only-testing:AppUITests/UpdateUITests MARKETING_VERSION=0.9.0` (스토어 1.0.1보다 낮은 버전으로 빌드)
```
UPDATE-E2E 팝업 표시
UPDATE-E2E 업데이트 → App Store 포그라운드
UPDATE-E2E 나중에 → 닫힘
UPDATE-E2E 같은 날 재실행 → 팝업 없음
Test Case '-[AppUITests.UpdateUITests testUpdatePopupOpensAppStoreAndLaterSuppresses]' passed (24.557 seconds).
** TEST SUCCEEDED **
```
테스트 후 정상 Debug 빌드(1.0.1)로 재설치.
