import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PUT } from './route'

const { authMock, findUserMock, appRoleMock, onRoleChangeMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUserMock: vi.fn(),
  appRoleMock: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  onRoleChangeMock: vi.fn(),
}))

vi.mock('server/auth', () => ({ auth: authMock }))
vi.mock('server/users', () => ({ findUserWithDiscordId: findUserMock }))
vi.mock('server/db', () => ({ db: { appRole: appRoleMock } }))
vi.mock('server/apps/hooks', () => ({
  APP_HOOKS: { tutorials: { onRoleChange: onRoleChangeMock } },
}))

const HOST = 'mangetsu.thalverntable.app'

const put = (app: string, body: unknown) =>
  PUT(
    new NextRequest(`https://${HOST}/api/admin/users/u2/apps/${app}`, {
      method: 'PUT',
      headers: { origin: `https://${HOST}`, host: HOST },
      body: JSON.stringify(body),
    }),
    {
      params: Promise.resolve({ id: 'u2', app }),
    } as RouteContext<'/api/admin/users/[id]/apps/[app]'>,
  )

const target = { id: 'u2', isRoot: false, discordId: 'd2', name: 'Gracz', email: 'g@x.pl' }

beforeEach(() => {
  vi.resetAllMocks()
  authMock.mockResolvedValue({ user: { id: 'root', isRoot: true, apps: {} } })
  findUserMock.mockResolvedValue(target)
  appRoleMock.findUnique.mockResolvedValue(null)
  onRoleChangeMock.mockResolvedValue(undefined)
})

describe('PUT /api/admin/users/[id]/apps/[app]', () => {
  it('rejects a non-root caller', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isRoot: false, apps: { tutorials: 'EDITOR' } } })

    const res = await put('tutorials', { role: 'USER' })

    expect(res.status).toBe(403)
    expect(appRoleMock.upsert).not.toHaveBeenCalled()
  })

  it('returns 404 for an app missing from the registry', async () => {
    expect((await put('characters', { role: 'USER' })).status).toBe(404)
  })

  it('rejects a role that the app does not define', async () => {
    expect((await put('tutorials', { role: 'ROOT' })).status).toBe(400)
  })

  it('refuses to change roles of a root user', async () => {
    findUserMock.mockResolvedValue({ ...target, isRoot: true })

    expect((await put('tutorials', { role: 'USER' })).status).toBe(403)
  })

  it('grants a role and fires the app hook with the change', async () => {
    const res = await put('tutorials', { role: 'EDITOR' })

    expect(res.status).toBe(200)
    expect(appRoleMock.upsert).toHaveBeenCalledWith({
      where: { userId_app: { userId: 'u2', app: 'tutorials' } },
      create: { userId: 'u2', app: 'tutorials', role: 'EDITOR' },
      update: { role: 'EDITOR' },
    })
    expect(onRoleChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u2', app: 'tutorials', role: 'EDITOR' }),
    )
  })

  it('revokes access with role null', async () => {
    appRoleMock.findUnique.mockResolvedValue({ role: 'USER' })

    const res = await put('tutorials', { role: null })

    expect(res.status).toBe(200)
    expect(appRoleMock.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u2', app: 'tutorials' },
    })
    expect(onRoleChangeMock).toHaveBeenCalledWith(expect.objectContaining({ role: null }))
  })

  it('does not fire the hook when the role is unchanged', async () => {
    appRoleMock.findUnique.mockResolvedValue({ role: 'USER' })

    await put('tutorials', { role: 'USER' })

    expect(onRoleChangeMock).not.toHaveBeenCalled()
  })

  it('reports a failed hook without failing the role change', async () => {
    onRoleChangeMock.mockRejectedValue(new Error('n8n down'))

    const res = await put('tutorials', { role: 'USER' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, webhookOk: false })
  })
})
