import { Avatar, AvatarFallback, AvatarImage } from 'common/components/ui'

import type { AdminUser } from '../../types'
import { maskEmail } from '../../utils'

interface UserIdentityProps {
  user: Pick<AdminUser, 'name' | 'email' | 'image'>
}

const UserIdentity = ({ user }: UserIdentityProps) => {
  const displayName = user.name ?? 'Bez nazwy'

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8">
        {user.image && <AvatarImage src={user.image} alt={displayName} />}
        <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{displayName}</p>
        <p className="text-muted-foreground truncate text-xs">{maskEmail(user.email)}</p>
      </div>
    </div>
  )
}

export default UserIdentity
