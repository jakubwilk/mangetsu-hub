export type SourceMethod = 'URL' | 'CONTENT'

export const submitSourceToWebhook = async (
  method: SourceMethod,
  data: string,
): Promise<string> => {
  const url = process.env.SOURCES_WEBHOOK_URL
  if (!url) throw new Error('Brak konfiguracji webhooka źródeł.')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Authorization': process.env.N8N_WEBHOOK_SECRET ?? '',
    },
    body: JSON.stringify({ method, data }),
  })

  const raw = await res.text()
  let json: { status: number; message: string } | null = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    // Webhook returned a non-JSON body (e.g. a plain-text auth error) — fall through and
    // surface `raw` as the error message instead of crashing on JSON.parse.
  }

  if (!res.ok) throw new Error(json?.message || raw || `Webhook zwrócił status ${res.status}.`)
  if (!json) throw new Error('Webhook zwrócił nieprawidłową odpowiedź.')

  return json.message
}
