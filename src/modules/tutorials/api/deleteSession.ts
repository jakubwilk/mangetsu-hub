import { requestJson } from 'common/api'

export const deleteSession = (sessionId: string) =>
  requestJson<{ success: boolean }>(
    `/api/tutorials/sessions?id=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
    'Nie udało się usunąć czatu. Spróbuj ponownie.',
  )
