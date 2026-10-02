import fs from 'fs/promises'
import type { Notice } from 'notices/types'
import path from 'path'

export const loadNotices = async (): Promise<Notice[]> => {
  const filePath = path.join(process.cwd(), 'docs', 'notices.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as Notice[]
}
