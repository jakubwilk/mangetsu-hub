'use client'

import { cn } from 'cn'
import {
  Button,
  Dialog,
  DialogContent,
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
import { FileText, Link2, Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'

import { type SourceMethod, submitSource } from '../../api'

const MarkdownEditorField = dynamic(() => import('../MarkdownEditorField/MarkdownEditorField'), {
  ssr: false,
})

// The feature is switched off until the n8n ingestion flow is ready — flip this to enable it.
const ENABLED = false

interface AddSourceModalProps {
  asMenuItem?: boolean
}

const AddSourceModal = ({ asMenuItem }: AddSourceModalProps) => {
  const [opened, setOpened] = useState(false)
  const [method, setMethod] = useState<SourceMethod>('URL')
  const [data, setData] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setOpened(false)
    setMethod('URL')
    setData('')
  }

  const handleMethodChange = (value: string) => {
    setMethod(value as SourceMethod)
    setData('')
  }

  const handleSubmit = async () => {
    if (!data.trim()) return

    setLoading(true)
    try {
      notifyInfo(await submitSource(method, data.trim()))
      handleClose()
    } catch (err) {
      notifyError(
        err instanceof Error ? err.message : 'Nie udało się dodać źródła. Spróbuj ponownie.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {asMenuItem ? (
        <DropdownMenuItem
          disabled={!ENABLED}
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
        <Button
          variant="ghost"
          className="hidden md:inline-flex"
          disabled={!ENABLED}
          onClick={() => setOpened(true)}
        >
          <Plus />
          Dodaj źródło
        </Button>
      )}

      <Dialog open={opened} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={cn(method === 'CONTENT' ? 'sm:max-w-4xl' : 'sm:max-w-xl')}>
          <DialogHeader>
            <DialogTitle>Dodaj źródło</DialogTitle>
          </DialogHeader>

          <Tabs value={method} onValueChange={handleMethodChange}>
            <TabsList className="w-full">
              <TabsTrigger value="URL">
                <Link2 />
                Link do forum
              </TabsTrigger>
              <TabsTrigger value="CONTENT">
                <FileText />
                Treść ręczna (Markdown)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="URL" className="flex flex-col gap-2 pt-3">
              <label htmlFor="source-url" className="text-sm font-medium">
                URL wątku
              </label>
              <Input
                id="source-url"
                placeholder="https://mangetsu.pl/viewtopic.php?t=..."
                value={data}
                onChange={(e) => setData(e.currentTarget.value)}
                disabled={loading}
              />
            </TabsContent>

            {/* Radix unmounts inactive tabs; Crepe only reads `defaultValue` at mount time,
                so the reset (setData('')) on tab switch/close actually clears it. */}
            <TabsContent value="CONTENT" className="pt-3">
              <MarkdownEditorField value={data} onChange={setData} readOnly={loading} />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={handleClose} disabled={loading}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !data.trim()}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AddSourceModal
