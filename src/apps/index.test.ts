import { existsSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import {
  APPS,
  canAccessApp,
  getAccessibleApps,
  getAppByPath,
  getRagCategories,
  isAppId,
  isRagCategory,
  isValidAppRole,
  toAppRoles,
} from '.'

describe('APPS', () => {
  it('has unique ids and paths', () => {
    expect(new Set(APPS.map((app) => app.id)).size).toBe(APPS.length)
    expect(new Set(APPS.map((app) => app.path)).size).toBe(APPS.length)
  })

  it('has a page under src/app for every app path', () => {
    for (const app of APPS) {
      expect(existsSync(path.join(process.cwd(), 'src/app', app.path, 'page.tsx'))).toBe(true)
    }
  })
})

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

describe('getRagCategories / isRagCategory', () => {
  it('lists the categories of an app knowledge base and accepts only those', () => {
    expect(getRagCategories('tutorials').map((c) => c.id)).toEqual([
      'realia',
      'kompendium',
      'mechanika',
      'inne',
    ])
    expect(isRagCategory('tutorials', 'mechanika')).toBe(true)
    expect(isRagCategory('tutorials', 'Mechanika')).toBe(false)
  })
})
