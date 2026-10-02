import { beforeEach, describe, expect, it } from 'vitest'

import type { ChatSession } from '../types'
import { chatStore, ensureActiveSession } from './chatStore'

const session = (id: string, messageCount = 1): ChatSession => ({
  id,
  createdAt: 0,
  messages: Array.from({ length: messageCount }, (_, i) => ({
    id: `${id}-m${i}`,
    role: 'user' as const,
    content: `pytanie ${i}`,
  })),
})

const storage = new Map<string, string>()
globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
} as Storage

const seed = (sessions: ChatSession[], activeId: string) => {
  storage.clear()
  storage.set('mangetsu:tutorials:chat-sessions', JSON.stringify(sessions))
  storage.set('mangetsu:tutorials:active-session', activeId)
  chatStore.init()
}

describe('ensureActiveSession', () => {
  it('keeps a valid active session', () => {
    const sessions = [session('a'), session('b')]
    expect(ensureActiveSession(sessions, 'b').activeSessionId).toBe('b')
  })

  it('falls back to the first session when the active one is gone', () => {
    expect(ensureActiveSession([session('a')], 'gone').activeSessionId).toBe('a')
  })

  it('creates a fresh empty session when none is left', () => {
    const result = ensureActiveSession([], 'gone')
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]!.messages).toEqual([])
    expect(result.activeSessionId).toBe(result.sessions[0]!.id)
  })
})

describe('chatStore', () => {
  beforeEach(() => storage.clear())

  it('drops legacy pre-hub keys on init', () => {
    storage.set('mangetsu:chat-sessions', '[]')
    chatStore.init()
    expect(storage.has('mangetsu:chat-sessions')).toBe(false)
  })

  it('prunes sessions unknown to the server but keeps empty ones', () => {
    seed([session('known'), session('unknown'), session('empty', 0)], 'known')

    chatStore.pruneSessions(['known'])

    expect(chatStore.getSnapshot().sessions.map((s) => s.id)).toEqual(['known', 'empty'])
  })

  it('moves the active session when the active one is deleted', () => {
    seed([session('a'), session('b')], 'a')

    chatStore.deleteSession('a')

    expect(chatStore.getSnapshot().activeSessionId).toBe('b')
  })

  it('removes a message from the active session', () => {
    seed([session('a', 2)], 'a')

    chatStore.removeMessage('a-m1')

    expect(chatStore.getSnapshot().sessions[0]!.messages.map((m) => m.id)).toEqual(['a-m0'])
  })
})
