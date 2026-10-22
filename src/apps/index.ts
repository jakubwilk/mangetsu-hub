// Manifests only — never an app's barrel: the proxy imports this registry and must not pull in components.
import { tutorialsManifest } from './tutorials/manifest'
import type { AppManifest, RagCategory } from './types'

export type { AppManifest, RagCategory } from './types'

export const APPS = [tutorialsManifest] as const satisfies readonly AppManifest[]

export const ROOT_LABEL = 'Administrator'

// Largest markdown accepted as a RAG source — the biggest forum topic today is ~40k characters.
export const MAX_SOURCE_CHARS = 100_000

export type App = (typeof APPS)[number]
export type AppId = App['id']
export type AppRole<A extends AppId> = Extract<App, { id: A }>['roles'][number]['id']
export type AppRoles = Partial<Record<AppId, string>>

export interface AppAccess {
  isRoot: boolean
  apps: AppRoles
}

export const isAppId = (id: string): id is AppId => APPS.some((app) => app.id === id)

export const getApp = (id: AppId): App => APPS.find((app) => app.id === id)!

export const getAppByPath = (pathname: string): App | undefined =>
  APPS.find((app) => pathname === app.path || pathname.startsWith(`${app.path}/`))

export const isValidAppRole = (appId: AppId, role: string): boolean =>
  getApp(appId).roles.some((r) => r.id === role)

// A disabled app keeps its roles in the DB but disappears from tiles and admin, and its routes 404.
export const isAppEnabled = (appId: AppId): boolean => getApp(appId).enabled

export const getEnabledApps = (): App[] => APPS.filter((app) => app.enabled)

export const getRagCategories = (appId: AppId): readonly RagCategory[] => {
  const app: AppManifest = getApp(appId)
  return app.rag?.categories ?? []
}

export const isRagCategory = (appId: AppId, category: string): boolean =>
  getRagCategories(appId).some((c) => c.id === category)

export const canAccessApp = (access: AppAccess, appId: AppId): boolean =>
  access.isRoot || access.apps[appId] !== undefined

export const getAccessibleApps = (access: AppAccess): App[] =>
  getEnabledApps().filter((app) => canAccessApp(access, app.id))

// Drops rows for apps or roles no longer in the registry (e.g. a removed app) instead of trusting the DB.
export const toAppRoles = (rows: readonly { app: string; role: string }[]): AppRoles => {
  const roles: AppRoles = {}
  for (const { app, role } of rows) {
    if (isAppId(app) && isValidAppRole(app, role)) roles[app] = role
  }
  return roles
}
