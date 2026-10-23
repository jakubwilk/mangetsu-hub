import { type AppId, isRagCategory, MAX_SOURCE_CHARS, MAX_TITLE_LENGTH } from 'apps'
import { createHash } from 'crypto'
import { embedText } from 'server/ai/embeddings'
import { db } from 'server/db'

import { chunkText } from './chunker'
import { IngestError } from './errors'
import { normalizeMarkdown } from './normalize'
import { isValidSlug } from './slug'

export interface DocumentInput {
  app: AppId
  slug: string
  title: string
  category: string
  markdown: string
  // Omitted keeps the stored link — a markdown update must not unlink a forum document.
  sourceUrl?: string | null
}

export interface IngestResult {
  // True only when the text changed and the document was re-chunked and re-embedded.
  changed: boolean
  chunks: number
}

export const hashContent = (markdown: string): string =>
  createHash('sha256').update(markdown).digest('hex')

const validate = ({ app, slug, title, category, markdown }: DocumentInput) => {
  if (!isRagCategory(app, category)) throw new IngestError(`Nieznana kategoria „${category}”.`, 400)
  if (!isValidSlug(slug)) throw new IngestError(`Nieprawidłowy slug „${slug}”.`, 400)
  if (!title.trim() || title.length > MAX_TITLE_LENGTH) {
    throw new IngestError(`Tytuł jest wymagany (maks. ${MAX_TITLE_LENGTH} znaków).`, 400)
  }
  if (!markdown.trim()) throw new IngestError('Treść jest pusta.', 400)
  if (markdown.length > MAX_SOURCE_CHARS) {
    throw new IngestError(`Treść przekracza limit ${MAX_SOURCE_CHARS} znaków.`, 400)
  }
}

export const ingestDocument = async (input: DocumentInput): Promise<IngestResult> => {
  validate(input)
  const { app, slug, category, sourceUrl } = input
  const title = input.title.trim()
  const markdown = normalizeMarkdown(input.markdown, title)
  const contentHash = hashContent(markdown)

  const existing = await db.document.findUnique({
    where: { app_slug: { app, slug } },
    select: {
      id: true,
      title: true,
      category: true,
      sourceUrl: true,
      contentHash: true,
      _count: { select: { chunks: true } },
    },
  })

  // Unchanged text costs no embeddings; metadata is written only when it differs, so
  // `updatedAt` keeps telling when the document last changed, not when it was last synced.
  if (existing?.contentHash === contentHash) {
    const metadataChanged =
      existing.title !== title ||
      existing.category !== category ||
      (sourceUrl !== undefined && existing.sourceUrl !== sourceUrl)
    if (metadataChanged) {
      await db.document.update({ where: { id: existing.id }, data: { title, category, sourceUrl } })
    }
    return { changed: false, chunks: existing._count.chunks }
  }

  const chunks = chunkText(markdown)

  // Embeddings are fetched before the transaction: a slow or failing embedding call must not
  // leave the document half-written (old chunks deleted, new ones without vectors).
  const vectors: string[] = []
  for (const chunk of chunks) {
    vectors.push(`[${(await embedText(chunk.content)).join(',')}]`)
  }

  await db.$transaction(
    async (tx) => {
      const doc = await tx.document.upsert({
        where: { app_slug: { app, slug } },
        update: { title, category, sourceUrl, markdown, contentHash },
        create: { app, slug, title, category, sourceUrl, markdown, contentHash },
      })

      await tx.chunk.deleteMany({ where: { documentId: doc.id } })

      for (const [i, chunk] of chunks.entries()) {
        const created = await tx.chunk.create({
          data: {
            documentId: doc.id,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            sections: chunk.sections,
          },
          select: { id: true },
        })
        await tx.$executeRaw`UPDATE chunks SET embedding = ${vectors[i]}::vector WHERE id = ${created.id}`
      }
    },
    { timeout: 60_000 },
  )

  return { changed: true, chunks: chunks.length }
}

// Chunks go with the document (onDelete: Cascade).
export const deleteDocument = async (app: AppId, slug: string): Promise<boolean> => {
  const { count } = await db.document.deleteMany({ where: { app, slug } })
  return count > 0
}

export const getDocument = async (app: AppId, slug: string) => {
  const document = await db.document.findUnique({
    where: { app_slug: { app, slug } },
    select: {
      slug: true,
      title: true,
      category: true,
      sourceUrl: true,
      markdown: true,
      updatedAt: true,
      _count: { select: { chunks: true } },
    },
  })
  if (!document) return null

  const { _count, ...rest } = document
  return { ...rest, chunks: _count.chunks }
}

export const listDocuments = async (app: AppId) => {
  const documents = await db.document.findMany({
    where: { app },
    orderBy: { title: 'asc' },
    select: {
      slug: true,
      title: true,
      category: true,
      sourceUrl: true,
      contentHash: true,
      updatedAt: true,
      _count: { select: { chunks: true } },
    },
  })
  return documents.map(({ _count, ...document }) => ({ ...document, chunks: _count.chunks }))
}

export type DocumentSummary = Awaited<ReturnType<typeof listDocuments>>[number]
