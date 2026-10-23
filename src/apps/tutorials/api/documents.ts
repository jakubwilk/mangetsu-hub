import { requestJson } from 'common/api'

export interface DocumentRow {
  slug: string
  title: string
  category: string
  sourceUrl: string | null
  updatedAt: string
  chunks: number
}

export interface StoredDocument extends DocumentRow {
  markdown: string
}

// A forum document takes no `markdown` — its text comes from the topic (`refresh`).
export interface DocumentEditBody {
  title: string
  category: string
  markdown?: string
  refresh?: boolean
}

const documentUrl = (slug: string) => `/api/tutorials/documents/${encodeURIComponent(slug)}`

export const fetchDocument = async (slug: string): Promise<StoredDocument> => {
  const { document } = await requestJson<{ document: StoredDocument }>(
    documentUrl(slug),
    {},
    'Nie udało się wczytać dokumentu.',
  )
  return document
}

export const saveDocument = async (slug: string, body: DocumentEditBody): Promise<string> => {
  const { message } = await requestJson<{ message?: string }>(
    documentUrl(slug),
    { method: 'PATCH', body },
    'Nie udało się zapisać dokumentu.',
  )
  return message ?? ''
}

export const removeDocument = async (slug: string): Promise<string> => {
  const { message } = await requestJson<{ message?: string }>(
    documentUrl(slug),
    { method: 'DELETE' },
    'Nie udało się usunąć dokumentu.',
  )
  return message ?? ''
}
