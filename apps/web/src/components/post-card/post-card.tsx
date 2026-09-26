import type { SavedItem } from "../../sleevy/saved-items"
import styles from "./post-card.module.scss"

/**
 * A post, drawn from Saved Metadata rather than from Readable Content.
 *
 * x.com renders client-side, so extraction gets nothing worth reading from a
 * post — of thirteen in the corpus only four yielded an article, and those four
 * were a bare avatar wrapped in a link. Capture already resolves the writer and
 * the message through the provider, so a post needs no article at all.
 */
export function PostCard({ item }: { readonly item: SavedItem }) {
  return (
    <article className={styles.card}>
      {item.authorName ? (
        <header className={styles.author}>
          {item.authorAvatarUrl ? (
            <img
              className={styles.avatar}
              src={item.authorAvatarUrl}
              alt=""
              width={44}
              height={44}
              loading="lazy"
            />
          ) : null}
          <span className={styles.names}>
            <span className={styles.name}>{item.authorName}</span>
            {item.authorHandle ? (
              <span className={styles.handle}>{item.authorHandle}</span>
            ) : null}
          </span>
        </header>
      ) : null}

      <p className={styles.message}>{item.title ?? ""}</p>

      {/* The media attached to the post. Captured already as the External Image
          URL, hotlinked from the platform that serves it — Sleevy stores no
          assets. */}
      {item.imageUrl ? (
        <img className={styles.media} src={item.imageUrl} alt="" loading="lazy" />
      ) : null}
    </article>
  )
}
