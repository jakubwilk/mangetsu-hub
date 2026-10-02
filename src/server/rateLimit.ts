import type { AppId } from 'common/apps'
import { NextResponse } from 'next/server'
import { db } from 'server/db'

export const DAILY_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT ?? '20', 10)

export const getRequestDate = (): Date => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

const counterKey = (userId: string, app: AppId, requestDate: Date) => ({
  userId_app_requestDate: { userId, app, requestDate },
})

export const getRequestsUsed = async (
  userId: string,
  app: AppId,
  requestDate: Date,
): Promise<number> => {
  const rateLimit = await db.rateLimit.findUnique({ where: counterKey(userId, app, requestDate) })
  return rateLimit?.count ?? 0
}

export const releaseRateLimit = async (
  userId: string,
  app: AppId,
  requestDate: Date,
): Promise<void> => {
  try {
    await db.rateLimit.update({
      where: counterKey(userId, app, requestDate),
      data: { count: { decrement: 1 } },
    })
  } catch {
    // Best-effort compensation — a failure here just leaves the user one request short.
  }
}

// Atomically increments the counter (Postgres upsert serializes on the row), then checks
// the result. This closes the check-then-increment race that a plain read-then-write has:
// concurrent requests can no longer all pass the check before any of them increments.
export const reserveRateLimit = async (
  userId: string,
  app: AppId,
  requestDate: Date,
): Promise<{ count: number } | NextResponse> => {
  const rateLimit = await db.rateLimit.upsert({
    where: counterKey(userId, app, requestDate),
    create: { userId, app, requestDate, count: 1 },
    update: { count: { increment: 1 } },
  })

  if (rateLimit.count > DAILY_LIMIT) {
    await releaseRateLimit(userId, app, requestDate)
    return NextResponse.json(
      { error: 'Przekroczono dzienny limit zapytań. Spróbuj ponownie jutro.' },
      { status: 429 },
    )
  }

  return { count: rateLimit.count }
}
