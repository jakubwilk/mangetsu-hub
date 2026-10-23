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
  DropdownMenuItem,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'common/components/ui'
import { notifyError, notifyInfo } from 'common/utils'
import { FileText, Link2, Plus, Upload } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { type ChangeEvent, useRef, useState } from 'react'

import { type SourceSubmissionBody, type SourceType, submitSource } from '../../api'
import { CategorySelect } from '../CategorySelect'

const MarkdownEditorField = dynamic(() => import('../MarkdownEditorField/MarkdownEditorField'), {
  ssr: false,
})

const FORUM_URL = process.env.NEXT_PUBLIC_FORUM_URL?.replace(/\/+$/, '') ?? ''
// A UTF-8 character takes at most 4 bytes — anything bigger cannot fit the limit.
const MAX_FILE_BYTES = MAX_SOURCE_CHARS * 4

interface MarkdownFile {
  name: string
  // Bumped on every pick: Crepe reads only `defaultValue`, so a new file needs a new editor.
  version: number
}

interface AddSourceModalProps {
  asMenuItem?: boolean
}

const AddSourceModal = ({ asMenuItem }: AddSourceModalProps) => {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [opened, setOpened] = useState(false)
  const [type, setType] = useState<SourceType>('FORUM')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<MarkdownFile | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const overLimit = markdown.length > MAX_SOURCE_CHARS
  const hasContent = type === 'FORUM' ? url.trim() !== '' : markdown.trim() !== '' && !overLimit
  const canSubmit = !loading && category !== '' && hasContent

  const resetContent = () => {
    setUrl('')
    setFile(null)
    setMarkdown('')
  }

  const handleClose = () => {
    setOpened(false)
    setType('FORUM')
    setCategory('')
    setTitle('')
    resetContent()
  }

  const handleTypeChange = (value: string) => {
    setType(value as SourceType)
    resetContent()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0]
    // Cleared so that picking the same file again still fires `change`.
    event.currentTarget.value = ''
    if (!picked) return

    if (picked.size > MAX_FILE_BYTES) {
      notifyError(`Plik jest za duży — limit to ${MAX_SOURCE_CHARS.toLocaleString('pl')} znaków.`)
      return
    }

    try {
      setMarkdown(await picked.text())
      setFile((current) => ({ name: picked.name, version: (current?.version ?? 0) + 1 }))
    } catch {
      notifyError('Nie udało się odczytać pliku.')
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    const fields = { category, title: title.trim() || undefined }
    const body: SourceSubmissionBody =
      type === 'FORUM'
        ? { ...fields, type, url: url.trim() }
        : { ...fields, type, markdown, fileName: file?.name }

    setLoading(true)
    try {
      notifyInfo(await submitSource(body))
      handleClose()
      // ROOT's source is already in the base; an editor's waits, and the refresh costs nothing.
      router.refresh()
    } catch (err) {
      notifyError(
        err instanceof Error ? err.message : 'Nie udało się zgłosić źródła. Spróbuj ponownie.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {asMenuItem ? (
        <DropdownMenuItem
          // preventDefault keeps the menu (and this dialog inside it) mounted while the dialog opens.
          onSelect={(e) => {
            e.preventDefault()
            setOpened(true)
          }}
        >
          <Plus />
          Dodaj źródło
        </DropdownMenuItem>
      ) : (
        <Button variant="ghost" className="hidden md:inline-flex" onClick={() => setOpened(true)}>
          <Plus />
          Dodaj źródło
        </Button>
      )}

      <Dialog open={opened} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={cn(file ? 'sm:max-w-4xl' : 'sm:max-w-xl')}>
          <DialogHeader>
            <DialogTitle>Dodaj źródło</DialogTitle>
            <DialogDescription>
              Zgłoszenie trafi do administratora — po akceptacji pojawi się w bazie wiedzy.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={type} onValueChange={handleTypeChange}>
            <TabsList className="w-full">
              <TabsTrigger value="FORUM" disabled={loading}>
                <Link2 />
                Link do forum
              </TabsTrigger>
              <TabsTrigger value="MARKDOWN" disabled={loading}>
                <FileText />
                Plik Markdown
              </TabsTrigger>
            </TabsList>

            <TabsContent value="FORUM" className="flex flex-col gap-2 pt-3">
              <label htmlFor="source-url" className="text-sm font-medium">
                Link do wątku
              </label>
              <Input
                id="source-url"
                placeholder={`${FORUM_URL}/index.php?showtopic=…`}
                value={url}
                onChange={(e) => setUrl(e.currentTarget.value)}
                disabled={loading}
              />
            </TabsContent>

            <TabsContent value="MARKDOWN" className="flex flex-col gap-2 pt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <Upload />
                  {file ? 'Zmień plik' : 'Wybierz plik'}
                </Button>
                <span className="text-muted-foreground truncate text-sm">
                  {file?.name ?? 'Plik .md z treścią poradnika'}
                </span>
              </div>

              {file && (
                <>
                  <MarkdownEditorField
                    key={file.version}
                    value={markdown}
                    onChange={setMarkdown}
                    readOnly={loading}
                  />
                  <p
                    className={cn(
                      'text-right text-xs',
                      overLimit ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {markdown.length.toLocaleString('pl')} / {MAX_SOURCE_CHARS.toLocaleString('pl')}{' '}
                    znaków
                  </p>
                </>
              )}
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="source-category" className="text-sm font-medium">
                Kategoria
              </label>
              <CategorySelect
                id="source-category"
                value={category}
                onChange={setCategory}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="source-title" className="text-sm font-medium">
                Tytuł <span className="text-muted-foreground font-normal">(opcjonalnie)</span>
              </label>
              <Input
                id="source-title"
                placeholder={type === 'FORUM' ? 'Tytuł wątku' : 'Pierwszy nagłówek „# ” pliku'}
                maxLength={MAX_TITLE_LENGTH}
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleClose} disabled={loading}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              Zgłoś
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AddSourceModal
