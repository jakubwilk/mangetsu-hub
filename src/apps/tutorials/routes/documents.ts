import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, verifyOrigin } from 'server/authorize'
import { deleteDocument, getDocument, prepareDocumentEdit, type SourceSubmission } from 'server/rag'

import { requireTutorialsEditor, TUTORIALS_APP } from '../server'
import { ingestErrorResponse, ingestNow, requestApproval, submitterOf } from './submit'

type DocumentContext = RouteContext<'/api/tutorials/documents/[slug]'>

const notFound = () => NextResponse.json({ error: 'Nie znaleziono dokumentu.' }, { status: 404 })

export const documentGet = async (_request: NextRequest, ctx: DocumentContext) => {
  const authResult = await requireTutorialsEditor()
  if (authResult instanceof NextResponse) return authResult

  const document = await getDocument(TUTORIALS_APP, (await ctx.params).slug)
  return document ? NextResponse.json({ document }) : notFound()
}

export const documentPatch = async (request: NextRequest, ctx: DocumentContext) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireTutorialsEditor()
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult.session

  const body = await readJsonBody(request)
  if (body instanceof NextResponse) return body

  let edit: SourceSubmission
  try {
    const { slug } = await ctx.params
    edit = await prepareDocumentEdit(TUTORIALS_APP, slug, body, await submitterOf(user.id))
  } catch (err) {
    return ingestErrorResponse(err)
  }

  if (user.isRoot) return ingestNow(edit, `Zapisano „${edit.title}”.`)
  return requestApproval(
    { type: 'rag.source_submitted', data: edit },
    `Zmiana „${edit.title}” czeka na akceptację administratora.`,
  )
}

export const documentDelete = async (request: NextRequest, ctx: DocumentContext) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireTutorialsEditor()
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult.session

  const document = await getDocument(TUTORIALS_APP, (await ctx.params).slug)
  if (!document) return notFound()
  const { slug, title, category, sourceUrl, chunks } = document

  if (user.isRoot) {
    await deleteDocument(TUTORIALS_APP, slug)
    return NextResponse.json({ message: `Usunięto „${title}” z bazy wiedzy.` })
  }
  return requestApproval(
    {
      type: 'rag.document_delete_requested',
      data: {
        app: TUTORIALS_APP,
        slug,
        title,
        category,
        sourceUrl,
        chunks,
        submittedBy: await submitterOf(user.id),
      },
    },
    `Prośba o usunięcie „${title}” czeka na akceptację administratora.`,
  )
}
