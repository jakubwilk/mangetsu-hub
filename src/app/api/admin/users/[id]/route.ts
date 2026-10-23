import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, requireRoot, verifyOrigin } from 'server/authorize'
import { db } from 'server/db'
import { emitEvent } from 'server/events'
import { findUserWithDiscordId } from 'server/users'

export const DELETE = async (request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireRoot()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await ctx.params

  const body = await readJsonBody(request)
  if (body instanceof NextResponse) return body

  const target = await findUserWithDiscordId(id)
  if (!target) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 })
  }
  if (target.isRoot) {
    return NextResponse.json({ error: 'Nie można usunąć administratora.' }, { status: 403 })
  }

  // Cascades to sessions, app roles, conversations and rate limits.
  await db.user.delete({ where: { id } })

  let webhookOk = true
  try {
    await emitEvent({
      type: 'user.deleted',
      data: {
        id,
        discordId: target.discordId,
        name: target.name,
        email: target.email,
        notify: body.notify === true,
      },
    })
  } catch {
    webhookOk = false
  }

  return NextResponse.json({ ok: true, webhookOk })
}
