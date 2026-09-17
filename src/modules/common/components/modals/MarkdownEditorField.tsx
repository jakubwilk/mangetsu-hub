'use client'

import '@mdxeditor/editor/style.css'

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  codeBlockPlugin,
  codeMirrorPlugin,
  ConditionalContents,
  CreateLink,
  headingsPlugin,
  imagePlugin,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor'
import { useEffect } from 'react'

// Remaps @mdxeditor/editor's Radix-style CSS variables onto Mantine's dark theme tokens.
// Declared both on `body` (Radix popovers for link/table/image dialogs portal there, outside
// .mdxeditor, so they only pick up variables inherited from a shared ancestor) and on the
// editor root itself (needed to win over the library's own same-specificity `._editorRoot_*`
// rule that sets these same variables).
const MDX_EDITOR_THEME_CSS = `
  body,
  .mdxeditor.mdxeditor-theme {
    --baseBg: var(--mantine-color-body);
    --basePageBg: var(--mantine-color-body);
    --baseBase: var(--mantine-color-dark-6);
    --baseBgHover: var(--mantine-color-dark-6);
    --baseBgActive: var(--mantine-primary-color-light);
    --baseBorder: var(--mantine-color-dark-4);
    --baseBorderHover: var(--mantine-color-dark-3);
    --baseText: var(--mantine-color-text);
    --baseTextContrast: var(--mantine-color-white);
    --accentSolid: var(--mantine-primary-color-filled);
    --accentBgActive: var(--mantine-primary-color-light);
    --accentText: var(--mantine-primary-color-light-color);
    --accentTextContrast: var(--mantine-color-white);
    --radius-medium: var(--mantine-radius-default);
    --radius-base: var(--mantine-radius-sm);
    --radius-small: var(--mantine-radius-sm);
    --font-body: var(--mantine-font-family);
    --font-mono: var(--font-geist-mono);
  }
  .mdxeditor.mdxeditor-theme {
    border: 1px solid var(--mantine-color-dark-4);
    border-radius: var(--mantine-radius-default);
  }
  .mdxeditor-root-contenteditable {
    min-height: 45vh;
  }
  /* --baseBgActive also colors table cell borders (._tableEditor_* td { border: 1px solid
     var(--baseBgActive) }), so it can't be repointed to the solid brand color without turning
     every table into a colored grid. Target the toolbar buttons directly instead — higher
     specificity (class + type + pseudo-class) than the library's own class + pseudo-class rule,
     so it wins without !important. */
  .mdxeditor-toolbar button:hover,
  .mdxeditor-toolbar button:active,
  .mdxeditor-toolbar button[data-state='on'] {
    background-color: var(--mantine-primary-color-filled);
  }
  /* Popover dialogs (link/table/image) have their own nested rules re-declaring --baseBg etc.
     from these raw Radix scale variables, which beats the body-scoped overrides above for
     that specific property. Overriding the scale itself at body.dark-theme (higher specificity
     than the library's own bare ".dark-theme" selector) closes that gap without having to chase
     every dialog's own CSS-module class name. */
  body.dark-theme {
    --slate-1: var(--mantine-color-dark-8);
    --slate-2: var(--mantine-color-dark-7);
    --slate-3: var(--mantine-color-body);
    --slate-4: var(--mantine-color-dark-6);
    --slate-5: var(--mantine-primary-color-light);
    --slate-6: var(--mantine-color-dark-5);
    --slate-7: var(--mantine-color-dark-4);
    --slate-8: var(--mantine-color-dark-3);
    --slate-9: var(--mantine-color-dark-3);
    --slate-10: var(--mantine-color-dark-2);
    --slate-11: var(--mantine-color-dimmed);
    --slate-12: var(--mantine-color-white);
    --blue-1: var(--mantine-color-dark-7);
    --blue-3: var(--mantine-primary-color-light);
    --blue-4: var(--mantine-primary-color-light);
    --blue-5: var(--mantine-primary-color-light);
    --blue-7: var(--mantine-primary-color-filled);
    --blue-9: var(--mantine-primary-color-filled);
    --blue-10: var(--mantine-primary-color-filled-hover);
    --blue-11: var(--mantine-primary-color-light-color);
    --blue-12: var(--mantine-color-white);
  }
`

interface MarkdownEditorFieldProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export default function MarkdownEditorField({ value, onChange, readOnly }: MarkdownEditorFieldProps) {
  // Link/table/image dialogs portal to document.body, outside .mdxeditor, so our scoped CSS
  // variable overrides reach them, but MDXEditor's own light/dark Radix palette switch (which
  // some dialog internals depend on directly) needs the `dark-theme` class on a shared ancestor.
  useEffect(() => {
    document.body.classList.add('dark-theme')
    return () => document.body.classList.remove('dark-theme')
  }, [])

  return (
    <>
      <style>{MDX_EDITOR_THEME_CSS}</style>

      <MDXEditor
        className="mdxeditor-theme"
        markdown={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder="Zacznij pisać treść poradnika..."
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          tablePlugin(),
          imagePlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
          codeMirrorPlugin({ codeBlockLanguages: { txt: 'Text', js: 'JavaScript' } }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <ConditionalContents
                options={[
                  {
                    when: (editor) => editor?.editorType === 'codeblock',
                    contents: () => <ChangeCodeMirrorLanguage />,
                  },
                  {
                    fallback: () => (
                      <>
                        <UndoRedo />
                        <Separator />
                        <BoldItalicUnderlineToggles />
                        <BlockTypeSelect />
                        <ListsToggle />
                        <Separator />
                        <CreateLink />
                        <InsertImage />
                        <InsertTable />
                        <InsertCodeBlock />
                      </>
                    ),
                  },
                ]}
              />
            ),
          }),
        ]}
      />
    </>
  )
}
