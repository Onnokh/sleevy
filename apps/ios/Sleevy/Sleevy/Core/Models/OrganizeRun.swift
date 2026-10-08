import Foundation

/// Mirror of `GET /v1/settings/organize` (`OrganizeRunDto`): the Account's one
/// Organize run, which sorts every unfiled save into Folders in the background
/// and leaves a plan that changes nothing until it is applied.
nonisolated struct OrganizeRun: Codable, Equatable, Sendable {
    enum Status: String, Codable, Sendable {
        case idle, running, ready, failed
    }

    enum Phase: String, Codable, Sendable {
        case proposing, filing
    }

    let status: Status
    let phase: Phase?
    let done: Int
    let total: Int
    let plan: OrganizePlan?
}

nonisolated struct OrganizePlan: Codable, Equatable, Sendable {
    let newFolders: [OrganizeNewFolder]
    let moves: [OrganizeMove]
    let considered: Int
}

/// A Folder the plan proposes and that does not exist yet.
nonisolated struct OrganizeNewFolder: Codable, Equatable, Sendable {
    let key: String
    let name: String
    let emoji: String?
    let color: String?
}

/// One unfiled save and its target: an existing Folder or a proposed one.
nonisolated struct OrganizeMove: Codable, Equatable, Sendable, Identifiable {
    let savedItemId: String
    let title: String?
    let url: String
    let folderId: String?
    let newFolderKey: String?

    var id: String { savedItemId }
}

nonisolated struct OrganizeApply: Encodable, Sendable {
    struct Move: Encodable, Sendable {
        let savedItemId: String
        let folderId: String?
        let newFolderKey: String?

        // The API wants both keys present, one of them null.
        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(savedItemId, forKey: .savedItemId)
            try container.encode(folderId, forKey: .folderId)
            try container.encode(newFolderKey, forKey: .newFolderKey)
        }

        private enum CodingKeys: String, CodingKey {
            case savedItemId, folderId, newFolderKey
        }
    }

    let newFolders: [OrganizeNewFolderPayload]
    let moves: [Move]
}

/// `OrganizeNewFolder` with its null emoji and colour written out, as the API
/// requires every key.
nonisolated struct OrganizeNewFolderPayload: Encodable, Sendable {
    let folder: OrganizeNewFolder

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(folder.key, forKey: .key)
        try container.encode(folder.name, forKey: .name)
        try container.encode(folder.emoji, forKey: .emoji)
        try container.encode(folder.color, forKey: .color)
    }

    private enum CodingKeys: String, CodingKey {
        case key, name, emoji, color
    }
}

nonisolated struct OrganizeResult: Codable, Equatable, Sendable {
    let filed: Int
    let foldersCreated: Int
}
