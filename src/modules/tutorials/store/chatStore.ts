import type { ChatSession, Message } from '../types'

const SESSIONS_KEY = 'mangetsu:tutorials:chat-sessions'
const ACTIVE_KEY = 'mangetsu:tutorials:active-session'
// Pre-hub keys — their sessions have no owner in the DB anymore, so they'd be pruned anyway.
const LEGACY_KEYS = ['mangetsu:chat-sessions', 'mangetsu:active-session', 'mangetsu:requests-today']

// Fallback until fetchRateLimit() resolves — matches the server's default DAILY_REQUEST_LIMIT.
const DEFAULT_REQUEST_LIMIT = 20

interface StoreSnapshot {
  sessions: ChatSession[]
  activeSessionId: string
  requestsUsed: number
  requestLimit: number
}

const SERVER_SNAPSHOT: StoreSnapshot = {
  sessions: [],
  activeSessionId: '',
  requestsUsed: 0,
  requestLimit: DEFAULT_REQUEST_LIMIT,
}

let snapshot: StoreSnapshot = SERVER_SNAPSHOT

const listeners = new Set<() => void>()

const createSession = (): ChatSession => ({
  id: crypto.randomUUID(),
  messages: [],
  createdAt: Date.now(),
})

const loadSessions = (): Pick<StoreSnapshot, 'sessions' | 'activeSessionId'> => {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
    return {
      sessions: JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]') as ChatSession[],
      activeSessionId: localStorage.getItem(ACTIVE_KEY) ?? '',
    }
  } catch {
    return { sessions: [], activeSessionId: '' }
  }
}

// Keeps the active session pointing at an existing session, creating a fresh one if none is left.
export const ensureActiveSession = (
  sessions: ChatSession[],
  activeSessionId: string,
): Pick<StoreSnapshot, 'sessions' | 'activeSessionId'> => {
  if (sessions.some((s) => s.id === activeSessionId)) return { sessions, activeSessionId }

  const [first] = sessions
  if (first) return { sessions, activeSessionId: first.id }

  const session = createSession()
  return { sessions: [session], activeSessionId: session.id }
}

const commit = (next: Partial<StoreSnapshot>, { persist = true } = {}) => {
  snapshot = { ...snapshot, ...next }
  if (persist) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(snapshot.sessions))
    localStorage.setItem(ACTIVE_KEY, snapshot.activeSessionId)
  }
  listeners.forEach((l) => l())
}

const updateActiveMessages = (update: (messages: Message[]) => Message[]) =>
  snapshot.sessions.map((s) =>
    s.id === snapshot.activeSessionId ? { ...s, messages: update(s.messages) } : s,
  )

export const chatStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },

  getSnapshot: () => snapshot,

  getServerSnapshot: () => SERVER_SNAPSHOT,

  init: () => {
    const { sessions, activeSessionId } = loadSessions()
    commit(ensureActiveSession(sessions, activeSessionId))
  },

  newSession: () => {
    const session = createSession()
    commit({ sessions: [session, ...snapshot.sessions], activeSessionId: session.id })
  },

  switchSession: (id: string) => {
    if (!snapshot.sessions.some((s) => s.id === id)) return
    commit({ activeSessionId: id })
  },

  addMessage: (message: Message) => {
    commit({ sessions: updateActiveMessages((messages) => [...messages, message]) })
  },

  // Streaming deltas skip localStorage; persistCurrentState() writes once the stream ends.
  appendToMessage: (id: string, delta: string) => {
    commit(
      {
        sessions: updateActiveMessages((messages) =>
          messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
        ),
      },
      { persist: false },
    )
  },

  removeMessage: (id: string) => {
    commit({ sessions: updateActiveMessages((messages) => messages.filter((m) => m.id !== id)) })
  },

  persistCurrentState: () => commit({}),

  setRequestsUsed: (requestsUsed: number) => commit({ requestsUsed }, { persist: false }),

  setRequestLimit: (requestLimit: number) => commit({ requestLimit }, { persist: false }),

  deleteSession: (id: string) => {
    const sessions = snapshot.sessions.filter((s) => s.id !== id)
    commit(ensureActiveSession(sessions, snapshot.activeSessionId))
  },

  // Drops local sessions the server doesn't know (deleted elsewhere, or from another account).
  // Empty sessions are kept — they were never sent, so the server can't know them.
  pruneSessions: (serverSessionIds: string[]) => {
    const known = new Set(serverSessionIds)
    const sessions = snapshot.sessions.filter((s) => s.messages.length === 0 || known.has(s.id))
    commit(ensureActiveSession(sessions, snapshot.activeSessionId))
  },
}
