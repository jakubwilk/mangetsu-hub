import { describe, expect, it } from 'vitest'

import { isValidSlug, slugify } from './slug'

describe('slugify', () => {
  it('lowercases, keeps Polish letters and joins words with dashes', () => {
    expect(slugify('System Obrażeń i Leczenie')).toBe('system-obrażeń-i-leczenie')
  })

  it('turns punctuation into single dashes and trims them from the ends', () => {
    expect(slugify('  „Fabuła” — forum: część 2! ')).toBe('fabuła-forum-część-2')
  })

  it('produces valid slugs', () => {
    expect(isValidSlug(slugify('Kręgi Czarowników'))).toBe(true)
    expect(isValidSlug(slugify('x'.repeat(200)))).toBe(true)
  })
})

describe('isValidSlug', () => {
  it('accepts existing content slugs', () => {
    expect(isValidSlug('przekleta-energia')).toBe(true)
    expect(isValidSlug('system-obrażeń-i-leczenie')).toBe(true)
  })

  it('rejects uppercase, spaces, paths and stray dashes', () => {
    for (const slug of ['', 'Waluty', 'dwa słowa', '../etc', '-a', 'a-', 'a--b']) {
      expect(isValidSlug(slug), slug).toBe(false)
    }
  })
})
