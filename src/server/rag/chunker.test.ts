import { describe, expect, it } from 'vitest'

import { chunkText } from './chunker'

describe('chunkText', () => {
  it('returns an empty array for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('keeps a single short paragraph as one chunk', () => {
    const chunks = chunkText('Krótki akapit o zasadach forum.')
    expect(chunks).toEqual([{ content: 'Krótki akapit o zasadach forum.', chunkIndex: 0 }])
  })

  it('merges multiple short paragraphs into one chunk', () => {
    const chunks = chunkText('Akapit pierwszy.\n\nAkapit drugi.\n\nAkapit trzeci.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.content).toBe('Akapit pierwszy.\n\nAkapit drugi.\n\nAkapit trzeci.')
  })

  it('splits into a new chunk once the target size is exceeded, with overlap carried over', () => {
    const paragraphA = 'A'.repeat(2000)
    const paragraphB = 'B'.repeat(2000)
    const paragraphC = 'C'.repeat(100)

    const chunks = chunkText(`${paragraphA}\n\n${paragraphB}\n\n${paragraphC}`)

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0]!.chunkIndex).toBe(0)
    expect(chunks[0]!.content.startsWith('A')).toBe(true)
    // The next chunk should carry the overlap tail from the previous chunk plus new content.
    expect(chunks[1]!.content.includes('B'.repeat(50))).toBe(true)
  })

  it('assigns sequential, zero-based chunkIndex values', () => {
    const paragraph = 'X'.repeat(2000)
    const chunks = chunkText([paragraph, paragraph, paragraph].join('\n\n'))

    chunks.forEach((chunk, i) => expect(chunk.chunkIndex).toBe(i))
  })

  it('normalizes CRLF line endings before chunking', () => {
    const chunks = chunkText('Linia pierwsza.\r\n\r\nLinia druga.')
    expect(chunks).toEqual([{ content: 'Linia pierwsza.\n\nLinia druga.', chunkIndex: 0 }])
  })
})
