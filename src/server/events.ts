import type { AppId } from 'apps'
import type { SourceSubmission } from 'server/rag/submission'

interface UserIdentity {
  id: string
  discordId: string | null
  name: string | null
  email: string | null
}

// Everything the hub tells n8n, through one webhook — n8n switches on `type`.
export type HubEvent =
  | { type: 'user.role_changed'; data: UserIdentity & { app: AppId; role: string } }
  | { type: 'user.deleted'; data: UserIdentity & { notify: boolean } }
  | { type: 'rag.source_submitted'; data: SourceSubmission }

export const emitEvent = async ({ type, data }: HubEvent): Promise<void> => {
  const url = process.env.N8N_EVENTS_WEBHOOK_URL
  if (!url) throw new Error(`Zdarzenie ${type}: brak konfiguracji N8N_EVENTS_WEBHOOK_URL.`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Authorization': process.env.N8N_WEBHOOK_SECRET ?? '',
    },
    body: JSON.stringify({ type, data, occurredAt: new Date().toISOString() }),
  })

  if (!res.ok) throw new Error(`Zdarzenie ${type}: n8n zwrócił status ${res.status}.`)
}
