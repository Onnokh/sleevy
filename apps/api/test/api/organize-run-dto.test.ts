import { describe, expect, test } from "bun:test"
import { Schema } from "effect"

import { OrganizeRunDto } from "../../src/api/ApiContract.js"
import { toRunDto } from "../../src/api/SettingsHandlers.js"

describe("Organize run response", () => {
  // The run carries its plan as plain data. The response encoder only accepts
  // the nested DTO classes, and a ready run once answered 500 because of it.
  test("encodes a ready run with its plan", () => {
    const run = {
      status: "ready",
      phase: null,
      done: 3,
      total: 3,
      plan: {
        newFolders: [{ key: "new-1", name: "Recipes", emoji: "🍲", color: null }],
        moves: [
          { savedItemId: "s-1", title: "Curry", url: "https://example.com/1", folderId: null, newFolderKey: "new-1" },
          { savedItemId: "s-2", title: null, url: "https://example.com/2", folderId: "f-1", newFolderKey: null },
        ],
        considered: 3,
      },
    } as const

    expect(Schema.encodeUnknownSync(OrganizeRunDto)(toRunDto(run))).toEqual(run)
  })

  test("encodes an idle run", () => {
    const run = { status: "idle", phase: null, done: 0, total: 0, plan: null } as const
    expect(Schema.encodeUnknownSync(OrganizeRunDto)(toRunDto(run))).toEqual(run)
  })
})
