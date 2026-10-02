import { describe, expect, it } from 'vitest'

import {
  canAccessApp,
  getAccessibleApps,
  getAppByPath,
  isAppId,
  isValidAppRole,
  toAppRoles,
} from './registry'

describe('getAppByPath', () => {
  it('matches the app root and nested paths', () => {
    expect(getAppByPath('/tutorials')?.id).toBe('tutorials')
    expect(getAppByPath('/tutorials/anything')?.id).toBe('tutorials')
  })

  it('does not match paths that only share a prefix', () => {
    expect(getAppByPath('/tutorialsx')).toBeUndefined()
    expect(getAppByPath('/admin')).toBeUndefined()
    expect(getAppByPath('/')).toBeUndefined()
  })
})

describe('isAppId / isValidAppRole', () => {
  it('accepts only registered apps and their roles', () => {
    expect(isAppId('tutorials')).toBe(true)
    expect(isAppId('characters')).toBe(false)
    expect(isValidAppRole('tutorials', 'EDITOR')).toBe(true)
    expect(isValidAppRole('tutorials', 'ROOT')).toBe(false)
  })
})

describe('canAccessApp / getAccessibleApps', () => {
  it('grants ROOT every app regardless of app roles', () => {
    const root = { isRoot: true, apps: {} }
    expect(canAccessApp(root, 'tutorials')).toBe(true)
    expect(getAccessibleApps(root).map((a) => a.id)).toEqual(['tutorials'])
  })

  it('grants a regular user only apps where they hold a role', () => {
    expect(canAccessApp({ isRoot: false, apps: { tutorials: 'USER' } }, 'tutorials')).toBe(true)
    expect(getAccessibleApps({ isRoot: false, apps: {} })).toEqual([])
  })
})

describe('toAppRoles', () => {
  it('keeps valid rows and drops unknown apps or roles', () => {
    expect(
      toAppRoles([
        { app: 'tutorials', role: 'EDITOR' },
        { app: 'removed-app', role: 'USER' },
        { app: 'tutorials', role: 'NOT_A_ROLE' },
      ]),
    ).toEqual({ tutorials: 'EDITOR' })
  })
})
