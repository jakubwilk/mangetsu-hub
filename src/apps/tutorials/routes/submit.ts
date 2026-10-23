import { NextResponse } from 'next/server'
import { emitEvent, type HubEvent } from 'server/events'
import { type DocumentInput, ingestDocument, IngestError, type SourceSubmission } from 'server/rag'
import { findUserWithDiscordId } from 'server/users'

const errorResponse = (error: string, status: number) => NextResponse.json({ error }, { status })

export const submitterOf = async (userId: string): Promise<SourceSubmission['submittedBy']> => {
  const user = await findUserWithDiscordId(userId)
  return { name: user?.name ?? null, discordId: user?.discordId ?? null }
}

// Rejected input answers with its own status; anything else is a bug and propagates.
export const ingestErrorResponse = (err: unknown) => {
  if (err instanceof IngestError) return errorResponse(err.message, err.status)
  throw err
}

// An EDITOR's change waits for ROOT, who decides on Discord through n8n.
export const requestApproval = async (event: HubEvent, message: string) => {
  try {
    await emitEvent(event)
  } catch (err) {
    console.error(`[${event.type}] event failed:`, err instanceof Error ? err.message : err)
    return errorResponse('Nie udało się wysłać zgłoszenia. Spróbuj ponownie później.', 502)
  }
  return NextResponse.json({ message })
}

// ROOT's own change is applied at once — asking ROOT to approve it would only add a step.
export const ingestNow = async (input: DocumentInput, message: string) => {
  try {
    await ingestDocument(input)
  } catch (err) {
    if (err instanceof IngestError) return errorResponse(err.message, err.status)
    console.error('[rag] document ingest failed:', err instanceof Error ? err.message : err)
    return errorResponse('Nie udało się zapisać dokumentu. Spróbuj ponownie później.', 503)
  }
  return NextResponse.json({ message })
}
