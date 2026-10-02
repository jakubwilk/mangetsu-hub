import 'dotenv/config'

import * as fs from 'fs'
import * as path from 'path'

import { embedText } from '../src/server/ai/embeddings'
import { db } from '../src/server/db'
import { chunkText } from '../src/server/rag/chunker'
import { type ContentFile, parseContentPath } from './contentPath'

const CONTENT_DIR = path.join(process.cwd(), 'content')

const listMarkdownFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return listMarkdownFiles(fullPath)
    return entry.name.endsWith('.md') ? [fullPath] : []
  })

const seedDocument = async (filePath: string, { app, category, title }: ContentFile) => {
  const chunks = chunkText(fs.readFileSync(filePath, 'utf-8'))

  // Embeddings are fetched before the transaction: a slow or failing embedding call must not
  // leave the document half-written (old chunks deleted, new ones without vectors).
  const vectors: string[] = []
  for (const chunk of chunks) {
    vectors.push(`[${(await embedText(chunk.content)).join(',')}]`)
  }

  await db.$transaction(
    async (tx) => {
      const doc = await tx.document.upsert({
        where: { filePath },
        update: { app, title, category },
        create: { app, title, category, filePath },
      })

      await tx.chunk.deleteMany({ where: { documentId: doc.id } })

      for (const [i, chunk] of chunks.entries()) {
        const created = await tx.chunk.create({
          data: { documentId: doc.id, content: chunk.content, chunkIndex: chunk.chunkIndex },
          select: { id: true },
        })
        await tx.$executeRaw`UPDATE chunks SET embedding = ${vectors[i]}::vector WHERE id = ${created.id}`
      }
    },
    { timeout: 60_000 },
  )

  console.log(`  [${app}/${category}] ${title} — ${chunks.length} chunks`)
}

const main = async () => {
  console.log('Seeding content...\n')

  for (const fullPath of listMarkdownFiles(CONTENT_DIR)) {
    const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/')
    const parsed = parseContentPath(relativePath)
    if (!parsed) {
      console.warn(`  Pominięto ${relativePath} — oczekiwano content/<app>/<kategoria>/<plik>.md`)
      continue
    }
    await seedDocument(relativePath, parsed)
  }

  const docCount = await db.document.count()
  const chunkCount = await db.chunk.count()
  console.log(`\nDone. ${docCount} documents, ${chunkCount} chunks total.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
