import type { AppRoles } from 'common/apps'

export interface AdminUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  isRoot: boolean
  apps: AppRoles
  createdAt: string
}
