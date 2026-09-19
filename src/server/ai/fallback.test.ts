import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import { describe, expect, it, vi } from 'vitest'

import { type ChatProvider, streamWithFallback } from './fallback'

const chunk = (content: string): ChatCompletionChunk =>
  ({ choices: [{ delta: { content }, index: 0, finish_reason: null }] }) as ChatCompletionChunk

const asyncIterable = (chunks: ChatCompletionChunk[]) => ({
  [Symbol.asyncIterator]: async function* () {
    for (const c of chunks) yield c
  },
})

const provider = (name: string, create: ReturnType<typeof vi.fn>): ChatProvider =>
  ({ client: { chat: { completions: { create } } }, model: 'test-model', name }) as unknown as ChatProvider

const drain = async (gen: AsyncGenerator<ChatCompletionChunk>) => {
  const out: ChatCompletionChunk[] = []
  for await (const c of gen) out.push(c)
  return out
}

describe('streamWithFallback', () => {
  it('streams from primary when it succeeds', async () => {
    const primaryCreate = vi.fn().mockResolvedValue(asyncIterable([chunk('hi')]))
    const secondaryCreate = vi.fn()

    const result = await drain(
      streamWithFallback(provider('LLM_AI', primaryCreate), provider('OVH_AI', secondaryCreate), []),
    )

    expect(result).toHaveLength(1)
    expect(secondaryCreate).not.toHaveBeenCalled()
  })

  it('falls back to secondary when primary fails before any token', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const primaryCreate = vi.fn().mockRejectedValue(new Error('boom'))
    const secondaryCreate = vi.fn().mockResolvedValue(asyncIterable([chunk('fallback')]))

    const result = await drain(
      streamWithFallback(provider('LLM_AI', primaryCreate), provider('OVH_AI', secondaryCreate), []),
    )

    expect(result).toHaveLength(1)
    expect(secondaryCreate).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })

  it('logs the full nested cause chain, not just the generic wrapper message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dnsError = new Error('getaddrinfo ENOTFOUND host')
    const fetchFailed = new Error('fetch failed', { cause: dnsError })
    const connectionError = new Error('Connection error.', { cause: fetchFailed })
    const primaryCreate = vi.fn().mockRejectedValue(connectionError)
    const secondaryCreate = vi.fn().mockResolvedValue(asyncIterable([chunk('fallback')]))

    await drain(streamWithFallback(provider('LLM_AI', primaryCreate), provider('OVH_AI', secondaryCreate), []))

    const logged = errorSpy.mock.calls[0]?.[0] as string
    expect(logged).toContain('Connection error.')
    expect(logged).toContain('fetch failed')
    expect(logged).toContain('getaddrinfo ENOTFOUND host')
    errorSpy.mockRestore()
  })

  it('propagates a mid-stream error without falling back', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const primaryCreate = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield chunk('partial')
        throw new Error('dropped')
      },
    })
    const secondaryCreate = vi.fn()

    await expect(
      drain(streamWithFallback(provider('LLM_AI', primaryCreate), provider('OVH_AI', secondaryCreate), [])),
    ).rejects.toThrow('dropped')

    expect(secondaryCreate).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('calls secondary directly when primary is undefined', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const secondaryCreate = vi.fn().mockResolvedValue(asyncIterable([chunk('only')]))

    const result = await drain(streamWithFallback(undefined, provider('OVH_AI', secondaryCreate), []))

    expect(result).toHaveLength(1)
    expect(secondaryCreate).toHaveBeenCalledOnce()
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
