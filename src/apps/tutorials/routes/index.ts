import { createRagChatRoutes } from 'server/chat'

import { tutorialsChat } from '../server'

export const { chatPost, sessionsGet, sessionsDelete, rateLimitGet } =
  createRagChatRoutes(tutorialsChat)

export { documentDelete, documentGet, documentPatch } from './documents'
export { sourcesPost } from './sources'
