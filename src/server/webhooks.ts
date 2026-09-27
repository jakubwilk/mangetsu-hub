const WEBHOOK_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET

const ROLE_ACTIVATION_WEBHOOK_PATH = process.env.N8N_ROLE_ACTIVATION_WEBHOOK_PATH
const USER_DELETION_WEBHOOK_PATH = process.env.N8N_USER_DELETION_WEBHOOK_PATH

const webhookHeaders = {
  'Content-Type': 'application/json',
  'X-Webhook-Authorization': WEBHOOK_SECRET ?? '',
}

interface RoleActivationPayload {
  id: string
  discordId: string | null
  name: string | null
  email: string | null
  role: string
}

export async function notifyRoleActivation(payload: RoleActivationPayload): Promise<void> {
  const res = await fetch(`${WEBHOOK_BASE_URL}/${ROLE_ACTIVATION_WEBHOOK_PATH}`, {
    method: 'POST',
    headers: webhookHeaders,
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`Webhook aktywacji konta zwrócił status ${res.status}.`)
}

interface UserDeletionPayload {
  id: string
  discordId: string | null
  notify: boolean
  name: string | null
  email: string | null
}

export async function notifyUserDeletion(payload: UserDeletionPayload): Promise<void> {
  const res = await fetch(`${WEBHOOK_BASE_URL}/${USER_DELETION_WEBHOOK_PATH}`, {
    method: 'DELETE',
    headers: webhookHeaders,
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`Webhook usunięcia konta zwrócił status ${res.status}.`)
}
