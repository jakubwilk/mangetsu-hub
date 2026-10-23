'use client'

import { MAX_SOURCE_CHARS, MAX_TITLE_LENGTH } from 'apps'
import { cn } from 'cn'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
} from 'common/components/ui'
import { notifyError, notifyInfo } from 'common/utils'
import { LoaderCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { type DocumentEditBody, fetchDocument, saveDocument, type StoredDocument } from '../../api'
import { CategorySelect } from '../CategorySelect'

const MarkdownEditorField = dynamic(() => import('../MarkdownEditorField/MarkdownEditorField'), {
  ssr: false,
})

// Mounted per document (keyed by slug), so every edit starts from freshly loaded text.
interface EditDocumentModalProps {
  slug: string
  isRoot: boolean
  onClose: () => void
}

const EditDocumentModal = ({ slug, isRoot, onClose }: EditDocumentModalProps) => {
  const router = useRouter()

  const [document, setDocument] = useState<StoredDocument | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [refresh, setRefresh] = useState(false)
  const [saving, setSaving] = useState(false)

  const isForum = !!document?.sourceUrl
  const overLimit = markdown.length > MAX_SOURCE_CHARS
  const dirty =
    !!document &&
    (title.trim() !== document.title ||
      category !== document.category ||
      refresh ||
      markdown !== document.markdown)
  const canSave = dirty && !saving && title.trim() !== '' && !overLimit

  const handleSave = async () => {
    if (!document || !canSave) return

    const fields = { title: title.trim(), category }
    const body: DocumentEditBody = isForum ? { ...fields, refresh } : { ...fields, markdown }

    setSaving(true)
    try {
      notifyInfo(await saveDocument(document.slug, body))
      onClose()
      router.refresh()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Nie udało się zapisać dokumentu.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    let active = true
    fetchDocument(slug)
      .then((loaded) => {
        if (!active) return
        setDocument(loaded)
        setTitle(loaded.title)
        setCategory(loaded.category)
        setMarkdown(loaded.markdown)
      })
      .catch((err: unknown) => {
        if (!active) return
        notifyError(err instanceof Error ? err.message : 'Nie udało się wczytać dokumentu.')
        onClose()
      })
    return () => {
      active = false
    }
  }, [slug, onClose])

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className={cn(document && !isForum ? 'sm:max-w-4xl' : 'sm:max-w-xl')}>
        <DialogHeader>
          <DialogTitle>Edytuj dokument</DialogTitle>
          <DialogDescription>
            {isRoot
              ? 'Zmiany trafią do bazy wiedzy od razu po zapisaniu.'
              : 'Zmiana trafi do administratora — po akceptacji pojawi się w bazie wiedzy.'}
          </DialogDescription>
        </DialogHeader>

        {!document ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Wczytywanie dokumentu…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="document-title" className="text-sm font-medium">
                  Tytuł
                </label>
                <Input
                  id="document-title"
                  maxLength={MAX_TITLE_LENGTH}
                  value={title}
                  onChange={(e) => setTitle(e.currentTarget.value)}
                  disabled={saving}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="document-category" className="text-sm font-medium">
                  Kategoria
                </label>
                <CategorySelect
                  id="document-category"
                  value={category}
                  onChange={setCategory}
                  disabled={saving}
                />
              </div>
            </div>

            {isForum ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Treść pochodzi z{' '}
                  <a
                    href={document.sourceUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-mangetsu-4 underline"
                  >
                    wątku na forum
                  </a>{' '}
                  — poprawiaj ją na forum. Nocna synchronizacja wczytuje zmiany sama.
                </p>
                <label className="flex items-center gap-2">
                  <Switch checked={refresh} onCheckedChange={setRefresh} disabled={saving} />
                  Pobierz aktualną treść z forum teraz
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <MarkdownEditorField value={markdown} onChange={setMarkdown} readOnly={saving} />
                <p
                  className={cn(
                    'text-right text-xs',
                    overLimit ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {markdown.length.toLocaleString('pl')} / {MAX_SOURCE_CHARS.toLocaleString('pl')}{' '}
                  znaków
                </p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <LoaderCircle className="animate-spin" />}
            {isRoot ? 'Zapisz' : 'Zgłoś zmianę'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditDocumentModal
