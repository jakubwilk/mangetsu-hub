import type { AppRoles } from 'apps'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string; isRoot: boolean; apps: AppRoles } & DefaultSession['user']
  }

  interface User {
    isRoot: boolean
  }
}
