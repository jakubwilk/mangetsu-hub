import { isAppEnabled, isAppId, isValidAppRole } from 'apps'
import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, requireRoot, verifyOrigin } from 'server/authorize'
import { db } from 'server/db'
import { emitEvent } from 'server/events'
import { findUserWithDiscordId } from 'server/users'

// Body: { role: string | null } — null revokes access to the app.
export const PUT = async (
  request: NextRequest,
  ctx: RouteContext<'/api/admin/users/[id]/apps/[app]'>,
) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireRoot()
  if (authResult instanceof NextResponse) return authResult

  const { id, app } = await ctx.params
  if (!isAppId(app) || !isAppEnabled(app)) {
    return NextResponse.json({ error: 'Nieznana aplikacja.' }, { status: 404 })
  }

  const body = await readJsonBody(request)
  if (body instanceof NextResponse) return body

  const { role } = body
  if (role !== null && (typeof role !== 'string' || !isValidAppRole(app, role))) {
    return NextResponse.json({ error: 'Nieprawidłowa rola.' }, { status: 400 })
  }

  const target = await findUserWithDiscordId(id)
  if (!target) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 })
  }
  if (target.isRoot) {
    return NextResponse.json({ error: 'Nie można zmienić ról administratora.' }, { status: 403 })
  }

  const key = { userId_app: { userId: id, app } }
  const current = await db.appRole.findUnique({ where: key })

  if (role === null) {
    await db.appRole.deleteMany({ where: { userId: id, app } })
  } else {
    await db.appRole.upsert({ where: key, create: { userId: id, app, role }, update: { role } })
  }

  let webhookOk = true
  if ((current?.role ?? null) !== role) {
    try {
      await emitEvent({
        type: 'user.role_changed',
        // n8n switches on USER/EDITOR/GUEST — "no access" maps to GUEST.
        data: {
          id,
          discordId: target.discordId,
          name: target.name,
          email: target.email,
          app,
          role: role ?? 'GUEST',
        },
      })
    } catch {
      webhookOk = false
    }
  }

  return NextResponse.json({ ok: true, webhookOk })
}
