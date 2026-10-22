export interface Chunk {
  content: string
  chunkIndex: number
  // Section paths ("Post › Section") of the chunk's paragraphs; search expands hits by them.
  sections: string[]
}

const TARGET_TOKENS = 650
const OVERLAP_TOKENS = 100
const CHARS_PER_TOKEN = 4

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN

export const SECTION_SEPARATOR = ' › '

// Level 2+ only — the `#` document title already reaches the prompt as the document title.
const SECTION_HEADING = /^(#{2,6})\s+(.+)$/

// A chunk cut mid-section (e.g. mid-table) gives no hint what it is about — the model then
// attributes it to the wrong subject, so every such chunk carries its section path.
const withSection = (content: string, section: string): string =>
  section && !content.startsWith('#') ? `Sekcja: ${section}\n\n${content}` : content

// Joins parts up to `limit` characters; a single part over the limit stays whole.
const pack = (parts: string[], separator: string, limit: number): string[] => {
  const pieces: string[] = []
  let current = ''
  for (const part of parts) {
    const candidate = current ? `${current}${separator}${part}` : part
    if (candidate.length > limit && current) {
      pieces.push(current)
      current = part
    } else {
      current = candidate
    }
  }
  if (current) pieces.push(current)
  return pieces
}

// Leaves room for the overlap the next chunk opens with.
const PIECE_CHARS = TARGET_CHARS - OVERLAP_CHARS

const splitLine = (line: string, limit: number): string[] =>
  line.length > limit ? pack(line.split(/(?<=[.!?…])\s+/), ' ', limit) : [line]

// A paragraph over the target (a long table, a wall of text) would otherwise become one
// oversized chunk. It is cut by lines, then by sentences; every table piece keeps its header.
const splitParagraph = (paragraph: string): string[] => {
  if (paragraph.length <= TARGET_CHARS) return [paragraph]

  const lines = paragraph.split('\n')
  const isTable = lines.length > 2 && lines.every((line) => line.startsWith('|'))
  const prefix = isTable ? `${lines[0]}\n${lines[1]}\n` : ''
  const limit = PIECE_CHARS - prefix.length

  const units = lines.slice(isTable ? 2 : 0).flatMap((line) => splitLine(line, limit))
  return pack(units, '\n', limit).map((piece) => prefix + piece)
}

export const chunkText = (text: string): Chunk[] => {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n\n+/).flatMap(splitParagraph)
  const chunks: Chunk[] = []
  const headings: string[] = []
  let current = ''
  // Section of every paragraph in `current`, keyed by its end offset. A split chunk opens with
  // the overlap, which can start a section or two before the newest heading.
  let spans: { end: number; section: string }[] = []
  let index = 0

  const sectionAt = (offset: number) =>
    (spans.find((s) => s.end > offset) ?? spans.at(-1))?.section ?? ''

  const pushChunk = () =>
    chunks.push({
      content: withSection(current.trim(), sectionAt(0)),
      chunkIndex: index++,
      sections: [...new Set(spans.map((s) => s.section).filter(Boolean))],
    })

  for (const paragraph of paragraphs) {
    const heading = paragraph.split('\n', 1)[0]!.match(SECTION_HEADING)
    if (heading) {
      const depth = heading[1]!.length - 2
      headings.splice(depth, headings.length, heading[2]!.trim())
    }
    const section = headings.join(SECTION_SEPARATOR)

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph

    if (candidate.length > TARGET_CHARS && current) {
      pushChunk()
      const overlap = current.slice(-OVERLAP_CHARS)
      const overlapSection = sectionAt(current.length - overlap.length)
      current = `${overlap}\n\n${paragraph}`
      spans = [
        { end: overlap.length, section: overlapSection },
        { end: current.length, section },
      ]
    } else {
      current = candidate
      spans.push({ end: current.length, section })
    }
  }

  if (current.trim()) pushChunk()

  return chunks
}
