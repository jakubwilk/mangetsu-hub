import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, verifyOrigin } from 'server/authorize'
import { emitEvent } from 'server/events'
import { IngestError, prepareSourceSubmission, type SourceSubmission } from 'server/rag'
import { findUserWithDiscordId } from 'server/users'

import { requireTutorialsEditor, TUTORIALS_APP } from '../server'

export const sourcesPost = async (request: NextRequest) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireTutorialsEditor()
  if (authResult instanceof NextResponse) return authResult

  const body = await readJsonBody(request)
  if (body instanceof NextResponse) return body

  let submission: SourceSubmission
  try {
    const author = await findUserWithDiscordId(authResult.session.user.id)
    submission = await prepareSourceSubmission(TUTORIALS_APP, body, {
      name: author?.name ?? null,
      discordId: author?.discordId ?? null,
    })
  } catch (err) {
    if (err instanceof IngestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  try {
    await emitEvent({ type: 'rag.source_submitted', data: submission })
  } catch (err) {
    console.error('[sources] submission event failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie później.' },
      { status: 502 },
    )
  }

  const action = submission.mode === 'update' ? 'Aktualizacja' : 'Nowy dokument'
  return NextResponse.json({
    message: `${action} „${submission.title}” czeka na akceptację administratora.`,
  })
}
