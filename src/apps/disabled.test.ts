import { describe, expect, it, vi } from 'vitest'

import { getAccessibleApps, getEnabledApps, isAppEnabled, toAppRoles } from '.'

vi.mock('./tutorials/manifest', async (importOriginal) => {
  const { tutorialsManifest } = await importOriginal<typeof import('./tutorials/manifest')>()
  return { tutorialsManifest: { ...tutorialsManifest, enabled: false } }
})

describe('disabled app', () => {
  it('is hidden from tiles and admin but keeps its roles', () => {
    expect(isAppEnabled('tutorials')).toBe(false)
    expect(getEnabledApps()).toEqual([])
    expect(getAccessibleApps({ isRoot: true, apps: {} })).toEqual([])
    expect(toAppRoles([{ app: 'tutorials', role: 'EDITOR' }])).toEqual({ tutorials: 'EDITOR' })
  })
})
