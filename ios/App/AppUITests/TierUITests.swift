import XCTest

// 난이도 하·중·상 전환 (실기기 전용, 약 30초)
// 상 → 토스트·지문 변경, 앱 재실행 후에도 상 유지, 중 → 원래 지문
final class TierUITests: XCTestCase {
    let app = XCUIApplication()

    override func setUp() { continueAfterFailure = false }

    private func question() -> String {
        // 문제 지문 = "?" 가 들어 있는 정적 텍스트 (출처 줄 제외, 화면 위쪽 첫 번째)
        let e = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@ AND NOT (label BEGINSWITH '📚')", "(?s).{6,}\\?.*")).firstMatch
        if !e.waitForExistence(timeout: 5) {
            print("TIER-DEBUG", app.staticTexts.allElementsBoundByIndex.prefix(60).map(\.label))
        }
        XCTAssertTrue(e.exists, "문제 지문을 찾지 못함")
        return e.label
    }

    func testTierSwitch() throws {
        app.launch()
        let hard = app.buttons["난이도 상"], normal = app.buttons["난이도 중"]
        XCTAssertTrue(hard.waitForExistence(timeout: 20), "하·중·상 버튼 없음")
        if app.staticTexts["새 버전이 나왔어요"].waitForExistence(timeout: 3) { app.buttons["나중에"].tap() }
        app.swipeUp()
        normal.tap()
        let q0 = question()
        print("TIER-E2E 중 지문: \(q0)")
        hard.tap()
        XCTAssertTrue(app.staticTexts["난이도 상 문제로 바꿨어요"].waitForExistence(timeout: 5), "상 전환 토스트 없음")
        let q1 = question()
        print("TIER-E2E 상 지문: \(q1)")
        XCTAssertNotEqual(q0, q1, "상으로 바꿨는데 지문이 같음")

        app.terminate(); app.launch()
        XCTAssertTrue(hard.waitForExistence(timeout: 20))
        sleep(2)
        XCTAssertEqual(question(), q1, "재실행 후 상 문제가 유지되지 않음")
        print("TIER-E2E 재실행 후 상 유지")
        normal.tap()
        sleep(1)
        XCTAssertEqual(question(), q0, "중으로 돌아왔는데 원래 지문이 아님")
        print("TIER-E2E 중 복귀 → 원래 지문")
    }
}
