# Exposing the Sleevy API through MCP

Researched 2026-07-18. This is a design and feasibility assessment only; it does not authorize or include an implementation.

## Recommendation

Expose a **small, remote MCP server at `https://api.sleevy.app/mcp`**, implemented beside the API and backed directly by Sleevy's application services. Use Streamable HTTP in stateless JSON-response mode for the first release. Do **not** mechanically translate every REST route into a tool: MCP tools should describe user tasks and their consequences, while the REST API remains the stable, general-purpose integration surface.

The project has a strong starting point: a shared Effect contract, account isolation, a fixed scope vocabulary, per-key rate limiting, and API handlers that are already thin facades over services. The principal missing capability is not the MCP tool layer but **standards-compatible remote authorization**. The existing Connect flow is deliberately limited to Chrome and Raycast and mints long-lived API keys; it is not the OAuth 2.1 authorization-server flow expected by the MCP HTTP authorization specification.

## Current Sleevy baseline

| Existing capability | Evidence | MCP implication |
| --- | --- | --- |
| REST routes and OpenAPI are defined from the shared `@sleevy/contract` Effect schemas. | [Contract ADR](../adr/0007-effect-schemas-generate-rest-openapi-contract.md), [API contract](../../apps/api/src/api/ApiContract.ts) | Reuse the DTOs and validation concepts, but define MCP input/output schemas deliberately rather than exposing OpenAPI automatically. |
| The API already serves capture, Saved Item and Folder operations, with account ownership enforced through `CurrentUser`. | [API README](../../apps/api/README.md), [handlers](../../apps/api/src/api) | All currently useful MCP actions have backend capabilities already. |
| API keys are bearer credentials, account-bound, scoped, and Redis rate-limited (20 requests/minute). | [auth middleware](../../apps/api/src/api/AuthMiddleware.ts), [scopes](../../apps/api/src/modules/auth/Scopes.ts), [rate-limit ADR](../adr/0011-redis-for-api-key-rate-limits.md) | Existing permissions map naturally to MCP tools. The limit, however, needs load testing against agent tool-call patterns. |
| First-party Connect only recognises `chrome-extension` and `raycast`, validates their redirect URIs, then returns a long-lived API key. | [Connect ADR](../adr/0013-connect-flow-for-first-party-clients.md), [client registry](../../apps/api/src/modules/connect/ConnectClients.ts), [exchange handler](../../apps/api/src/api/ConnectHandlers.ts) | It cannot enroll arbitrary MCP hosts or provide MCP OAuth discovery, token issuance, refresh, resource audience binding, or generic client registration. |
| `Bun.serve` hosts the API and applies its current CORS layer to every request. | [server entry point](../../apps/api/src/runtime/Main.ts), [HTTP app](../../apps/api/src/runtime/HttpApp.ts) | MCP can live in this process, but needs its own endpoint/security middleware; CORS is not a substitute for MCP Origin validation. |

## What the MCP surface should contain

Use tools for actions the model may invoke, with narrow input schemas and structured results. The following is an initial product surface, not a mandate to ship all tools at once.

| Tool | Sleevy capability / minimum scope | Safety and UX notes |
| --- | --- | --- |
| `save_link` | capture; `saved-items:capture` | Set the server-side capture channel to `mcp`; accepts URL, optional tags and folder. Return the Saved Item and whether it was created or updated. |
| `list_saved_items` | list; `saved-items:read` | Read-only. Keep sort and folder filtering; add a result limit/cursor before exposing large libraries to models. |
| `list_folders` | list; `folders:read` | Read-only; useful to resolve a user-named destination before saving/moving. |
| `set_saved_item_read_state` | read/unread; `saved-items:write` | Mutating but reversible. Require the item ID; do not guess an item from a vague title. |
| `move_saved_item` | set Folder; `saved-items:write` | Mutating but reversible. Accept `null` only for an explicit “Library root” request. |
| `create_folder` / `rename_folder` | Folder create/rename; `folders:write` | Mutating. Preserve the existing unique-name validation. |
| `delete_saved_item` / `delete_folder` | delete; `saved-items:delete` (or documented existing write compatibility) / `folders:delete` | Destructive: accurately advertise this characteristic, require a clearly identified target, and have the client present confirmation when its policy supports it. |

Do not expose raw database or enrichment internals. Avoid making the first release depend on resources, prompts, subscriptions, tasks, or server-to-client notifications: none is needed to save and organise links. A future `saved-item://{id}` resource or an enrichment-status tool can be considered after a concrete client need emerges.

MCP defines tools, resources, and prompts as distinct server primitives, and tool annotations such as read-only/destructive are hints rather than access control. This supports task-focused tools with server-enforced scopes, not an unfiltered REST mirror. [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture) [MCP server primitives](https://modelcontextprotocol.io/specification/2025-11-25/server/index) [MCP schema/tool annotations](https://modelcontextprotocol.io/specification/2025-11-25/schema)

## Required design decisions and work

### 1. Choose the authorization tier before exposing a public endpoint

Two viable paths have sharply different reach:

1. **Controlled beta using personal API keys.** The MCP endpoint validates Sleevy's existing bearer API key and maps its existing scopes to tools. This is fast and can work with clients that let a user configure a bearer token/header. The TypeScript SDK explicitly supports externally managed bearer tokens, including API keys, but this will not give every MCP host a smooth “Connect Sleevy” experience. [SDK client authentication](https://ts.sdk.modelcontextprotocol.io/client)
2. **Public, interoperable remote MCP.** Add or adopt an OAuth 2.1 authorization server and make Sleevy the protected resource server. The MCP endpoint must publish OAuth Protected Resource Metadata, return the appropriate `WWW-Authenticate` metadata challenge on 401, and validate tokens issued for its audience. The authorization flow must use HTTPS and PKCE; users should grant narrowly requested scopes. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

For a public product integration, select path 2. The current custom Connect flow can inform the consent UX and scope model, but it is not a standards-compliant substitute. Keep its first-party API-key issuance intact during migration rather than repurposing it ambiguously.

The OAuth work includes: authorization-server selection; OAuth authorization/token endpoints and discovery; protected-resource metadata; client registration or OAuth Client ID Metadata support; PKCE and state handling; short-lived, audience-bound access tokens plus refresh/revocation; consent and scope grants; and a tool-to-scope authorization policy. MCP requires clients to send a resource indicator and servers to validate that the presented token was issued for that resource; it also prohibits token passthrough to another upstream. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

### 2. Add the MCP server runtime and transport

Use the Tier-1 official TypeScript SDK (`@modelcontextprotocol/sdk`, with `zod`) in `apps/api`; create an `McpServer`, register the selected tool schemas, and attach a Streamable HTTP transport at `/mcp`. For a remote server, Streamable HTTP is the current transport; the older HTTP+SSE transport is deprecated. A stateless JSON-response configuration is appropriate initially because Sleevy has no MCP notification or resume requirement. [Official SDK list](https://modelcontextprotocol.io/docs/sdk) [TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/) [SDK server guide](https://ts.sdk.modelcontextprotocol.io/server) [transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

Implement the tools as a thin adapter over `CaptureService`, `SavedItemRepository`, `FolderRepository`, and the existing application layers—not by making HTTP requests back into `/v1`. That preserves account scoping, domain error mapping, observability, and future REST/MCP consistency without a loopback credential.

### 3. Meet the transport security baseline

The `/mcp` handler must validate the `Origin` header on every request and reject an invalid supplied Origin with 403; this is specifically required to prevent DNS-rebinding attacks. Apply normal TLS, request-size/time limits, structured logging with secrets redacted, and endpoint-specific rate limiting. Do not reuse the current CORS allowlist as the Origin policy: CORS controls browser access to responses, while MCP requires server-side validation for every incoming MCP connection. [transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

Authenticate every request. If sessions are later enabled, treat the SDK/session identifier only as routing state—not as identity—and bind any state to the authenticated user. [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)

### 4. Close product/API gaps exposed by agent use

- Add an `mcp` capture channel before `save_link` is released; the current contract allows only `api`, Raycast, web, iOS, and Chrome channels. [contract enum](../../packages/contract/src/index.ts)
- Add pagination and an upper response-size limit to Saved Item listing. It currently returns the entire selected library and only accepts `sort` and `folder`; that is a poor context-window and latency boundary for an agent. [query and response contract](../../packages/contract/src/index.ts)
- Consider title/URL search and explicit item disambiguation before enabling write/delete tools. Today the caller must already know an ID.
- Decide whether MCP traffic shares the present 20 RPM API-key bucket (safe initially but potentially restrictive) or gets a separately observable bucket. Preserve a hard upper bound either way.
- Define tool-specific audit events: authenticated account, OAuth/API-key client identity, tool name, requested scopes, outcome, target IDs, latency, and a redacted error code. Do not log bearer tokens, authorization codes, URLs with embedded credentials, or captured page content.
- Test invalid Origin, unauthenticated requests, insufficient scope, expired/revoked credentials, cross-account IDs, duplicate capture, malicious URLs, rate-limit behaviour, and destructive-tool confirmation behaviour in at least one MCP host plus the SDK test client.

## Suggested delivery sequence

1. Record an ADR that chooses **personal-key beta** or **OAuth public integration**, states the supported MCP clients, endpoint (`/mcp`), and scope-to-tool matrix.
2. Define the smallest read/capture-only tool set: `save_link`, `list_saved_items`, and `list_folders`; add output bounds and `mcp` capture attribution.
3. Implement the Streamable HTTP server, direct service adapters, Origin/auth/rate-limit middleware, structured tool outputs, and integration tests.
4. If public OAuth was chosen, complete the OAuth discovery/consent/token lifecycle before publishing the endpoint; do not advertise a generic connection until it works in target hosts.
5. Add reversible mutations, then destructive tools only after tool audit, confirmation, and client behaviour have been verified.
6. Publish user documentation. Registry publication is optional and the official registry is currently preview/public-only; use it only once the server is publicly reachable and installable. [Registry overview](https://modelcontextprotocol.io/registry/about) [remote server registration](https://modelcontextprotocol.io/registry/remote-servers)

## Scope-to-tool policy (proposed)

Reuse the existing scope names initially; do not create an MCP-wide master key.

| Existing scope | MCP tools |
| --- | --- |
| `saved-items:capture` | `save_link` |
| `saved-items:read` | `list_saved_items` and any future item-detail resource |
| `saved-items:write` | read-state and folder-assignment tools |
| `saved-items:delete` | `delete_saved_item` |
| `folders:read` | `list_folders` |
| `folders:write` | `create_folder`, `rename_folder` |
| `folders:delete` | `delete_folder` |

Keep session access as an internal web-client convenience only. An MCP authorization token/key should always carry explicit least-privilege scopes. The existing API’s `saved-items:write` compatibility for deletion should not become the public MCP policy; require `saved-items:delete` when the MCP server is introduced.

## Open questions to resolve in the ADR

1. Is the target a private/power-user integration (personal key acceptable) or a one-click public connection in ChatGPT, Claude, IDEs, and other hosts (OAuth required)?
2. Which hosts are launch targets, and what destructive-tool confirmation behaviour do they actually provide?
3. Should the new OAuth authorization server replace the custom first-party Connect flow, coexist with it, or be supplied by a dedicated identity provider?
4. What retention, user-visible history, and revocation controls should MCP clients have beyond the current Connected Apps screen?
5. Should a capture count against the general API-key quota, a distinct MCP quota, or a plan-specific quota?

## Bottom line

The MCP adapter itself is a contained TypeScript addition because Sleevy's API already has the right service and scope boundaries. A private beta can be modest. A public remote MCP integration is an authorization-platform project first: treat OAuth discovery, consent, audience-bound credentials, per-tool scope enforcement, and transport security as launch prerequisites rather than wrapper details.
