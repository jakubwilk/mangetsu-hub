import type { AppId } from 'apps'
import { requestJson } from 'common/api'

export const updateUserAppRole = (userId: string, app: AppId, role: string | null) =>
  requestJson<{ webhookOk: boolean }>(
    `/api/admin/users/${userId}/apps/${app}`,
    { method: 'PUT', body: { role } },
    'Nie udało się zmienić roli.',
  )
