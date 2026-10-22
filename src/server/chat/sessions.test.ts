import { NextRequest } from 'next/server'
import { DAILY_LIMIT } from 'server/rateLimit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createRagChatRoutes } from './routes'

const { authMock, conversationMock, rateLimitMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  conversationMock: { findMany: vi.fn(), deleteMany: vi.fn() },
  rateLimitMock: { findUnique: vi.fn() },
}))

vi.mock('server/auth', () => ({ auth: authMock }))
vi.mock('server/db', () => ({ db: { conversation: conversationMock, rateLimit: rateLimitMock } }))
vi.mock('server/ai', () => ({}))
vi.mock('server/rag', () => ({}))

const config = {
  app: 'tutorials',
  roles: ['USER', 'EDITOR'],
  buildSystemPrompt: () => '',
  buildUserMessage: () => '',
} as const

const { sessionsDelete, sessionsGet, rateLimitGet } = createRagChatRoutes(config)

const HOST = 'mangetsu.thalverntable.app'

beforeEach(() => {
  vi.resetAllMocks()
  authMock.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: { tutorials: 'USER' } } })
  conversationMock.findMany.mockResolvedValue([])
  conversationMock.deleteMany.mockResolvedValue({ count: 0 })
})

describe('GET /api/tutorials/sessions', () => {
  it('lists only the caller’s own sessions in this app', async () => {
    conversationMock.findMany.mockResolvedValue([{ sessionId: 's1' }, { sessionId: 's2' }])

    const res = await sessionsGet()

    expect(await res.json()).toEqual({ sessionIds: ['s1', 's2'] })
    expect(conversationMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', app: 'tutorials' } }),
    )
  })

  it('rejects a user without a role in tutorials', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: {} } })

    expect((await sessionsGet()).status).toBe(403)
  })
})

describe('DELETE /api/tutorials/sessions', () => {
  const del = (headers: Record<string, string>) =>
    sessionsDelete(
      new NextRequest(`https://${HOST}/api/tutorials/sessions?id=foreign-session`, {
        method: 'DELETE',
        headers,
      }),
    )

  it('scopes the delete to the caller, so another user’s sessionId deletes nothing', async () => {
    const res = await del({ origin: `https://${HOST}`, host: HOST })

    expect(res.status).toBe(200)
    expect(conversationMock.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', app: 'tutorials', sessionId: 'foreign-session' },
    })
  })

  it('rejects a cross-origin request', async () => {
    const res = await del({ origin: 'https://naruto.thalverntable.app', host: HOST })

    expect(res.status).toBe(403)
    expect(conversationMock.deleteMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/tutorials/rate-limit', () => {
  it('reports the caller’s usage against the app’s own daily limit', async () => {
    rateLimitMock.findUnique.mockResolvedValue({ count: 3 })

    const res = await createRagChatRoutes({ ...config, dailyLimit: 5 }).rateLimitGet()

    expect(await res.json()).toEqual({ requestsUsed: 3, limit: 5 })
  })

  it('falls back to the default limit', async () => {
    rateLimitMock.findUnique.mockResolvedValue(null)

    const res = await rateLimitGet()

    expect(await res.json()).toEqual({ requestsUsed: 0, limit: DAILY_LIMIT })
  })
})
