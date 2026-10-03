import { NextResponse } from 'next/server'
import { streamChatCompletion } from 'server/ai'
import { type ChatMessage, getRecentHistory, saveExchange } from 'server/conversations'
import { searchChunks } from 'server/rag'
import { releaseRateLimit } from 'server/rateLimit'

import { TUTORIALS_APP } from './access'
import { buildSystemPrompt, buildUserMessage } from './prompts'
import { expandWithSynonyms } from './synonyms'

const STAT_ADVANCEMENT_PATTERN =
  /zwi[eę]kszy[ćc]|ulepsz|awanso|wykupi[ćc]|rozwin|podbij|podnie[sś][ćc]|rang[aąię]|poziom|statystyk[aąię]/i

const MAX_MESSAGE_LENGTH = 1000

// Leading blank lines close a markdown table the model may have been cut off in the middle of.
export const TRUNCATION_NOTE = '\n\n_Odpowiedź została ucięta — dopytaj o konkretną część._'

// Long past answers pull the model into continuing them and re-asserting their mistakes as facts.
const HISTORY_ANSWER_CHARS = 400

const trimAnswer = (m: ChatMessage): ChatMessage =>
  m.role === 'assistant' && m.content.length > HISTORY_ANSWER_CHARS
    ? { ...m, content: `${m.content.slice(0, HISTORY_ANSWER_CHARS)}…` }
    : m

const enc = new TextEncoder()
const sseEvent = (data: object) => enc.encode(`data: ${JSON.stringify(data)}\n\n`)

const search = (query: string, options: { limit?: number; expand?: boolean } = {}) =>
  searchChunks(query, { app: TUTORIALS_APP, expandQuery: expandWithSynonyms, ...options })

// Supplementary context: only the matching fragments, never whole documents.
const SUPPLEMENTARY = { limit: 2, expand: false }

export const parseChatRequest = (
  body: Record<string, unknown>,
): { message: string; sessionId: string } | NextResponse => {
  const { message, sessionId } = body

  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: "Pole 'message' jest wymagane." }, { status: 400 })
  }
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return NextResponse.json({ error: "Pole 'sessionId' jest wymagane." }, { status: 400 })
  }

  return { message: message.trim().slice(0, MAX_MESSAGE_LENGTH), sessionId }
}

export const buildPromptContext = async (
  userId: string,
  searchQuery: string,
  sessionId: string,
) => {
  const needsCostContext = STAT_ADVANCEMENT_PATTERN.test(searchQuery)

  const { conversationId, history: fullHistory } = await getRecentHistory(
    userId,
    TUTORIALS_APP,
    sessionId,
  )
  const history = fullHistory.map(trimAnswer)

  // Follow-ups ("a skąd je wziąć?") carry no topic of their own, so the previous question gets a
  // separate, smaller search — appended after the current results so it can't take over the context.
  const previousQuestion = history.findLast((m) => m.role === 'user')?.content

  const [chunks, previousChunks, costChunks] = await Promise.all([
    search(searchQuery),
    previousQuestion ? search(previousQuestion, SUPPLEMENTARY) : Promise.resolve([]),
    needsCostContext
      ? search('koszt PD sklep wykupienie statystyki', SUPPLEMENTARY)
      : Promise.resolve([]),
  ])

  const merged = [
    ...new Map([...chunks, ...previousChunks, ...costChunks].map((c) => [c.id, c])).values(),
  ]

  return {
    systemPrompt: buildSystemPrompt(needsCostContext),
    userMessage: buildUserMessage(merged, searchQuery),
    history,
    conversationId,
  }
}

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
  const { searchQuery, systemPrompt, userMessage, history, userId, requestDate, requestsUsed } =
    params

  return new ReadableStream({
    async start(controller) {
      try {
        const completion = streamChatCompletion([
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage },
        ])

        let fullContent = ''
        let tokensUsed = 0

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content ?? ''
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
          app: TUTORIALS_APP,
          sessionId: params.sessionId,
          ip: params.ip,
          question: searchQuery,
          answer: fullContent,
          tokensUsed,
        })

        controller.enqueue(sseEvent({ type: 'done', requestsUsed }))
      } catch (err) {
        await releaseRateLimit(userId, TUTORIALS_APP, requestDate)
        const detail = err instanceof Error ? err.message : 'Nieznany błąd'
        controller.enqueue(
          sseEvent({ type: 'error', message: `Błąd połączenia z modelem AI: ${detail}` }),
        )
      } finally {
        controller.close()
      }
    },
  })
}
