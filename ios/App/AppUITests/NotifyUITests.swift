import XCTest

// 매일 알림 E2E (실기기 전용, 약 5분)
// 1) 설정 → 알림 켜기(권한 허용) → 2분 뒤 시각으로 설정 → 홈으로 나가 배너 도착 확인 → 배너 탭 → 앱 열림
// 2) 다시 2분 뒤로 설정 후 알림 끄기 → 그 시각이 지나도 배너가 오지 않음
// 실행: xcodebuild test -project ios/App/App.xcodeproj -scheme AppUITests -destination "id=<UDID>" -allowProvisioningUpdates
final class NotifyUITests: XCTestCase {
    let app = XCUIApplication()
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let bannerText = "오늘의 한 문제"

    override func setUp() {
        continueAfterFailure = false
    }

    func testDailyNotificationArrivesAndStopsWhenOff() throws {
        app.launch()
        openNotifyCard()

        // 켜기 (권한 팝업이 뜨면 허용)
        setToggle(on: true)

        // 1) 2분 뒤 → 알림 도착
        let t1 = try setTime(minutesAhead: 2)
        assertStatus("매일 \(t1.label)에 알려 드려요")
        XCUIDevice.shared.press(.home)
        let banner = springboard.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", bannerText)).firstMatch
        let wait1 = t1.date.timeIntervalSinceNow + 60
        print("NOTIFY-E2E 대기 \(Int(wait1))초 (예정 \(t1.label))")
        XCTAssertTrue(banner.waitForExistence(timeout: wait1), "\(t1.label) 알림 배너가 오지 않음")
        print("NOTIFY-E2E 배너 도착: \(Date()) label=\(banner.label)")

        // 배너 탭 → 앱이 앞으로
        banner.tap()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10), "배너 탭 후 앱이 열리지 않음")
        print("NOTIFY-E2E 배너 탭 → 앱 포그라운드")

        // 2) 2분 뒤로 바꾼 다음 끄기 → 오지 않아야 함
        openNotifyCard()
        let t2 = try setTime(minutesAhead: 2)
        setToggle(on: false)
        assertStatus("꺼져 있어요")
        XCUIDevice.shared.press(.home)
        let wait2 = t2.date.timeIntervalSinceNow + 45
        print("NOTIFY-E2E 끈 상태 대기 \(Int(wait2))초 (예정이었던 \(t2.label))")
        XCTAssertFalse(banner.waitForExistence(timeout: wait2), "알림을 껐는데 \(t2.label) 배너가 옴")
        print("NOTIFY-E2E 끈 뒤 배너 없음 확인")
    }

    // MARK: - 헬퍼

    private func openNotifyCard() {
        let settings = app.buttons["설정"]
        XCTAssertTrue(settings.waitForExistence(timeout: 15))
        settings.tap()
        XCTAssertTrue(app.switches["매일 알림 켜기"].waitForExistence(timeout: 10))
        app.swipeUp()
    }

    private func setToggle(on: Bool) {
        let toggle = app.switches["매일 알림 켜기"]
        if ((toggle.value as? String) == "1") != on {
            toggle.tap()
            if on {
                let allow = springboard.alerts.buttons.matching(
                    NSPredicate(format: "label IN {'허용', 'Allow'}")).firstMatch
                if allow.waitForExistence(timeout: 5) { allow.tap() }
            }
        }
        let want = on ? "1" : "0"
        let ok = NSPredicate(format: "value == %@", want)
        XCTAssertEqual(XCTWaiter().wait(for: [expectation(for: ok, evaluatedWith: toggle)], timeout: 5), .completed,
                       "토글이 \(want)이 되지 않음")
    }

    /// 시간 휠(시·분·AM/PM)을 지금+n분(초가 40초 넘으면 +1분 여유)으로 맞추고 Done
    private func setTime(minutesAhead n: Int) throws -> (date: Date, label: String) {
        var target = Date().addingTimeInterval(TimeInterval(n * 60))
        if Calendar.current.component(.second, from: target) > 40 { target.addTimeInterval(60) }
        let c = Calendar.current.dateComponents([.hour, .minute], from: target)
        let h24 = c.hour!, m = c.minute!
        let h12 = h24 % 12 == 0 ? 12 : h24 % 12

        let field = app.otherElements.matching(NSPredicate(format: "label == '알림 시간' AND value != nil")).element(boundBy: 0)
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        let wheels = app.datePickers.firstMatch.pickerWheels
        XCTAssertTrue(wheels.element(boundBy: 0).waitForExistence(timeout: 5), "시간 선택기가 열리지 않음")
        wheels.element(boundBy: 2).adjust(toPickerWheelValue: h24 < 12 ? "AM" : "PM")
        wheels.element(boundBy: 0).adjust(toPickerWheelValue: String(h12))
        wheels.element(boundBy: 1).adjust(toPickerWheelValue: String(format: "%02d", m))
        app.buttons["Done"].tap()

        // 실제 예정 시각(초 0)
        var dc = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: target)
        dc.second = 0
        let date = Calendar.current.date(from: dc)!
        return (date, String(format: "%02d:%02d", h24, m))
    }

    private func assertStatus(_ text: String) {
        XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 5), "상태 문구 '\(text)' 없음")
    }
}
