import { NextRequest } from 'next/server'
import { IngestError } from 'server/rag/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sourcesPost } from './sources'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUser: vi.fn(),
  prepareSourceSubmission: vi.fn(),
  emitEvent: vi.fn(),
}))

vi.mock('server/auth', () => ({ auth: mocks.auth }))
vi.mock('server/users', () => ({ findUserWithDiscordId: mocks.findUser }))
vi.mock('server/events', () => ({ emitEvent: mocks.emitEvent }))
vi.mock('server/rag', async () => ({
  IngestError: (await import('server/rag/errors')).IngestError,
  prepareSourceSubmission: mocks.prepareSourceSubmission,
}))
// The chat config in the app's server barrel is not under test here.
vi.mock('../server', () => ({
  TUTORIALS_APP: 'tutorials',
  requireTutorialsEditor: async () =>
    (await import('server/authorize')).requireAppRole('tutorials', ['EDITOR']),
}))

const HOST = 'mangetsu.thalverntable.app'
const body = { type: 'FORUM', url: 'https://mangetsu.jcink.net/index.php?showtopic=41' }

const post = (origin = `https://${HOST}`) =>
  sourcesPost(
    new NextRequest(`https://${HOST}/api/tutorials/sources`, {
      method: 'POST',
      headers: { origin, host: HOST, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

const submission = {
  app: 'tutorials',
  slug: 'waluty',
  title: 'Waluty',
  category: 'mechanika',
  markdown: '# Waluty\n\nJeny.\n',
  sourceUrl: 'https://mangetsu.jcink.net/index.php?showtopic=41',
  mode: 'create',
  chars: 17,
  submittedBy: { name: 'Redaktor', discordId: 'd1' },
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: { tutorials: 'EDITOR' } } })
  mocks.findUser.mockResolvedValue({ id: 'u1', name: 'Redaktor', discordId: 'd1' })
  mocks.prepareSourceSubmission.mockResolvedValue(submission)
  mocks.emitEvent.mockResolvedValue(undefined)
})

describe('POST /api/tutorials/sources', () => {
  it('prepares the source and sends it to n8n for approval', async () => {
    const res = await post()

    expect(res.status).toBe(200)
    expect((await res.json()).message).toContain('„Waluty” czeka na akceptację')
    expect(mocks.prepareSourceSubmission).toHaveBeenCalledWith('tutorials', body, {
      name: 'Redaktor',
      discordId: 'd1',
    })
    expect(mocks.emitEvent).toHaveBeenCalledWith({
      type: 'rag.source_submitted',
      data: submission,
    })
  })

  it('requires a signed-in user', async () => {
    mocks.auth.mockResolvedValue(null)

    expect((await post()).status).toBe(401)
    expect(mocks.emitEvent).not.toHaveBeenCalled()
  })

  it('allows only editors', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: { tutorials: 'USER' } } })

    expect((await post()).status).toBe(403)
    expect(mocks.prepareSourceSubmission).not.toHaveBeenCalled()
  })

  it('rejects a request from another origin', async () => {
    expect((await post('https://thalverntable.app')).status).toBe(403)
    expect(mocks.auth).not.toHaveBeenCalled()
  })

  it('returns a rejected source with its status and sends nothing', async () => {
    mocks.prepareSourceSubmission.mockRejectedValue(new IngestError('Nie rozpoznano wątku.', 422))

    const res = await post()

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Nie rozpoznano wątku.' })
    expect(mocks.emitEvent).not.toHaveBeenCalled()
  })

  it('answers 502 when n8n does not take the event', async () => {
    mocks.emitEvent.mockRejectedValue(new Error('status 500'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await post()).status).toBe(502)
  })
})
