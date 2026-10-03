import { beforeEach, describe, expect, it, vi } from 'vitest'

import { searchChunks } from './search'

// vi.hoisted/vi.mock are moved above the imports above by Vitest's transform at build time.
const { queryRawMock, findManyMock, embedTextMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  findManyMock: vi.fn(),
  embedTextMock: vi.fn(),
}))

vi.mock('server/db', () => ({
  db: {
    $queryRaw: queryRawMock,
    chunk: { findMany: findManyMock },
  },
}))

vi.mock('server/ai/embeddings', () => ({
  embedText: embedTextMock,
}))

interface ChunkFindManyArgs {
  where?: { id?: { in?: string[]; notIn?: string[] }; documentId?: { in?: string[] } }
}

const sqlOf = (strings: TemplateStringsArray): string => strings.join(' ')

beforeEach(() => {
  queryRawMock.mockReset()
  findManyMock.mockReset()
  embedTextMock.mockReset()
  findManyMock.mockResolvedValue([])
})

describe('searchChunks', () => {
  it('returns an empty array without querying the database when the query has no usable tokens', async () => {
    const result = await searchChunks('a', { app: 'tutorials' })

    expect(result).toEqual([])
    expect(queryRawMock).not.toHaveBeenCalled()
  })

  it('falls back to FTS + trigram results when the embedding call fails', async () => {
    embedTextMock.mockResolvedValue(null)
    queryRawMock.mockImplementation((strings: TemplateStringsArray) => {
      const sql = sqlOf(strings)
      if (sql.includes('to_tsquery')) {
        return Promise.resolve([
          {
            id: 'c1',
            content: 'Zawartość 1',
            documentTitle: 'Dok 1',
            category: 'zasady',
            rank: 0.5,
          },
        ])
      }
      return Promise.resolve([])
    })

    const result = await searchChunks('kolejka postów', { app: 'tutorials', limit: 5 })

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('c1')
  })

  it('merges FTS and trigram by position, not by their incomparable raw scores', async () => {
    embedTextMock.mockResolvedValue(null)
    queryRawMock.mockImplementation((strings: TemplateStringsArray) => {
      const sql = sqlOf(strings)
      const row = (id: string, rank: number) => ({
        id,
        content: id,
        documentTitle: id,
        category: 'zasady',
        rank,
      })
      if (sql.includes('to_tsquery')) return Promise.resolve([row('fts-hit', 0.03)])
      if (sql.includes('word_similarity')) return Promise.resolve([row('trigram-hit', 0.3)])
      return Promise.resolve([])
    })

    const result = await searchChunks('klany wrodzone', { app: 'tutorials', limit: 5 })

    expect(result.map((r) => r.id)).toEqual(['fts-hit', 'trigram-hit'])
  })

  it('ranks a chunk found by both FTS and embedding search above one found by only one source', async () => {
    embedTextMock.mockResolvedValue([0.1, 0.2, 0.3])
    queryRawMock.mockImplementation((strings: TemplateStringsArray) => {
      const sql = sqlOf(strings)
      if (sql.includes('to_tsquery')) {
        return Promise.resolve([
          {
            id: 'fts-only',
            content: 'FTS only',
            documentTitle: 'Dok A',
            category: 'zasady',
            rank: 0.9,
          },
        ])
      }
      if (sql.includes('<=>')) {
        return Promise.resolve([
          {
            id: 'embed-only',
            content: 'Embedding only',
            documentTitle: 'Dok B',
            category: 'zasady',
            rank: 0.8,
          },
        ])
      }
      return Promise.resolve([])
    })

    const result = await searchChunks('kolejka', { app: 'tutorials', limit: 5 })
    const ids = result.map((r) => r.id)

    expect(ids).toContain('fts-only')
    expect(ids).toContain('embed-only')
    // Embedding results carry 2x RRF weight, so at equal rank position they should outrank FTS-only hits.
    expect(ids.indexOf('embed-only')).toBeLessThan(ids.indexOf('fts-only'))
  })

  it('expands results with every remaining chunk of a document that has more than one hit', async () => {
    embedTextMock.mockResolvedValue(null)
    queryRawMock.mockImplementation((strings: TemplateStringsArray) => {
      const sql = sqlOf(strings)
      if (sql.includes('to_tsquery')) {
        return Promise.resolve([
          {
            id: 'c0',
            content: 'Fragment 0',
            documentTitle: 'Dok C',
            category: 'zasady',
            rank: 0.9,
          },
          {
            id: 'c2',
            content: 'Fragment 2',
            documentTitle: 'Dok C',
            category: 'zasady',
            rank: 0.7,
          },
        ])
      }
      return Promise.resolve([])
    })
    findManyMock.mockImplementation((args: ChunkFindManyArgs) => {
      if (args.where?.id?.in) {
        return Promise.resolve([
          { id: 'c0', documentId: 'doc-c' },
          { id: 'c2', documentId: 'doc-c' },
        ])
      }
      return Promise.resolve([
        {
          id: 'c1',
          documentId: 'doc-c',
          content: 'Fragment 1',
          document: { title: 'Dok C', category: 'zasady' },
        },
      ])
    })

    const result = await searchChunks('kolejka', { app: 'tutorials', limit: 5 })

    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(['c0', 'c2', 'c1']))
  })

  it('expands results with the rest of the document even when it only has a single hit', async () => {
    embedTextMock.mockResolvedValue(null)
    queryRawMock.mockImplementation((strings: TemplateStringsArray) => {
      const sql = sqlOf(strings)
      if (sql.includes('to_tsquery')) {
        return Promise.resolve([
          {
            id: 'stat-sila',
            content: 'Siła...',
            documentTitle: 'Statystyki',
            category: 'mechanika',
            rank: 0.9,
          },
        ])
      }
      return Promise.resolve([])
    })
    findManyMock.mockImplementation((args: ChunkFindManyArgs) => {
      if (args.where?.id?.in) {
        return Promise.resolve([{ id: 'stat-sila', documentId: 'doc-statystyki' }])
      }
      return Promise.resolve([
        {
          id: 'stat-wytrzymalosc',
          documentId: 'doc-statystyki',
          content: 'Wytrzymałość...',
          document: { title: 'Statystyki', category: 'mechanika' },
        },
        {
          id: 'stat-szybkosc',
          documentId: 'doc-statystyki',
          content: 'Szybkość...',
          document: { title: 'Statystyki', category: 'mechanika' },
        },
      ])
    })

    const result = await searchChunks('statystyki', { app: 'tutorials', limit: 5 })

    expect(result.map((r) => r.id)).toEqual(
      expect.arrayContaining(['stat-sila', 'stat-wytrzymalosc', 'stat-szybkosc']),
    )
  })

  it('returns only the ranked hits without document expansion when expand is false', async () => {
    embedTextMock.mockResolvedValue(null)
    queryRawMock.mockImplementation((strings: TemplateStringsArray) =>
      Promise.resolve(
        sqlOf(strings).includes('to_tsquery')
          ? [{ id: 'c1', content: 'Treść', documentTitle: 'Dok', category: 'zasady', rank: 0.5 }]
          : [],
      ),
    )

    const result = await searchChunks('klany', { app: 'tutorials', expand: false })

    expect(result.map((r) => r.id)).toEqual(['c1'])
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('skips expanding a document whose remaining chunks exceed the expansion budget', async () => {
    embedTextMock.mockResolvedValue(null)
    queryRawMock.mockImplementation((strings: TemplateStringsArray) => {
      const sql = sqlOf(strings)
      if (sql.includes('to_tsquery')) {
        return Promise.resolve([
          {
            id: 'huge-hit',
            content: 'Fragment',
            documentTitle: 'Dok Ogromny',
            category: 'zasady',
            rank: 0.9,
          },
        ])
      }
      return Promise.resolve([])
    })
    findManyMock.mockImplementation((args: ChunkFindManyArgs) => {
      if (args.where?.id?.in) {
        return Promise.resolve([{ id: 'huge-hit', documentId: 'doc-huge' }])
      }
      return Promise.resolve([
        {
          id: 'huge-rest',
          documentId: 'doc-huge',
          // Exceeds MAX_EXPANSION_CHARS (12000) on its own.
          content: 'x'.repeat(12001),
          document: { title: 'Dok Ogromny', category: 'zasady' },
        },
      ])
    })

    const result = await searchChunks('kolejka', { app: 'tutorials', limit: 5 })

    expect(result.map((r) => r.id)).toEqual(['huge-hit'])
  })

  it('applies expandQuery to FTS tokens only', async () => {
    embedTextMock.mockResolvedValue(null)
    queryRawMock.mockImplementation(() => Promise.resolve([]))

    await searchChunks('jakie są rodzaje klątw', {
      app: 'tutorials',
      limit: 5,
      expandQuery: (q) => `${q} poziom`,
    })

    const ftsCall = queryRawMock.mock.calls.find(([strings]) =>
      sqlOf(strings as TemplateStringsArray).includes('to_tsquery'),
    )
    const tsQueryArg = ftsCall?.[1] as string

    expect(tsQueryArg).toContain('poziom')
    expect(embedTextMock).toHaveBeenCalledWith('jakie są rodzaje klątw')
  })

  it('scopes every raw query to the requested app', async () => {
    embedTextMock.mockResolvedValue([0.1])
    queryRawMock.mockImplementation(() => Promise.resolve([]))

    await searchChunks('kolejka postów', { app: 'tutorials', limit: 5 })

    expect(queryRawMock).toHaveBeenCalled()
    for (const [strings, ...values] of queryRawMock.mock.calls) {
      expect(sqlOf(strings as TemplateStringsArray)).toContain('d.app =')
      expect(values).toContain('tutorials')
    }
  })
})
