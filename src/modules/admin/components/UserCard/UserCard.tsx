'use client'

import { type AppId, APPS, ROOT_LABEL } from 'common/apps'
import { Badge, Button, Card } from 'common/components/ui'
import { Trash2 } from 'lucide-react'

import type { AdminUser } from '../../types'
import { AppRoleSelect } from '../AppRoleSelect'
import { UserIdentity } from '../UserIdentity'

interface UserCardProps {
  user: AdminUser
  pendingApp: AppId | null
  onRoleChange: (app: AppId, role: string | null) => void
  onDelete: () => void
}

const UserCard = ({ user, pendingApp, onRoleChange, onDelete }: UserCardProps) => (
  <Card className="gap-3 p-3">
    <div className="flex items-start justify-between gap-2">
      <UserIdentity user={user} />
      {!user.isRoot && (
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Usuń użytkownika">
          <Trash2 className="text-destructive" />
        </Button>
      )}
    </div>

    {user.isRoot ? (
      <Badge className="w-fit">{ROOT_LABEL}</Badge>
    ) : (
      APPS.map((app) => (
        <div key={app.id} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-sm">{app.name}</span>
          <AppRoleSelect
            app={app}
            value={user.apps[app.id]}
            disabled={pendingApp === app.id}
            onChange={(role) => onRoleChange(app.id, role)}
          />
        </div>
      ))
    )}

    <p className="text-muted-foreground text-right text-xs">
      Dołączył {new Date(user.createdAt).toLocaleDateString('pl-PL')}
    </p>
  </Card>
)

export default UserCard
