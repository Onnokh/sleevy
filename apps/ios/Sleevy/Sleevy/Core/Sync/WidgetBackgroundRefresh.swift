import BackgroundTasks
import os

enum WidgetBackgroundRefresh {
    static let identifier = "app.sleevy.widget-refresh"
    private static let logger = Logger(subsystem: "app.sleevy", category: "widget-refresh")

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        // This is the earliest opportunity; iOS chooses the actual wake time.
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            logger.info("Could not schedule widget refresh: \(error.localizedDescription, privacy: .public)")
        }
    }

    static func cancel() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: identifier)
    }
}
