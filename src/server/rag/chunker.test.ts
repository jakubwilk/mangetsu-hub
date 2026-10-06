import { describe, expect, it } from 'vitest'

import { chunkText } from './chunker'

describe('chunkText', () => {
  it('returns an empty array for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('keeps a single short paragraph as one chunk', () => {
    const chunks = chunkText('Krótki akapit o zasadach forum.')
    expect(chunks).toEqual([
      { content: 'Krótki akapit o zasadach forum.', chunkIndex: 0, sections: [] },
    ])
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

  it('prefixes a chunk that starts mid-section with its nested section path', () => {
    const text = ['# Sklep', '## Bronie', '### Pasywki', 'A'.repeat(2000), 'B'.repeat(2000)].join(
      '\n\n',
    )

    const chunks = chunkText(text)

    expect(chunks[0]!.content.startsWith('# Sklep')).toBe(true)
    expect(chunks[1]!.content.startsWith('Sekcja: Bronie › Pasywki\n\n')).toBe(true)
  })

  it('replaces a section of the same level instead of nesting it', () => {
    const text = [
      '## Statystyki',
      '### Siła',
      '## Techniki',
      'T'.repeat(2500),
      'U'.repeat(2500),
    ].join('\n\n')

    expect(chunkText(text).at(-1)!.content.startsWith('Sekcja: Techniki\n\n')).toBe(true)
  })

  it('labels a split chunk with the section its overlap comes from, not the next heading', () => {
    const text = ['## Pierwsza', 'A'.repeat(2580), '## Druga', 'B'.repeat(100)].join('\n\n')

    const chunks = chunkText(text)

    expect(chunks).toHaveLength(2)
    expect(chunks[1]!.content.startsWith('Sekcja: Pierwsza\n\nAAA')).toBe(true)
    expect(chunks[1]!.content).toContain('## Druga')
  })

  it('labels a chunk whose overlap crosses a heading with the section the overlap starts in', () => {
    const text = [
      '## Pierwsza',
      'A'.repeat(2000),
      '## Druga',
      'B'.repeat(300),
      'C'.repeat(1000),
    ].join('\n\n')

    const chunks = chunkText(text)

    expect(chunks[1]!.content.startsWith('Sekcja: Pierwsza\n\nAAA')).toBe(true)
  })

  it('leaves chunks of a document without section headings unchanged', () => {
    const chunks = chunkText(['# Tytuł', 'X'.repeat(2000), 'Y'.repeat(2000)].join('\n\n'))

    expect(chunks.some((c) => c.content.startsWith('Sekcja:'))).toBe(false)
  })

  it('normalizes CRLF line endings before chunking', () => {
    const chunks = chunkText('Linia pierwsza.\r\n\r\nLinia druga.')
    expect(chunks).toEqual([
      { content: 'Linia pierwsza.\n\nLinia druga.', chunkIndex: 0, sections: [] },
    ])
  })

  it('lists every section path a chunk touches, without the document preamble', () => {
    const text = ['# Sklep', '## Bronie', '### Pasywki', 'A'.repeat(2000), 'B'.repeat(2000)].join(
      '\n\n',
    )

    const chunks = chunkText(text)

    expect(chunks[0]!.sections).toEqual(['Bronie', 'Bronie › Pasywki'])
    expect(chunks[1]!.sections).toEqual(['Bronie › Pasywki'])
  })

  it('assigns a chunk that spans a heading to both sections', () => {
    const text = ['## Pierwsza', 'A'.repeat(2580), '## Druga', 'B'.repeat(100)].join('\n\n')

    expect(chunkText(text)[1]!.sections).toEqual(['Pierwsza', 'Druga'])
  })
})
