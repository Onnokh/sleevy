# Sleevy keyword opportunities

Researched 2026-07-16. This is a qualitative opportunity map, not a keyword-volume report: no authenticated Keyword Planner, Search Console, or Bing Webmaster export was available. Before committing to a content calendar, validate the candidates in the measurement loop below by country (start with US/English) and compare actual impressions, not a third-party difficulty score.

## Executive recommendation

Target **specific capture workflow** searches first, then own the timely **Pocket alternative** comparison intent. Do not lead with the broad head term `read later app`: it is crowded by established products and native browser features. Sleevy's differentiated, provable proposition is *one synced link queue captured from iPhone share sheet, Chrome, Raycast, and a personal API*.

There are already well-focused, indexable integration pages for iOS, Chrome, Raycast, and API docs (see the current [marketing routes](../../apps/web/src/routes/_marketing)). The opportunity is to make the query-to-page match more explicit and to add comparison/workflow pages; it is not to create dozens of thin keyword variants.

## Keyword clusters and recommended pages

| Priority | Cluster and seed queries | Intent | Best page / next action | Why this is an opportunity |
| --- | --- | --- | --- | --- |
| P0 | `Pocket alternative`, `alternative to Pocket`, `Pocket replacement`, `what replaced Pocket` | Comparison / high consideration | Create **`/pocket-alternative`**: transparent comparison with a migration caveat, supported surfaces, what Sleevy does/doesn't do, and CTA. | Mozilla says Pocket shut down July 8, 2025; its apps/extensions and API are no longer available. This creates durable replacement intent. Do **not** promise Pocket import unless it exists. [Mozilla support](https://support.mozilla.org/en-US/kb/future-of-pocket) |
| P0 | `save links from iPhone`, `iPhone save links for later`, `iOS share sheet read later app`, `read later app iPhone` | Product / how-to | Strengthen existing **`/ios-app`** with the first two phrases in title/H1/intro, instructions for enabling the share extension, and an annotated screenshot. | Exact native interaction is differentiated and matches how Apple describes the adjacent behavior (Safari Reading List). [Apple Support](https://support.apple.com/en-in/guide/iphone/iph1a4721132/ios) |
| P0 | `Chrome read later extension`, `save tabs for later Chrome`, `Chrome extension save links`, `tab saver extension` | Product / solution | Strengthen existing **`/chrome-extension`**; title should lead with “Chrome read-later extension”; add a concise “how to save a tab” section and link to the Web Store. | The Chrome Store has dedicated lightweight “Read Later” extensions, confirming clear product-led intent, but many are local-only. Sleevy can compete on cross-device sync. [Chrome Web Store example](https://chromewebstore.google.com/detail/read-later/cbkpffbpdnkdlfdaoeakdelhmakefomb) |
| P1 | `Raycast read later`, `Raycast save links`, `Raycast bookmark manager`, `search saved links Raycast` | Navigational / product | Strengthen **`/raycast`** and publish a short **“Save links with Raycast”** guide that links to the Raycast Store. | The Raycast Store itself has a `Read Later` extension, showing the category exists; Sleevy's cross-surface queue is the differentiator. [Raycast Store](https://www.raycast.com/jimluo/later) |
| P1 | `read later API`, `bookmark manager API`, `save URL API`, `personal link saving API` | Developer / solution | Expand **`/docs`** with an API landing introduction and add 2–3 implementation guides: curl, Raycast/automation, and webhooks (only for shipped capabilities). | This is likely lower-volume but unusually qualified: the existing personal capture API is a concrete differentiation most read-later apps do not foreground. |
| P1 | `read later app Chrome iPhone`, `sync reading list Chrome iPhone`, `save links across devices`, `cross platform read later app` | Product comparison | Create **`/read-later-app-chrome-iphone`** (or a consolidated cross-device landing page), explaining one queue across iOS share sheet, Chrome, Raycast, web and API. | Multi-surface capture is the clearest positioning seam. Competing products advertise overlapping surfaces, so this needs proof and a product demo rather than generic copy. [Later](https://xavimoll.com/later/) |
| P2 | `bookmark manager for developers`, `developer read later app`, `research link manager` | Exploratory | Publish one durable workflow page for developers: save docs/repos while browsing, search them in Raycast, organize into folders/tags. | Matches actual product capabilities, but should be built only after P0 pages gain impressions. |

### Terms to de-emphasize

- `best read later app` and `best bookmark manager`: listicle/review intent, dominated by editorial and larger products; pursue only once Sleevy has independent reviews and a substantially richer comparison page.
- `offline read later app`: only claim offline *capture* (which the iOS page describes). Do not target offline-reading intent unless full offline reading is supported.
- `Pocket import` / `import Pocket bookmarks`: do not target without a working import path; Mozilla's export window is closed, so it also has limited current utility.

## Page architecture and on-page rules

1. Preserve one canonical intent per page. The existing integration pages should each own their platform cluster; do not make `/` compete with them by stuffing every variant into the home title.
2. For each P0 page, put the primary phrase in the title, H1, first paragraph, image alt text where natural, and one FAQ-like answer. Make the page materially useful: setup steps, screenshots, limitations, and a direct install/download CTA.
3. Build `/pocket-alternative` as a fair decision page, not a feature checklist. State date/context, table the relevant workflows, mention native Reading List where appropriate, and clearly distinguish “save a URL and return to it” from full offline/article-reader claims.
4. Add contextual internal links: home → platform pages; platform pages → cross-device page; every workflow/comparison page → relevant installer and API docs. Add new, indexable pages to `sitemap.xml` and submit meaningful deployments through the existing IndexNow hook. IndexNow improves notification/discovery for participating engines, not Google ranking. [IndexNow FAQ](https://www.indexnow.org/faq#what-happens-after-i-submit-a-url-using-indexnow)

## Automation and measurement plan

### Set up once

1. Verify the `sc-domain:sleevy.app` property in Google Search Console and `sleevy.app` in Bing Webmaster Tools; submit the existing sitemap. Google’s Performance report provides impressions, clicks, CTR and position, while Bing exposes queries/pages and the same core visibility metrics. [Google](https://support.google.com/webmasters/answer/7576553) [Bing](https://www.bing.com/webmasters/help/search-performance-c680da36)
2. Create a small keyword registry (CSV or database) with: `cluster`, `keyword`, `target_url`, `intent`, `country`, `priority`, `published_at`, and `baseline_date`. Seed it with the table above plus variants surfaced in Keyword Planner.
3. Use Google Ads Keyword Planner’s “Discover new keywords” with the seed clusters and each target URL; export ideas, monthly-search ranges, competition, and bid signals. It supports keyword/URL discovery and these filters, but the numbers are advertising estimates—not ranking forecasts. [Google Ads Help](https://support.google.com/google-ads/answer/6325025)

### Weekly automated opportunity job

Run a scheduled job weekly (and retain daily raw data) that calls the Search Console Search Analytics API for the last 28 days and the preceding 28 days, grouped by `query,page,device,country`. The API supports these dimensions and filters, but returns top rows rather than a guaranteed complete query universe. [Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

Score and send a Slack/email/dashboard digest for:

- **Striking distance:** non-brand query + page, impressions ≥ 20, average position 4–20, clicks low relative to impressions. Improve the mapped page before making another one.
- **CTR opportunity:** position ≤ 10, impressions ≥ 50, CTR below the site's comparable-page median. Test title/description/snippet alignment—not keyword repetition.
- **New demand:** queries with meaningful impressions not in the registry; cluster them by phrase and propose a mapped page only if no existing page satisfies the intent.
- **Cannibalization:** the same query receiving impressions for two Sleevy URLs; consolidate content/internal links or clarify canonicals.
- **Launch readout:** compare each new target URL’s 28/56/84-day non-brand impressions, clicks, CTR and average position with its pre-publish baseline. Attribute product installs/sign-ups separately in Rybbit using UTM-tagged CTAs; ranking visibility alone is not the goal.

Review Bing monthly as a secondary signal. Its Search Performance report supports query/page analysis and reports up to six months in the current help documentation. Also review Bing’s AI Performance report monthly for citations/grounding queries if the property has access. [Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)

### Decision rule

For the first 90 days, ship only the P0 page improvements plus the Pocket comparison. Expand P1 only when a cluster earns impressions or the planner indicates meaningful demand. A page that gains impressions but ranks 8–20 is an optimization task; a page that gains no impressions after indexing is a demand/intent problem, not a signal to add more near-duplicate pages.

## Source notes

The opportunity conclusions combine direct inspection of Sleevy’s current routes with live SERP/category evidence. Competitor pages show that iOS share-sheet, browser-extension and cross-device link-saving positioning is actively contested—not that a competitor’s unsupported feature claims should be copied. No paid keyword-volume dataset was used; validate the prioritization with the first-party tools above.
