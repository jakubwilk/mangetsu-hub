import TurndownService from 'turndown'

import { IngestError } from '../errors'

// Markers of the jcink "printable version" of a topic and of the forum's post BBCode.
const BREADCRUMB = /<font color='red'>([^<]*)<\/font>/
const POSTED_BY = /Posted by:/g
const POST =
  /<div class="nazwa-mangetsu">([\s\S]*?)<\/div><!-- end_bbc_fourtyeight -->[\s\S]*?<div class="tresc-mangetsu">([\s\S]*?)<\/div><!-- end_bbc_fourtynine -->/g

export interface ConvertedTopic {
  title: string
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
  const title = normalizeTitle(toText(breadcrumb))

  return {
    title,
    markdown: `${tidy([`# ${title}`, ...parts].join('\n\n'))}\n`,
    posts: posts.length,
    untitled: (html.match(POSTED_BY)?.length ?? 0) - posts.length,
  }
}

export interface ForumSource {
  title: string
  markdown: string
  // Canonical topic link — the same topic pasted with &st= or #entry… is still one document.
  sourceUrl: string
}

const FETCH_TIMEOUT_MS = 15_000

const forumBase = (): URL => {
  const forumUrl = process.env.NEXT_PUBLIC_FORUM_URL
  if (!forumUrl) throw new IngestError('Brak NEXT_PUBLIC_FORUM_URL — adresu forum.', 503)
  return new URL(forumUrl)
}

const TOPIC_ID = /^[1-9]\d*$/

// Only a plain topic link of our forum: "…/index.php?showtopic=N", extra params and #entry allowed.
export const parseForumTopicUrl = (url: string): number | null => {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }

  const base = forumBase()
  const topic = parsed.searchParams.get('showtopic') ?? ''
  const isForumPage =
    (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
    parsed.host === base.host &&
    parsed.pathname === new URL('index.php', base).pathname

  return isForumPage && TOPIC_ID.test(topic) ? Number(topic) : null
}

export const canonicalTopicUrl = (topic: number): string =>
  new URL(`index.php?showtopic=${topic}`, forumBase()).toString()

// The printable version holds every post of the topic on one page, without the forum skin.
const printableUrl = (topic: number) =>
  new URL(`index.php?act=Print&client=printer&t=${topic}`, forumBase())

export const fetchForumTopic = async (url: string): Promise<ForumSource> => {
  const topic = parseForumTopicUrl(url)
  if (topic === null) {
    throw new IngestError(
      'Nieprawidłowy link — oczekiwano wątku forum (…/index.php?showtopic=N).',
      400,
    )
  }

  let html: string
  try {
    const res = await fetch(printableUrl(topic), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'brak odpowiedzi'
    throw new IngestError(`Nie udało się pobrać wątku ${topic} z forum (${detail}).`, 502)
  }

  try {
    const { title, markdown } = topicHtmlToMarkdown(html)
    return { title, markdown, sourceUrl: canonicalTopicUrl(topic) }
  } catch (err) {
    throw new IngestError(err instanceof Error ? err.message : 'Nie rozpoznano wątku.', 422)
  }
}
