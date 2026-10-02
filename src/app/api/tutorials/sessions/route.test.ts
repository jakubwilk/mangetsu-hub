import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE, GET } from './route'

const { authMock, conversationMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  conversationMock: { findMany: vi.fn(), deleteMany: vi.fn() },
}))

vi.mock('server/auth', () => ({ auth: authMock }))
vi.mock('server/db', () => ({ db: { conversation: conversationMock } }))
vi.mock('server/ai', () => ({}))
vi.mock('server/rag', () => ({}))

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

    const res = await GET()

    expect(await res.json()).toEqual({ sessionIds: ['s1', 's2'] })
    expect(conversationMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', app: 'tutorials' } }),
    )
  })

  it('rejects a user without a role in tutorials', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: {} } })

    expect((await GET()).status).toBe(403)
  })
})

describe('DELETE /api/tutorials/sessions', () => {
  const del = (headers: Record<string, string>) =>
    DELETE(
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
