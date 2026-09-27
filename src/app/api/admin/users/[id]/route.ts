import { NextRequest, NextResponse } from 'next/server'
import { requireRole, verifyOrigin } from 'server/authorize'
import { db } from 'server/db'
import { notifyRoleActivation, notifyUserDeletion } from 'server/webhooks'

const ASSIGNABLE_ROLES = ['GUEST', 'USER', 'EDITOR'] as const

const withDiscordAccount = {
  accounts: { where: { provider: 'discord' }, select: { providerAccountId: true } },
} as const

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireRole(['ROOT'])
  if (authResult instanceof NextResponse) return authResult

  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format żądania.' }, { status: 400 })
  }

  const { role } = body
  if (
    typeof role !== 'string' ||
    !ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])
  ) {
    return NextResponse.json({ error: 'Nieprawidłowa rola.' }, { status: 400 })
  }

  const target = await db.user.findUnique({ where: { id }, include: withDiscordAccount })
  if (!target) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 })
  }
  if (target.role === 'ROOT') {
    return NextResponse.json({ error: 'Nie można zmienić roli administratora.' }, { status: 403 })
  }

  await db.user.update({
    where: { id },
    data: { role: role as (typeof ASSIGNABLE_ROLES)[number] },
  })

  let webhookOk = true
  if (target.role === 'GUEST' && role !== 'GUEST') {
    try {
      await notifyRoleActivation({
        id,
        discordId: target.accounts[0]?.providerAccountId ?? null,
        name: target.name,
        email: target.email,
        role,
      })
    } catch {
      webhookOk = false
    }
  }

  return NextResponse.json({ ok: true, webhookOk })
}

export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireRole(['ROOT'])
  if (authResult instanceof NextResponse) return authResult

  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowy format żądania.' }, { status: 400 })
  }

  const notify = body.notify === true

  const target = await db.user.findUnique({ where: { id }, include: withDiscordAccount })
  if (!target) {
    return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 })
  }
  if (target.role === 'ROOT') {
    return NextResponse.json({ error: 'Nie można usunąć administratora.' }, { status: 403 })
  }

  await db.user.delete({ where: { id } })

  let webhookOk = true
  try {
    await notifyUserDeletion({
      id,
      discordId: target.accounts[0]?.providerAccountId ?? null,
      notify,
      name: target.name,
      email: target.email,
    })
  } catch {
    webhookOk = false
  }

  return NextResponse.json({ ok: true, webhookOk })
}
