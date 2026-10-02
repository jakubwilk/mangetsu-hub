import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DAILY_LIMIT, getRequestDate, reserveRateLimit } from './rateLimit'

const { upsertMock, updateMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('server/db', () => ({
  db: { rateLimit: { upsert: upsertMock, update: updateMock } },
}))

beforeEach(() => {
  upsertMock.mockReset()
  updateMock.mockReset().mockResolvedValue({})
})

describe('getRequestDate', () => {
  it('truncates the current time to a UTC calendar day', () => {
    const date = getRequestDate()
    expect(date.getUTCHours()).toBe(0)
    expect(date.getUTCMinutes()).toBe(0)
    expect(date.getUTCSeconds()).toBe(0)
    expect(date.getUTCMilliseconds()).toBe(0)
  })
})

describe('reserveRateLimit', () => {
  const requestDate = new Date('2026-07-23T00:00:00.000Z')
  const key = { userId_app_requestDate: { userId: 'user-1', app: 'tutorials', requestDate } }

  it('counts per user and app, returning the incremented count when under the limit', async () => {
    upsertMock.mockResolvedValue({ count: DAILY_LIMIT - 1 })

    const result = await reserveRateLimit('user-1', 'tutorials', requestDate)

    expect(result).toEqual({ count: DAILY_LIMIT - 1 })
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: key,
        create: { userId: 'user-1', app: 'tutorials', requestDate, count: 1 },
      }),
    )
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('releases the reservation and returns a 429 once the daily limit is exceeded', async () => {
    upsertMock.mockResolvedValue({ count: DAILY_LIMIT + 1 })

    const result = await reserveRateLimit('user-1', 'tutorials', requestDate)

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(429)
    expect(updateMock).toHaveBeenCalledWith({ where: key, data: { count: { decrement: 1 } } })
  })
})
