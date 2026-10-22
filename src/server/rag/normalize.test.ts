import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { normalizeMarkdown } from './normalize'

const CONTENT_DIR = path.join(process.cwd(), 'content')

const listMarkdownFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return listMarkdownFiles(fullPath)
    return entry.name.endsWith('.md') ? [fullPath] : []
  })

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

  // A changed text would change the hash, and the first sync would re-chunk every document.
  it('leaves every file in content/ unchanged', () => {
    for (const file of listMarkdownFiles(CONTENT_DIR)) {
      const markdown = readFileSync(file, 'utf-8')
      expect(normalizeMarkdown(markdown, 'ignored'), file).toBe(markdown)
    }
  })
})
