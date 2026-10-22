import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IngestError } from './errors'
import { documentsDelete, documentsGet, documentsPut } from './routes'

const mocks = vi.hoisted(() => ({
  ingestDocument: vi.fn(),
  deleteDocument: vi.fn(),
  listDocuments: vi.fn(),
  fetchForumTopic: vi.fn(),
}))

vi.mock('server/auth', () => ({ auth: vi.fn() }))
vi.mock('./ingest', () => ({
  ingestDocument: mocks.ingestDocument,
  deleteDocument: mocks.deleteDocument,
  listDocuments: mocks.listDocuments,
}))
vi.mock('./sources/forum', () => ({ fetchForumTopic: mocks.fetchForumTopic }))

const SECRET = 'n8n-secret'
const URL_BASE = 'http://localhost/api/internal/rag/documents'

const request = (
  method: string,
  { query = '', body, secret = SECRET }: { query?: string; body?: unknown; secret?: string } = {},
) =>
  new NextRequest(`${URL_BASE}${query}`, {
    method,
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const put = (body: unknown) => documentsPut(request('PUT', { body }))

const document = {
  app: 'tutorials',
  slug: 'waluty',
  title: 'Waluty',
  category: 'mechanika',
  markdown: '# Waluty\n\nJeny.',
}
const forumDocument = { app: 'tutorials', slug: 'waluty', category: 'mechanika' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('INTERNAL_API_SECRET', SECRET)
  mocks.ingestDocument.mockResolvedValue({ changed: true, chunks: 2 })
})
afterEach(() => vi.unstubAllEnvs())

describe('internal documents API', () => {
  it('rejects every method without the secret', async () => {
    for (const response of [
      await documentsGet(request('GET', { query: '?app=tutorials', secret: 'wrong' })),
      await documentsPut(request('PUT', { body: document, secret: 'wrong' })),
      await documentsDelete(request('DELETE', { query: '?app=tutorials&slug=a', secret: 'wrong' })),
    ]) {
      expect(response.status).toBe(401)
    }
    expect(mocks.listDocuments).not.toHaveBeenCalled()
    expect(mocks.ingestDocument).not.toHaveBeenCalled()
    expect(mocks.deleteDocument).not.toHaveBeenCalled()
  })

  it('answers 404 for an app that is unknown or has no knowledge base', async () => {
    expect((await documentsGet(request('GET', { query: '?app=nope' }))).status).toBe(404)
    expect((await documentsGet(request('GET'))).status).toBe(404)
    expect((await put({ ...document, app: 'nope' })).status).toBe(404)
  })
})

describe('documentsGet', () => {
  it('lists the app documents', async () => {
    mocks.listDocuments.mockResolvedValue([{ slug: 'waluty' }])

    const response = await documentsGet(request('GET', { query: '?app=tutorials' }))

    expect(await response.json()).toEqual({ documents: [{ slug: 'waluty' }] })
    expect(mocks.listDocuments).toHaveBeenCalledWith('tutorials')
  })
})

describe('documentsPut', () => {
  it('ingests a markdown document and returns the result', async () => {
    const response = await put({ ...document, sourceUrl: 'https://example.com/a' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ changed: true, chunks: 2 })
    expect(mocks.ingestDocument).toHaveBeenCalledWith({
      ...document,
      sourceUrl: 'https://example.com/a',
    })
  })

  it('leaves the stored link alone when none is sent, and clears it on null', async () => {
    await put(document)
    await put({ ...document, sourceUrl: null })

    expect(mocks.ingestDocument.mock.calls[0]![0].sourceUrl).toBeUndefined()
    expect(mocks.ingestDocument.mock.calls[1]![0].sourceUrl).toBeNull()
  })

  it('fetches a forum topic itself, taking the topic title unless one is given', async () => {
    mocks.fetchForumTopic.mockResolvedValue({
      title: 'Waluty forum',
      markdown: '# Waluty forum\n',
      sourceUrl: 'https://mangetsu.jcink.net/index.php?showtopic=41',
    })
    const forumUrl = 'https://mangetsu.jcink.net/index.php?showtopic=41&st=15'

    await put({ ...forumDocument, forumUrl })
    await put({ ...forumDocument, forumUrl, title: 'Waluty' })

    expect(mocks.fetchForumTopic).toHaveBeenCalledWith(forumUrl)
    expect(mocks.ingestDocument.mock.calls[0]![0]).toEqual({
      ...forumDocument,
      title: 'Waluty forum',
      markdown: '# Waluty forum\n',
      sourceUrl: 'https://mangetsu.jcink.net/index.php?showtopic=41',
    })
    expect(mocks.ingestDocument.mock.calls[1]![0].title).toBe('Waluty')
  })

  it.each([
    ['both markdown and forumUrl', { ...document, forumUrl: 'https://mangetsu.jcink.net/' }],
    ['neither markdown nor forumUrl', { ...document, markdown: undefined }],
    ['a markdown document without a title', { ...document, title: undefined }],
    ['a non-text slug', { ...document, slug: 5 }],
    ['a non-http link', { ...document, sourceUrl: 'javascript:alert(1)' }],
    ['an empty link', { ...document, sourceUrl: '' }],
  ])('rejects %s with 400', async (_, body) => {
    expect((await put(body)).status).toBe(400)
    expect(mocks.ingestDocument).not.toHaveBeenCalled()
  })

  it('maps ingest and forum errors to their status and message', async () => {
    mocks.ingestDocument.mockRejectedValueOnce(new IngestError('Nieznana kategoria „x”.', 400))
    const invalid = await put(document)
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Nieznana kategoria „x”.' })

    mocks.fetchForumTopic.mockRejectedValueOnce(new IngestError('Nie rozpoznano wątku.', 422))
    expect((await put({ ...forumDocument, forumUrl: 'https://x' })).status).toBe(422)
  })

  it('hides unexpected failures behind 503', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.ingestDocument.mockRejectedValueOnce(new Error('connection refused at 10.0.0.1'))

    const response = await put(document)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Usługa chwilowo niedostępna.' })
  })
})

describe('documentsDelete', () => {
  it('deletes a document and answers 404 when there is none', async () => {
    mocks.deleteDocument.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const remove = () => documentsDelete(request('DELETE', { query: '?app=tutorials&slug=waluty' }))

    expect(await (await remove()).json()).toEqual({ deleted: true })
    expect((await remove()).status).toBe(404)
    expect(mocks.deleteDocument).toHaveBeenCalledWith('tutorials', 'waluty')
  })

  it('requires a slug', async () => {
    expect((await documentsDelete(request('DELETE', { query: '?app=tutorials' }))).status).toBe(400)
  })
})
