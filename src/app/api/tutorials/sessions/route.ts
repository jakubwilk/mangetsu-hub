import { NextRequest, NextResponse } from 'next/server'
import { verifyOrigin } from 'server/authorize'
import { deleteSession, listSessionIds } from 'server/conversations'
import { requireTutorialsUser, TUTORIALS_APP } from 'server/tutorials'

export const GET = async () => {
  const authResult = await requireTutorialsUser()
  if (authResult instanceof NextResponse) return authResult

  try {
    const sessionIds = await listSessionIds(authResult.session.user.id, TUTORIALS_APP)
    return NextResponse.json({ sessionIds })
  } catch {
    return NextResponse.json({ error: 'Usługa chwilowo niedostępna.' }, { status: 503 })
  }
}

export const DELETE = async (request: NextRequest) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireTutorialsUser()
  if (authResult instanceof NextResponse) return authResult

  const sessionId = request.nextUrl.searchParams.get('id')
  if (!sessionId) {
    return NextResponse.json({ error: "Parametr 'id' jest wymagany." }, { status: 400 })
  }

  try {
    await deleteSession(authResult.session.user.id, TUTORIALS_APP, sessionId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Usługa chwilowo niedostępna.' }, { status: 503 })
  }
}
