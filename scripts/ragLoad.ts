import './loadEnv'

import * as fs from 'fs'

import { isAppId } from '../src/apps'
import { db } from '../src/server/db'
import { ingestDocument } from '../src/server/rag/ingest'

interface DumpedDocument {
  app: string
  slug: string
  title: string
  category: string
  markdown: string
  sourceUrl: string | null
}

// Ingests a `pnpm rag:dump` file — unchanged documents are skipped by their hash, so a re-run
// costs no embeddings.
const main = async () => {
  const [inFile] = process.argv.slice(2)
  if (!inFile) throw new Error('Użycie: pnpm rag:load <plik.json>')

  const documents = JSON.parse(fs.readFileSync(inFile, 'utf-8')) as DumpedDocument[]
  let changed = 0
  let failed = 0

  for (const { app, ...document } of documents) {
    const label = `${app}/${document.category}/${document.slug}`
    if (!isAppId(app)) {
      console.warn(`  [BŁĄD] ${label} — nieznana aplikacja`)
      failed++
      continue
    }
    try {
      const result = await ingestDocument({ app, ...document })
      if (result.changed) changed++
      console.log(
        `  [${result.changed ? 'ZAPISANO' : 'BEZ ZMIAN'}] ${label} — ${result.chunks} chunków`,
      )
    } catch (err) {
      console.warn(`  [BŁĄD] ${label} — ${err instanceof Error ? err.message : err}`)
      failed++
    }
  }

  console.log(
    `\nZapisano: ${changed}, bez zmian: ${documents.length - changed - failed}, błędy: ${failed}.`,
  )
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
