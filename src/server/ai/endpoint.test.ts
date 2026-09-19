import { describe, expect, it } from 'vitest'

import { normalizeEndpoint } from './endpoint'

describe('normalizeEndpoint', () => {
  it.each([
    [undefined, undefined],
    ['', ''],
    ['https://host/v1', 'https://host/v1'],
    ['https://host/v1/chat/completions', 'https://host/v1'],
    ['https://host/v1/chat/completions/', 'https://host/v1'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeEndpoint(input)).toBe(expected)
  })
})
