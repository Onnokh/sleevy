import XCTest

/// Add Link is in the same place on every list screen: the last button of the
/// top bar. A tap opens the same Capture Sheet on every screen.
final class AddLinkButtonUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testAddLinkIsTheLastTopBarButtonOnEveryScreen() throws {
        var positions: [String: CGFloat] = [:]

        for screen in ["library", "inbox", "folder", "tag", "search"] {
            let app = XCUIApplication()
            app.launchEnvironment["SLEEVY_DEMO_MODE"] = "1"
            app.launchEnvironment["SLEEVY_DEMO_SCREEN"] = screen
            app.launch()

            let addLink = app.navigationBars.buttons["Add Link"]
            XCTAssertTrue(addLink.waitForExistence(timeout: 10), "\(screen): no Add Link button")

            let others = app.navigationBars.buttons.allElementsBoundByIndex.filter {
                $0.label != "Add Link" && $0.frame.minY < addLink.frame.maxY
            }
            for other in others {
                XCTAssertLessThan(
                    other.frame.midX,
                    addLink.frame.midX,
                    "\(screen): \(other.label) is right of Add Link"
                )
            }
            positions[screen] = addLink.frame.midX

            addLink.tap()
            XCTAssertTrue(
                app.textFields["Paste or type URL"].waitForExistence(timeout: 5),
                "\(screen): Add Link did not open the Capture Sheet"
            )
            XCTAssertTrue(app.navigationBars["Add Link"].exists, "\(screen): the Capture Sheet has no Add Link title")

            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = "capture-sheet-\(screen)"
            shot.lifetime = .keepAlways
            add(shot)

            app.terminate()
        }

        // A lone button is its own glass circle, not part of a group, so it
        // sits up to a point further out.
        let xs = positions.values
        XCTAssertLessThanOrEqual(
            (xs.max() ?? 0) - (xs.min() ?? 0),
            2,
            "Add Link moves between screens: \(positions)"
        )
    }
}
