'use client'

import { MilkdownProvider } from '@milkdown/react'

import { CrepeEditor, type CrepeEditorProps } from '../CrepeEditor'

const MarkdownEditorField = (props: CrepeEditorProps) => (
  <MilkdownProvider>
    <CrepeEditor {...props} />
  </MilkdownProvider>
)

export default MarkdownEditorField
