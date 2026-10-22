import { type AppId, getRagCategories, isAppId } from 'apps'
import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from 'server/authorize'
import { requireInternal } from 'server/internal'

import { IngestError } from './errors'
import { deleteDocument, type DocumentInput, ingestDocument, listDocuments } from './ingest'
import { fetchForumTopic } from './sources/forum'

const errorResponse = (error: string, status: number) => NextResponse.json({ error }, { status })

// Only apps with a knowledge base; a disabled app can still be maintained from the back office.
const toRagApp = (app: unknown): AppId | null =>
  typeof app === 'string' && isAppId(app) && getRagCategories(app).length > 0 ? app : null

const optionalString = (value: unknown): string | undefined | null =>
  value === undefined ? undefined : typeof value === 'string' ? value : null

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

// PUT body: `markdown` (+ optional `sourceUrl`) or `forumUrl`, which the server fetches itself.
const parseDocumentBody = async (
  body: Record<string, unknown>,
): Promise<DocumentInput | NextResponse> => {
  const app = toRagApp(body.app)
  if (!app) return errorResponse('Nieznana aplikacja.', 404)

  const { slug, category, markdown, forumUrl, sourceUrl } = body
  const title = optionalString(body.title)
  if (typeof slug !== 'string' || typeof category !== 'string' || title === null) {
    return errorResponse("Pola 'slug', 'category' i 'title' muszą być tekstem.", 400)
  }

  if (typeof forumUrl === 'string' && markdown === undefined && sourceUrl === undefined) {
    const source = await fetchForumTopic(forumUrl)
    return { app, slug, category, ...source, title: title ?? source.title }
  }

  if (typeof markdown !== 'string' || forumUrl !== undefined) {
    return errorResponse("Wymagane jest dokładnie jedno z pól 'markdown' albo 'forumUrl'.", 400)
  }
  if (title === undefined) return errorResponse("Pole 'title' jest wymagane.", 400)

  const link = optionalString(sourceUrl)
  if (link === null && sourceUrl !== null) {
    return errorResponse("Pole 'sourceUrl' musi być tekstem.", 400)
  }
  if (typeof link === 'string' && !isHttpUrl(link))
    return errorResponse("Pole 'sourceUrl' musi być adresem http(s).", 400)

  return { app, slug, category, title, markdown, sourceUrl: link }
}

export const documentsGet = async (request: NextRequest) => {
  const authError = requireInternal(request)
  if (authError) return authError

  const app = toRagApp(request.nextUrl.searchParams.get('app'))
  if (!app) return errorResponse('Nieznana aplikacja.', 404)

  return NextResponse.json({ documents: await listDocuments(app) })
}

export const documentsPut = async (request: NextRequest) => {
  const authError = requireInternal(request)
  if (authError) return authError

  const body = await readJsonBody(request)
  if (body instanceof NextResponse) return body

  try {
    const input = await parseDocumentBody(body)
    if (input instanceof NextResponse) return input
    return NextResponse.json(await ingestDocument(input))
  } catch (err) {
    if (err instanceof IngestError) return errorResponse(err.message, err.status)
    console.error('[rag] document ingest failed:', err instanceof Error ? err.message : err)
    return errorResponse('Usługa chwilowo niedostępna.', 503)
  }
}

export const documentsDelete = async (request: NextRequest) => {
  const authError = requireInternal(request)
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const app = toRagApp(searchParams.get('app'))
  if (!app) return errorResponse('Nieznana aplikacja.', 404)

  const slug = searchParams.get('slug')
  if (!slug) return errorResponse("Parametr 'slug' jest wymagany.", 400)

  if (!(await deleteDocument(app, slug))) return errorResponse('Nie znaleziono dokumentu.', 404)
  return NextResponse.json({ deleted: true })
}
