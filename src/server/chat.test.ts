import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DAILY_LIMIT, getRequestDate, parseChatRequest, reserveRateLimit } from './chat'

const { upsertMock, updateMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('server/db', () => ({
  db: {
    rateLimit: {
      upsert: upsertMock,
      update: updateMock,
    },
  },
}))

vi.mock('search', () => ({ searchChunks: vi.fn().mockResolvedValue([]) }))
vi.mock('server/prompts', () => ({ buildSystemPrompt: vi.fn().mockReturnValue('') }))
vi.mock('./ai', () => ({ streamChatCompletion: vi.fn() }))

beforeEach(() => {
  upsertMock.mockReset()
  updateMock.mockReset().mockResolvedValue({})
})

describe('parseChatRequest', () => {
  it('rejects a missing message', () => {
    const result = parseChatRequest({ sessionId: 'abc' })
    expect(result).toBeInstanceOf(NextResponse)
  })

  it('rejects a missing sessionId', () => {
    const result = parseChatRequest({ message: 'Cześć' })
    expect(result).toBeInstanceOf(NextResponse)
  })

  it('rejects a blank message', () => {
    const result = parseChatRequest({ message: '   ', sessionId: 'abc' })
    expect(result).toBeInstanceOf(NextResponse)
  })

  it('trims the message and passes through the sessionId', () => {
    const result = parseChatRequest({ message: '  Jak zdobyć PD?  ', sessionId: 'session-1' })
    expect(result).toEqual({ message: 'Jak zdobyć PD?', sessionId: 'session-1' })
  })

  it('truncates messages longer than the max length', () => {
    const longMessage = 'a'.repeat(2000)
    const result = parseChatRequest({ message: longMessage, sessionId: 'session-1' })
    expect(result).not.toBeInstanceOf(NextResponse)
    expect((result as { message: string }).message).toHaveLength(1000)
  })
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

  it('returns the incremented count when under the daily limit', async () => {
    upsertMock.mockResolvedValue({ count: DAILY_LIMIT - 1 })

    const result = await reserveRateLimit('user-1', requestDate)

    expect(result).toEqual({ count: DAILY_LIMIT - 1 })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('releases the reservation and returns a 429 once the daily limit is exceeded', async () => {
    upsertMock.mockResolvedValue({ count: DAILY_LIMIT + 1 })

    const result = await reserveRateLimit('user-1', requestDate)

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(429)
    expect(updateMock).toHaveBeenCalledWith({
      where: { userId_requestDate: { userId: 'user-1', requestDate } },
      data: { count: { decrement: 1 } },
    })
  })
})
