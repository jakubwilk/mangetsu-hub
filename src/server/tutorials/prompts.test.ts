import { POLISH_ONLY_MESSAGE } from 'server/guardrails'
import { describe, expect, it, vi } from 'vitest'

import { buildSystemPrompt, GROUNDING_REMINDER, OFF_TOPIC_MESSAGE } from './prompts'

vi.mock('server/ai', () => ({ openai: {} }))

const chunk = {
  content: 'Treść poradnika o profesjach.',
  documentTitle: 'Profesje',
  category: 'mechaniki',
}

describe('buildSystemPrompt', () => {
  it('does not offer the language-refusal sentence to the model', () => {
    expect(buildSystemPrompt([chunk])).not.toContain(POLISH_ONLY_MESSAGE)
    expect(buildSystemPrompt([])).not.toContain(POLISH_ONLY_MESSAGE)
  })

  it('gives the model a dedicated off-topic sentence', () => {
    expect(buildSystemPrompt([chunk])).toContain(OFF_TOPIC_MESSAGE)
  })

  it('includes retrieved chunks with their title and category', () => {
    const prompt = buildSystemPrompt([chunk])

    expect(prompt).toContain('### Profesje (mechaniki)')
    expect(prompt).toContain(chunk.content)
  })

  it('repeats the grounding reminder after the retrieved context', () => {
    const prompt = buildSystemPrompt([chunk])

    expect(prompt.endsWith(GROUNDING_REMINDER)).toBe(true)
    expect(prompt.indexOf(chunk.content)).toBeLessThan(prompt.indexOf(GROUNDING_REMINDER))
  })

  it('falls back to the no-context instruction when nothing was retrieved', () => {
    expect(buildSystemPrompt([])).toContain('Nie znaleziono pasujących fragmentów')
  })

  it('adds PD cost rules only when cost context is needed', () => {
    expect(buildSystemPrompt([chunk], true)).toContain('Zasady kalkulacji kosztów PD')
    expect(buildSystemPrompt([chunk])).not.toContain('Zasady kalkulacji kosztów PD')
  })
})
