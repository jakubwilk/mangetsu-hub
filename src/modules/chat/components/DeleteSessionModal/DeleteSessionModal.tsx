'use client'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'common/components/ui'

import type { ChatSession } from '../../types'

interface DeleteSessionModalProps {
  session: ChatSession | null
  preview: string
  loading: boolean
  onClose: () => void
  onConfirm: (sessionId: string) => void
}

const DeleteSessionModal = ({
  session,
  preview,
  loading,
  onClose,
  onConfirm,
}: DeleteSessionModalProps) => (
  <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Usuń czat</DialogTitle>
        <DialogDescription>
          Czat „{preview}” zostanie trwale usunięty. Tej operacji nie można cofnąć. Dzienny limit
          zapytań pozostaje bez zmian.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Anuluj
        </Button>
        <Button
          variant="destructive"
          disabled={!session || loading}
          onClick={() => session && onConfirm(session.id)}
        >
          Usuń
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export default DeleteSessionModal
