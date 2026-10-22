import type { AppId } from 'apps'
import { streamChatCompletion } from 'server/ai'
import { splitDelta } from 'server/ai/content'
import { type ChatMessage, saveExchange } from 'server/conversations'
import { releaseRateLimit } from 'server/rateLimit'

// Leading blank lines close a markdown table the model may have been cut off in the middle of.
export const TRUNCATION_NOTE = '\n\n_Odpowiedź została ucięta — dopytaj o konkretną część._'

// A reasoning model can loop in its thinking until max_tokens — cut it off well before that.
const MAX_THINKING_CHARS = 12_000

export const THINKING_LIMIT_MESSAGE =
  'Model nie poradził sobie z tym pytaniem — spróbuj sformułować je inaczej.'

class ThinkingLimitError extends Error {}

const enc = new TextEncoder()
const sseEvent = (data: object) => enc.encode(`data: ${JSON.stringify(data)}\n\n`)

// Canned reply in the same SSE shape as a model answer, so the client renders it as a normal bubble.
export const createFixedReplyStream = (content: string, requestsUsed: number): ReadableStream =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(sseEvent({ type: 'token', content }))
      controller.enqueue(sseEvent({ type: 'done', requestsUsed }))
      controller.close()
    },
  })

export const createChatStream = (params: {
  app: AppId
  searchQuery: string
  systemPrompt: string
  userMessage: string
  history: ChatMessage[]
  conversationId: string | undefined
  sessionId: string
  userId: string
  ip: string
  requestDate: Date
  requestsUsed: number
}): ReadableStream => {
  const {
    app,
    searchQuery,
    systemPrompt,
    userMessage,
    history,
    userId,
    requestDate,
    requestsUsed,
  } = params

  // Stops the paid LLM call when the client disconnects or the thinking runs away.
  const abort = new AbortController()
  let cancelled = false

  return new ReadableStream({
    async start(controller) {
      try {
        const completion = streamChatCompletion(
          [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userMessage },
          ],
          abort.signal,
        )

        let fullContent = ''
        let thinkingChars = 0
        let tokensUsed = 0
        let model: string | undefined

        for await (const chunk of completion) {
          // Last one wins: a primary that dies before its first token is followed by fallback chunks.
          if (chunk.model) model = chunk.model
          // Thinking is shown live but never saved or sent back to the model as history.
          const { text: content, thinking } = splitDelta(chunk.choices[0]?.delta?.content)
          if (thinking) {
            thinkingChars += thinking.length
            if (!fullContent && thinkingChars > MAX_THINKING_CHARS) {
              abort.abort()
              console.error(
                `[chat] ${model ?? 'model'} thought for over ${MAX_THINKING_CHARS} chars without answering, aborted`,
              )
              throw new ThinkingLimitError(THINKING_LIMIT_MESSAGE)
            }
            controller.enqueue(sseEvent({ type: 'thinking', content: thinking }))
          }
          if (content) {
            fullContent += content
            controller.enqueue(sseEvent({ type: 'token', content }))
          }
          if (chunk.usage) {
            tokensUsed = chunk.usage.total_tokens
          }
          if (chunk.choices[0]?.finish_reason === 'length') {
            fullContent += TRUNCATION_NOTE
            controller.enqueue(sseEvent({ type: 'token', content: TRUNCATION_NOTE }))
          }
        }

        await saveExchange({
          conversationId: params.conversationId,
          userId,
          app,
          sessionId: params.sessionId,
          ip: params.ip,
          question: searchQuery,
          answer: fullContent,
          tokensUsed,
          model,
        })

        controller.enqueue(sseEvent({ type: 'done', requestsUsed }))
      } catch (err) {
        await releaseRateLimit(userId, app, requestDate)
        // The client is gone and the stream already closed — there's no one left to tell.
        if (cancelled) return
        const detail = err instanceof Error ? err.message : 'Nieznany błąd'
        const message =
          err instanceof ThinkingLimitError ? detail : `Błąd połączenia z modelem AI: ${detail}`
        controller.enqueue(sseEvent({ type: 'error', message }))
      } finally {
        if (!cancelled) controller.close()
      }
    },
    cancel() {
      cancelled = true
      abort.abort()
    },
  })
}
