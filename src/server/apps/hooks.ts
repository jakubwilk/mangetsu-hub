import type { AppId } from 'common/apps'
import { notifyRoleActivation } from 'server/webhooks'

export interface RoleChange {
  userId: string
  discordId: string | null
  name: string | null
  email: string | null
  app: AppId
  role: string | null
}

interface AppHooks {
  onRoleChange?: (change: RoleChange) => Promise<void>
}

// Optional server-side side effects per app — an app without an entry simply has none.
export const APP_HOOKS: Partial<Record<AppId, AppHooks>> = {
  tutorials: {
    // The n8n "User activation" workflow switches on USER/EDITOR/GUEST — "no access" maps to GUEST.
    onRoleChange: ({ userId, discordId, name, email, app, role }) =>
      notifyRoleActivation({ id: userId, discordId, name, email, app, role: role ?? 'GUEST' }),
  },
}
