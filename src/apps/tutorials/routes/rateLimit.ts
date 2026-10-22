import { NextResponse } from 'next/server'
import { DAILY_LIMIT, getRequestDate, getRequestsUsed } from 'server/rateLimit'

import { requireTutorialsUser, TUTORIALS_APP } from '../server'

export const rateLimitGet = async () => {
  const authResult = await requireTutorialsUser()
  if (authResult instanceof NextResponse) return authResult

  try {
    const requestsUsed = await getRequestsUsed(
      authResult.session.user.id,
      TUTORIALS_APP,
      getRequestDate(),
    )
    return NextResponse.json({ requestsUsed, limit: DAILY_LIMIT })
  } catch {
    return NextResponse.json({ error: 'Usługa chwilowo niedostępna.' }, { status: 503 })
  }
}
