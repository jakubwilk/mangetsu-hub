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

export const chunkText = (text: string): Chunk[] => {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n\n+/)
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
