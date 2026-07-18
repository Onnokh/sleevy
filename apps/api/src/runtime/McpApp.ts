import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client"
import { createAuthClient } from "better-auth/client"
import { createHash } from "node:crypto"
import { and, eq, gt } from "drizzle-orm"
import { Effect } from "effect"

import type { UserId } from "../domain/SavedItem.js"
import { BetterAuth } from "../modules/auth/BetterAuth.js"
import { type Scope, V1_SCOPES, permissionsToScopes } from "../modules/auth/Scopes.js"
import { MCP_SCOPES, McpTools } from "../modules/mcp/McpTools.js"
import { PostgresClient } from "../modules/persistence/PostgresClient.js"
import { oauthAccessToken } from "../modules/persistence/schema.js"
import { AppConfig } from "./Config.js"

const bearerCredential = (authorization: string | null) =>
  authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null

const isSignedSessionToken = (credential: string) => credential.includes(".")

// Better Auth stores opaque OAuth tokens as SHA-256 base64url hashes. OAuth
// clients may omit `resource` at the token endpoint, in which case Better Auth
// deliberately issues one of these instead of a JWT.
export const hashOpaqueAccessToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url")

export const mcpOAuthVerificationOptions = (apiBaseUrl: string) => ({
  audience: `${apiBaseUrl}/mcp`,
  issuer: `${apiBaseUrl}/api/auth`,
})

const oauthScopes = (scope: unknown): ReadonlySet<Scope> =>
  typeof scope === "string"
    ? new Set(scope.split(" ").filter((value): value is Scope => V1_SCOPES.includes(value as Scope)))
    : new Set()

const unauthorized = (baseUrl: string) =>
  new Response("Missing valid credentials or an MCP scope.", {
    status: 401,
    headers: {
      "www-authenticate": `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"`,
    },
  })

export const makeMcpWebHandler = Effect.gen(function* () {
  const config = yield* AppConfig
  const { auth } = yield* BetterAuth
  const { authDb } = yield* PostgresClient
  const mcpTools = yield* McpTools
  const oauthClient = createAuthClient({ plugins: [oauthProviderResourceClient(auth)] })

  return async (request: Request): Promise<Response> => {
    const credential = bearerCredential(request.headers.get("authorization"))
    if (!credential) return unauthorized(config.auth.baseUrl)

    let userId: UserId | undefined
    let scopes: ReadonlySet<Scope> | undefined
    try {
      if (!isSignedSessionToken(credential)) {
        try {
          const apiKey = await auth.api.verifyApiKey({ body: { key: credential } })
          if (apiKey.valid && apiKey.key) {
            userId = apiKey.key.referenceId as UserId
            scopes = permissionsToScopes(apiKey.key.permissions ?? null)
          }
        } catch {
          // OAuth bearer tokens are not API keys; continue with OAuth lookup.
        }

        if (userId === undefined) {
          const [token] = await authDb
            .select({
              userId: oauthAccessToken.userId,
              scopes: oauthAccessToken.scopes,
            })
            .from(oauthAccessToken)
            .where(
              and(
                eq(oauthAccessToken.token, hashOpaqueAccessToken(credential)),
                gt(oauthAccessToken.expiresAt, new Date()),
              ),
            )
            .limit(1)

          if (token?.userId) {
            userId = token.userId as UserId
            scopes = new Set(token.scopes.filter((scope): scope is Scope => V1_SCOPES.includes(scope as Scope)))
          }
        }
      }
      if (userId === undefined) {
        const token = await oauthClient.verifyAccessToken(credential, {
          verifyOptions: mcpOAuthVerificationOptions(config.auth.baseUrl),
        })
        if (typeof token.sub === "string") {
          userId = token.sub as UserId
          scopes = oauthScopes(token.scope)
        }
      }
    } catch {
      // Return the same neutral 401 response for invalid API keys and tokens.
    }

    if (!userId || !scopes || !MCP_SCOPES.some((scope) => scopes.has(scope))) {
      return unauthorized(config.auth.baseUrl)
    }

    return mcpTools.handlerFor(userId, scopes)(request)
  }
})
