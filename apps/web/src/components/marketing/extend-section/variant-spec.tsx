// PROTOTYPE — throwaway. "Spec sheet": no cards. The heading holds the left
// column; the right column is two plain spec tables under thin rules, the way
// a developer reads a reference page.

import { Link } from "@tanstack/react-router"

import { ArrowIcon, CopyButton, mcpSnippet, statement } from "./extend-snippets"
import styles from "./variant-spec.module.scss"

const tools = [
  "save_link",
  "list_saved_items",
  "set_saved_item_read_state",
  "set_saved_item_folder",
  "list_folders",
  "add_folder",
  "delete_saved_item",
  "remove_folder",
]

export function VariantSpec() {
  return (
    <section className={styles.section} aria-labelledby="extend-title">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <h2 className={styles.title} id="extend-title">
            {statement.title}
          </h2>
          <p className={styles.lead}>{statement.lead}</p>
          <div className={styles.links}>
            <Link to="/docs/$" params={{ _splat: "getting-started" }}>
              Read the API docs
              <ArrowIcon />
            </Link>
            <Link to="/docs/$" params={{ _splat: "mcp" }}>
              Connect an agent
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className={styles.tables}>
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <h3>REST API</h3>
              <code>api.sleevy.app/v1</code>
            </div>
            <dl>
              <div>
                <dt>Auth</dt>
                <dd>API Keys you make in settings, each limited to the scopes you grant</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>
                  JSON over HTTPS, described by an <a href="/openapi.json">OpenAPI 3.1 schema</a>
                </dd>
              </div>
              <div>
                <dt>Retries</dt>
                <dd>Send an Idempotency-Key on a write, and a retry never saves twice</dd>
              </div>
              <div>
                <dt>Rate limit</dt>
                <dd>20 requests per minute per API Key</dd>
              </div>
            </dl>
          </div>

          <div className={styles.group}>
            <div className={styles.groupHead}>
              <h3>MCP server</h3>
              <code>api.sleevy.app/mcp</code>
            </div>
            <dl>
              <div>
                <dt>Install</dt>
                <dd className={styles.install}>
                  <code>npx add-mcp https://api.sleevy.app/mcp --name sleevy</code>
                  <CopyButton snippet={mcpSnippet} />
                </dd>
              </div>
              <div>
                <dt>Sign-in</dt>
                <dd>OAuth, where you approve only what the agent needs. No API Key to paste.</dd>
              </div>
              <div>
                <dt>Tools</dt>
                <dd className={styles.tools}>
                  {tools.map((tool) => (
                    <code key={tool}>{tool}</code>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Clients</dt>
                <dd>Any client that speaks Streamable HTTP</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
