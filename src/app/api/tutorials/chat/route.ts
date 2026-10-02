import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, verifyOrigin } from 'server/authorize'
import { classifyMessage, type MessageVerdict, POLISH_ONLY_MESSAGE } from 'server/guardrails'
import { getRequestDate, releaseRateLimit, reserveRateLimit } from 'server/rateLimit'
import {
  buildPromptContext,
  createChatStream,
  createFixedReplyStream,
  parseChatRequest,
  requireTutorialsUser,
  TUTORIALS_APP,
} from 'server/tutorials'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}

export const POST = async (request: NextRequest) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireTutorialsUser()
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
  const reservation = await reserveRateLimit(userId, TUTORIALS_APP, requestDate)
  if (reservation instanceof NextResponse) return reservation

  // The guardrail runs alongside RAG context building so its latency hides behind search.
  let verdict: MessageVerdict
  let context: Awaited<ReturnType<typeof buildPromptContext>>
  try {
    ;[verdict, context] = await Promise.all([
      classifyMessage(searchQuery),
      buildPromptContext(userId, searchQuery, sessionId),
    ])
  } catch {
    await releaseRateLimit(userId, TUTORIALS_APP, requestDate)
    return NextResponse.json({ error: 'Usługa chwilowo niedostępna.' }, { status: 503 })
  }

  if (verdict === 'injection') {
    await releaseRateLimit(userId, TUTORIALS_APP, requestDate)
    return NextResponse.json({ error: 'Nieprawidłowe zapytanie.' }, { status: 400 })
  }

  // Answered with a fixed reply instead of the model; not counted against the limit nor saved.
  if (verdict === 'language') {
    await releaseRateLimit(userId, TUTORIALS_APP, requestDate)
    const stream = createFixedReplyStream(POLISH_ONLY_MESSAGE, reservation.count - 1)
    return new Response(stream, { headers: SSE_HEADERS })
  }

  const stream = createChatStream({
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
