import { describe, expect, it } from 'vitest'

import { parseContentPath } from './contentPath'

describe('parseContentPath', () => {
  it('extracts app, category and a capitalized title from the slug', () => {
    expect(parseContentPath('content/tutorials/mechanika/system-walki.md')).toEqual({
      app: 'tutorials',
      category: 'mechanika',
      title: 'System Walki',
    })
  })

  it('accepts Windows path separators', () => {
    expect(parseContentPath('content\\tutorials\\realia\\mangetsu.md')?.title).toBe('Mangetsu')
  })

  it('rejects an app that is not in the registry', () => {
    expect(parseContentPath('content/unknown/mechanika/x.md')).toBeNull()
  })

  it('rejects paths with a different depth or a non-markdown file', () => {
    expect(parseContentPath('content/tutorials/x.md')).toBeNull()
    expect(parseContentPath('content/tutorials/mechanika/sub/x.md')).toBeNull()
    expect(parseContentPath('content/tutorials/mechanika/notes.txt')).toBeNull()
  })
})
