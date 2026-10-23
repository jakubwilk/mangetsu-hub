import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { emitEvent, type HubEvent } from './events'

const fetchMock = vi.fn()

const event: HubEvent = {
  type: 'user.deleted',
  data: { id: 'u2', discordId: 'd2', name: 'Gracz', email: null, notify: true },
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('N8N_EVENTS_WEBHOOK_URL', 'https://n8n.example.com/webhook/hub-events')
  vi.stubEnv('N8N_WEBHOOK_SECRET', 'webhook-secret')
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('emitEvent', () => {
  it('posts the event with the webhook secret', async () => {
    await emitEvent(event)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://n8n.example.com/webhook/hub-events')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Webhook-Authorization']).toBe('webhook-secret')
    expect(JSON.parse(init.body)).toEqual({
      type: 'user.deleted',
      data: event.data,
      occurredAt: expect.any(String),
    })
  })

  it('throws without a configured webhook URL', async () => {
    vi.stubEnv('N8N_EVENTS_WEBHOOK_URL', '')

    await expect(emitEvent(event)).rejects.toThrow('N8N_EVENTS_WEBHOOK_URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when n8n does not accept the event', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(emitEvent(event)).rejects.toThrow('status 500')
  })
})
