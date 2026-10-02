import type { AppId, AppRole } from 'common/apps'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { auth } from './auth'

const errorResponse = (error: string, status: number) => NextResponse.json({ error }, { status })

export const requireRoot = async () => {
  const session = await auth()

  if (!session) return errorResponse('Wymagane logowanie.', 401)
  if (!session.user.isRoot) return errorResponse('Brak uprawnień.', 403)

  return { session }
}

// ROOT has access to every app regardless of `roles`.
export const requireAppRole = async <A extends AppId>(appId: A, roles: readonly AppRole<A>[]) => {
  const session = await auth()

  if (!session) return errorResponse('Wymagane logowanie.', 401)

  const role = session.user.apps[appId]
  const allowed = session.user.isRoot || (role !== undefined && roles.some((r) => r === role))
  if (!allowed) return errorResponse('Brak uprawnień.', 403)

  return { session }
}

export const readJsonBody = async (
  request: NextRequest,
): Promise<Record<string, unknown> | NextResponse> => {
  const body: unknown = await request.json().catch(() => null)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorResponse('Nieprawidłowy format żądania.', 400)
  }

  return body as Record<string, unknown>
}

export const verifyOrigin = (request: NextRequest) => {
  const originHeader = request.headers.get('origin')
  const hostHeader = request.headers.get('host')

  if (!originHeader || !hostHeader) return errorResponse('Brak nagłówka Origin.', 403)

  let origin: URL
  try {
    origin = new URL(originHeader)
  } catch {
    return errorResponse('Nieprawidłowy nagłówek Origin.', 403)
  }

  if (origin.host !== hostHeader) return errorResponse('Nieprawidłowe pochodzenie żądania.', 403)

  return null
}
