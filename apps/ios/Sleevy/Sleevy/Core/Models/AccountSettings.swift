import Foundation

/// Mirror of `GET /v1/settings` (`AccountSettingsDto`): the settings that
/// follow the Account to every device. `autoFiling` puts a new save that
/// arrives without a Folder into the one existing Folder that clearly fits it.
nonisolated struct AccountSettings: Codable, Equatable, Sendable {
    var autoFiling: Bool
}
