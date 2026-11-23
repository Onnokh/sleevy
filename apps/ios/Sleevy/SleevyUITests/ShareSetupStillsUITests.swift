import UIKit
import XCTest

/// Takes the still images of Share Setup in the real share sheet of Safari:
/// one image for each step, cropped to the part that matters. The script
/// `scripts/capture-share-setup-stills.sh` runs it in light and in dark mode
/// and puts the images in the asset catalog. It is not part of the normal
/// test run: it only runs with SLEEVY_CAPTURE_SHARE_STILLS=1.
final class ShareSetupStillsUITests: XCTestCase {
    private var directory = URL(fileURLWithPath: "/tmp/sleevy-stills")
    private let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")

    @MainActor
    func testShareSetupStills() throws {
        let environment = ProcessInfo.processInfo.environment
        try XCTSkipUnless(environment["SLEEVY_CAPTURE_SHARE_STILLS"] == "1", "Takes the stills only on request.")
        if let path = environment["SLEEVY_STILLS_DIR"] { directory = URL(fileURLWithPath: path) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        // Sleevy first, so iOS knows its share extension.
        let sleevy = XCUIApplication()
        sleevy.launchEnvironment["SLEEVY_DEMO_MODE"] = "1"
        sleevy.launchEnvironment["SLEEVY_DEMO_SCREEN"] = "firstrun"
        sleevy.launch()
        sleep(2)

        safari.launch()
        XCUIDevice.shared.system.open(URL(string: "https://sleevy.app")!)
        let menu = safari.buttons["MoreMenuButton"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15))
        sleep(6) // the page loads

        // Share, from the ••• menu.
        menu.tap()
        let share = safari.buttons["Share"].firstMatch
        XCTAssertTrue(share.waitForExistence(timeout: 5))
        share.tap()
        let row = safari.collectionViews["activityCollectionView"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        sleep(2)
        let bandShareSetupRow = appRow(in: row)
        try still("ShareSetupRow", rows: bandShareSetupRow.rows, x: bandShareSetupRow.x)

        // Swipe to the end of the row: More.
        let start = row.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.49))
        let end = row.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.49))
        start.press(forDuration: 0.1, thenDragTo: end, withVelocity: 800, thenHoldForDuration: 0.3)
        sleep(1)
        let bandShareSetupMore = appRow(in: row)
        try still("ShareSetupMore", rows: bandShareSetupMore.rows, x: bandShareSetupMore.x)

        let more = row.cells.matching(identifier: "shareCell").matching(NSPredicate(format: "label == 'More'")).firstMatch
        more.tap()
        let edit = safari.buttons["Edit"].firstMatch
        XCTAssertTrue(edit.waitForExistence(timeout: 5))
        sleep(1)
        try still("ShareSetupEdit", rows: edit.frame.insetBy(dx: 0, dy: -22), x: nil)

        // Edit: the plus next to Sleevy.
        edit.tap()
        let insert = safari.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Insert Sleevy'")).firstMatch
        XCTAssertTrue(insert.waitForExistence(timeout: 5))
        sleep(1)
        let firstInsert = safari.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Insert'")).firstMatch
        let list = CGRect(
            x: 0, y: firstInsert.frame.minY - 58,
            width: 1, height: insert.frame.maxY + 18 - (firstInsert.frame.minY - 58)
        )
        try still("ShareSetupPlus", rows: list, x: nil)

        // Done, and Done: Sleevy is first in the row.
        insert.tap()
        sleep(1)
        safari.buttons["Done"].firstMatch.tap()
        sleep(1)
        safari.buttons["Done"].firstMatch.tap()
        sleep(1)
        let sleevyCell = row.cells.matching(identifier: "shareCell").matching(NSPredicate(format: "label BEGINSWITH 'Sleevy'")).firstMatch
        XCTAssertTrue(sleevyCell.waitForExistence(timeout: 5))
        if sleevyCell.frame.minX < row.frame.minX {
            end.press(forDuration: 0.1, thenDragTo: start, withVelocity: 800, thenHoldForDuration: 0.3)
            sleep(1)
        }
        let bandShareSetupFirst = appRow(in: row)
        try still("ShareSetupFirst", rows: bandShareSetupFirst.rows, x: bandShareSetupFirst.x)
    }

    /// The row of apps, cropped to the first four icons that are fully on
    /// screen, with their names: no cut icon, no separator lines.
    private func appRow(in row: XCUIElement) -> (rows: CGRect, x: CGRect) {
        let cells = row.cells.matching(identifier: "shareCell").allElementsBoundByIndex
            .map(\.frame)
            .filter { $0.minX >= row.frame.minX - 1 && $0.maxX <= row.frame.maxX + 1 }
            .sorted { $0.minX < $1.minX }
            .prefix(4)
        let top = cells.map(\.minY).min() ?? row.frame.minY
        let bottom = cells.map(\.maxY).max() ?? row.frame.maxY
        let left = (cells.first?.minX ?? row.frame.minX) - 10
        let right = (cells.last?.maxX ?? row.frame.maxX) + 10
        return (
            CGRect(x: 0, y: top + 4, width: 1, height: bottom - top - 4),
            CGRect(x: left, y: 0, width: right - left, height: 1)
        )
    }

    /// Saves the screen between the top and bottom of `rows`, and between the
    /// sides of `x` (or the full width), as a PNG.
    private func still(_ name: String, rows: CGRect, x: CGRect?) throws {
        let screen = XCUIScreen.main.screenshot().image
        guard let image = screen.cgImage else { return }
        let scale = CGFloat(image.width) / safari.frame.width
        let left = x?.minX ?? 0, right = x?.maxX ?? safari.frame.width
        let crop = CGRect(x: left, y: rows.minY, width: right - left, height: rows.height)
            .applying(CGAffineTransform(scaleX: scale, y: scale))
            .integral
        guard let cropped = image.cropping(to: crop),
              let png = UIImage(cgImage: cropped, scale: scale, orientation: .up).pngData() else { return }
        try png.write(to: directory.appendingPathComponent("\(name).png"))

        let shot = XCTAttachment(image: UIImage(cgImage: cropped))
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
