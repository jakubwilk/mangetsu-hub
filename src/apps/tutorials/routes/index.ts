import { createRagChatRoutes } from 'server/chat'

import { tutorialsChat } from '../server'

export const { chatPost, sessionsGet, sessionsDelete, rateLimitGet } =
  createRagChatRoutes(tutorialsChat)

export { sourcesPost } from './sources'
