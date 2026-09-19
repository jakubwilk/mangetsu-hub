import type OpenAI from 'openai'
import type { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export type ChatProvider = { client: OpenAI; model: string; name: string }

// The openai SDK wraps network failures in a generic APIConnectionError whose `message` is
// always "Connection error." — the real cause (DNS, TLS, timeout, ...) is nested in `cause`,
// sometimes several levels deep (undici's "fetch failed" wraps the actual socket error, which
// can itself be an AggregateError with multiple candidate failures) — walk the whole chain.
const describeError = (err: unknown): string => {
  const parts: string[] = []
  const seen = new Set<unknown>()
  let current: unknown = err
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current)
    parts.push(current.message)
    if (current instanceof AggregateError) {
      parts.push(...current.errors.map((e) => (e instanceof Error ? e.message : String(e))))
    }
    current = current.cause
  }
  return parts.length ? parts.join(' -> ') : String(err)
}

const CHAT_COMPLETION_OPTIONS = {
  temperature: 0.7,
  max_tokens: 1024,
  stream: true as const,
  stream_options: { include_usage: true },
}

// Falls back from `primary` to `secondary` only if `primary` fails before it has streamed
// any real token — once content has reached the caller, switching providers mid-stream
// would produce a garbled response, so a later failure just propagates instead.
export async function* streamWithFallback(
  primary: ChatProvider | undefined,
  secondary: ChatProvider,
  messages: ChatCompletionMessageParam[],
): AsyncGenerator<ChatCompletionChunk> {
  if (primary) {
    let tokenSent = false
    try {
      const stream = await primary.client.chat.completions.create({
        model: primary.model,
        messages,
        ...CHAT_COMPLETION_OPTIONS,
      })
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) tokenSent = true
        yield chunk
      }
      return
    } catch (err) {
      if (tokenSent) throw err
      console.error(
        `[chat] ${primary.name} failed before streaming any tokens, falling back to ${secondary.name}: ${describeError(err)}`,
      )
    }
  }

  const stream = await secondary.client.chat.completions.create({
    model: secondary.model,
    messages,
    ...CHAT_COMPLETION_OPTIONS,
  })
  for await (const chunk of stream) {
    yield chunk
  }
}
