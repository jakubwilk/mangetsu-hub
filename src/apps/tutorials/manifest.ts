import { BookOpen } from 'lucide-react'

import type { AppManifest } from '../types'

export const tutorialsManifest = {
  id: 'tutorials',
  path: '/tutorials',
  name: 'Poradniki',
  description: 'Asystent AI odpowiadający na pytania o zasady, mechaniki i realia forum.',
  icon: BookOpen,
  background: '/apps/tutorials/bg.png',
  roles: [
    { id: 'USER', label: 'Użytkownik' },
    { id: 'EDITOR', label: 'Redaktor' },
  ],
  enabled: true,
} as const satisfies AppManifest
