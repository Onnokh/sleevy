/**
 * Trim Markdown down to what is worth spending Extracted Page Content's budget
 * on.
 *
 * AI Enrichment reads this field as prose within PAGE_CONTENT_LIMIT, where a
 * link target or an image URL can spend sixty characters on a string no
 * summarizer reads. Headings, lists, and emphasis stay: they cost a character
 * or two each, and they tell the model how the article is built.
 */
export const markdownForSummary = (markdown: string): string =>
  markdown
    // Fenced code is the one block whose content is not prose.
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // A link keeps its text and loses its target.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Line structure survives: a heading only reads as a heading on its own
    // line, and leading spaces are list nesting. Only runs of spaces, trailing
    // spaces, and blank lines collapse.
    .replace(/[ \t]+/g, " ")
    .replace(/ +$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
