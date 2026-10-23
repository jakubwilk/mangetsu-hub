'use client'

import { getRagCategories } from 'apps'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'common/components/ui'
import { notifyError, notifyInfo } from 'common/utils'
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Fragment, useCallback, useState } from 'react'

import { type DocumentRow, removeDocument } from '../../api'
import { tutorialsManifest } from '../../manifest'
import { DeleteDocumentModal } from '../DeleteDocumentModal'
import { EditDocumentModal } from '../EditDocumentModal'

const COLUMNS = 5

interface DocumentsTableProps {
  documents: DocumentRow[]
  isRoot: boolean
}

const DocumentsTable = ({ documents, isRoot }: DocumentsTableProps) => {
  const router = useRouter()

  const [editSlug, setEditSlug] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const groups = getRagCategories(tutorialsManifest.id)
    .map((category) => ({
      ...category,
      documents: documents
        .filter((document) => document.category === category.id)
        .sort((a, b) => a.title.localeCompare(b.title, 'pl')),
    }))
    .filter((group) => group.documents.length > 0)

  const closeEdit = useCallback(() => setEditSlug(null), [])

  const handleDeleteConfirm = async (slug: string) => {
    setDeleting(true)
    try {
      notifyInfo(await removeDocument(slug))
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Nie udało się usunąć dokumentu.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tytuł</TableHead>
            <TableHead className="hidden md:table-cell">Źródło</TableHead>
            <TableHead className="hidden md:table-cell">Zmieniono</TableHead>
            <TableHead className="hidden text-right md:table-cell">Fragmenty</TableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <Fragment key={group.id}>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMNS}
                  className="text-muted-foreground pt-6 text-xs font-semibold uppercase"
                >
                  {group.label}
                </TableCell>
              </TableRow>
              {group.documents.map((document) => (
                <TableRow key={document.slug}>
                  <TableCell className="font-medium whitespace-normal">{document.title}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {document.sourceUrl ? (
                      <a
                        href={document.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mangetsu-4 inline-flex items-center gap-1 hover:underline"
                      >
                        Forum
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Plik</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {new Date(document.updatedAt).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-right md:table-cell">
                    {document.chunks}
                  </TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditSlug(document.slug)}
                          aria-label="Edytuj"
                        >
                          <Pencil />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edytuj</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(document)}
                          aria-label="Usuń"
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Usuń</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
          {groups.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS} className="text-muted-foreground py-8 text-center">
                Baza wiedzy jest pusta.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {editSlug && (
        <EditDocumentModal key={editSlug} slug={editSlug} isRoot={isRoot} onClose={closeEdit} />
      )}
      <DeleteDocumentModal
        document={deleteTarget}
        isRoot={isRoot}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}

export default DocumentsTable
