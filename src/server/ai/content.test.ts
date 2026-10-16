import { describe, expect, it } from 'vitest'

import { splitDelta } from './content'

const thinking = (text: string) => ({ type: 'thinking', thinking: [{ type: 'text', text }] })

describe('splitDelta', () => {
  it('passes a plain string through as answer text', () => {
    expect(splitDelta('Odpowiedź')).toEqual({ text: 'Odpowiedź', thinking: '' })
  })

  it('returns nothing for a missing delta', () => {
    expect(splitDelta(undefined)).toEqual({ text: '', thinking: '' })
    expect(splitDelta(null)).toEqual({ text: '', thinking: '' })
  })

  it('extracts the reasoning trace from a thinking part', () => {
    expect(splitDelta([thinking('Gracz pyta o klan.')])).toEqual({
      text: '',
      thinking: 'Gracz pyta o klan.',
    })
  })

  it('splits the closing thinking part from the first answer text', () => {
    expect(splitDelta([thinking(' Odpowiem.'), { type: 'text', text: 'Na' }])).toEqual({
      text: 'Na',
      thinking: ' Odpowiem.',
    })
  })

  it('ignores unknown parts', () => {
    expect(splitDelta([{ type: 'image_url' }, 'x', null])).toEqual({ text: '', thinking: '' })
  })
})
