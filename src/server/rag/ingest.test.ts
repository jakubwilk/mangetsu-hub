import { MAX_SOURCE_CHARS } from 'apps'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteDocument, hashContent, ingestDocument, listDocuments } from './ingest'

const { db, tx, embedTextMock } = vi.hoisted(() => {
  const tx = {
    document: { upsert: vi.fn() },
    chunk: { deleteMany: vi.fn(), create: vi.fn() },
    $executeRaw: vi.fn(),
  }
  return {
    tx,
    embedTextMock: vi.fn(),
    db: {
      document: { findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    },
  }
})

vi.mock('server/db', () => ({ db }))
vi.mock('server/ai/embeddings', () => ({ embedText: embedTextMock }))

const input = {
  app: 'tutorials' as const,
  slug: 'waluty',
  title: 'Waluty',
  category: 'mechanika',
  markdown: '# Waluty\r\n\r\n\r\nJeny i PD.',
  sourceUrl: 'https://mangetsu.jcink.net/index.php?showtopic=41',
}
const normalized = '# Waluty\n\nJeny i PD.\n'

const stored = (overrides: object = {}) => ({
  id: 'doc-1',
  title: 'Waluty',
  category: 'mechanika',
  sourceUrl: input.sourceUrl,
  contentHash: hashContent(normalized),
  _count: { chunks: 3 },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  embedTextMock.mockResolvedValue([0.1, 0.2])
  tx.document.upsert.mockResolvedValue({ id: 'doc-1' })
  tx.chunk.create.mockImplementation(async ({ data }) => ({ id: `chunk-${data.chunkIndex}` }))
})

describe('ingestDocument', () => {
  it('skips chunking and embeddings when the normalized text is unchanged', async () => {
    db.document.findUnique.mockResolvedValue(stored())

    expect(await ingestDocument(input)).toEqual({ changed: false, chunks: 3 })
    expect(embedTextMock).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.document.update).not.toHaveBeenCalled()
  })

  it('updates only the metadata when the text is unchanged but the title differs', async () => {
    db.document.findUnique.mockResolvedValue(stored({ title: 'Stare waluty' }))

    expect(await ingestDocument(input)).toEqual({ changed: false, chunks: 3 })
    expect(db.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { title: 'Waluty', category: 'mechanika', sourceUrl: input.sourceUrl },
    })
    expect(embedTextMock).not.toHaveBeenCalled()
  })

  it('keeps the stored link when the update does not send one', async () => {
    db.document.findUnique.mockResolvedValue(stored({ title: 'Stare waluty' }))

    await ingestDocument({ ...input, sourceUrl: undefined })

    expect(db.document.update.mock.calls[0]![0].data.sourceUrl).toBeUndefined()
  })

  it('stores a new document with its normalized text, hash, chunks and vectors', async () => {
    db.document.findUnique.mockResolvedValue(null)

    expect(await ingestDocument(input)).toEqual({ changed: true, chunks: 1 })

    expect(tx.document.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { app_slug: { app: 'tutorials', slug: 'waluty' } },
        create: expect.objectContaining({
          markdown: normalized,
          contentHash: hashContent(normalized),
        }),
      }),
    )
    expect(tx.chunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc-1' } })
    expect(tx.chunk.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: normalized.trim() }) }),
    )
    expect(embedTextMock).toHaveBeenCalledTimes(1)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('re-chunks a document whose text changed', async () => {
    db.document.findUnique.mockResolvedValue(stored({ contentHash: 'old' }))

    expect(await ingestDocument(input)).toEqual({ changed: true, chunks: 1 })
    expect(tx.chunk.deleteMany).toHaveBeenCalled()
  })

  it('writes nothing when an embedding call fails', async () => {
    db.document.findUnique.mockResolvedValue(null)
    embedTextMock.mockRejectedValue(new Error('timeout'))

    await expect(ingestDocument(input)).rejects.toThrow('timeout')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown category', { category: 'Mechanika' }],
    ['an invalid slug', { slug: 'Złe Słowo' }],
    ['an empty title', { title: '  ' }],
    ['an empty text', { markdown: '\n\n' }],
    ['a text over the limit', { markdown: 'x'.repeat(MAX_SOURCE_CHARS + 1) }],
  ])('rejects %s with 400 before touching the database', async (_, overrides) => {
    await expect(ingestDocument({ ...input, ...overrides })).rejects.toMatchObject({ status: 400 })
    expect(db.document.findUnique).not.toHaveBeenCalled()
  })
})

describe('deleteDocument', () => {
  it('deletes by app and slug and reports whether anything was removed', async () => {
    db.document.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    expect(await deleteDocument('tutorials', 'waluty')).toBe(true)
    expect(await deleteDocument('tutorials', 'waluty')).toBe(false)
    expect(db.document.deleteMany).toHaveBeenCalledWith({
      where: { app: 'tutorials', slug: 'waluty' },
    })
  })
})

describe('listDocuments', () => {
  it('lists the app documents with their chunk counts', async () => {
    db.document.findMany.mockResolvedValue([
      { slug: 'waluty', title: 'Waluty', _count: { chunks: 3 } },
    ])

    expect(await listDocuments('tutorials')).toEqual([
      { slug: 'waluty', title: 'Waluty', chunks: 3 },
    ])
    expect(db.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { app: 'tutorials' } }),
    )
  })
})
