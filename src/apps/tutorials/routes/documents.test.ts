import { NextRequest } from 'next/server'
import { IngestError } from 'server/rag/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { documentDelete, documentGet, documentPatch } from './documents'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUser: vi.fn(),
  getDocument: vi.fn(),
  prepareDocumentEdit: vi.fn(),
  ingestDocument: vi.fn(),
  deleteDocument: vi.fn(),
  emitEvent: vi.fn(),
}))

vi.mock('server/auth', () => ({ auth: mocks.auth }))
vi.mock('server/users', () => ({ findUserWithDiscordId: mocks.findUser }))
vi.mock('server/events', () => ({ emitEvent: mocks.emitEvent }))
vi.mock('server/rag', async () => ({
  IngestError: (await import('server/rag/errors')).IngestError,
  getDocument: mocks.getDocument,
  prepareDocumentEdit: mocks.prepareDocumentEdit,
  ingestDocument: mocks.ingestDocument,
  deleteDocument: mocks.deleteDocument,
}))
// The chat config in the app's server barrel is not under test here.
vi.mock('../server', () => ({
  TUTORIALS_APP: 'tutorials',
  requireTutorialsEditor: async () =>
    (await import('server/authorize')).requireAppRole('tutorials', ['EDITOR']),
}))

const HOST = 'mangetsu.thalverntable.app'
const DOCUMENT_URL = `https://${HOST}/api/tutorials/documents/waluty`
const ctx = {
  params: Promise.resolve({ slug: 'waluty' }),
} as RouteContext<'/api/tutorials/documents/[slug]'>
const author = { name: 'Redaktor', discordId: 'd1' }

const request = (method: string, body?: unknown, origin = `https://${HOST}`) =>
  new NextRequest(DOCUMENT_URL, {
    method,
    headers: { origin, host: HOST, 'content-type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

const editBody = { title: 'Waluty i PD', category: 'mechanika' }
const patch = (origin?: string) => documentPatch(request('PATCH', editBody, origin), ctx)
const remove = (origin?: string) => documentDelete(request('DELETE', undefined, origin), ctx)

const editor = { user: { id: 'u1', isRoot: false, apps: { tutorials: 'EDITOR' } } }
const root = { user: { id: 'u1', isRoot: true, apps: {} } }

const document = {
  slug: 'waluty',
  title: 'Waluty',
  category: 'mechanika',
  sourceUrl: 'https://mangetsu.jcink.net/index.php?showtopic=41',
  markdown: '# Waluty\n\nJeny.\n',
  updatedAt: new Date('2026-10-22T10:00:00Z'),
  chunks: 3,
}
const edit = {
  app: 'tutorials',
  slug: 'waluty',
  title: 'Waluty i PD',
  category: 'mechanika',
  markdown: document.markdown,
  sourceUrl: document.sourceUrl,
  mode: 'update',
  chars: 16,
  changes: ['tytuł'],
  submittedBy: author,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue(editor)
  mocks.findUser.mockResolvedValue({ id: 'u1', name: 'Redaktor', discordId: 'd1' })
  mocks.getDocument.mockResolvedValue(document)
  mocks.prepareDocumentEdit.mockResolvedValue(edit)
  mocks.ingestDocument.mockResolvedValue({ changed: false, chunks: 3 })
  mocks.deleteDocument.mockResolvedValue(true)
  mocks.emitEvent.mockResolvedValue(undefined)
})

describe('GET /api/tutorials/documents/[slug]', () => {
  it('returns the document with its text to an editor', async () => {
    const res = await documentGet(request('GET'), ctx)

    expect(res.status).toBe(200)
    expect((await res.json()).document).toMatchObject({
      slug: 'waluty',
      markdown: document.markdown,
    })
    expect(mocks.getDocument).toHaveBeenCalledWith('tutorials', 'waluty')
  })

  it('answers 404 for a missing document', async () => {
    mocks.getDocument.mockResolvedValue(null)

    expect((await documentGet(request('GET'), ctx)).status).toBe(404)
  })

  it('allows only editors', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: { tutorials: 'USER' } } })

    expect((await documentGet(request('GET'), ctx)).status).toBe(403)
  })
})

describe('PATCH /api/tutorials/documents/[slug]', () => {
  it('sends an editor’s change to n8n for approval', async () => {
    const res = await patch()

    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe(
      'Zmiana „Waluty i PD” czeka na akceptację administratora.',
    )
    expect(mocks.prepareDocumentEdit).toHaveBeenCalledWith('tutorials', 'waluty', editBody, author)
    expect(mocks.emitEvent).toHaveBeenCalledWith({ type: 'rag.source_submitted', data: edit })
    expect(mocks.ingestDocument).not.toHaveBeenCalled()
  })

  it('saves a change from ROOT at once', async () => {
    mocks.auth.mockResolvedValue(root)

    const res = await patch()

    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe('Zapisano „Waluty i PD”.')
    expect(mocks.ingestDocument).toHaveBeenCalledWith(edit)
    expect(mocks.emitEvent).not.toHaveBeenCalled()
  })

  it('returns a rejected edit with its status', async () => {
    mocks.prepareDocumentEdit.mockRejectedValue(new IngestError('Brak zmian.', 400))

    const res = await patch()

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Brak zmian.' })
    expect(mocks.emitEvent).not.toHaveBeenCalled()
  })

  it('answers 502 when n8n does not take the event', async () => {
    mocks.emitEvent.mockRejectedValue(new Error('status 500'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await patch()).status).toBe(502)
  })

  it('requires a signed-in user', async () => {
    mocks.auth.mockResolvedValue(null)

    expect((await patch()).status).toBe(401)
  })

  it('rejects a request from another origin', async () => {
    expect((await patch('https://thalverntable.app')).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/tutorials/documents/[slug]', () => {
  it('asks ROOT to approve an editor’s deletion', async () => {
    const res = await remove()

    expect(res.status).toBe(200)
    expect((await res.json()).message).toContain('Prośba o usunięcie „Waluty”')
    expect(mocks.emitEvent).toHaveBeenCalledWith({
      type: 'rag.document_delete_requested',
      data: {
        app: 'tutorials',
        slug: 'waluty',
        title: 'Waluty',
        category: 'mechanika',
        sourceUrl: document.sourceUrl,
        chunks: 3,
        submittedBy: author,
      },
    })
    expect(mocks.deleteDocument).not.toHaveBeenCalled()
  })

  it('deletes at once for ROOT', async () => {
    mocks.auth.mockResolvedValue(root)

    const res = await remove()

    expect(res.status).toBe(200)
    expect(mocks.deleteDocument).toHaveBeenCalledWith('tutorials', 'waluty')
    expect(mocks.emitEvent).not.toHaveBeenCalled()
  })

  it('answers 404 for a missing document', async () => {
    mocks.getDocument.mockResolvedValue(null)

    expect((await remove()).status).toBe(404)
    expect(mocks.emitEvent).not.toHaveBeenCalled()
  })

  it('allows only editors', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: { tutorials: 'USER' } } })

    expect((await remove()).status).toBe(403)
    expect(mocks.getDocument).not.toHaveBeenCalled()
  })

  it('rejects a request from another origin', async () => {
    expect((await remove('https://thalverntable.app')).status).toBe(403)
  })
})
