import { NextRequest, NextResponse } from 'next/server'
import { ModelConfigError } from 'server/ai/model'
import { readJsonBody, requireAppRole, verifyOrigin } from 'server/authorize'
import { deleteSession, listSessionIds } from 'server/conversations'
import { classifyMessage, type MessageVerdict, POLISH_ONLY_MESSAGE } from 'server/guardrails'
import {
  DAILY_LIMIT,
  getRequestDate,
  getRequestsUsed,
  releaseRateLimit,
  reserveRateLimit,
} from 'server/rateLimit'

import { buildPromptContext, parseChatRequest } from './context'
import { createChatStream, createFixedReplyStream } from './stream'
import type { RagChatConfig } from './types'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}

const unavailable = () =>
  NextResponse.json({ error: 'Usługa chwilowo niedostępna.' }, { status: 503 })

export const createRagChatRoutes = (config: RagChatConfig) => {
  const { app } = config
  const dailyLimit = config.dailyLimit ?? DAILY_LIMIT
  const requireUser = () => requireAppRole(app, config.roles)

  const chatPost = async (request: NextRequest) => {
    const originError = verifyOrigin(request)
    if (originError) return originError

    const authResult = await requireUser()
    if (authResult instanceof NextResponse) return authResult
    const userId = authResult.session.user.id

    const body = await readJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = parseChatRequest(body)
    if (parsed instanceof NextResponse) return parsed
    const { message: searchQuery, sessionId } = parsed

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const requestDate = getRequestDate()

    // Reserve before any paid call (guardrail LLM, embeddings) so over-limit requests cost nothing.
    const reservation = await reserveRateLimit(userId, app, requestDate, dailyLimit)
    if (reservation instanceof NextResponse) return reservation

    // The guardrail runs alongside RAG context building so its latency hides behind search.
    let verdict: MessageVerdict
    let context: Awaited<ReturnType<typeof buildPromptContext>>
    try {
      ;[verdict, context] = await Promise.all([
        classifyMessage(searchQuery),
        buildPromptContext(config, userId, searchQuery, sessionId),
      ])
    } catch (err) {
      await releaseRateLimit(userId, app, requestDate)
      const error = err instanceof ModelConfigError ? err.message : 'Usługa chwilowo niedostępna.'
      return NextResponse.json({ error }, { status: 503 })
    }

    if (verdict === 'injection') {
      await releaseRateLimit(userId, app, requestDate)
      return NextResponse.json({ error: 'Nieprawidłowe zapytanie.' }, { status: 400 })
    }

    // Answered with a fixed reply instead of the model; not counted against the limit nor saved.
    if (verdict === 'language') {
      await releaseRateLimit(userId, app, requestDate)
      const stream = createFixedReplyStream(POLISH_ONLY_MESSAGE, reservation.count - 1)
      return new Response(stream, { headers: SSE_HEADERS })
    }

    const stream = createChatStream({
      app,
      searchQuery,
      ...context,
      sessionId,
      userId,
      ip,
      requestDate,
      requestsUsed: reservation.count,
    })

    return new Response(stream, { headers: SSE_HEADERS })
  }

  const sessionsGet = async () => {
    const authResult = await requireUser()
    if (authResult instanceof NextResponse) return authResult

    try {
      const sessionIds = await listSessionIds(authResult.session.user.id, app)
      return NextResponse.json({ sessionIds })
    } catch {
      return unavailable()
    }
  }

  const sessionsDelete = async (request: NextRequest) => {
    const originError = verifyOrigin(request)
    if (originError) return originError

    const authResult = await requireUser()
    if (authResult instanceof NextResponse) return authResult

    const sessionId = request.nextUrl.searchParams.get('id')
    if (!sessionId) {
      return NextResponse.json({ error: "Parametr 'id' jest wymagany." }, { status: 400 })
    }

    try {
      await deleteSession(authResult.session.user.id, app, sessionId)
      return NextResponse.json({ success: true })
    } catch {
      return unavailable()
    }
  }

  const rateLimitGet = async () => {
    const authResult = await requireUser()
    if (authResult instanceof NextResponse) return authResult

    try {
      const requestsUsed = await getRequestsUsed(authResult.session.user.id, app, getRequestDate())
      return NextResponse.json({ requestsUsed, limit: dailyLimit })
    } catch {
      return unavailable()
    }
  }

  return { chatPost, sessionsGet, sessionsDelete, rateLimitGet }
}
