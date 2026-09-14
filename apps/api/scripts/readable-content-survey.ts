// Measures how much Readable Content this host could actually extract, and
// writes nothing.
//
// The extraction rate depends on where it is measured from. A laptop on a
// residential address reaches pages the Hetzner origin is refused outright, so
// a rate measured locally is optimistic by an unknown margin. This reports the
// rate from wherever it runs, and separates the two things that decide it: what
// the host can fetch, and what Readability makes of what it got.
//
// Usage, from inside the api container (which has bun and the deps):
//
//   docker exec -e CLOUDFLARE_ACCOUNT_ID=… -e CLOUDFLARE_API_TOKEN=… \
//     <container> bun scripts/readable-content-survey.ts
//
// DATABASE_URL is read from the environment. Cloudflare credentials are
// optional: without them the Cloudflare tier is reported as unmeasured rather
// than as a failure.

import { SQL } from "bun"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? ""
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? ""
const CLOUDFLARE_READY = ACCOUNT_ID.length > 0 && API_TOKEN.length > 0

// The free plan allows one quick action per ten seconds, so the rescue pass is
// spaced and capped rather than run over everything that failed.
const RESCUE_LIMIT = Number(process.env.RESCUE_LIMIT ?? 25)
const RESCUE_SPACING_MS = Number(process.env.RESCUE_SPACING_MS ?? 11_000)

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"

type Row = { id: string; original_url: string; host: string; type: string }

type Outcome = {
  url: string
  host: string
  type: string
  direct: "ok" | "blocked" | "http-error" | "network-error" | "not-html"
  directDetail?: string
  rescue?: "rescued" | "failed" | "unmeasured"
  extraction?: "extracted" | "no-article" | "unmeasured"
  markdownChars?: number
}

// Readability and the converter only exist in an image built from the branch
// that added them. Without them the fetch numbers are still worth having, so
// the extraction column is reported as unmeasured instead of failing the run.
const loadExtractor = async () => {
  try {
    const [{ Readability, isProbablyReaderable }, { parseHTML }, turndownModule] =
      await Promise.all([
        import("@mozilla/readability"),
        import("linkedom"),
        import("turndown"),
      ])
    const TurndownService = (turndownModule as any).default ?? turndownModule
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    })

    return (html: string, url: string) => {
      const check = parseHTML(html).document
      if (check.querySelectorAll("*").length > 20_000) return undefined
      if (!isProbablyReaderable(check as never, { minContentLength: 140, minScore: 20 })) {
        return undefined
      }

      const doc = parseHTML(html).document as any
      for (const key of ["baseURI", "documentURI"]) {
        Object.defineProperty(doc, key, { value: url, configurable: true })
      }
      const article = new Readability(doc, {
        charThreshold: 500,
        maxElemsToParse: 20_000,
        keepClasses: false,
      }).parse()

      if (!article?.content?.trim()) return undefined
      if ((article.textContent?.trim().length ?? 0) < 500) return undefined
      const markdown = turndown.turndown(article.content).trim()
      return markdown.length > 0 ? markdown : undefined
    }
  } catch {
    return undefined
  }
}

const directFetch = async (url: string) => {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      return {
        kind: res.status === 403 || res.status === 429 ? ("blocked" as const) : ("http-error" as const),
        detail: `HTTP ${res.status}`,
      }
    }
    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("html")) {
      return { kind: "not-html" as const, detail: contentType.split(";")[0] }
    }
    return { kind: "ok" as const, html: await res.text() }
  } catch (error) {
    return { kind: "network-error" as const, detail: String(error).slice(0, 60) }
  }
}

const cloudflareRender = async (url: string) => {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/browser-rendering/content`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${API_TOKEN}` },
    body: JSON.stringify({ url, gotoOptions: { waitUntil: "networkidle0" } }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const body = (await res.json()) as { success: boolean; result?: string; errors?: Array<{ message: string }> }
  if (!body.success) throw new Error(body.errors?.map((e) => e.message).join("; ") || "success=false")
  const html = body.result
  if (!html?.trim()) throw new Error("empty result")
  return html
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const main = async () => {
  const extract = await loadExtractor()

  let egressIp = "unknown"
  try {
    egressIp = (await (await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(8_000) })).text()).trim()
  } catch {}

  console.log("=== WHERE THIS RAN ===")
  console.log(`  egress address     : ${egressIp}`)
  console.log(`  cloudflare creds   : ${CLOUDFLARE_READY ? "present" : "ABSENT (rescue pass unmeasured)"}`)
  console.log(`  extractor deps     : ${extract ? "present" : "ABSENT (extraction unmeasured)"}`)
  console.log()

  const sql = new SQL(DATABASE_URL)
  const rows: Row[] = await sql`
    select l.id, l.original_url, l.host, e.type
    from links l
    join link_enrichment e on e.link_id = l.id
    where exists (select 1 from saved_items s where s.link_id = l.id)
    order by l.created_at
  `
  await sql.end()

  console.log(`=== POPULATION ===\n  links with a Saved Item: ${rows.length}\n`)

  const outcomes: Outcome[] = []
  let done = 0
  for (const row of rows) {
    const result = await directFetch(row.original_url)
    const outcome: Outcome = {
      url: row.original_url,
      host: row.host,
      type: row.type,
      direct: result.kind,
      ...(("detail" in result && result.detail) ? { directDetail: result.detail } : {}),
    }
    if (result.kind === "ok" && extract) {
      const markdown = extract(result.html, row.original_url)
      outcome.extraction = markdown ? "extracted" : "no-article"
      if (markdown) outcome.markdownChars = markdown.length
    } else if (result.kind === "ok") {
      outcome.extraction = "unmeasured"
    }
    outcomes.push(outcome)
    if (++done % 25 === 0) console.error(`  … ${done}/${rows.length}`)
  }

  // Everything the host could not fetch is what the Cloudflare tier exists for.
  const needRescue = outcomes.filter((o) => o.direct === "blocked" || o.direct === "http-error" || o.direct === "network-error")
  let rescueBudget = RESCUE_LIMIT
  for (const outcome of needRescue) {
    if (!CLOUDFLARE_READY || rescueBudget <= 0) {
      outcome.rescue = "unmeasured"
      continue
    }
    rescueBudget--
    try {
      const html = await cloudflareRender(outcome.url)
      outcome.rescue = "rescued"
      if (extract) {
        const markdown = extract(html, outcome.url)
        outcome.extraction = markdown ? "extracted" : "no-article"
        if (markdown) outcome.markdownChars = markdown.length
      } else {
        outcome.extraction = "unmeasured"
      }
    } catch (error) {
      outcome.rescue = "failed"
      outcome.directDetail = `${outcome.directDetail ?? ""} | cf: ${String(error).slice(0, 80)}`.trim()
    }
    await sleep(RESCUE_SPACING_MS)
  }

  const count = (predicate: (o: Outcome) => boolean) => outcomes.filter(predicate).length

  console.log("=== DIRECT FETCH FROM THIS HOST ===")
  for (const kind of ["ok", "blocked", "http-error", "network-error", "not-html"] as const) {
    console.log(`  ${kind.padEnd(16)} ${String(count((o) => o.direct === kind)).padStart(4)}`)
  }

  console.log("\n=== CLOUDFLARE RESCUE (of what the host could not fetch) ===")
  console.log(`  needed rescue    ${String(needRescue.length).padStart(4)}`)
  for (const kind of ["rescued", "failed", "unmeasured"] as const) {
    console.log(`  ${kind.padEnd(16)} ${String(count((o) => o.rescue === kind)).padStart(4)}`)
  }

  console.log("\n=== EXTRACTION ===")
  for (const kind of ["extracted", "no-article", "unmeasured"] as const) {
    console.log(`  ${kind.padEnd(16)} ${String(count((o) => o.extraction === kind)).padStart(4)}`)
  }
  const extracted = outcomes.filter((o) => o.extraction === "extracted")
  if (extracted.length > 0) {
    const chars = extracted.map((o) => o.markdownChars ?? 0).sort((a, b) => a - b)
    console.log(`\n  BACKFILLABLE: ${extracted.length} of ${rows.length}  (${Math.round((extracted.length / rows.length) * 100)}%)`)
    console.log(`  markdown total  ${chars.reduce((a, b) => a + b, 0).toLocaleString()}`)
    console.log(`  markdown median ${chars[Math.floor(chars.length / 2)]?.toLocaleString()}`)
  }

  console.log("\n=== BLOCKED HOSTS (the number that differs by origin) ===")
  const blockedHosts = new Map<string, number>()
  for (const o of outcomes) {
    if (o.direct === "blocked") blockedHosts.set(o.host, (blockedHosts.get(o.host) ?? 0) + 1)
  }
  for (const [host, n] of [...blockedHosts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${host}`)
  }
  if (blockedHosts.size === 0) console.log("  none")

  await Bun.write("/tmp/readable-content-survey.json", JSON.stringify({ egressIp, outcomes }, null, 2))
  console.log("\nwrote /tmp/readable-content-survey.json (nothing was written to the database)")
}

await main()
