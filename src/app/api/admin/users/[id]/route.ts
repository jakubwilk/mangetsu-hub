import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, requireRoot, verifyOrigin } from 'server/authorize'
import { db } from 'server/db'
import { findUserWithDiscordId } from 'server/users'
import { notifyUserDeletion } from 'server/webhooks'

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
    await notifyUserDeletion({
      id,
      discordId: target.discordId,
      notify: body.notify === true,
      name: target.name,
      email: target.email,
    })
  } catch {
    webhookOk = false
  }

  return NextResponse.json({ ok: true, webhookOk })
}
