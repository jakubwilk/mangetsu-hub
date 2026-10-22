import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import { streamChatCompletion } from 'server/ai'
import { saveExchange } from 'server/conversations'
import { releaseRateLimit } from 'server/rateLimit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createChatStream, THINKING_LIMIT_MESSAGE, TRUNCATION_NOTE } from './stream'

vi.mock('server/conversations', () => ({ saveExchange: vi.fn() }))
vi.mock('server/rateLimit', () => ({ releaseRateLimit: vi.fn() }))
vi.mock('server/ai', () => ({ streamChatCompletion: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createChatStream', () => {
  const chunk = (
    content: string,
    finishReason: ChatCompletionChunk.Choice['finish_reason'],
    model?: string,
  ) =>
    ({
      model,
      choices: [{ delta: { content }, index: 0, finish_reason: finishReason }],
    }) as ChatCompletionChunk

  const streamParams = {
    app: 'tutorials' as const,
    searchQuery: 'Pytanie',
    systemPrompt: 'system',
    userMessage: 'fragmenty + Pytanie',
    history: [],
    conversationId: undefined,
    sessionId: 'session-1',
    userId: 'user-1',
    ip: '127.0.0.1',
    requestDate: new Date('2026-10-03'),
    requestsUsed: 1,
  }

  const run = async (chunks: ChatCompletionChunk[]) => {
    vi.mocked(streamChatCompletion).mockReturnValue(
      (async function* () {
        yield* chunks
      })(),
    )
    const stream = createChatStream(streamParams)
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

    expect(saveExchange).toHaveBeenCalledWith(
      expect.objectContaining({ app: 'tutorials', answer: 'Odpowiedź.' }),
    )
  })

  it('sends the fragments with the question to the model but saves only the raw question', async () => {
    await run([chunk('Odpowiedź.', 'stop')])

    expect(vi.mocked(streamChatCompletion).mock.calls[0][0].at(-1)).toEqual({
      role: 'user',
      content: 'fragmenty + Pytanie',
    })
    expect(saveExchange).toHaveBeenCalledWith(expect.objectContaining({ question: 'Pytanie' }))
  })

  it('streams thinking separately and saves only the answer text', async () => {
    const reasoning = (
      parts: unknown[],
      finishReason: ChatCompletionChunk.Choice['finish_reason'],
    ) =>
      ({
        choices: [{ delta: { content: parts }, index: 0, finish_reason: finishReason }],
      }) as unknown as ChatCompletionChunk
    const thought = (text: string) => ({ type: 'thinking', thinking: [{ type: 'text', text }] })

    const output = await run([
      reasoning([thought('Gracz pyta.')], null),
      reasoning([thought(' Odpowiem.'), { type: 'text', text: 'Na' }], null),
      chunk(' podstawie.', 'stop'),
    ])

    expect(output).toContain(JSON.stringify({ type: 'thinking', content: 'Gracz pyta.' }))
    expect(output).toContain(JSON.stringify({ type: 'token', content: 'Na' }))
    expect(saveExchange).toHaveBeenCalledWith(expect.objectContaining({ answer: 'Na podstawie.' }))
  })

  it('aborts a model that keeps thinking without answering', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const thought = {
      choices: [
        {
          delta: {
            content: [
              { type: 'thinking', thinking: [{ type: 'text', text: 'z/t? '.repeat(1000) }] },
            ],
          },
          index: 0,
          finish_reason: null,
        },
      ],
    } as unknown as ChatCompletionChunk

    const output = await run([thought, thought, thought, chunk('Odpowiedź.', 'stop')])

    const signal = vi.mocked(streamChatCompletion).mock.calls[0][1]
    expect(signal?.aborted).toBe(true)
    expect(output).toContain(JSON.stringify({ type: 'error', message: THINKING_LIMIT_MESSAGE }))
    expect(output).not.toContain('Odpowiedź.')
    expect(saveExchange).not.toHaveBeenCalled()
    expect(releaseRateLimit).toHaveBeenCalledWith('user-1', 'tutorials', streamParams.requestDate)
    errorSpy.mockRestore()
  })

  it('aborts the model call when the client disconnects', async () => {
    vi.mocked(streamChatCompletion).mockReturnValue(
      (async function* () {
        yield chunk('Odp', null)
        yield chunk('owiedź.', 'stop')
      })(),
    )
    const stream = createChatStream(streamParams)

    await stream.cancel()

    expect(vi.mocked(streamChatCompletion).mock.calls[0][1]?.aborted).toBe(true)
  })

  it('saves the model reported by the provider', async () => {
    await run([chunk('Odpowiedź.', null, 'model-a'), chunk('', 'stop', 'model-a')])

    expect(saveExchange).toHaveBeenCalledWith(expect.objectContaining({ model: 'model-a' }))
  })

  it('saves the fallback model when the primary failed after an empty chunk', async () => {
    await run([chunk('', null, 'primary'), chunk('Odpowiedź.', 'stop', 'fallback')])

    expect(saveExchange).toHaveBeenCalledWith(expect.objectContaining({ model: 'fallback' }))
  })
})
