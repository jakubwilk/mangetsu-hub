import { NextResponse } from 'next/server'
import { getRecentHistory } from 'server/conversations'
import { searchChunks } from 'server/rag'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildPromptContext, parseChatRequest } from './context'
import type { RagChatConfig } from './types'

vi.mock('server/rag', () => ({ searchChunks: vi.fn().mockResolvedValue([]) }))
vi.mock('server/conversations', () => ({ getRecentHistory: vi.fn() }))

const config: RagChatConfig = {
  app: 'tutorials',
  roles: ['USER'],
  buildSystemPrompt: (query) => `system: ${query}`,
  buildUserMessage: (chunks, question) =>
    [...chunks.map((c) => `### ${c.documentTitle}`), question].join('\n'),
  expandQuery: (query) => query,
}

const result = (id: string) => ({
  id,
  content: `treść ${id}`,
  documentTitle: `Dokument ${id}`,
  category: 'mechaniki',
  rank: 1,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parseChatRequest', () => {
  it('rejects a missing message', () => {
    expect(parseChatRequest({ sessionId: 'abc' })).toBeInstanceOf(NextResponse)
  })

  it('rejects a missing sessionId', () => {
    expect(parseChatRequest({ message: 'Cześć' })).toBeInstanceOf(NextResponse)
  })

  it('rejects a blank message', () => {
    expect(parseChatRequest({ message: '   ', sessionId: 'abc' })).toBeInstanceOf(NextResponse)
  })

  it('trims the message and passes through the sessionId', () => {
    const result = parseChatRequest({ message: '  Jak zdobyć PD?  ', sessionId: 'session-1' })
    expect(result).toEqual({ message: 'Jak zdobyć PD?', sessionId: 'session-1' })
  })

  it('truncates messages longer than the max length', () => {
    const result = parseChatRequest({ message: 'a'.repeat(2000), sessionId: 'session-1' })
    expect(result).not.toBeInstanceOf(NextResponse)
    expect((result as { message: string }).message).toHaveLength(1000)
  })
})

describe('buildPromptContext', () => {
  it('searches the previous user question separately with a smaller limit', async () => {
    vi.mocked(getRecentHistory).mockResolvedValue({
      conversationId: 'conv-1',
      history: [
        { role: 'user', content: 'Czym są zdolności wrodzone?' },
        { role: 'assistant', content: 'To moce, z którymi rodzi się czarownik.' },
      ],
    })

    await buildPromptContext(config, 'user-1', 'a skąd je wziąć?', 'session-1')

    expect(searchChunks).toHaveBeenCalledWith('a skąd je wziąć?', {
      app: 'tutorials',
      expandQuery: config.expandQuery,
    })
    expect(searchChunks).toHaveBeenCalledWith(
      'Czym są zdolności wrodzone?',
      expect.objectContaining({ app: 'tutorials', limit: 2, expand: false }),
    )
  })

  it('puts current results first and drops duplicates from the previous-question search', async () => {
    vi.mocked(getRecentHistory).mockResolvedValue({
      conversationId: 'conv-1',
      history: [{ role: 'user', content: 'Poprzednie pytanie' }],
    })
    vi.mocked(searchChunks)
      .mockResolvedValueOnce([result('a'), result('b')])
      .mockResolvedValueOnce([result('b'), result('c')])

    const { userMessage } = await buildPromptContext(
      config,
      'user-1',
      'Bieżące pytanie',
      'session-1',
    )

    expect(userMessage.match(/### Dokument b/g)).toHaveLength(1)
    expect(userMessage.indexOf('### Dokument a')).toBeLessThan(
      userMessage.indexOf('### Dokument c'),
    )
    expect(userMessage.endsWith('Bieżące pytanie')).toBe(true)
  })

  it('appends the app’s extra searches as supplementary context after the main results', async () => {
    vi.mocked(getRecentHistory).mockResolvedValue({ conversationId: undefined, history: [] })
    vi.mocked(searchChunks)
      .mockResolvedValueOnce([result('a')])
      .mockResolvedValueOnce([result('a'), result('koszt')])

    const { userMessage } = await buildPromptContext(
      { ...config, extraSearches: () => ['koszt PD'] },
      'user-1',
      'Jak awansować?',
      'session-1',
    )

    expect(searchChunks).toHaveBeenCalledWith(
      'koszt PD',
      expect.objectContaining({ limit: 2, expand: false }),
    )
    expect(userMessage).toBe('### Dokument a\n### Dokument koszt\nJak awansować?')
  })

  it('builds the system prompt from the current question', async () => {
    vi.mocked(getRecentHistory).mockResolvedValue({ conversationId: undefined, history: [] })

    const { systemPrompt } = await buildPromptContext(config, 'user-1', 'Pytanie', 'session-1')

    expect(systemPrompt).toBe('system: Pytanie')
  })

  it('trims long assistant answers in history and keeps user messages intact', async () => {
    const longQuestion = 'p'.repeat(600)
    vi.mocked(getRecentHistory).mockResolvedValue({
      conversationId: 'conv-1',
      history: [
        { role: 'user', content: longQuestion },
        { role: 'assistant', content: 'a'.repeat(1000) },
      ],
    })

    const { history } = await buildPromptContext(config, 'user-1', 'Dalej?', 'session-1')

    expect(history).toEqual([
      { role: 'user', content: longQuestion },
      { role: 'assistant', content: `${'a'.repeat(400)}…` },
    ])
  })

  it('searches with the current message alone when there is no history', async () => {
    vi.mocked(getRecentHistory).mockResolvedValue({ conversationId: undefined, history: [] })

    await buildPromptContext(config, 'user-1', 'Jak zdobyć PD?', 'session-1')

    expect(searchChunks).toHaveBeenCalledTimes(1)
    expect(searchChunks).toHaveBeenCalledWith(
      'Jak zdobyć PD?',
      expect.objectContaining({ app: 'tutorials' }),
    )
  })
})
