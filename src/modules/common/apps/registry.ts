import { BookOpen, type LucideIcon } from 'lucide-react'

interface AppDefinition {
  id: string
  path: string
  name: string
  description: string
  icon: LucideIcon
  background: string
  roles: readonly { id: string; label: string }[]
}

export const APPS = [
  {
    id: 'tutorials',
    path: '/tutorials',
    name: 'Poradniki',
    description: 'Asystent AI odpowiadający na pytania o zasady, mechaniki i realia forum.',
    icon: BookOpen,
    background: '/tutorials-bg.png',
    roles: [
      { id: 'USER', label: 'Użytkownik' },
      { id: 'EDITOR', label: 'Redaktor' },
    ],
  },
] as const satisfies readonly AppDefinition[]

export const ROOT_LABEL = 'Administrator'

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

export const canAccessApp = (access: AppAccess, appId: AppId): boolean =>
  access.isRoot || access.apps[appId] !== undefined

export const getAccessibleApps = (access: AppAccess): App[] =>
  APPS.filter((app) => canAccessApp(access, app.id))

// Drops rows for apps or roles no longer in the registry (e.g. a removed app) instead of trusting the DB.
export const toAppRoles = (rows: readonly { app: string; role: string }[]): AppRoles => {
  const roles: AppRoles = {}
  for (const { app, role } of rows) {
    if (isAppId(app) && isValidAppRole(app, role)) roles[app] = role
  }
  return roles
}
