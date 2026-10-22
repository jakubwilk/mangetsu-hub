import { describe, expect, it } from 'vitest'

import { normalizeMarkdown } from './normalize'

describe('normalizeMarkdown', () => {
  it('strips the BOM, unifies line endings and collapses blank lines', () => {
    expect(normalizeMarkdown('\uFEFF# Tytuł\r\n\r\n\r\n\r\nTekst\r\n', 'Tytuł')).toBe(
      '# Tytuł\n\nTekst\n',
    )
  })

  it('adds the title when the text has no top-level heading', () => {
    expect(normalizeMarkdown('Wstęp\n\n## Sekcja\n\nTekst', 'Waluty')).toBe(
      '# Waluty\n\nWstęp\n\n## Sekcja\n\nTekst\n',
    )
  })

  it('demotes every heading when there are several top-level ones', () => {
    expect(normalizeMarkdown('# Jeden\n\nA\n\n# Dwa\n\n## Pod\n\n###### Dno', 'Całość')).toBe(
      '# Całość\n\n## Jeden\n\nA\n\n## Dwa\n\n### Pod\n\n###### Dno\n',
    )
  })

  it('demotes a single top-level heading that is not on top', () => {
    expect(normalizeMarkdown('Wstęp\n\n# Tytuł', 'Tytuł')).toBe('# Tytuł\n\nWstęp\n\n## Tytuł\n')
  })

  it('does not treat hashtags or bold text as headings', () => {
    expect(normalizeMarkdown('# Tytuł\n\n#tag i **#1**', 'Tytuł')).toBe(
      '# Tytuł\n\n#tag i **#1**\n',
    )
  })

  it('is idempotent', () => {
    const once = normalizeMarkdown('Tekst\n\n# A\n\n# B', 'Tytuł')
    expect(normalizeMarkdown(once, 'Tytuł')).toBe(once)
  })

  // A changed text would change the hash, and the next sync would re-chunk the document.
  it('leaves a converted forum topic unchanged, whatever title it is given', () => {
    const topic = '# Ekwipunek\n\n## Mechanika\n\n### Zakupy\n\n- Miecz\n\n> **Przykład:**\n'
    expect(normalizeMarkdown(topic, 'Inny tytuł')).toBe(topic)
  })
})
