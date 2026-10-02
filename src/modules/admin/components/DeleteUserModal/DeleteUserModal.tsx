'use client'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from 'common/components/ui'
import { useState } from 'react'

import type { AdminUser } from '../../types'
import { UserIdentity } from '../UserIdentity'

interface DeleteUserModalProps {
  user: AdminUser | null
  loading: boolean
  onClose: () => void
  onConfirm: (userId: string, notify: boolean) => void
}

const DeleteUserModal = ({ user, loading, onClose, onConfirm }: DeleteUserModalProps) => {
  const [notify, setNotify] = useState(false)

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuń użytkownika</DialogTitle>
          <DialogDescription>
            Tej operacji nie można cofnąć. Konto, sesje, role, historia czatów i limity zapytań tego
            użytkownika zostaną trwale usunięte.
          </DialogDescription>
        </DialogHeader>

        {user && <UserIdentity user={user} />}

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={notify} onCheckedChange={setNotify} />
          Wyślij powiadomienie
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Anuluj
          </Button>
          <Button
            variant="destructive"
            disabled={!user || loading}
            onClick={() => user && onConfirm(user.id, notify)}
          >
            Usuń
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteUserModal
