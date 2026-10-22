import type { AppId, AppRole } from 'apps'
import type { SearchResult } from 'server/rag'

// Everything app-specific about a RAG chat; the engine owns auth, limits, history and streaming.
export interface RagChatConfig<A extends AppId = AppId> {
  app: A
  roles: readonly AppRole<A>[]
  buildSystemPrompt: (query: string) => string
  // Fragments travel with the question, not in the system prompt before the history.
  buildUserMessage: (chunks: SearchResult[], question: string) => string
  expandQuery?: (query: string) => string
  // Extra queries whose top fragments are appended after the main results.
  extraSearches?: (query: string) => string[]
  // Falls back to DAILY_REQUEST_LIMIT.
  dailyLimit?: number
}
