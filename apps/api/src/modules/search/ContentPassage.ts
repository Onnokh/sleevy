export type ContentPassage = {
  readonly ordinal: number
  readonly headingPath: string
  readonly content: string
}

export type PassageSplitOptions = {
  readonly targetCharacters?: number
  readonly maximumCharacters?: number
}

const DEFAULT_TARGET_CHARACTERS = 1_200
const DEFAULT_MAXIMUM_CHARACTERS = 1_600

type Block = {
  readonly headingPath: string
  readonly content: string
}

/**
 * Split Markdown at paragraph and heading boundaries. Heading ancestry is
 * carried separately so retrieval can explain where a match came from.
 * Fenced code stays intact unless one fence is larger than the hard limit.
 */
export const splitReadableContent = (
  markdown: string,
  options: PassageSplitOptions = {},
): readonly ContentPassage[] => {
  const target = options.targetCharacters ?? DEFAULT_TARGET_CHARACTERS
  const maximum = options.maximumCharacters ?? DEFAULT_MAXIMUM_CHARACTERS
  if (target <= 0 || maximum < target) {
    throw new RangeError("Passage character limits must satisfy 0 < target <= maximum")
  }

  const blocks = parseBlocks(markdown)
  const passages: Array<Omit<ContentPassage, "ordinal">> = []
  let current: Block | undefined

  const flush = () => {
    if (!current || current.content.trim().length === 0) return
    passages.push({
      headingPath: current.headingPath,
      content: current.content.trim(),
    })
    current = undefined
  }

  for (const block of blocks) {
    const pieces = splitOversizedBlock(block, maximum)
    for (const piece of pieces) {
      if (!current) {
        current = piece
        continue
      }

      const joinedLength = current.content.length + 2 + piece.content.length
      const headingChanged = current.headingPath !== piece.headingPath
      if (joinedLength > maximum || headingChanged) {
        flush()
        current = piece
        continue
      }

      current = {
        headingPath: current.headingPath || piece.headingPath,
        content: `${current.content}\n\n${piece.content}`,
      }
      if (current.content.length >= target) flush()
    }
  }
  flush()

  return passages.map((passage, ordinal) => ({ ...passage, ordinal }))
}

export const passageEmbeddingInput = (
  title: string | undefined,
  passage: ContentPassage,
): string => {
  const context = [
    title?.trim() ? `Title: ${title.trim()}` : undefined,
    passage.headingPath ? `Section: ${passage.headingPath}` : undefined,
  ].filter((part): part is string => part !== undefined)

  return context.length === 0
    ? passage.content
    : `${context.join("\n")}\n\n${passage.content}`
}

const parseBlocks = (markdown: string): readonly Block[] => {
  const blocks: Block[] = []
  const headings: string[] = []
  let lines: string[] = []
  let inFence = false

  const flush = () => {
    const content = lines.join("\n").trim()
    if (content) blocks.push({ headingPath: headings.filter(Boolean).join(" > "), content })
    lines = []
  }

  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      lines.push(line)
      continue
    }

    const heading = !inFence ? /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line) : null
    if (heading) {
      flush()
      const level = heading[1]!.length
      headings.length = level
      headings[level - 1] = heading[2]!.trim()
      continue
    }

    if (!inFence && line.trim() === "") {
      flush()
      continue
    }
    lines.push(line)
  }
  flush()
  return blocks
}

const splitOversizedBlock = (block: Block, maximum: number): readonly Block[] => {
  if (block.content.length <= maximum) return [block]

  const pieces: Block[] = []
  let rest = block.content
  while (rest.length > maximum) {
    const window = rest.slice(0, maximum + 1)
    const boundary = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "))
    const at = boundary >= Math.floor(maximum * 0.6) ? boundary : maximum
    pieces.push({ headingPath: block.headingPath, content: rest.slice(0, at).trim() })
    rest = rest.slice(at).trim()
  }
  if (rest) pieces.push({ headingPath: block.headingPath, content: rest })
  return pieces
}
