/**
 * Flatten Markdown to the prose inside it.
 *
 * Extracted Page Content is what the page says, and AI Enrichment reads it as
 * prose: heading markers, bullets, and fenced code add nothing, and an image or
 * link URL spends the budget on a string no reader reads. Emphasis is unwrapped
 * only in its unambiguous forms, so snake_case identifiers survive.
 */
export const markdownToPlainText = (markdown: string): string =>
  markdown
    // Fenced code and images carry no prose worth summarizing.
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // A link keeps its text and loses its target.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}(?:[-*_]\s*){3,}$/gm, " ")
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/\*(?=\S)([^*\n]*?\S)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
