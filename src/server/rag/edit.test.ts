import { MAX_SOURCE_CHARS } from 'apps'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prepareDocumentEdit } from './edit'
import { IngestError } from './errors'

const { db, fetchForumTopicMock } = vi.hoisted(() => ({
  db: { document: { findUnique: vi.fn() } },
  fetchForumTopicMock: vi.fn(),
}))

vi.mock('server/db', () => ({ db }))
vi.mock('./sources/forum', () => ({ fetchForumTopic: fetchForumTopicMock }))

const TOPIC_URL = 'https://mangetsu.jcink.net/index.php?showtopic=41'
const author = { name: 'Redaktor', discordId: 'd1' }

const fileDocument = {
  title: 'Zasady walki',
  category: 'mechanika',
  sourceUrl: null,
  markdown: '# Zasady walki\n\nTekst.\n',
}
const forumDocument = {
  title: 'Waluty',
  category: 'mechanika',
  sourceUrl: TOPIC_URL,
  markdown: '# Waluty\n\nJeny.\n',
}

const edit = (body: Record<string, unknown>, slug = 'zasady-walki') =>
  prepareDocumentEdit('tutorials', slug, { category: 'mechanika', ...body }, author)

const rejection = async (promise: Promise<unknown>) => {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(IngestError)
  return err as IngestError
}

beforeEach(() => {
  vi.clearAllMocks()
  db.document.findUnique.mockResolvedValue(fileDocument)
  fetchForumTopicMock.mockResolvedValue({
    title: 'Waluty',
    markdown: '# Waluty\n\nJeny i PD.\n',
    sourceUrl: TOPIC_URL,
  })
})

describe('prepareDocumentEdit — document from a file', () => {
  it('prepares the new text as an update of the same slug', async () => {
    expect(
      await edit({ title: 'Zasady walki', markdown: '# Zasady walki\n\nNowy tekst.' }),
    ).toEqual({
      app: 'tutorials',
      slug: 'zasady-walki',
      title: 'Zasady walki',
      category: 'mechanika',
      markdown: '# Zasady walki\n\nNowy tekst.\n',
      mode: 'update',
      chars: 28,
      changes: ['treść'],
      submittedBy: author,
    })
  })

  it('lists every changed field', async () => {
    const result = await edit({
      title: 'Walka',
      category: 'inne',
      markdown: '# Zasady walki\n\nNowy tekst.',
    })
    expect(result.changes).toEqual(['tytuł', 'kategoria', 'treść'])
  })

  it('does not count a new title alone as new text', async () => {
    const result = await edit({ title: 'Walka', markdown: fileDocument.markdown })
    expect(result.changes).toEqual(['tytuł'])
  })

  it('rejects an edit that changes nothing', async () => {
    const err = await rejection(
      edit({ title: 'Zasady walki', markdown: '# Zasady walki\r\n\r\nTekst.' }),
    )
    expect(err.status).toBe(400)
  })

  it('requires the text', async () => {
    expect((await rejection(edit({ title: 'Zasady walki' }))).status).toBe(400)
  })

  it('rejects text over the limit', async () => {
    const markdown = `# Zasady walki\n\n${'x'.repeat(MAX_SOURCE_CHARS)}`
    expect((await rejection(edit({ title: 'Zasady walki', markdown }))).status).toBe(400)
  })
})

describe('prepareDocumentEdit — document from the forum', () => {
  beforeEach(() => db.document.findUnique.mockResolvedValue(forumDocument))

  it('keeps the stored text and link when only metadata changes', async () => {
    const result = await edit({ title: 'Waluty i PD' }, 'waluty')

    expect(result).toMatchObject({
      title: 'Waluty i PD',
      markdown: forumDocument.markdown,
      sourceUrl: TOPIC_URL,
      changes: ['tytuł'],
    })
    expect(fetchForumTopicMock).not.toHaveBeenCalled()
  })

  it('takes the current text from the topic on refresh', async () => {
    const result = await edit({ title: 'Waluty', refresh: true }, 'waluty')

    expect(fetchForumTopicMock).toHaveBeenCalledWith(TOPIC_URL)
    expect(result).toMatchObject({ markdown: '# Waluty\n\nJeny i PD.\n', changes: ['treść'] })
  })

  it('refuses text written in the app', async () => {
    const err = await rejection(
      edit({ title: 'Waluty', markdown: '# Waluty\n\nInaczej.' }, 'waluty'),
    )
    expect(err.status).toBe(400)
  })

  it('passes forum errors through with their status', async () => {
    fetchForumTopicMock.mockRejectedValue(new IngestError('Forum nie odpowiada.', 502))

    const err = await rejection(edit({ title: 'Waluty', refresh: true }, 'waluty'))
    expect(err.status).toBe(502)
  })
})

describe('prepareDocumentEdit — common checks', () => {
  it('answers 404 for a missing document', async () => {
    db.document.findUnique.mockResolvedValue(null)

    expect((await rejection(edit({ title: 'X', markdown: 'Y' }))).status).toBe(404)
  })

  it('requires a category from the manifest', async () => {
    const err = await rejection(edit({ title: 'Zasady walki', markdown: 'x', category: 'plotki' }))
    expect(err.status).toBe(400)
  })

  it('requires a title', async () => {
    expect((await rejection(edit({ title: '  ', markdown: 'x' }))).status).toBe(400)
  })

  it('rejects a title too long to store', async () => {
    expect((await rejection(edit({ title: 'a'.repeat(201), markdown: 'x' }))).status).toBe(400)
  })
})
