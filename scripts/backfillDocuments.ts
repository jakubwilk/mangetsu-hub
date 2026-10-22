import './loadEnv'

import * as fs from 'fs'
import * as path from 'path'

import { db } from '../src/server/db'
import { type Chunk, chunkText } from '../src/server/rag/chunker'
import { hashContent } from '../src/server/rag/ingest'
import { normalizeMarkdown } from '../src/server/rag/normalize'
import { canonicalTopicUrl } from '../src/server/rag/sources/forum'
import { parseContentPath } from './contentPath'
import { FORUM_TOPICS } from './forumTopics'

// One-off move of content/ into the database: each document gets its markdown, hash, slug and
// forum link, while its chunks (and their ids and vectors) stay exactly as they are.
const CONTENT_DIR = path.join(process.cwd(), 'content')
const TITLE = /^# (.+)$/m
const dryRun = process.argv.includes('--dry-run')

const listMarkdownFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return listMarkdownFiles(fullPath)
    return entry.name.endsWith('.md') ? [fullPath] : []
  })

const sameChunks = (expected: Chunk[], stored: Chunk[]) =>
  expected.length === stored.length &&
  expected.every(
    (chunk, i) =>
      chunk.content === stored[i]!.content &&
      chunk.chunkIndex === stored[i]!.chunkIndex &&
      chunk.sections.join('\n') === stored[i]!.sections.join('\n'),
  )

const main = async () => {
  console.log(`Backfilling documents${dryRun ? ' (dry run — nothing is written)' : ''}...\n`)
  let written = 0
  let unchanged = 0
  let failed = 0

  for (const fullPath of listMarkdownFiles(CONTENT_DIR)) {
    const filePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/')
    const parsed = parseContentPath(filePath)
    const raw = fs.readFileSync(fullPath, 'utf-8')
    const title = raw.match(TITLE)?.[1]?.trim()
    const doc = await db.document.findUnique({
      where: { filePath },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          select: { content: true, chunkIndex: true, sections: true },
        },
      },
    })

    if (!parsed || !title || !doc || doc.app !== parsed.app) {
      console.warn(`  [BŁĄD] ${filePath} — brak dokumentu w bazie, tytułu "#" albo inna apka`)
      failed++
      continue
    }

    const markdown = normalizeMarkdown(raw, title)
    // A different chunking would mean the stored chunks no longer match the stored text.
    if (!sameChunks(chunkText(markdown), doc.chunks)) {
      console.warn(`  [BŁĄD] ${filePath} — chunki w bazie różnią się od treści pliku, pominięto`)
      failed++
      continue
    }

    const slug = path.basename(filePath, '.md')
    const topic = FORUM_TOPICS.find((t) => t.slug === slug && t.category === parsed.category)
    const data = {
      slug,
      title,
      markdown,
      contentHash: hashContent(markdown),
      sourceUrl: topic ? canonicalTopicUrl(topic.topic) : null,
    }

    const upToDate = (Object.keys(data) as (keyof typeof data)[]).every((k) => doc[k] === data[k])
    if (upToDate) {
      unchanged++
      continue
    }

    if (!dryRun) await db.document.update({ where: { id: doc.id }, data })
    written++
    const retitled = doc.title === title ? '' : ` (tytuł: „${doc.title}” → „${title}”)`
    console.log(`  [${dryRun ? 'DO ZAPISU' : 'ZAPISANO'}] ${parsed.category}/${slug}${retitled}`)
  }

  const withoutSlug = await db.document.count({ where: { slug: null } })
  console.log(
    `\n${dryRun ? 'Do zapisu' : 'Zapisano'}: ${written}, bez zmian: ${unchanged}, błędy: ${failed}.`,
  )
  console.log(`Dokumenty bez sluga w bazie: ${withoutSlug}${dryRun ? ' (przed zapisem)' : ''}.`)
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
