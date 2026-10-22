import type { LucideIcon } from 'lucide-react'

export interface RagCategory {
  id: string
  label: string
}

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
  // Apps with a RAG knowledge base: document categories, in display order.
  rag?: { categories: readonly RagCategory[] }
}
