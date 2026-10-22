import './loadEnv'

import * as fs from 'fs'

import { db } from '../src/server/db'

// Knowledge base without vectors — `pnpm rag:load` rebuilds chunks and embeddings from it,
// e.g. to fill a local database from production.
const main = async () => {
  const [outFile] = process.argv.slice(2)
  if (!outFile) throw new Error('Użycie: pnpm rag:dump <plik.json>')

  const documents = await db.document.findMany({
    where: { slug: { not: null }, markdown: { not: null } },
    orderBy: [{ app: 'asc' }, { slug: 'asc' }],
    select: { app: true, slug: true, title: true, category: true, markdown: true, sourceUrl: true },
  })

  fs.writeFileSync(outFile, `${JSON.stringify(documents, null, 2)}\n`)
  console.log(`Zapisano ${documents.length} dokumentów do ${outFile}.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
