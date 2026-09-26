import { type ReactNode, type Ref, useEffect, useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { useReadableContent } from "../sleevy/readable-content"
import type { SavedItem } from "../sleevy/saved-items"
import { PostCard } from "../components/post-card/post-card"
import { PageTitleBar } from "../components/ui/page-title-bar/page-title-bar"
import styles from "./reader-page.module.scss"

const formatExtractedAt = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * One header for both kinds of Reader View. A post and an article are the same
 * page — a title, where it came from, the way back out to the original — and
 * only the body below differs.
 */
function ReaderHeader({
  title,
  titleRef,
  children,
}: {
  readonly title: string
  readonly titleRef: Ref<HTMLHeadingElement>
  readonly children: ReactNode
}) {
  return (
    <>
      <h1 className={styles.title} ref={titleRef}>{title}</h1>
      <p className={styles.meta}>{children}</p>
    </>
  )
}

/**
 * The element overrides, built once.
 *
 * react-markdown takes these as the component *types* for the nodes it builds,
 * and React answers a new type by throwing the old node away and mounting a
 * fresh one. Declared inline they were new functions on every render, so every
 * link and every image in the article was rebuilt each time the page rendered
 * — and a rebuilt `img` starts its download again from nothing. While a
 * trackpad was scrolling, the renders came faster than the image could load,
 * so it never finished: it flickered between no height and its full height
 * instead of appearing once.
 */
const READER_COMPONENTS: Components = {
  // An in-page anchor is a link into the original page's own table of
  // contents. Half the corpus carries them, and opening one in a new tab lands
  // on a blank reader, so they render as plain text instead. Everything else
  // leaves in a new tab.
  a: ({ children, href, ...props }) =>
    href?.startsWith("#") ? (
      <span>{children}</span>
    ) : (
      <a {...props} href={href} target="_blank" rel="noreferrer ugc">
        {children}
      </a>
    ),
  // Loaded eagerly. Markdown carries no width or height, so an image reserves
  // nothing until it arrives; deferring it to the moment it is scrolled to
  // means the article grows under the reader exactly as they reach the end of
  // it. A Reader View holds one article the reader has already chosen, so its
  // pictures are fetched with it and the page settles before they get there.
  img: ({ ...props }) => <img {...props} alt={props.alt ?? ""} />,
}

/** Once, for the same reason: a new array is a new pipeline every render. */
const READER_REMARK_PLUGINS = [remarkGfm]

type ReaderPageProps = {
  readonly savedItemId: string
  /** The list row this was opened from, when the caller already holds it. */
  readonly item?: SavedItem | undefined
}

export function ReaderPage({ savedItemId, item }: ReaderPageProps) {
  const router = useRouter()
  // A post is its own preview, so it is drawn from Saved Metadata and never
  // asks for Readable Content it does not have.
  const isPost = item?.type === "post"
  const contentQuery = useReadableContent(savedItemId, !isPost)
  const [titleEl, setTitleEl] = useState<HTMLHeadingElement | null>(null)

  // Escape leaves the Reader View, matching the keyboard-first model the rest
  // of the Web Companion uses (ADR 0010).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.history.back()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router])

  const content = contentQuery.data
  // Both kinds of Reader View lead back to the same place, and the navigation
  // line holds the link for both. It is absent only while there is nothing yet
  // to leave for.
  const originalUrl = isPost ? item?.originalUrl : content?.originalUrl
  // A post's title is its whole message, which makes a poor page title and a
  // worse browser tab. The writer is the useful handle for it.
  const title = isPost
    ? `Tweet by ${item?.authorHandle ?? item?.authorName ?? hostOf(item?.originalUrl ?? "")}`
    : (content?.title ?? (content ? hostOf(content.originalUrl) : "Reader"))

  return (
    <div className={styles.page}>
      {/* The heading is passed as the element, not a ref to it, so the bar
          attaches whenever one appears and re-attaches when the next article
          replaces it. Nothing to gate on. */}
      <PageTitleBar title={title} watch={titleEl} />

      <div className={styles.bar}>
        <Link to="/inbox" className={styles.back}>
          <ArrowLeft size={15} strokeWidth={1.75} />
          Back
        </Link>

        {/* Offered on every article rather than only at the end of one:
            extraction loses embeds and figure captions, so the way out should
            not require reading to the bottom first. It sits on the navigation
            line because that is what it is — a way out, not part of the
            article's own heading. */}
        {originalUrl ? (
          <a
            className={styles.original}
            href={originalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open the original
            <ExternalLink size={14} strokeWidth={1.75} />
          </a>
        ) : null}
      </div>

      {isPost && item ? (
        <article>
          <ReaderHeader title={title} titleRef={setTitleEl}>
            <span>{hostOf(item.originalUrl)}</span>
          </ReaderHeader>
          <PostCard item={item} />
        </article>
      ) : null}

      {!isPost && contentQuery.isLoading ? (
        <div aria-hidden="true">
          {Array.from({ length: 8 }, (_unused, index) => (
            <div
              key={index}
              className={styles.skeletonLine}
              style={{ width: `${[96, 88, 92, 70, 94, 86, 90, 60][index]}%` }}
            />
          ))}
        </div>
      ) : null}

      {/* Most Links are not articles, so an absent one is ordinary rather than
          an error to apologise for. */}
      {!isPost && contentQuery.isError ? (
        <p className={styles.state}>
          This saved item has no readable article. Open the original instead.
        </p>
      ) : null}

      {!isPost && content ? (
        <article>
          <ReaderHeader title={title} titleRef={setTitleEl}>
            <span>{hostOf(content.originalUrl)}</span>
            {formatExtractedAt(content.extractedAt) ? (
              <>
                <span className={styles.separator}>·</span>
                <span>Extracted {formatExtractedAt(content.extractedAt)}</span>
              </>
            ) : null}
          </ReaderHeader>

          {/* react-markdown builds React elements and ignores raw HTML unless
              rehype-raw is added, so third-party markup is never injected and
              the Markdown-only decision in ADR 0021 still holds. */}
          <div className={styles.article}>
            <Markdown remarkPlugins={READER_REMARK_PLUGINS} components={READER_COMPONENTS}>
              {content.markdown}
            </Markdown>
          </div>
        </article>
      ) : null}
    </div>
  )
}
