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
