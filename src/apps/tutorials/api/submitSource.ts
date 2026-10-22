import { requestJson } from 'common/api'

export type SourceMethod = 'URL' | 'CONTENT'

export const submitSource = async (method: SourceMethod, data: string): Promise<string> => {
  const { message } = await requestJson<{ message?: string }>(
    '/api/tutorials/sources',
    { method: 'POST', body: { method, data } },
    'Nie udało się dodać źródła.',
  )
  return message ?? ''
}
