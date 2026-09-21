'use client'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'

import { Crepe } from '@milkdown/crepe'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { notifyError } from 'common/utils'
import { useEffect, useRef } from 'react'

interface MarkdownEditorFieldProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

// The block/inline "Upload file" affordance defaults to embedding a session-scoped
// `blob:` URL as literal markdown, which is dead on reload and for every other viewer.
// Pasting an image URL (unaffected by this handler) stays the supported path.
const rejectImageUpload = (): Promise<string> => {
  notifyError('Wklej link do obrazka — przesyłanie plików nie jest obsługiwane.')
  return Promise.reject(new Error('Image upload is not supported'))
}

function CrepeEditor({ value, onChange, readOnly }: MarkdownEditorFieldProps) {
  const crepeRef = useRef<Crepe>(undefined)
  const onChangeRef = useRef(onChange)

  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: value,
      features: {
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.TopBar]: true,
        [Crepe.Feature.Latex]: false,
      },
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: { onUpload: rejectImageUpload },
        [Crepe.Feature.Placeholder]: { text: 'Zacznij pisać treść poradnika...' },
        [Crepe.Feature.TopBar]: {
          buildTopBar: (builder) => {
            const formatting = builder.getGroup('formatting')
            formatting.group.items = formatting.group.items.filter(
              (item) => item.key !== 'strikethrough',
            )

            const block = builder.getGroup('block')
            block.group.items = block.group.items.filter((item) => item.key !== 'code-block')
          },
        },
      },
    })

    crepeRef.current = crepe
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) onChangeRef.current(markdown)
      })
    })

    return crepe
  }, [])

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    crepeRef.current?.setReadonly(!!readOnly)
  }, [readOnly])

  return (
    <div className="milkdown-editor max-h-150 min-h-64 overflow-y-auto">
      <Milkdown />
    </div>
  )
}

export default function MarkdownEditorField(props: MarkdownEditorFieldProps) {
  return (
    <MilkdownProvider>
      <CrepeEditor {...props} />
    </MilkdownProvider>
  )
}
