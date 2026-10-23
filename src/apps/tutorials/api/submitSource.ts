import { requestJson } from 'common/api'

export type SourceType = 'FORUM' | 'MARKDOWN'

interface SourceFields {
  category: string
  title?: string
}

export type SourceSubmissionBody =
  | (SourceFields & { type: 'FORUM'; url: string })
  | (SourceFields & { type: 'MARKDOWN'; markdown: string; fileName?: string })

export const submitSource = async (body: SourceSubmissionBody): Promise<string> => {
  const { message } = await requestJson<{ message?: string }>(
    '/api/tutorials/sources',
    { method: 'POST', body },
    'Nie udało się zgłosić źródła.',
  )
  return message ?? ''
}
