// PROTOTYPE — throwaway. "Cards": the bento's quiet solid cards, one for the
// REST API and one for the MCP server, each with its own command to copy.

import { Link } from "@tanstack/react-router"

import { api, apiSnippet, ArrowIcon, Code, CopyButton, mcp, mcpSnippet, type Snippet, statement } from "./extend-snippets"
import styles from "./variant-cards.module.scss"

// The install command is one line; the next step fills the well to the API's height.
const mcpShown: Snippet = {
  lines: [
    ...mcpSnippet.lines,
    [["text", " "]],
    [["flag", "# Your client opens a sign-in. Approve the"]],
    [["flag", "# scopes, then ask your agent to save a link."]],
  ],
}

const cards = [
  { content: api, snippet: apiSnippet, shown: apiSnippet, label: "Save a link" },
  { content: mcp, snippet: mcpSnippet, shown: mcpShown, label: "Add to your MCP client" },
] as const

export function VariantCards() {
  return (
    <section className={styles.section} aria-labelledby="extend-title">
      <div className={styles.inner}>
        <h2 className={styles.statement} id="extend-title">
          {statement.title} <span>{statement.lead}</span>
        </h2>

        <div className={styles.grid}>
          {cards.map(({ content, snippet, shown, label }) => (
            <article key={content.title} className={styles.card}>
              <h3>{content.title}</h3>
              <p className={styles.body}>{content.body}</p>

              <div className={styles.snippet}>
                <div className={styles.snippetBar}>
                  <span>{label}</span>
                  <CopyButton snippet={snippet} />
                </div>
                <Code snippet={shown} className={styles.code} />
              </div>

              <ul className={styles.facts}>
                {content.facts.map((fact) => (
                  <li key={fact}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {fact}
                  </li>
                ))}
              </ul>

              <Link className={styles.cta} to="/docs/$" params={{ _splat: content.splat }}>
                {content.cta}
                <ArrowIcon />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
