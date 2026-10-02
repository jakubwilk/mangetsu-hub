import { requestJson } from 'common/api'

export interface RateLimitStatus {
  requestsUsed: number
  limit: number
}

export const fetchRateLimit = () => requestJson<RateLimitStatus>('/api/tutorials/rate-limit')
