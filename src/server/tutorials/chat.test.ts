import { NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { parseChatRequest } from './chat'

vi.mock('./access', () => ({ TUTORIALS_APP: 'tutorials' }))
vi.mock('server/rag', () => ({ searchChunks: vi.fn().mockResolvedValue([]) }))
vi.mock('server/conversations', () => ({}))
vi.mock('server/rateLimit', () => ({}))
vi.mock('server/ai', () => ({ streamChatCompletion: vi.fn() }))

describe('parseChatRequest', () => {
  it('rejects a missing message', () => {
    expect(parseChatRequest({ sessionId: 'abc' })).toBeInstanceOf(NextResponse)
  })

  it('rejects a missing sessionId', () => {
    expect(parseChatRequest({ message: 'Cześć' })).toBeInstanceOf(NextResponse)
  })

  it('rejects a blank message', () => {
    expect(parseChatRequest({ message: '   ', sessionId: 'abc' })).toBeInstanceOf(NextResponse)
  })

  it('trims the message and passes through the sessionId', () => {
    const result = parseChatRequest({ message: '  Jak zdobyć PD?  ', sessionId: 'session-1' })
    expect(result).toEqual({ message: 'Jak zdobyć PD?', sessionId: 'session-1' })
  })

  it('truncates messages longer than the max length', () => {
    const result = parseChatRequest({ message: 'a'.repeat(2000), sessionId: 'session-1' })
    expect(result).not.toBeInstanceOf(NextResponse)
    expect((result as { message: string }).message).toHaveLength(1000)
  })
})
