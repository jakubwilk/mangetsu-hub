'use client'

import type { App } from 'common/apps'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'common/components/ui'

// Radix Select can't hold an empty value, so "no access" needs a sentinel.
const NO_ACCESS = '__none__'

interface AppRoleSelectProps {
  app: App
  value: string | undefined
  disabled: boolean
  onChange: (role: string | null) => void
}

const AppRoleSelect = ({ app, value, disabled, onChange }: AppRoleSelectProps) => (
  <Select
    value={value ?? NO_ACCESS}
    onValueChange={(next) => onChange(next === NO_ACCESS ? null : next)}
    disabled={disabled}
  >
    <SelectTrigger size="sm" className="w-40" aria-label={`Rola: ${app.name}`}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={NO_ACCESS}>Brak dostępu</SelectItem>
      {app.roles.map((role) => (
        <SelectItem key={role.id} value={role.id}>
          {role.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

export default AppRoleSelect
