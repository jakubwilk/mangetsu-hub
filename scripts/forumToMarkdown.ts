import TurndownService from 'turndown'

// Markers of the jcink "printable version" of a topic and of the forum's post BBCode.
const BREADCRUMB = /<font color='red'>([^<]*)<\/font>/
const POSTED_BY = /Posted by:/g
const POST =
  /<div class="nazwa-mangetsu">([\s\S]*?)<\/div><!-- end_bbc_fourtyeight -->[\s\S]*?<div class="tresc-mangetsu">([\s\S]*?)<\/div><!-- end_bbc_fourtynine -->/g

export interface ConvertedTopic {
  markdown: string
  posts: number
  // Posts without the title/content BBCode — skipped, so the caller can warn about them.
  untitled: number
}

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim()

const hasClass = (node: HTMLElement, name: string) =>
  (node.getAttribute('class') ?? '').split(' ').includes(name)

const isInside = (node: Node, tagName: string): boolean =>
  node.parentNode !== null &&
  (node.parentNode.nodeName === tagName || isInside(node.parentNode, tagName))

// The same box holds a drop cap ("E" + "ra Heian") or a label ("V" + " To…"). Only the space
// after it tells them apart, and turndown collapses that whitespace before its rules run.
const MARKER_BOX = /<div class="mangetsu-num">([^<]*)<\/div>((?:<!--[^>]*-->)*)(\s?)/g
const inlineMarkerBoxes = (html: string) =>
  html.replace(MARKER_BOX, (_, text: string, comments: string, space: string) =>
    space ? `<b>${text}</b>${comments}${space}` : `${text}${comments}`,
  )

const tableToMarkdown = (table: HTMLElement, cellText: (html: string) => string): string => {
  const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
    Array.from(row.querySelectorAll('td, th')).map((cell) =>
      collapse(cellText(cell.innerHTML)).replace(/\|/g, '\\|'),
    ),
  )
  const [head, ...body] = rows
  if (!head) return ''

  const width = Math.max(...rows.map((cells) => cells.length))
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`
  return [line(head), line(Array<string>(width).fill('---')), ...body.map(line)].join('\n')
}

const service = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  // A single <br> ends a paragraph on the forum; a blank line lets the chunker split there.
  br: '\n',
})
// Forum posts are prose, not markdown — escaping would only add backslash noise to the RAG text.
service.escape = (text) => text
// `remove()` loses to turndown's built-in rules (hr, img), an explicit rule does not.
service.addRule('drop', {
  filter: ['hr', 'img', 'summary'],
  replacement: () => '',
})
service.addRule('section', {
  filter: 'h1',
  // Examples quote whole forum posts, headings included — those must not become sections.
  replacement: (content, node) =>
    isInside(node, 'DETAILS')
      ? `\n\n**${collapse(content)}**\n\n`
      : `\n\n### ${collapse(content)}\n\n`,
})
service.addRule('subtitle', {
  filter: (node) => hasClass(node, 'dodatek-mangetsu'),
  replacement: (content) => `\n\n*${collapse(content)}*\n\n`,
})
service.addRule('example', {
  filter: 'details',
  replacement: (content, node) => {
    const summary = collapse(node.querySelector('summary')?.textContent ?? '')
    // One quote per block keeps blank lines between them, so the chunker can still split.
    const quoted = content
      .trim()
      .split(/\n{2,}/)
      .map((block) =>
        block
          .split('\n')
          .map((line) => `> ${line}`.trimEnd())
          .join('\n'),
      )
      .join('\n\n')
    return `\n\n**${summary}:**\n\n${quoted}\n\n`
  },
})
service.addRule('table', {
  filter: 'table',
  // Cells are converted on their own: textContent would glue words split by <br>.
  replacement: (_, node) => `\n\n${tableToMarkdown(node, (html) => service.turndown(html))}\n\n`,
})
// Loose list (blank line between items): long item lists stay splittable for the chunker.
service.addRule('listItem', {
  filter: 'li',
  replacement: (content) => `- ${content.trim().replace(/\n/g, '\n  ')}\n\n`,
})

const toText = (html: string) => collapse(service.turndown(html))

// Titles are often typed in caps on the forum ("SIŁA") and end with stray colons.
const normalizeTitle = (title: string) =>
  title
    .replace(/:$/, '')
    .trim()
    .replace(/\p{Lu}{4,}/gu, (word) => word.charAt(0) + word.slice(1).toLowerCase())

const tidy = (markdown: string) =>
  markdown
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

// Printable topic → "# Topic", one "## Post" per post and "###" per forum section (h1). An
// introduction post keeps its heading too: without a section, search could not expand it.
export const topicHtmlToMarkdown = (html: string): ConvertedTopic => {
  const breadcrumb = html.match(BREADCRUMB)?.[1]
  const posts = [...html.matchAll(POST)]
  if (!breadcrumb || posts.length === 0) {
    throw new Error(
      'Nie rozpoznano wątku — zmienił się szablon wersji do druku albo BBCode postów.',
    )
  }

  const parts = posts.map(
    ([, title = '', body = '']) =>
      `## ${normalizeTitle(toText(title))}\n\n${service.turndown(inlineMarkerBoxes(body))}`,
  )

  return {
    markdown: `${tidy([`# ${normalizeTitle(toText(breadcrumb))}`, ...parts].join('\n\n'))}\n`,
    posts: posts.length,
    untitled: (html.match(POSTED_BY)?.length ?? 0) - posts.length,
  }
}
