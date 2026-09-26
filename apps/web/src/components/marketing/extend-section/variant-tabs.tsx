// PROTOTYPE — throwaway. "Tabs": the vgpu idea. One card, a REST API / MCP
// server switch, and the command to copy as the main thing to do.

import { useState } from "react"
import { Link } from "@tanstack/react-router"
import clsx from "clsx"

import { api, apiSnippet, ArrowIcon, Code, CopyButton, mcp, mcpSnippet, type Snippet, statement } from "./extend-snippets"
import styles from "./variant-tabs.module.scss"

// What comes back: the CaptureCreated shape from the contract, trimmed.
const apiOutput: Snippet = {
  lines: [
    [["flag", "# 201 Created"]],
    [["text", "{"]],
    [["text", '  "captureResult": '], ["str", '"created"'], ["text", ","]],
    [["text", '  "savedItem": {']],
    [["text", '    "host": '], ["str", '"example.com"'], ["text", ","]],
    [["text", '    "isRead": '], ["var", "false"], ["text", ","]],
    [["text", '    "enrichmentStatus": '], ["str", '"pending"'], ["text", ","]],
    [["flag", "    …"]],
    [["text", "  }"]],
    [["text", "}"]],
  ],
}

const mcpOutput: Snippet = {
  lines: [
    [["flag", "# Sign in once, approve the scopes, then ask:"]],
    [["str", '"Save example.com/postgres-indexes to Reading."']],
  ],
}

const tabs = [
  { key: "api", content: api, snippet: apiSnippet, output: apiOutput, file: "save.sh" },
  { key: "mcp", content: mcp, snippet: mcpSnippet, output: mcpOutput, file: "terminal" },
] as const

export function VariantTabs() {
  const [active, setActive] = useState<(typeof tabs)[number]["key"]>("api")
  const tab = tabs.find((candidate) => candidate.key === active)!

  return (
    <section className={styles.section} aria-labelledby="extend-title">
      <div className={styles.inner}>
        <h2 className={styles.statement} id="extend-title">
          {statement.title} <span>{statement.lead}</span>
        </h2>

        <div className={styles.card}>
          <div className={styles.copy}>
            <div className={styles.tabs} role="tablist" aria-label="Ways to extend Sleevy">
              {tabs.map((candidate) => (
                <button
                  key={candidate.key}
                  type="button"
                  role="tab"
                  aria-selected={candidate.key === active}
                  className={clsx(styles.tab, candidate.key === active && styles.tabActive)}
                  onClick={() => setActive(candidate.key)}
                >
                  {candidate.content.title}
                </button>
              ))}
            </div>
            <p className={styles.body}>{tab.content.body}</p>
            <ul className={styles.facts}>
              {tab.content.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
            <Link className={styles.cta} to="/docs/$" params={{ _splat: tab.content.splat }}>
              {tab.content.cta}
              <ArrowIcon />
            </Link>
          </div>

          <div className={styles.terminal}>
            <div className={styles.bar}>
              <span className={styles.dots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className={styles.file}>{tab.file}</span>
              <CopyButton snippet={tab.snippet} />
            </div>
            <Code snippet={tab.snippet} className={styles.code} />
            <Code snippet={tab.output} className={styles.output} />
          </div>
        </div>
      </div>
    </section>
  )
}
