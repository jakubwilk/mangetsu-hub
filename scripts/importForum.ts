import './loadEnv'

import * as fs from 'fs'
import * as path from 'path'

import { topicHtmlToMarkdown } from './forumToMarkdown'
import { FORUM_TOPICS } from './forumTopics'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'tutorials')

// The printable version holds every post of the topic on one page, without the forum skin.
const printableUrl = (forumUrl: string, topic: number) =>
  new URL(`index.php?act=Print&client=printer&t=${topic}`, forumUrl)

const main = async () => {
  const forumUrl = process.env.NEXT_PUBLIC_FORUM_URL
  if (!forumUrl) throw new Error('Brak NEXT_PUBLIC_FORUM_URL — adresu forum.')

  const requested = process.argv.slice(2).map(Number)
  const topics = requested.length
    ? FORUM_TOPICS.filter(({ topic }) => requested.includes(topic))
    : FORUM_TOPICS
  const unknown = requested.filter((id) => !FORUM_TOPICS.some(({ topic }) => topic === id))
  if (unknown.length)
    throw new Error(`Nieznane wątki: ${unknown.join(', ')} (scripts/forumTopics.ts)`)

  console.log('Importing forum topics...\n')

  for (const { topic, category, slug } of topics) {
    const res = await fetch(printableUrl(forumUrl, topic))
    if (!res.ok) throw new Error(`Wątek ${topic}: HTTP ${res.status}`)

    const { markdown, posts, untitled } = topicHtmlToMarkdown(await res.text())
    const filePath = path.join(CONTENT_DIR, category, `${slug}.md`)
    fs.writeFileSync(filePath, markdown)

    console.log(`  [${category}] ${slug} — ${posts} posts`)
    if (untitled > 0) console.warn(`    Pominięto ${untitled} post(y) bez tytułu/treści w BBCode.`)
  }

  console.log('\nDone. Review the changes with `git diff content/` before seeding.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
