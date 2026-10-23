import { MAX_SOURCE_CHARS } from 'apps'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IngestError } from './errors'
import { prepareSourceSubmission } from './submission'

const { db, fetchForumTopicMock } = vi.hoisted(() => ({
  db: { document: { count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() } },
  fetchForumTopicMock: vi.fn(),
}))

vi.mock('server/db', () => ({ db }))
vi.mock('./sources/forum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sources/forum')>()),
  fetchForumTopic: fetchForumTopicMock,
}))

const TOPIC_URL = 'https://mangetsu.jcink.net/index.php?showtopic=41'
const author = { name: 'Redaktor', discordId: 'd1' }

const submit = (body: Record<string, unknown>) =>
  prepareSourceSubmission('tutorials', { category: 'mechanika', ...body }, author)

const forum = (body: Record<string, unknown> = {}) =>
  submit({ type: 'FORUM', url: `${TOPIC_URL}&st=15`, ...body })

const file = (markdown: string, body: Record<string, unknown> = {}) =>
  submit({ type: 'MARKDOWN', markdown, fileName: 'zasady-walki.md', ...body })

const rejection = async (promise: Promise<unknown>) => {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(IngestError)
  return err as IngestError
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_FORUM_URL', 'https://mangetsu.jcink.net/')
  fetchForumTopicMock.mockResolvedValue({
    title: 'Waluty',
    markdown: '# Waluty\n\nJeny i PD.\n',
    sourceUrl: TOPIC_URL,
  })
  db.document.count.mockResolvedValue(0)
  db.document.findFirst.mockResolvedValue(null)
  db.document.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllEnvs())

describe('prepareSourceSubmission — forum topic', () => {
  it('creates a document titled and slugged after the topic', async () => {
    expect(await forum()).toEqual({
      app: 'tutorials',
      slug: 'waluty',
      title: 'Waluty',
      category: 'mechanika',
      markdown: '# Waluty\n\nJeny i PD.\n',
      sourceUrl: TOPIC_URL,
      mode: 'create',
      chars: 21,
      submittedBy: author,
    })
    expect(fetchForumTopicMock).toHaveBeenCalledWith(`${TOPIC_URL}&st=15`)
  })

  it('uses the title from the form', async () => {
    expect(await forum({ title: '  Pieniądze ' })).toMatchObject({
      title: 'Pieniądze',
      slug: 'pieniądze',
    })
  })

  it('updates the document already linked to the topic, keeping its slug and title', async () => {
    db.document.findFirst.mockResolvedValue({ slug: 'system-walut', title: 'System walut' })

    expect(await forum()).toMatchObject({
      mode: 'update',
      slug: 'system-walut',
      title: 'System walut',
    })
    expect(db.document.findFirst).toHaveBeenCalledWith({
      where: { app: 'tutorials', sourceUrl: TOPIC_URL },
      select: { slug: true, title: true },
    })
  })

  it('keeps a new topic apart from a document that already owns its slug', async () => {
    db.document.count.mockResolvedValueOnce(1)

    expect(await forum()).toMatchObject({ mode: 'create', slug: 'waluty-41' })
  })

  it('rejects a topic whose fallback slug is taken too', async () => {
    db.document.count.mockResolvedValue(1)

    expect((await rejection(forum())).status).toBe(409)
  })

  it('passes conversion errors through with their status', async () => {
    fetchForumTopicMock.mockRejectedValue(new IngestError('Nie rozpoznano wątku.', 422))

    expect((await rejection(forum())).status).toBe(422)
  })

  it('requires a link', async () => {
    expect((await rejection(submit({ type: 'FORUM', url: ' ' }))).status).toBe(400)
  })
})

describe('prepareSourceSubmission — markdown file', () => {
  it('takes the title from the first heading and the slug from the file name', async () => {
    expect(await file('﻿# Zasady walki\r\n\r\nInicjatywa.')).toEqual({
      app: 'tutorials',
      slug: 'zasady-walki',
      title: 'Zasady walki',
      category: 'mechanika',
      markdown: '# Zasady walki\n\nInicjatywa.\n',
      mode: 'create',
      chars: 28,
      submittedBy: author,
    })
  })

  it('falls back to the file name when the text has no title', async () => {
    const result = await file('Inicjatywa.', { fileName: 'Walka wręcz.md' })

    expect(result).toMatchObject({ title: 'Walka wręcz', slug: 'walka-wręcz' })
    expect(result.markdown).toBe('# Walka wręcz\n\nInicjatywa.\n')
  })

  it('prefers the title from the form', async () => {
    expect(await file('# Zasady walki\n\nInicjatywa.', { title: 'Walka' })).toMatchObject({
      title: 'Walka',
      slug: 'zasady-walki',
    })
  })

  it('slugs a pasted text without a file name after its title', async () => {
    expect(await file('# Zasady walki\n\nTekst.', { fileName: undefined })).toMatchObject({
      slug: 'zasady-walki',
    })
  })

  it('updates the document with the same slug', async () => {
    db.document.findUnique.mockResolvedValue({ sourceUrl: null })

    expect(await file('# Zasady walki\n\nTekst.')).toMatchObject({ mode: 'update' })
  })

  it('refuses to replace a document that comes from the forum', async () => {
    db.document.findUnique.mockResolvedValue({ sourceUrl: TOPIC_URL })

    expect((await rejection(file('# Zasady walki\n\nTekst.'))).status).toBe(409)
  })

  it('rejects a file that is not markdown', async () => {
    const err = await rejection(file('# A\n\nB', { fileName: 'notatki.txt' }))
    expect(err.status).toBe(400)
  })

  it('requires a title when neither the text nor the file name gives one', async () => {
    const err = await rejection(file('Tekst bez tytułu.', { fileName: undefined }))
    expect(err.status).toBe(400)
  })

  it('rejects text over the limit', async () => {
    const err = await rejection(file(`# A\n\n${'x'.repeat(MAX_SOURCE_CHARS)}`))
    expect(err.status).toBe(400)
  })
})

describe('prepareSourceSubmission — common checks', () => {
  it('requires a category from the manifest', async () => {
    const err = await rejection(forum({ category: 'plotki' }))
    expect(err.status).toBe(400)
    expect(fetchForumTopicMock).not.toHaveBeenCalled()
  })

  it('rejects an unknown source type', async () => {
    expect((await rejection(submit({ type: 'URL', data: TOPIC_URL }))).status).toBe(400)
  })

  it('rejects a title too long to store', async () => {
    expect((await rejection(forum({ title: 'a'.repeat(201) }))).status).toBe(400)
  })

  it('rejects a title that gives no slug', async () => {
    expect((await rejection(forum({ title: '!!!' }))).status).toBe(400)
  })
})
