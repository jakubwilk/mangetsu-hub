import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readJsonBody, requireAppRole, requireRoot, verifyOrigin } from './authorize'

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }))

vi.mock('./auth', () => ({ auth: authMock }))

const sessionFor = (user: { isRoot?: boolean; apps?: Record<string, string> }) => ({
  user: { id: 'u1', isRoot: false, apps: {}, ...user },
})

const statusOf = (result: unknown) => (result instanceof NextResponse ? result.status : 200)

beforeEach(() => authMock.mockReset())

describe('requireAppRole', () => {
  it('returns 401 without a session', async () => {
    authMock.mockResolvedValue(null)
    expect(statusOf(await requireAppRole('tutorials', ['USER']))).toBe(401)
  })

  it('returns 403 when the user has no role in the app', async () => {
    authMock.mockResolvedValue(sessionFor({}))
    expect(statusOf(await requireAppRole('tutorials', ['USER', 'EDITOR']))).toBe(403)
  })

  it('returns 403 when the role in the app is not one of the allowed ones', async () => {
    authMock.mockResolvedValue(sessionFor({ apps: { tutorials: 'USER' } }))
    expect(statusOf(await requireAppRole('tutorials', ['EDITOR']))).toBe(403)
  })

  it('passes a user with an allowed role', async () => {
    authMock.mockResolvedValue(sessionFor({ apps: { tutorials: 'EDITOR' } }))
    expect(statusOf(await requireAppRole('tutorials', ['EDITOR']))).toBe(200)
  })

  it('always passes ROOT', async () => {
    authMock.mockResolvedValue(sessionFor({ isRoot: true }))
    expect(statusOf(await requireAppRole('tutorials', ['EDITOR']))).toBe(200)
  })
})

describe('requireRoot', () => {
  it('rejects a non-root user even with app roles', async () => {
    authMock.mockResolvedValue(sessionFor({ apps: { tutorials: 'EDITOR' } }))
    expect(statusOf(await requireRoot())).toBe(403)
  })
})

describe('readJsonBody', () => {
  const requestWith = (body: string) =>
    new NextRequest('http://localhost/api/x', { method: 'POST', body })

  it('returns the parsed object', async () => {
    expect(await readJsonBody(requestWith('{"a":1}'))).toEqual({ a: 1 })
  })

  it.each(['not json', '[1,2]', 'null', '"text"'])('returns 400 for %s', async (body) => {
    expect(statusOf(await readJsonBody(requestWith(body)))).toBe(400)
  })
})

describe('verifyOrigin', () => {
  const requestWith = (headers: Record<string, string>) =>
    new NextRequest('https://mangetsu.thalverntable.app/api/x', { method: 'POST', headers })

  it('accepts a same-host origin', () => {
    expect(
      verifyOrigin(
        requestWith({
          origin: 'https://mangetsu.thalverntable.app',
          host: 'mangetsu.thalverntable.app',
        }),
      ),
    ).toBeNull()
  })

  it('rejects a sibling subdomain', () => {
    const result = verifyOrigin(
      requestWith({
        origin: 'https://naruto.thalverntable.app',
        host: 'mangetsu.thalverntable.app',
      }),
    )
    expect(statusOf(result)).toBe(403)
  })

  it('rejects a request without an Origin header', () => {
    expect(statusOf(verifyOrigin(requestWith({ host: 'mangetsu.thalverntable.app' })))).toBe(403)
  })
})
