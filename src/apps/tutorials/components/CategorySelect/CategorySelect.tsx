import { getRagCategories } from 'apps'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'common/components/ui'

import { tutorialsManifest } from '../../manifest'

const CATEGORIES = getRagCategories(tutorialsManifest.id)

interface CategorySelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const CategorySelect = ({ id, value, onChange, disabled }: CategorySelectProps) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger id={id} className="w-full">
      <SelectValue placeholder="Wybierz kategorię" />
    </SelectTrigger>
    <SelectContent>
      {CATEGORIES.map((c) => (
        <SelectItem key={c.id} value={c.id}>
          {c.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

export default CategorySelect
