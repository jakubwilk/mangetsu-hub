import { errorFromResponse } from 'common/api'

import type { ChatStreamEvent } from '../types'

export async function* sendMessage(
  message: string,
  sessionId: string,
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch('/api/tutorials/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })

  if (!response.ok || !response.body) {
    throw await errorFromResponse(response, 'Błąd serwera. Spróbuj ponownie.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.startsWith('data: ')) continue
      let event: ChatStreamEvent
      try {
        event = JSON.parse(part.slice(6)) as ChatStreamEvent
      } catch {
        continue
      }
      if (event.type === 'done' || event.type === 'error') finished = true
      yield event
    }
  }

  // A connection cut mid-answer closes the body cleanly too — the server never saved that answer.
  if (!finished) throw new Error('Stream ended without a final event')
}
