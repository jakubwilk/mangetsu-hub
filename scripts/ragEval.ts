import './loadEnv'

import * as fs from 'fs'
import * as path from 'path'

import { tutorialsChat } from '../src/apps/tutorials/server/chatConfig'
import { retrieveChunks } from '../src/server/chat/context'
import { db } from '../src/server/db'

// Retrieval guard for refactors: the same questions must put the same chunks in the context.
// `--save` records the baseline from the local DB; a plain run compares against it.

interface EvalCase {
  question: string
  previousQuestion?: string
  expected: string[]
}

interface EvalResult {
  question: string
  chunkIds: string[]
  titles: string[]
}

const CASES: EvalCase[] = [
  { question: 'Jak działa przeklęta energia?', expected: ['Przeklęta Energia'] },
  // Triggers the extra PD cost search.
  { question: 'Ile PD kosztuje zwiększenie statystyki z C do A?', expected: ['Statystyki'] },
  { question: 'Jakie są poziomy klątw?', expected: ['Poziomy Klątw'] },
  // "postów" is expanded to the "kolejk" stem by the synonyms.
  { question: 'Ile postów trzeba napisać na misji?', expected: ['Misje i Wyzwania'] },
  { question: 'Jak stworzyć własną technikę?', expected: ['Techniki'] },
  { question: 'Jakie profesje mogę wybrać?', expected: ['Profesje'] },
  { question: 'Czym są kontrakty i restrykcje?', expected: ['Kontrakty i Restrykcje'] },
  { question: 'Jak działa rozszerzenie domeny?', expected: ['Domeny'] },
  { question: 'Jakie waluty są na forum?', expected: ['Waluty'] },
  { question: 'Jak działa leczenie ran?', expected: ['System Obrażeń i Leczenie'] },
  { question: 'Jakie style walki są dostępne?', expected: ['Style Walki'] },
  { question: 'Czym są rzeczy przeklęte?', expected: ['Rzeczy Przeklęte'] },
  { question: 'Kiedy dzieje się fabuła forum?', expected: ['Fabuła Forum'] },
  // A follow-up without its own topic relies on the previous question's search.
  {
    question: 'A co mogę tam kupić?',
    previousQuestion: 'Czym jest Sklep Jujutsu?',
    expected: ['Sklep Jujutsu'],
  },
]

const BASELINE_PATH = path.join(process.cwd(), 'scripts', '.rag-eval-baseline.json')

const runCase = async ({ question, previousQuestion }: EvalCase): Promise<EvalResult> => {
  const chunks = await retrieveChunks(tutorialsChat, question, previousQuestion)
  return {
    question,
    chunkIds: chunks.map((c) => c.id),
    titles: [...new Set(chunks.map((c) => c.documentTitle))],
  }
}

const compare = (result: EvalResult, baseline: EvalResult | undefined): string | null => {
  if (!baseline) return 'brak w wyniku bazowym'
  if (result.chunkIds.join() === baseline.chunkIds.join()) return null

  const before = new Set(baseline.chunkIds)
  const after = new Set(result.chunkIds)
  if (before.size === after.size && [...after].every((id) => before.has(id))) {
    return 'te same chunki, inna kolejność'
  }
  const added = result.chunkIds.filter((id) => !before.has(id)).length
  const removed = baseline.chunkIds.filter((id) => !after.has(id)).length
  return `+${added} / -${removed} chunków (było: ${baseline.titles.join(', ')})`
}

const main = async () => {
  const save = process.argv.includes('--save')
  const baseline: EvalResult[] =
    !save && fs.existsSync(BASELINE_PATH)
      ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as EvalResult[])
      : []
  if (!save && baseline.length === 0) {
    throw new Error(`Brak wyniku bazowego — uruchom najpierw z --save (${BASELINE_PATH}).`)
  }

  const results: EvalResult[] = []
  let failures = 0

  for (const evalCase of CASES) {
    const result = await runCase(evalCase)
    results.push(result)

    const missing = evalCase.expected.filter((title) => !result.titles.includes(title))
    const diff = save
      ? null
      : compare(
          result,
          baseline.find((b) => b.question === result.question),
        )
    if (diff) failures++

    const status = diff ? 'RÓŻNICA' : 'ok'
    console.log(`  [${status}] ${result.question} → ${result.titles.join(', ')}`)
    if (missing.length) console.warn(`    Brak oczekiwanych: ${missing.join(', ')}`)
    if (diff) console.warn(`    ${diff}`)
  }

  if (save) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(results, null, 2)}\n`)
    console.log(`\nZapisano wynik bazowy: ${BASELINE_PATH}`)
    return
  }

  console.log(`\n${CASES.length - failures}/${CASES.length} identycznych z wynikiem bazowym.`)
  if (failures) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
