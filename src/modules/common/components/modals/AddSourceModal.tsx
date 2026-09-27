'use client'

import { Button, Group, Menu, Modal, Stack, Tabs, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconLink, IconMarkdown, IconPlus } from '@tabler/icons-react'
import type { SourceMethod } from 'common/api'
import { submitSource } from 'common/api'
import { notifyError, notifyInfo } from 'common/utils'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const MarkdownEditorField = dynamic(() => import('./MarkdownEditorField'), { ssr: false })

interface AddSourceModalProps {
  asMenuItem?: boolean
}

export default function AddSourceModal({ asMenuItem }: AddSourceModalProps) {
  const [opened, { open, close }] = useDisclosure(false)
  const [method, setMethod] = useState<SourceMethod>('URL')
  const [data, setData] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    close()
    setMethod('URL')
    setData('')
  }

  const handleMethodChange = (value: string | null) => {
    if (!value) return
    setMethod(value as SourceMethod)
    setData('')
  }

  const handleSubmit = async () => {
    if (!data.trim()) return

    setLoading(true)
    try {
      const message = await submitSource(method, data.trim())
      notifyInfo(message)
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
        <Menu.Item leftSection={<IconPlus size={16} />} onClick={open} hiddenFrom="md" disabled>
          Dodaj źródło
        </Menu.Item>
      ) : (
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconPlus size={16} />}
          onClick={open}
          visibleFrom="md"
          disabled
        >
          Dodaj źródło
        </Button>
      )}

      <Modal
        opened={opened}
        onClose={handleClose}
        title="Dodaj źródło"
        centered
        size={method === 'CONTENT' ? 'xl' : 'lg'}
        yOffset={method === 'CONTENT' ? '3dvh' : undefined}
      >
        <Stack gap="lg">
          <Tabs value={method} onChange={handleMethodChange}>
            <Tabs.List grow>
              <Tabs.Tab value="URL" leftSection={<IconLink size={16} />}>
                Link do forum
              </Tabs.Tab>
              <Tabs.Tab value="CONTENT" leftSection={<IconMarkdown size={16} />}>
                Treść ręczna (Markdown)
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="URL" pt="md">
              <TextInput
                label="URL wątku"
                placeholder="https://mangetsu.pl/viewtopic.php?t=..."
                leftSection={<IconLink size={16} />}
                value={data}
                onChange={(e) => setData(e.currentTarget.value)}
                disabled={loading}
              />
            </Tabs.Panel>

            {/* keepMounted=false: Crepe only reads `defaultValue` at mount time, so the panel
                must unmount on tab switch/close for the reset (setData('')) to actually clear it. */}
            <Tabs.Panel value="CONTENT" pt="md" keepMounted={false}>
              <MarkdownEditorField value={data} onChange={setData} readOnly={loading} />
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={handleClose} disabled={loading}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} loading={loading} disabled={!data.trim()}>
              Zapisz
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
