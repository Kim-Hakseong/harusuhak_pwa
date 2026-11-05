import XCTest

// 새 버전 알림 E2E (실기기 전용). 스토어보다 낮은 버전으로 빌드해서 실행해야 한다:
//   xcodebuild test ... -only-testing:AppUITests/UpdateUITests MARKETING_VERSION=0.9.0
// 1) 실행 → "새 버전이 나왔어요" 팝업 → 업데이트 → App Store 앱이 앞으로
// 2) 다시 실행 → 팝업 → 나중에 → 다시 실행하면 같은 날에는 팝업 없음
final class UpdateUITests: XCTestCase {
    let app = XCUIApplication()
    let appStore = XCUIApplication(bundleIdentifier: "com.apple.AppStore")

    override func setUp() {
        continueAfterFailure = false
    }

    private var popup: XCUIElement { app.staticTexts["새 버전이 나왔어요"] }

    func testUpdatePopupOpensAppStoreAndLaterSuppresses() throws {
        app.launch()
        XCTAssertTrue(popup.waitForExistence(timeout: 20), "새 버전 팝업이 뜨지 않음")
        print("UPDATE-E2E 팝업 표시")
        app.buttons["업데이트"].tap()
        XCTAssertTrue(appStore.wait(for: .runningForeground, timeout: 15), "App Store 가 열리지 않음")
        print("UPDATE-E2E 업데이트 → App Store 포그라운드")

        app.terminate()
        app.launch()
        XCTAssertTrue(popup.waitForExistence(timeout: 20), "재실행 후 팝업이 뜨지 않음")
        app.buttons["나중에"].tap()
        XCTAssertFalse(popup.waitForExistence(timeout: 2), "나중에 후에도 팝업이 남아 있음")
        print("UPDATE-E2E 나중에 → 닫힘")

        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["설정"].waitForExistence(timeout: 15))
        XCTAssertFalse(popup.waitForExistence(timeout: 8), "나중에를 누른 날 다시 팝업이 뜸")
        print("UPDATE-E2E 같은 날 재실행 → 팝업 없음")
    }
}
