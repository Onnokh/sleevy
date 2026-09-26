// PROTOTYPE — throwaway. The copy, commands, and code pieces the extend-section
// looks share. Every claim is one the docs back (getting-started.mdx, mcp.mdx,
// openapi.json); the webhooks the current section lists do not exist.

import { useState } from "react"
import clsx from "clsx"

import styles from "./extend-snippets.module.scss"

type TokenKind = "cmd" | "flag" | "str" | "var" | "text"
type Token = readonly [kind: TokenKind, text: string]
export type Snippet = { readonly lines: readonly (readonly Token[])[] }

export const apiSnippet: Snippet = {
  lines: [
    [["cmd", "curl"], ["text", " https://api.sleevy.app/v1/captures \\"]],
    [["text", "  "], ["flag", "-H"], ["str", ' "Authorization: Bearer '], ["var", "$SLEEVY_API_KEY"], ["str", '"'], ["text", " \\"]],
    [["text", "  "], ["flag", "-H"], ["str", ' "Content-Type: application/json"'], ["text", " \\"]],
    [["text", "  "], ["flag", "-d"], ["str", ` '{"url": "https://example.com/article"}'`]],
  ],
}

export const mcpSnippet: Snippet = {
  lines: [[["cmd", "npx"], ["text", " add-mcp https://api.sleevy.app/mcp "], ["flag", "--name"], ["text", " sleevy"]]],
}

export const statement = {
  title: "Built to extend.",
  lead: "Save from your own scripts with the REST API, or let an AI agent work your queue over MCP.",
}

export const api = {
  title: "REST API",
  body: "Anything that can send an HTTP request can save to your queue: a script, a CLI tool, or an automation.",
  facts: [
    "API Keys you make in settings, each limited to the scopes you grant",
    "JSON over HTTPS, described by an OpenAPI 3.1 schema",
    "An Idempotency-Key on writes, so a retry never saves twice",
    "20 requests per minute per API Key",
  ],
  cta: "Read the API docs",
  splat: "getting-started",
}

export const mcp = {
  title: "MCP server",
  body: "Connect Claude, Cursor, or any MCP client, and your agent can save, find, and sort links in the flow of a conversation.",
  facts: [
    "Save links, find saved items, and mark them read",
    "Move saved items into folders, and manage the folders",
    "OAuth sign-in: approve only what the agent needs",
    "Works with any client that speaks Streamable HTTP",
  ],
  cta: "Connect an agent",
  splat: "mcp",
}

const plainText = (snippet: Snippet) => snippet.lines.map((line) => line.map(([, text]) => text).join("")).join("\n")

export function Code({ snippet, className }: { snippet: Snippet; className?: string }) {
  return (
    <pre className={clsx(styles.code, className)}>
      <code>
        {snippet.lines.map((line, row) => (
          <span key={row} className={styles.line}>
            {line.map(([kind, text], column) => (
              <span key={column} className={styles[kind]}>
                {text}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  )
}

export function CopyButton({ snippet, className }: { snippet: Snippet; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={clsx(styles.copy, className)}
      aria-label={copied ? "Copied" : "Copy command"}
      onClick={() => {
        void navigator.clipboard.writeText(plainText(snippet))
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )}
    </button>
  )
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11.5M10.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
