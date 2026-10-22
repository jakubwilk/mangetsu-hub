import type { AppId } from 'apps'
import { requestJson } from 'common/api'

export const fetchSessionIds = async (appId: AppId): Promise<string[]> => {
  const { sessionIds } = await requestJson<{ sessionIds: string[] }>(`/api/${appId}/sessions`)
  return sessionIds
}
