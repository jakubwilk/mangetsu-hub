import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChatStreamEvent } from '../types'
import { sendMessage } from './sendMessage'

const sse = (events: ChatStreamEvent[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''))

const drain = async () => {
  const out: ChatStreamEvent[] = []
  for await (const e of sendMessage('tutorials', 'Pytanie', 'session-1')) out.push(e)
  return out
}

describe('sendMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('yields every event of a stream that ends with done', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse([
          { type: 'token', content: 'Odp' },
          { type: 'done', requestsUsed: 1 },
        ]),
      ),
    )

    await expect(drain()).resolves.toEqual([
      { type: 'token', content: 'Odp' },
      { type: 'done', requestsUsed: 1 },
    ])
  })

  it('throws when the stream closes without a final event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse([{ type: 'thinking', content: 'hmm' }])))

    await expect(drain()).rejects.toThrow()
  })
})
