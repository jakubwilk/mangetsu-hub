import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireInternal } from './internal'

const request = (authorization?: string) =>
  new NextRequest('http://localhost/api/internal/rag/documents', {
    headers: authorization ? { authorization } : {},
  })

describe('requireInternal', () => {
  beforeEach(() => vi.stubEnv('INTERNAL_API_SECRET', 's3cret-value'))
  afterEach(() => vi.unstubAllEnvs())

  it('lets through a request with the bearer secret', () => {
    expect(requireInternal(request('Bearer s3cret-value'))).toBeNull()
  })

  it.each([
    ['no header', undefined],
    ['a wrong secret', 'Bearer wrong'],
    ['a secret prefix', 'Bearer s3cret'],
    ['the secret without the scheme', 's3cret-value'],
    ['an empty bearer', 'Bearer '],
  ])('rejects %s with 401', (_, header) => {
    expect(requireInternal(request(header))?.status).toBe(401)
  })

  it('stays closed when no secret is configured, even for an empty token', () => {
    vi.stubEnv('INTERNAL_API_SECRET', '')
    expect(requireInternal(request('Bearer '))?.status).toBe(503)
    expect(requireInternal(request())?.status).toBe(503)
  })
})
