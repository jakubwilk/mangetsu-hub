import { NextResponse } from 'next/server'
import { type ChatMessage, getRecentHistory } from 'server/conversations'
import { searchChunks } from 'server/rag'

import type { RagChatConfig } from './types'

const MAX_MESSAGE_LENGTH = 1000

// Long past answers pull the model into continuing them and re-asserting their mistakes as facts.
const HISTORY_ANSWER_CHARS = 400

const trimAnswer = (m: ChatMessage): ChatMessage =>
  m.role === 'assistant' && m.content.length > HISTORY_ANSWER_CHARS
    ? { ...m, content: `${m.content.slice(0, HISTORY_ANSWER_CHARS)}…` }
    : m

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

// Follow-ups ("a skąd je wziąć?") carry no topic of their own, so the previous question gets a
// separate, smaller search — appended after the current results so it can't take over the context.
export const retrieveChunks = async (
  config: RagChatConfig,
  searchQuery: string,
  previousQuestion?: string,
) => {
  const search = (query: string, options: { limit?: number; expand?: boolean } = {}) =>
    searchChunks(query, { app: config.app, expandQuery: config.expandQuery, ...options })

  const results = await Promise.all([
    search(searchQuery),
    previousQuestion ? search(previousQuestion, SUPPLEMENTARY) : Promise.resolve([]),
    ...(config.extraSearches?.(searchQuery) ?? []).map((query) => search(query, SUPPLEMENTARY)),
  ])

  return [...new Map(results.flat().map((c) => [c.id, c])).values()]
}

export const buildPromptContext = async (
  config: RagChatConfig,
  userId: string,
  searchQuery: string,
  sessionId: string,
) => {
  const { conversationId, history: fullHistory } = await getRecentHistory(
    userId,
    config.app,
    sessionId,
  )
  const history = fullHistory.map(trimAnswer)

  const previousQuestion = history.findLast((m) => m.role === 'user')?.content
  const chunks = await retrieveChunks(config, searchQuery, previousQuestion)

  return {
    systemPrompt: config.buildSystemPrompt(searchQuery),
    userMessage: config.buildUserMessage(chunks, searchQuery),
    history,
    conversationId,
  }
}
