import { describe, expect, it, vi } from 'vitest'

import { tutorialsChat } from './chatConfig'

vi.mock('server/authorize', () => ({ requireAppRole: vi.fn() }))

describe('tutorialsChat', () => {
  it('adds the PD cost rules and search for an advancement question', () => {
    const query = 'Ile kosztuje zwiększenie statystyki?'

    expect(tutorialsChat.buildSystemPrompt(query)).toContain('Zasady kalkulacji kosztów PD')
    expect(tutorialsChat.extraSearches?.(query)).toEqual(['koszt PD sklep wykupienie statystyki'])
  })

  it('keeps the base prompt and no extra search for other questions', () => {
    const query = 'Czym jest przeklęta energia?'

    expect(tutorialsChat.buildSystemPrompt(query)).not.toContain('Zasady kalkulacji kosztów PD')
    expect(tutorialsChat.extraSearches?.(query)).toEqual([])
  })
})
