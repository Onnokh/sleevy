# integrations.sh discovery compliance

Researched 2026-07-18. This note assesses discovery/listing requirements, not MCP protocol compliance or a production release.

## Finding

Sleevy already meets the baseline to be indexed as an HTTP API: the live marketing domain exposes a valid owner declaration, OpenAPI document, `llms.txt`, and API catalog. This is **not a certification program**: integrations.sh describes the process as publishing discovery metadata on the product's own domain, then manually requesting a mapping at `https://integrations.sh/{domain}/`. [Publishing guide](https://integrations.sh/publishing/)

An MCP listing is not ready to claim on the live domain. The production MCP server-card and OAuth protected-resource URLs returned 404 during this assessment. Publish and verify those only when the public MCP endpoint and its OAuth flow are deployed.

## Requirements that apply now

| Requirement | Sleevy status | Evidence / action |
| --- | --- | --- |
| Publish a `/.well-known/integrations.json` owner declaration. It must use v3, be strict JSON, and contain only real integration surfaces. | Met | `apps/web/public/.well-known/integrations.json` parses with `jq` and declares the REST API. The registry says an invalid v3 document is silently ignored. [Declaration format and validation rule](https://integrations.sh/publishing/) |
| Declare credentials once at the top level; reference them from each surface and specify how they bind to requests. | Met for REST | The declaration describes the scoped personal API key and its `Authorization: Bearer` binding. This is the documented v3 credential/auth layout. [Credential and auth schema](https://integrations.sh/publishing/) |
| Give every declared surface a stable `slug`, type, and owner `basis.source`; include applicable URL, docs, and spec fields. | Met for REST | The REST surface declares `http`, base URL, docs, and OpenAPI URL. `basis.source` points back to the owner declaration as required. [Surface schema and rules](https://integrations.sh/publishing/) |
| Expose the canonical OpenAPI document publicly as JSON. | Met | `https://sleevy.app/openapi.json` returned `200 application/json; charset=utf-8`; the registry calls `/openapi.json` canonical and probes a few conventional alternates. [OpenAPI publication guidance](https://integrations.sh/publishing/) |
| Serve discovery metadata with a public cache policy and appropriate content type. | Met in the web server source; verify after each deploy | The web server serves JSON as `application/json` and discovery assets with a public cache policy. The registry specifically requires JSON, rejecting HTML/error responses. [Verification rule](https://integrations.sh/publishing/) |
| Publish `llms.txt` when product docs have a useful LLM-readable overview. | Met | `https://sleevy.app/llms.txt` returned `200 text/plain;charset=utf-8` and links the docs, API specification, and declaration. It is complementary metadata rather than a replacement for the declaration. [Supported discovery formats](https://integrations.sh/publishing/) |
| Publish RFC 9727 API Catalog only when appropriate. | Met and useful | `https://sleevy.app/.well-known/api-catalog` returned `200 application/linkset+json; charset=utf-8` and links the REST description/docs. The site recommends it particularly for multiple API surfaces. [API-catalog guidance](https://integrations.sh/publishing/) |

## Conditional requirements for the public MCP server

When `https://api.sleevy.app/mcp` is deployed for external use, update the declaration with a real `mcp` surface (`url` and `transports: ["streamable-http"]`) and publish:

1. `https://api.sleevy.app/.well-known/mcp/server-card.json`, containing at least the MCP connection URL. If authentication is OAuth, include its OAuth metadata in the card. [MCP server-card requirement](https://integrations.sh/publishing/)
2. `https://api.sleevy.app/.well-known/oauth-protected-resource` (or the resource-specific RFC 9728 location used by the endpoint) when OAuth protects the MCP/API resource. It must identify the resource and authorization server(s). [OAuth protected-resource guidance](https://integrations.sh/publishing/)
3. A declaration whose MCP authentication mechanics accurately state OAuth discovery (`source: "well-known"`) rather than reusing the personal-key declaration. If personal API keys remain a supported MCP option, model that as a separate valid auth alternative with its actual header mechanics. Auth entries are alternatives; credentials inside an entry are sent together. [Auth semantics](https://integrations.sh/publishing/)

Do not publish an MCP card or declaration entry before the endpoint is live and installable: the registry explicitly says to omit surfaces and files that do not actually exist. [Publication rules](https://integrations.sh/publishing/)

## Release checklist

1. On the deployed domain, request and parse every advertised JSON file; confirm its `Content-Type` is `application/json` (the API catalog is the documented `application/linkset+json` exception).
2. Confirm every URL, credential setup instruction, transport, and authentication detail is current production behavior; owner declarations are treated as statements of intent and may be augmented with verified operational caveats. [Registry behaviour](https://integrations.sh/publishing/)
3. Open `https://integrations.sh/sleevy.app/` and select **Map integration surface**. The registry says this refreshes discovery and makes the listing live immediately. [Discovery step](https://integrations.sh/publishing/)
4. Repeat the mapping after adding any new real surface, especially MCP.

Suggested live checks:

```sh
curl -sS -D- -o /dev/null https://sleevy.app/.well-known/integrations.json
curl -sS https://sleevy.app/.well-known/integrations.json | jq .
curl -sS -D- -o /dev/null https://sleevy.app/openapi.json
curl -sS -D- -o /dev/null https://api.sleevy.app/.well-known/mcp/server-card.json # after MCP launch
```
