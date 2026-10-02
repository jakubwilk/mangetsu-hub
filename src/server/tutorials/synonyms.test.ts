import { describe, expect, it } from 'vitest'

import { expandWithSynonyms } from './synonyms'

describe('expandWithSynonyms', () => {
  it('leaves a query without known synonyms unchanged', () => {
    expect(expandWithSynonyms('jak działa sklep')).toBe('jak działa sklep')
  })

  it('appends the canonical stem while keeping the original words', () => {
    expect(expandWithSynonyms('ile postów na misję')).toBe('ile postów na misję kolejk')
    expect(expandWithSynonyms('jakie są rodzaje klątw')).toBe('jakie są rodzaje klątw poziom')
  })

  it('appends each stem once even when several rules map to it', () => {
    expect(expandWithSynonyms('ile tur i rund trwa walka, ile postów')).toBe(
      'ile tur i rund trwa walka, ile postów kolejk',
    )
  })
})
