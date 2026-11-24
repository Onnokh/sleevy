// The longest meta description a search result shows before it cuts the text.
// Crawlers such as Ahrefs flag a description over 160 characters, so this stays
// a little under that.
export const META_DESCRIPTION_MAX_LENGTH = 155

// Below this, the same crawlers flag a description as too short. A cut at a
// sentence end is only taken when it keeps at least this much text.
const META_DESCRIPTION_MIN_LENGTH = 110

// A meta description made from a longer page summary, such as the description
// of an OpenAPI operation. The page keeps its full summary; only the
// <meta name="description"> is shortened.
//
// Markdown code marks are removed, because a search result shows them as
// literal backticks. The text is cut at the last full sentence that fits, or at
// the last whole word with an ellipsis when that sentence end would leave the
// description too short.
export const metaDescription = (text: string, maxLength = META_DESCRIPTION_MAX_LENGTH) => {
  const plain = text.replace(/`/g, "").replace(/\s+/g, " ").trim()
  if (plain.length <= maxLength) return plain

  const head = plain.slice(0, maxLength + 1)
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("; "))
  if (sentenceEnd + 1 >= META_DESCRIPTION_MIN_LENGTH) return plain.slice(0, sentenceEnd + 1).replace(/;$/, ".")

  const wordEnd = head.lastIndexOf(" ", maxLength - 1)
  const cut = wordEnd > 0 ? plain.slice(0, wordEnd) : plain.slice(0, maxLength - 1)
  return `${cut.replace(/[\s,;:.]+$/, "")}…`
}
