export const normalizeSearchPhrase = (text: string): string =>
  text.toLowerCase().replace(/['‘’]/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
