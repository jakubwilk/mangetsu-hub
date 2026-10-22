import type { LucideIcon } from 'lucide-react'

// Client- and proxy-safe app metadata — no server code, no components.
export interface AppManifest {
  id: string
  path: string
  name: string
  description: string
  icon: LucideIcon
  background: string
  roles: readonly { id: string; label: string }[]
  enabled: boolean
}
