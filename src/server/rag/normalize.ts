const HEADING = /^(#{1,6})(\s)/
const TITLE = /^#\s/

const demote = (line: string) =>
  line.replace(
    HEADING,
    (_, hashes: string, space: string) => `${hashes.length < 6 ? `${hashes}#` : hashes}${space}`,
  )

// Same text, same hash: sources differ in BOM, line endings and blank lines, and the chunker
// expects exactly one `# Title` on top — other headings become sections.
export const normalizeMarkdown = (markdown: string, title: string): string => {
  const text = markdown
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const lines = text ? text.split('\n') : []
  const titles = lines.filter((line) => TITLE.test(line)).length
  if (titles === 1 && TITLE.test(lines[0]!)) return `${text}\n`

  const body = titles === 0 ? lines : lines.map(demote)
  return `${[`# ${title.trim()}`, '', ...body].join('\n').trim()}\n`
}
