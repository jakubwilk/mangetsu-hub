import { requestJson } from 'common/api'

export const deleteUser = (userId: string, notify: boolean) =>
  requestJson<{ webhookOk: boolean }>(
    `/api/admin/users/${userId}`,
    { method: 'DELETE', body: { notify } },
    'Nie udało się usunąć użytkownika.',
  )
