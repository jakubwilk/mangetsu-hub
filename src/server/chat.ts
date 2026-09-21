import { NextResponse } from 'next/server'
import { searchChunks } from 'search'
import { db } from 'server/db'
import { buildSystemPrompt } from 'server/prompts'

import { streamChatCompletion } from './ai'

export const DAILY_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT ?? '20', 10)

const STAT_ADVANCEMENT_PATTERN =
  /zwi[eę]kszy[ćc]|ulepsz|awanso|wykupi[ćc]|rozwin|podbij|podnie[sś][ćc]|rang[aąię]|poziom|statystyk[aąię]/i

const MAX_MESSAGE_LENGTH = 1000

const enc = new TextEncoder()
const sseEvent = (data: object) => enc.encode(`data: ${JSON.stringify(data)}\n\n`)

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export function parseChatRequest(
  body: Record<string, unknown>,
): { message: string; sessionId: string } | NextResponse {
  const { message, sessionId } = body

  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: "Pole 'message' jest wymagane." }, { status: 400 })
  }
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return NextResponse.json({ error: "Pole 'sessionId' jest wymagane." }, { status: 400 })
  }

  return { message: message.trim().slice(0, MAX_MESSAGE_LENGTH), sessionId }
}

export function getRequestDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function releaseRateLimit(userId: string, requestDate: Date): Promise<void> {
  try {
    await db.rateLimit.update({
      where: { userId_requestDate: { userId, requestDate } },
      data: { count: { decrement: 1 } },
    })
  } catch {
    // Best-effort compensation — a failure here just leaves the user one request short.
  }
}

// Atomically increments the counter (Postgres upsert serializes on the row), then checks
// the result. This closes the check-then-increment race that a plain read-then-write has:
// concurrent requests can no longer all pass the check before any of them increments.
export async function reserveRateLimit(
  userId: string,
  requestDate: Date,
): Promise<{ count: number } | NextResponse> {
  const rateLimit = await db.rateLimit.upsert({
    where: { userId_requestDate: { userId, requestDate } },
    create: { userId, requestDate, count: 1 },
    update: { count: { increment: 1 } },
  })

  if (rateLimit.count > DAILY_LIMIT) {
    await releaseRateLimit(userId, requestDate)
    return NextResponse.json(
      { error: 'Przekroczono dzienny limit zapytań. Spróbuj ponownie jutro.' },
      { status: 429 },
    )
  }

  return { count: rateLimit.count }
}

export async function buildPromptContext(searchQuery: string, sessionId: string) {
  const needsCostContext = STAT_ADVANCEMENT_PATTERN.test(searchQuery)

  const [chunks, costChunks, existingConversation] = await Promise.all([
    searchChunks(searchQuery),
    needsCostContext
      ? searchChunks('koszt PD sklep wykupienie statystyki', 2)
      : Promise.resolve([]),
    db.conversation.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      },
    }),
  ])

  const seen = new Set(chunks.map((c) => c.id))
  const merged = [...chunks, ...costChunks.filter((c) => !seen.has(c.id))]
  const systemPrompt = buildSystemPrompt(merged, needsCostContext)
  const history: ChatMessage[] = (existingConversation?.messages ?? [])
    .reverse()
    .map((m) => ({ role: m.role as ChatMessage['role'], content: m.content }))

  return { systemPrompt, history, existingConversationId: existingConversation?.id }
}

export function createChatStream(params: {
  searchQuery: string
  systemPrompt: string
  history: ChatMessage[]
  existingConversationId: string | undefined
  sessionId: string
  userId: string
  ip: string
  requestDate: Date
  requestsUsed: number
}): ReadableStream {
  const {
    searchQuery,
    systemPrompt,
    history,
    existingConversationId,
    sessionId,
    userId,
    ip,
    requestDate,
    requestsUsed,
  } = params

  return new ReadableStream({
    async start(controller) {
      try {
        const completion = streamChatCompletion([
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: searchQuery },
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
        }

        const conversationId =
          existingConversationId ?? (await db.conversation.create({ data: { sessionId, ip } })).id

        await db.message.createMany({
          data: [
            { conversationId, role: 'user', content: searchQuery, tokensUsed: 0 },
            { conversationId, role: 'assistant', content: fullContent, tokensUsed },
          ],
        })

        controller.enqueue(sseEvent({ type: 'done', requestsUsed }))
      } catch (err) {
        await releaseRateLimit(userId, requestDate)
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
