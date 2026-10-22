import { requestJson } from 'common/api'

export const fetchSessionIds = async (): Promise<string[]> => {
  const { sessionIds } = await requestJson<{ sessionIds: string[] }>('/api/tutorials/sessions')
  return sessionIds
}
