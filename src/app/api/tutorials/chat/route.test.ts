import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  classifyMessage: vi.fn(),
  buildPromptContext: vi.fn(),
  createChatStream: vi.fn(),
}))

vi.mock('server/auth', () => ({ auth: mocks.auth }))
vi.mock('server/rateLimit', () => ({
  getRequestDate: () => new Date('2026-10-01T00:00:00.000Z'),
  reserveRateLimit: mocks.reserve,
  releaseRateLimit: mocks.release,
}))
vi.mock('server/guardrails', () => ({
  classifyMessage: mocks.classifyMessage,
  POLISH_ONLY_MESSAGE: 'Tylko po polsku.',
}))
vi.mock('server/tutorials/chat', async (importOriginal) => ({
  ...(await importOriginal<typeof import('server/tutorials/chat')>()),
  buildPromptContext: mocks.buildPromptContext,
  createChatStream: mocks.createChatStream,
}))
vi.mock('server/rag', () => ({}))
vi.mock('server/conversations', () => ({}))
vi.mock('server/ai', () => ({}))

const HOST = 'mangetsu.thalverntable.app'

const post = () =>
  POST(
    new NextRequest(`https://${HOST}/api/tutorials/chat`, {
      method: 'POST',
      headers: { origin: `https://${HOST}`, host: HOST },
      body: JSON.stringify({ message: 'Jak zdobyć PD?', sessionId: 's1' }),
    }),
  )

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: { tutorials: 'USER' } } })
  mocks.reserve.mockResolvedValue({ count: 1 })
  mocks.classifyMessage.mockResolvedValue('ok')
  mocks.buildPromptContext.mockResolvedValue({
    systemPrompt: '',
    userMessage: '',
    history: [],
    conversationId: undefined,
  })
  mocks.createChatStream.mockReturnValue(new ReadableStream())
})

describe('POST /api/tutorials/chat', () => {
  it('stops at the rate limit before any paid call (guardrail, search, embeddings)', async () => {
    mocks.reserve.mockResolvedValue(NextResponse.json({ error: 'limit' }, { status: 429 }))

    const res = await post()

    expect(res.status).toBe(429)
    expect(mocks.classifyMessage).not.toHaveBeenCalled()
    expect(mocks.buildPromptContext).not.toHaveBeenCalled()
  })

  it('releases the reservation when the guardrail flags the message', async () => {
    mocks.classifyMessage.mockResolvedValue('injection')

    const res = await post()

    expect(res.status).toBe(400)
    expect(mocks.release).toHaveBeenCalledWith('u1', 'tutorials', expect.any(Date))
    expect(mocks.createChatStream).not.toHaveBeenCalled()
  })

  it('answers a non-Polish message with the fixed reply, uncounted and without the model', async () => {
    mocks.reserve.mockResolvedValue({ count: 4 })
    mocks.classifyMessage.mockResolvedValue('language')

    const res = await post()

    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(await res.text()).toBe(
      'data: {"type":"token","content":"Tylko po polsku."}\n\n' +
        'data: {"type":"done","requestsUsed":3}\n\n',
    )
    expect(mocks.release).toHaveBeenCalledWith('u1', 'tutorials', expect.any(Date))
    expect(mocks.createChatStream).not.toHaveBeenCalled()
  })

  it('releases the reservation when building the context fails', async () => {
    mocks.buildPromptContext.mockRejectedValue(new Error('db down'))

    const res = await post()

    expect(res.status).toBe(503)
    expect(mocks.release).toHaveBeenCalled()
  })

  it('streams the answer for the caller’s own history', async () => {
    const res = await post()

    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(mocks.buildPromptContext).toHaveBeenCalledWith('u1', 'Jak zdobyć PD?', 's1')
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it('rejects a user without a role in tutorials before reserving anything', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: {} } })

    expect((await post()).status).toBe(403)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
})
