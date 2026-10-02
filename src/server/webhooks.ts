const webhookUrl = (path: string | undefined): string | undefined => {
  const base = process.env.N8N_WEBHOOK_BASE_URL
  return base && path ? `${base}/${path}` : undefined
}

const callWebhook = async (
  label: string,
  url: string | undefined,
  method: 'POST' | 'DELETE',
  payload: object,
): Promise<void> => {
  if (!url) throw new Error(`${label}: brak konfiguracji adresu webhooka.`)

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Authorization': process.env.N8N_WEBHOOK_SECRET ?? '',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`${label} zwrócił status ${res.status}.`)
}

interface RoleActivationPayload {
  id: string
  discordId: string | null
  name: string | null
  email: string | null
  app: string
  role: string
}

export const notifyRoleActivation = (payload: RoleActivationPayload) =>
  callWebhook(
    'Webhook aktywacji konta',
    webhookUrl(process.env.N8N_ROLE_ACTIVATION_WEBHOOK_PATH),
    'POST',
    payload,
  )

interface UserDeletionPayload {
  id: string
  discordId: string | null
  notify: boolean
  name: string | null
  email: string | null
}

export const notifyUserDeletion = (payload: UserDeletionPayload) =>
  callWebhook(
    'Webhook usunięcia konta',
    webhookUrl(process.env.N8N_USER_DELETION_WEBHOOK_PATH),
    'DELETE',
    payload,
  )
