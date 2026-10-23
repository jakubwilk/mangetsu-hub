import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, verifyOrigin } from 'server/authorize'
import { prepareSourceSubmission, type SourceSubmission } from 'server/rag'

import { requireTutorialsEditor, TUTORIALS_APP } from '../server'
import { ingestErrorResponse, ingestNow, requestApproval, submitterOf } from './submit'

export const sourcesPost = async (request: NextRequest) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireTutorialsEditor()
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult.session

  const body = await readJsonBody(request)
  if (body instanceof NextResponse) return body

  let submission: SourceSubmission
  try {
    submission = await prepareSourceSubmission(TUTORIALS_APP, body, await submitterOf(user.id))
  } catch (err) {
    return ingestErrorResponse(err)
  }

  const isUpdate = submission.mode === 'update'
  if (user.isRoot) {
    const action = isUpdate ? 'Zaktualizowano' : 'Dodano'
    return ingestNow(submission, `${action} „${submission.title}” w bazie wiedzy.`)
  }

  const action = isUpdate ? 'Aktualizacja' : 'Nowy dokument'
  return requestApproval(
    { type: 'rag.source_submitted', data: submission },
    `${action} „${submission.title}” czeka na akceptację administratora.`,
  )
}
