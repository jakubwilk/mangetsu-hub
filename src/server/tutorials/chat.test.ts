import { NextResponse } from 'next/server'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import { streamChatCompletion } from 'server/ai'
import { getRecentHistory, saveExchange } from 'server/conversations'
import { searchChunks } from 'server/rag'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildPromptContext, createChatStream, parseChatRequest, TRUNCATION_NOTE } from './chat'

vi.mock('./access', () => ({ TUTORIALS_APP: 'tutorials' }))
vi.mock('server/rag', () => ({ searchChunks: vi.fn().mockResolvedValue([]) }))
vi.mock('server/conversations', () => ({ getRecentHistory: vi.fn(), saveExchange: vi.fn() }))
vi.mock('server/rateLimit', () => ({ releaseRateLimit: vi.fn() }))
vi.mock('server/ai', () => ({ streamChatCompletion: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

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

describe('buildPromptContext', () => {
  it('searches with the previous user question prepended to a follow-up', async () => {
    vi.mocked(getRecentHistory).mockResolvedValue({
      conversationId: 'conv-1',
      history: [
        { role: 'user', content: 'Czym są zdolności wrodzone?' },
        { role: 'assistant', content: 'To moce, z którymi rodzi się czarownik.' },
      ],
    })

    await buildPromptContext('user-1', 'a skąd je wziąć?', 'session-1')

    expect(searchChunks).toHaveBeenCalledWith(
      'Czym są zdolności wrodzone? a skąd je wziąć?',
      expect.objectContaining({ app: 'tutorials' }),
    )
  })

  it('trims long assistant answers in history and keeps user messages intact', async () => {
    const longQuestion = 'p'.repeat(600)
    vi.mocked(getRecentHistory).mockResolvedValue({
      conversationId: 'conv-1',
      history: [
        { role: 'user', content: longQuestion },
        { role: 'assistant', content: 'a'.repeat(1000) },
      ],
    })

    const { history } = await buildPromptContext('user-1', 'Dalej?', 'session-1')

    expect(history).toEqual([
      { role: 'user', content: longQuestion },
      { role: 'assistant', content: `${'a'.repeat(400)}…` },
    ])
  })

  it('searches with the current message alone when there is no history', async () => {
    vi.mocked(getRecentHistory).mockResolvedValue({ conversationId: undefined, history: [] })

    await buildPromptContext('user-1', 'Jak zdobyć PD?', 'session-1')

    expect(searchChunks).toHaveBeenCalledWith(
      'Jak zdobyć PD?',
      expect.objectContaining({ app: 'tutorials' }),
    )
  })
})

describe('createChatStream', () => {
  const chunk = (content: string, finishReason: ChatCompletionChunk.Choice['finish_reason']) =>
    ({
      choices: [{ delta: { content }, index: 0, finish_reason: finishReason }],
    }) as ChatCompletionChunk

  const run = async (chunks: ChatCompletionChunk[]) => {
    vi.mocked(streamChatCompletion).mockReturnValue(
      (async function* () {
        yield* chunks
      })(),
    )
    const stream = createChatStream({
      searchQuery: 'Pytanie',
      systemPrompt: 'system',
      history: [],
      conversationId: undefined,
      sessionId: 'session-1',
      userId: 'user-1',
      ip: '127.0.0.1',
      requestDate: new Date('2026-10-03'),
      requestsUsed: 1,
    })
    return new Response(stream).text()
  }

  it('appends a truncation note when the model hits the output limit', async () => {
    const output = await run([chunk('| a | b |', null), chunk('', 'length')])

    expect(output).toContain(JSON.stringify(TRUNCATION_NOTE))
    expect(saveExchange).toHaveBeenCalledWith(
      expect.objectContaining({ answer: `| a | b |${TRUNCATION_NOTE}` }),
    )
  })

  it('saves the answer unchanged when the model finishes normally', async () => {
    await run([chunk('Odpowiedź.', null), chunk('', 'stop')])

    expect(saveExchange).toHaveBeenCalledWith(expect.objectContaining({ answer: 'Odpowiedź.' }))
  })
})
