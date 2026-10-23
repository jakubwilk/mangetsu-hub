import type { AppId } from 'apps'
import { db } from 'server/db'

import { IngestError } from './errors'
import { normalizeMarkdown } from './normalize'
import { fetchForumTopic } from './sources/forum'
import { normalizeSource, requireCategory, requiredText, type SourceSubmission } from './submission'

// An edit of a stored document, prepared like a submission so ROOT approves it the same way.
export const prepareDocumentEdit = async (
  app: AppId,
  slug: string,
  body: Record<string, unknown>,
  submittedBy: SourceSubmission['submittedBy'],
): Promise<SourceSubmission> => {
  const existing = await db.document.findUnique({
    where: { app_slug: { app, slug } },
    select: { title: true, category: true, sourceUrl: true, markdown: true },
  })
  if (!existing) throw new IngestError('Nie znaleziono dokumentu.', 404)

  const category = requireCategory(app, body.category)
  const title = requiredText(body.title, 'title')

  let text: string
  if (existing.sourceUrl) {
    // The nightly sync would bring the topic's text back anyway.
    if (body.markdown !== undefined) {
      throw new IngestError('Treść dokumentu z forum zmienia się na forum.', 400)
    }
    text =
      body.refresh === true
        ? (await fetchForumTopic(existing.sourceUrl)).markdown
        : existing.markdown
  } else {
    text = requiredText(body.markdown, 'markdown')
  }

  const markdown = normalizeSource(text, title)
  // Against the stored title, so a new title alone does not count as new text.
  const textChanged = normalizeMarkdown(text, existing.title) !== existing.markdown
  const changes = [
    title !== existing.title && 'tytuł',
    category !== existing.category && 'kategoria',
    textChanged && 'treść',
  ].filter((change): change is string => change !== false)
  if (changes.length === 0) throw new IngestError('Brak zmian.', 400)

  return {
    app,
    slug,
    title,
    category,
    markdown,
    ...(existing.sourceUrl && { sourceUrl: existing.sourceUrl }),
    mode: 'update',
    chars: markdown.length,
    changes,
    submittedBy,
  }
}
