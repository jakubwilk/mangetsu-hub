import type { AppId } from 'apps'
import { requestJson } from 'common/api'

export interface RateLimitStatus {
  requestsUsed: number
  limit: number
}

export const fetchRateLimit = (appId: AppId) =>
  requestJson<RateLimitStatus>(`/api/${appId}/rate-limit`)
