import Foundation

/// Outcome of trying to push a read-state change while draining the queue.
enum PendingReadStateSyncError: LocalizedError {
    case retriable(String)
    case unretriable(String)

    var errorDescription: String? {
        switch self {
        case .retriable(let message), .unretriable(let message):
            return message
        }
    }
}

extension ReadStateQueue {
    /// Applies any queued read state on top of `items`, leaving items with no
    /// pending change (or whose pending state already matches) untouched.
    func apply(to items: [SavedItem]) -> [SavedItem] {
        let pendingStates = Dictionary(
            uniqueKeysWithValues: all().map { ($0.itemId, $0.isRead) }
        )

        return items.map { item in
            guard let pendingIsRead = pendingStates[item.id], item.isRead != pendingIsRead else {
                return item
            }

            return item.withReadState(pendingIsRead)
        }
    }
}
