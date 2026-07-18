import { describe, expect, test } from "bun:test"

import {
  hashOpaqueAccessToken,
  mcpOAuthVerificationOptions,
} from "../../src/runtime/McpApp.js"

describe("MCP OAuth verification", () => {
  test("uses the Better Auth issuer and MCP resource audience", () => {
    expect(mcpOAuthVerificationOptions("https://api.sleevy.app")).toEqual({
      audience: "https://api.sleevy.app/mcp",
      issuer: "https://api.sleevy.app/api/auth",
    })
  })

  test("hashes opaque tokens with Better Auth's SHA-256 base64url format", () => {
    expect(hashOpaqueAccessToken("opaque-access-token")).toBe(
      "ziBUtZEpY5JqE5mEv5FPe8jxfREaojHC2Eo9VfATgy4",
    )
  })
})
