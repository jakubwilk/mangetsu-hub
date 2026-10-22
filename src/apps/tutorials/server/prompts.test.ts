import { POLISH_ONLY_MESSAGE } from 'server/guardrails'
import { describe, expect, it, vi } from 'vitest'

import {
  buildSystemPrompt,
  buildUserMessage,
  GROUNDING_REMINDER,
  OFF_TOPIC_MESSAGE,
} from './prompts'

vi.mock('server/ai', () => ({ openai: {} }))

const chunk = {
  content: 'Treść poradnika o profesjach.',
  documentTitle: 'Profesje',
  category: 'mechaniki',
}

describe('buildSystemPrompt', () => {
  it('does not offer the language-refusal sentence to the model', () => {
    expect(buildSystemPrompt()).not.toContain(POLISH_ONLY_MESSAGE)
  })

  it('gives the model a dedicated off-topic sentence', () => {
    expect(buildSystemPrompt()).toContain(OFF_TOPIC_MESSAGE)
  })

  it('adds PD cost rules only when cost context is needed', () => {
    expect(buildSystemPrompt(true)).toContain('Zasady kalkulacji kosztów PD')
    expect(buildSystemPrompt()).not.toContain('Zasady kalkulacji kosztów PD')
  })
})

describe('buildUserMessage', () => {
  it('includes retrieved chunks with their title and category', () => {
    const message = buildUserMessage([chunk], 'Jakie są profesje?')

    expect(message).toContain('### Profesje (mechaniki)')
    expect(message).toContain(chunk.content)
  })

  it('puts the reminder after the fragments and ends with the question', () => {
    const message = buildUserMessage([chunk], 'Jakie są profesje?')

    expect(message.indexOf(chunk.content)).toBeLessThan(message.indexOf(GROUNDING_REMINDER))
    expect(message.endsWith('Jakie są profesje?')).toBe(true)
  })

  it('falls back to the no-context instruction when nothing was retrieved', () => {
    const message = buildUserMessage([], 'Jakie są profesje?')

    expect(message).toContain('Nie znaleziono pasujących fragmentów')
    expect(message.endsWith('Jakie są profesje?')).toBe(true)
  })
})
