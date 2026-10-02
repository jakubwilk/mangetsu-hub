export interface Chunk {
  content: string
  chunkIndex: number
}

const TARGET_TOKENS = 650
const OVERLAP_TOKENS = 100
const CHARS_PER_TOKEN = 4

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN

export const chunkText = (text: string): Chunk[] => {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n\n+/)
  const chunks: Chunk[] = []
  let current = ''
  let index = 0

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph

    if (candidate.length > TARGET_CHARS && current) {
      chunks.push({ content: current.trim(), chunkIndex: index++ })
      const overlap = current.slice(-OVERLAP_CHARS)
      current = `${overlap}\n\n${paragraph}`
    } else {
      current = candidate
    }
  }

  if (current.trim()) {
    chunks.push({ content: current.trim(), chunkIndex: index })
  }

  return chunks
}
