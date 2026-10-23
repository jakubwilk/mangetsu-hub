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

import type { DocumentRow } from '../../api'

interface DeleteDocumentModalProps {
  document: DocumentRow | null
  isRoot: boolean
  loading: boolean
  onClose: () => void
  onConfirm: (slug: string) => void
}

const DeleteDocumentModal = ({
  document,
  isRoot,
  loading,
  onClose,
  onConfirm,
}: DeleteDocumentModalProps) => (
  <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Usuń dokument</DialogTitle>
        <DialogDescription>
          {isRoot
            ? 'Dokument i jego fragmenty zostaną trwale usunięte z bazy wiedzy.'
            : 'Prośba o usunięcie trafi do administratora — dokument zniknie po akceptacji.'}
        </DialogDescription>
      </DialogHeader>

      {document && (
        <p className="text-sm">
          <strong>{document.title}</strong>
          {document.sourceUrl && (
            <span className="text-muted-foreground">
              {' '}
              — wątek na forum zostaje, nocna synchronizacja go nie przywróci.
            </span>
          )}
        </p>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Anuluj
        </Button>
        <Button
          variant="destructive"
          disabled={!document || loading}
          onClick={() => document && onConfirm(document.slug)}
        >
          {isRoot ? 'Usuń' : 'Poproś o usunięcie'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export default DeleteDocumentModal
