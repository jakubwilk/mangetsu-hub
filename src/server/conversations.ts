import type { AppId } from 'common/apps'
import { db } from 'server/db'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

const HISTORY_SIZE = 6

// Every query is scoped by owner + app: a sessionId alone (generated client-side) never grants
// access to a conversation.
const ownedBy = (userId: string, app: AppId) => ({ userId, app })

export const listSessionIds = async (userId: string, app: AppId): Promise<string[]> => {
  const conversations = await db.conversation.findMany({
    where: ownedBy(userId, app),
    select: { sessionId: true },
    distinct: ['sessionId'],
  })
  return conversations.map((c) => c.sessionId)
}

export const deleteSession = async (userId: string, app: AppId, sessionId: string) => {
  // Cascades to `messages`. Never touches `rate_limits` — the daily limit is a separate counter.
  await db.conversation.deleteMany({ where: { ...ownedBy(userId, app), sessionId } })
}

export const getRecentHistory = async (userId: string, app: AppId, sessionId: string) => {
  const conversation = await db.conversation.findFirst({
    where: { ...ownedBy(userId, app), sessionId },
    orderBy: { createdAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: HISTORY_SIZE } },
  })

  const history: ChatMessage[] = (conversation?.messages ?? [])
    .reverse()
    .map((m) => ({ role: m.role as ChatMessage['role'], content: m.content }))

  return { conversationId: conversation?.id, history }
}

export const saveExchange = async (params: {
  conversationId: string | undefined
  userId: string
  app: AppId
  sessionId: string
  ip: string
  question: string
  answer: string
  tokensUsed: number
}) => {
  const { userId, app, sessionId, ip, question, answer, tokensUsed } = params

  const conversationId =
    params.conversationId ??
    (await db.conversation.create({ data: { userId, app, sessionId, ip } })).id

  await db.message.createMany({
    data: [
      { conversationId, role: 'user', content: question, tokensUsed: 0 },
      { conversationId, role: 'assistant', content: answer, tokensUsed },
    ],
  })
}
