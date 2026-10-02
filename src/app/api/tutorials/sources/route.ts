import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody, verifyOrigin } from 'server/authorize'
import { requireTutorialsEditor, submitSourceToWebhook } from 'server/tutorials'

export const POST = async (request: NextRequest) => {
  const originError = verifyOrigin(request)
  if (originError) return originError

  const authResult = await requireTutorialsEditor()
  if (authResult instanceof NextResponse) return authResult

  const body = await readJsonBody(request)
  if (body instanceof NextResponse) return body

  const { method, data } = body

  if (method !== 'URL' && method !== 'CONTENT') {
    return NextResponse.json({ error: 'Nieprawidłowa metoda.' }, { status: 400 })
  }
  if (typeof data !== 'string' || !data.trim()) {
    return NextResponse.json({ error: "Pole 'data' jest wymagane." }, { status: 400 })
  }

  try {
    const message = await submitSourceToWebhook(method, data.trim())
    return NextResponse.json({ message })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udało się dodać źródła.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
