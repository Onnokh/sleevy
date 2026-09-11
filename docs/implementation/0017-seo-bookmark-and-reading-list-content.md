# SEO Content Plan: Bookmark and Reading List Demand

This document turns the keyword research of 2026-09-11 into a content plan. It adds five article pages and extends three existing pages. All volume figures come from Ranksta's Paradise, market **United States / en**, and describe the size of the addressable market — not a traffic forecast.

## Why this plan exists

The Registry held 62 keywords and **15,830 monthly searches**, and 30 of those keywords measured as `unreported`. The `/ios-app`, `/raycast`, `/docs`, cross-device and developer clusters were written from intuition. The searches behind them do not exist.

Two measured themes replace that guesswork:

- **Reading List** — what Apple calls the feature people already misuse as a read-later tool.
- **Browser bookmark maintenance** — import, export, organization, and recovery of bookmarks.

Together they add about **40,800 monthly searches**, which takes the plan to roughly **53,000–56,600**. The range reflects overlap between `export import chrome bookmarks` and `chrome bookmarks import`, which the vendor reports as separate rows at separate volumes.

## Two findings that constrain the plan

**Raycast has no search demand.** The seed `raycast extension` returned zero rows above 200/mo. The seed `raycast app` returned only `raycast mac app` 480 — a term Raycast itself owns. Keep `/raycast` as a conversion page. Do not write SEO content for it.

**A large number needs a neighbourhood.** The proposal `pocket read it later` reports 74,000/mo, but the seed returns 10 rows in total, and the seeds `getpocket`, `save to pocket`, `pocket bookmarks` and `what happened to pocket` return no read-later demand at all. Treat it as a clustered artifact and do not plan content against it. The same test applied to `export import chrome bookmarks` (18,100) **passes**: 199 rows returned, 51 above 200/mo, with a full tail of browser pairs.

## Language

[CONTEXT.md](../../CONTEXT.md) directs the codebase to say **Saved Item** and to avoid *bookmark*. That rule governs code, API contracts, and commit messages. It does not govern marketing copy written against search demand, where *bookmark* is the word people type and must appear in titles, headings, and body text. Keep the two vocabularies apart: a page may explain bookmarks to the reader while the product behind it creates Saved Items.

## Page plan

Pages are ordered by what a site with near-zero Domain Rating can win first, not by volume.

### P1 — `/articles/where-are-my-bookmarks`

**Demand: 2,350/mo, difficulty 3–21.** The best intent in the bookmark set: the reader has lost bookmarks and is looking on the wrong device.

| Keyword | Volume | Difficulty |
| --- | --- | --- |
| `where are my bookmarks iphone` | 720 | 4 |
| `where are my chrome bookmarks` | 590 | 6 |
| `where are my bookmarks on my phone` | 480 | 7 |
| `where are my bookmarks on google` | 390 | 18 |
| `where are my bookmarks on android` | 170 | 3 |

One section per device: iPhone and Safari, Chrome on desktop, Android, and the Google Account. Close on the reason the question keeps returning — bookmarks belong to one browser on one device, and a Saved Item does not.

### P2 — `/articles/safari-reading-list`

**Demand: 5,080/mo, difficulty 0–6.** The lowest difficulty in the whole plan, and the closest product fit: every reader is already using a read-later feature and meeting its limits.

| Keyword | Volume | Difficulty |
| --- | --- | --- |
| `reading list safari` | 1,300 | 4 |
| `reading list iphone` | 1,300 | 6 |
| `delete reading list safari` | 880 | 1 |
| `how to delete reading list from safari` | 590 | 2 |
| `how to find reading list on iphone` | 390 | 2 |
| `how to clear reading list on iphone` | 390 | 3 |
| `how to use reading list on iphone` | 390 | 0 |
| `what is safari reading list` | 260 | 1 |
| `what is reading list on iphone` | 170 | 5 |

**Build one page, not two.** The Safari and iPhone clusters describe one Apple feature, and two thin pages would compete with each other for the same results. Cover both with iPhone-specific headings inside the page: what the Reading List is, where to find it on iPhone and Mac, how to use it, how to clear it, and where it stops — no sync outside Apple, no tags, no search, no archive.

### P3 — `/articles/export-import-bookmarks`

**Demand: about 23,250/mo, difficulty 2–15.** The largest prize and the most work. The reader is migrating between browsers, so they already accept that bookmarks should be portable.

| Keyword | Volume | Difficulty |
| --- | --- | --- |
| `export import chrome bookmarks` | 18,100 | 12 |
| `chrome bookmarks import` | 3,600 | 15 |
| `import bookmarks from chrome to safari` | 590 | 10 |
| `import chrome bookmarks to firefox` | 480 | 8 |
| `how to import bookmarks from edge to chrome` | 480 | 2 |

Write it as a hub with one section per browser pair, each with exact steps. If the hub ranks, split the pairs into their own pages later. The argument at the end is migration itself: the reader is moving bookmarks because bookmarks are tied to a browser.

### P4 — `/articles/how-to-organize-bookmarks-chrome`

**Demand: 720/mo, difficulty 13.** `how to organize bookmarks in chrome`. The reader has a mess and wants a system, which is Sleevy's pitch stated in the reader's own words.

Keep this page distinct from `/articles/how-to-organize-too-many-open-tabs` (tabs, not bookmarks) and from `/articles/best-bookmark-manager-chrome` (comparison, not method).

### P5 — `/articles/chrome-bookmarks-bar`

**Demand: 8,860/mo, difficulty 0–9. Weak intent, accepted deliberately.**

| Keyword | Volume | Difficulty |
| --- | --- | --- |
| `show chrome bookmarks bar` | 4,400 | 1 |
| `hide bookmarks bar chrome` | 1,900 | 0 |
| `chrome bookmarks bar` | 1,300 | 9 |
| `how to show bookmarks bar in chrome on top` | 480 | 6 |
| `chrome bookmarks bar disappeared` | 390 | 0 |
| `add to bookmarks bar chrome` | 390 | 3 |

A reader searching `show chrome bookmarks bar` wants a keyboard shortcut, takes it from the result snippet, and leaves. This page buys impressions, not conversions. It is cheap to write and should be measured on assisted paths only. The `disappeared` and `missing` variants are the exception — that reader has lost data and is open to an alternative.

### Existing pages to extend

| Page | Keyword | Volume |
| --- | --- | --- |
| `/safari-bookmark-manager` | `bookmarks safari iphone` | 320 |
| `/safari-bookmark-manager` | `show bookmarks safari iphone` | 210 |
| `/articles/how-to-organize-too-many-open-tabs` | `chrome tab manager` | 320 |
| `/pocket-alternative` | `pocket app alternative` | 320 |

`pocket app alternative` carries a cost-per-click of $11.03, the highest commercial signal in the Registry. It belongs to the same cluster as the existing `Pocket alternative` row, so it adds intent evidence rather than new volume.

## Registry hygiene

The 37 stored Proposals contain near-duplicates that the vendor reports as separate rows: `show` and `view` bookmarks bar both at 4,400, `display` and `enable` both at 2,900, `hide` and `remove` both at 1,900, and `disappeared`, `gone` and `missing` all at 390. **Add one row per concept.** Adding every variant would inflate `totals.monthlyVolume` by counting one audience several times.

## Delivery order

1. P2 Safari Reading List — lowest difficulty, best product fit.
2. P1 Where are my bookmarks — low difficulty, strong intent.
3. P3 Export and import bookmarks — largest demand, largest effort.
4. P4 Organize bookmarks.
5. P5 Bookmarks bar.

Each page is one route file under `apps/web/src/routes/_marketing/`, built with the `ArticlePage` component, and needs its own `head` meta, canonical link, and `datePublished` schema. Add each new page to the articles index and link it from the related existing articles.

After a page ships, record it with `log_add` using kind `publish` and the date it shipped. The before-and-after readout depends on it.
