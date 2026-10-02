import { type AppId, isAppId } from '../src/modules/common/apps'

export interface ContentFile {
  app: AppId
  category: string
  title: string
}

// "content/<app>/<category>/<slug>.md" → app, category and a human title from the slug.
export const parseContentPath = (relativePath: string): ContentFile | null => {
  const parts = relativePath.replace(/\\/g, '/').split('/')
  if (parts.length !== 4 || parts[0] !== 'content') return null

  const [, app, category, file] = parts as [string, string, string, string]
  if (!isAppId(app) || !file.endsWith('.md')) return null

  const title = file
    .slice(0, -'.md'.length)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return { app, category, title }
}
