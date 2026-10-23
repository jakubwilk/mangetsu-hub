import { type AppId, isRagCategory, MAX_SOURCE_CHARS, MAX_TITLE_LENGTH } from 'apps'
import { db } from 'server/db'

import { IngestError } from './errors'
import { normalizeMarkdown } from './normalize'
import { isValidSlug, slugify } from './slug'
import { fetchForumTopic, parseForumTopicUrl } from './sources/forum'

export interface SourceSubmission {
  app: AppId
  slug: string
  title: string
  category: string
  markdown: string
  sourceUrl?: string
  mode: 'create' | 'update'
  chars: number
  submittedBy: { name: string | null; discordId: string | null }
}

type PreparedSource = Pick<SourceSubmission, 'slug' | 'title' | 'markdown' | 'sourceUrl' | 'mode'>

const MARKDOWN_FILE = /\.(md|markdown)$/i
const FIRST_TITLE = /^#[ \t]+(.+)$/m

const optionalText = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new IngestError(`Pole '${field}' musi być tekstem.`, 400)
  return value.trim() || undefined
}

const requiredText = (value: unknown, field: string): string => {
  const text = optionalText(value, field)
  if (!text) throw new IngestError(`Pole '${field}' jest wymagane.`, 400)
  return text
}

const isSlugTaken = async (app: AppId, slug: string) =>
  (await db.document.count({ where: { app, slug } })) > 0

// A topic already in the base is an update of that document, whatever its title is today.
const fromForum = async (
  app: AppId,
  url: string,
  titleOverride: string | undefined,
): Promise<PreparedSource> => {
  const topic = await fetchForumTopic(url)
  const source = { markdown: topic.markdown, sourceUrl: topic.sourceUrl }

  // Without an override the stored title stays — the nightly sync keeps it the same way.
  const existing = await db.document.findFirst({
    where: { app, sourceUrl: topic.sourceUrl },
    select: { slug: true, title: true },
  })
  if (existing) {
    const title = titleOverride ?? existing.title
    return { ...source, title, slug: existing.slug, mode: 'update' }
  }

  const title = titleOverride ?? topic.title
  const slug = slugify(title)
  if (!(await isSlugTaken(app, slug))) return { ...source, title, slug, mode: 'create' }

  // Another document owns the title's slug — the topic id keeps the new one apart.
  const suffixed = `${slug}-${parseForumTopicUrl(topic.sourceUrl)}`
  if (await isSlugTaken(app, suffixed)) {
    throw new IngestError(`Dokument „${suffixed}” już istnieje — zmień tytuł.`, 409)
  }
  return { ...source, title, slug: suffixed, mode: 'create' }
}

// A file updates the document with the same slug, so re-uploading an edited file replaces it.
const fromMarkdown = async (
  app: AppId,
  markdown: string,
  fileName: string | undefined,
  titleOverride: string | undefined,
): Promise<PreparedSource> => {
  if (markdown.length > MAX_SOURCE_CHARS) {
    throw new IngestError(`Treść przekracza limit ${MAX_SOURCE_CHARS} znaków.`, 400)
  }
  if (fileName !== undefined && !MARKDOWN_FILE.test(fileName)) {
    throw new IngestError('Oczekiwano pliku Markdown (.md).', 400)
  }

  const baseName = fileName?.replace(MARKDOWN_FILE, '').trim() || undefined
  const title = titleOverride ?? markdown.match(FIRST_TITLE)?.[1]?.trim() ?? baseName
  if (!title) throw new IngestError('Podaj tytuł — plik nie ma nagłówka „# ”.', 400)

  const slug = slugify(baseName ?? title)
  const existing = await db.document.findUnique({
    where: { app_slug: { app, slug } },
    select: { sourceUrl: true },
  })
  // The nightly forum sync would overwrite the file's text with the topic again.
  if (existing?.sourceUrl) {
    throw new IngestError('Ten dokument pochodzi z forum — zgłoś link do wątku.', 409)
  }

  return { title, markdown, slug, mode: existing ? 'update' : 'create' }
}

// Validates and converts a source at submission time, so ROOT approves exactly what gets ingested.
export const prepareSourceSubmission = async (
  app: AppId,
  body: Record<string, unknown>,
  submittedBy: SourceSubmission['submittedBy'],
): Promise<SourceSubmission> => {
  const { category } = body
  if (typeof category !== 'string' || !isRagCategory(app, category)) {
    throw new IngestError('Wybierz kategorię z listy.', 400)
  }
  const titleOverride = optionalText(body.title, 'title')

  let source: PreparedSource
  if (body.type === 'FORUM') {
    source = await fromForum(app, requiredText(body.url, 'url'), titleOverride)
  } else if (body.type === 'MARKDOWN') {
    source = await fromMarkdown(
      app,
      requiredText(body.markdown, 'markdown'),
      optionalText(body.fileName, 'fileName'),
      titleOverride,
    )
  } else {
    throw new IngestError('Nieznany rodzaj źródła.', 400)
  }

  if (source.title.length > MAX_TITLE_LENGTH) {
    throw new IngestError(`Tytuł może mieć maks. ${MAX_TITLE_LENGTH} znaków.`, 400)
  }
  if (!isValidSlug(source.slug)) {
    throw new IngestError('Z tytułu nie da się utworzyć identyfikatora — zmień tytuł.', 400)
  }

  const markdown = normalizeMarkdown(source.markdown, source.title)
  if (markdown.length > MAX_SOURCE_CHARS) {
    throw new IngestError(`Treść przekracza limit ${MAX_SOURCE_CHARS} znaków.`, 400)
  }

  return { app, ...source, category, markdown, chars: markdown.length, submittedBy }
}
