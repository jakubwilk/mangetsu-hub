import { embedText } from 'server/ai/embeddings'
import { db } from 'server/db'

import { SECTION_SEPARATOR } from './chunker'
import type { SearchResult } from './types'

const tokenize = (query: string): string[] =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\sÀ-ſ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)

const runFts = (app: string, tsQuery: string, limit: number) =>
  db.$queryRaw<SearchResult[]>`
    SELECT
      c.id,
      c.content,
      d.title AS "documentTitle",
      d.category,
      ts_rank(c.search_vector, to_tsquery('pg_catalog.simple', ${tsQuery})) AS rank
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    WHERE d.app = ${app} AND c.search_vector @@ to_tsquery('pg_catalog.simple', ${tsQuery})
    ORDER BY rank DESC
    LIMIT ${limit}
  `

const runTrigram = (app: string, query: string, limit: number) =>
  db.$queryRaw<SearchResult[]>`
    SELECT
      c.id,
      c.content,
      d.title AS "documentTitle",
      d.category,
      word_similarity(${query}, c.content)::float AS rank
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    WHERE d.app = ${app} AND word_similarity(${query}, c.content) > 0.1
    ORDER BY rank DESC
    LIMIT ${limit}
  `

const runEmbedding = (app: string, embedding: number[], limit: number) => {
  const vector = `[${embedding.join(',')}]`
  return db.$queryRaw<SearchResult[]>`
    SELECT
      c.id,
      c.content,
      d.title AS "documentTitle",
      d.category,
      (1 - (c.embedding <=> ${vector}::vector))::float AS rank
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    WHERE d.app = ${app} AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vector}::vector
    LIMIT ${limit}
  `
}

// Reciprocal Rank Fusion: scores by position in each list, not by raw score, so lists on
// different scales (ts_rank ~0.03 vs word_similarity ~0.2 vs cosine) can be merged fairly.
const fuseRanks = (
  lists: { results: SearchResult[]; weight: number }[],
  limit: number,
): SearchResult[] => {
  const k = 60
  const scores = new Map<string, { result: SearchResult; score: number }>()

  for (const { results, weight } of lists) {
    results.forEach((r, i) => {
      const rrfScore = weight / (k + i + 1)
      const entry = scores.get(r.id)
      if (entry) {
        entry.score += rrfScore
      } else {
        scores.set(r.id, { result: r, score: rrfScore })
      }
    })
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ result }) => result)
}

// Trigram is a fuzzy helper (typos, inflections) — half the weight of exact FTS matches.
const mergeFts = (fts: SearchResult[], trigram: SearchResult[], limit: number) =>
  fuseRanks(
    [
      { results: fts, weight: 1 },
      { results: trigram, weight: 0.5 },
    ],
    limit,
  )

// Embeddings get 2× weight: for Polish RPG content, semantic similarity is more reliable
// than keyword matching — user query words rarely appear verbatim in document text.
const mergeHybrid = (fts: SearchResult[], embedding: SearchResult[], limit: number) =>
  fuseRanks(
    [
      { results: fts, weight: 1 },
      { results: embedding, weight: 2 },
    ],
    limit,
  )

// Caps how many characters of extra context expandHits will pull in. Without this, a broad
// query whose top-5 hits span several documents can balloon the prompt to 30k+ tokens, which is
// both costly (OVH bills per token) and likely to bury the relevant fragment in noise.
const MAX_EXPANSION_CHARS = 12000

const sectionDepth = (path: string) => (path ? path.split(SECTION_SEPARATOR).length : 0)

// Groups a hit can expand to, widest first: the whole document (''), then every prefix of the
// section paths the hit touches — "Post", "Post › Section", …
const expansionGroups = (sections: string[]): string[] => {
  const prefixes = sections.flatMap((path) => {
    const parts = path.split(SECTION_SEPARATOR)
    return parts.map((_, i) => parts.slice(0, i + 1).join(SECTION_SEPARATOR))
  })
  return ['', ...new Set(prefixes)].sort((a, b) => sectionDepth(a) - sectionDepth(b))
}

const inGroup = (sections: string[], group: string) =>
  group === '' ||
  sections.some((path) => path === group || path.startsWith(`${group}${SECTION_SEPARATOR}`))

// After the hybrid merge, pull in more of the documents behind the hits. A single hit is often
// just a fragment of one section (e.g. one stat out of five in "Statystyki") — without the rest,
// the LLM only sees a partial picture and answers incompletely. Each hit, in rank order, takes
// the widest group whose missing chunks still fit the budget: its whole document, else its
// top-level section, else a subsection — so a large document still contributes the section that
// matters instead of nothing. Chunks seeded without sections expand whole or not at all.
const expandHits = async (results: SearchResult[]): Promise<SearchResult[]> => {
  if (results.length === 0) return results

  const resultIds = results.map((r) => r.id)

  const hits = await db.chunk.findMany({
    where: { id: { in: resultIds } },
    select: { id: true, documentId: true, sections: true },
  })
  const hitById = new Map(hits.map((h) => [h.id, h]))
  const documentIds = [...new Set(hits.map((h) => h.documentId))]
  if (documentIds.length === 0) return results

  const remainingChunks = await db.chunk.findMany({
    where: {
      documentId: { in: documentIds },
      id: { notIn: resultIds },
    },
    orderBy: { chunkIndex: 'asc' },
    select: {
      id: true,
      documentId: true,
      content: true,
      sections: true,
      document: { select: { title: true, category: true } },
    },
  })

  const chunksByDocument = new Map<string, typeof remainingChunks>()
  for (const chunk of remainingChunks) {
    const list = chunksByDocument.get(chunk.documentId)
    if (list) {
      list.push(chunk)
    } else {
      chunksByDocument.set(chunk.documentId, [chunk])
    }
  }

  const included = new Set<string>()
  const expanded: SearchResult[] = []
  let remainingBudget = MAX_EXPANSION_CHARS

  // findMany with `id: { in }` doesn't preserve order — walk `resultIds`, which is rank-ordered.
  for (const id of resultIds) {
    const hit = hitById.get(id)
    const docChunks = hit && chunksByDocument.get(hit.documentId)
    if (!docChunks) continue

    for (const group of expansionGroups(hit.sections)) {
      const missing = docChunks.filter((c) => !included.has(c.id) && inGroup(c.sections, group))
      const chars = missing.reduce((sum, c) => sum + c.content.length, 0)
      if (chars > remainingBudget) continue

      remainingBudget -= chars
      for (const c of missing) {
        included.add(c.id)
        expanded.push({
          id: c.id,
          content: c.content,
          documentTitle: c.document.title,
          category: c.document.category,
          rank: 0,
        })
      }
      break
    }
  }

  return [...results, ...expanded]
}

interface SearchOptions {
  app: string
  limit?: number
  // App-specific query rewriting for FTS only (e.g. synonyms); embedding and trigram see the raw query.
  expandQuery?: (query: string) => string
  // Off for supplementary searches: pulling in whole documents there buries the main question.
  expand?: boolean
}

export const searchChunks = async (
  query: string,
  { app, limit = 5, expandQuery = (q) => q, expand = true }: SearchOptions,
): Promise<SearchResult[]> => {
  const tokens = tokenize(expandQuery(query))
  if (tokens.length === 0) return []

  // Fetch more candidates than needed so RRF can boost chunks appearing in multiple sources.
  // Without this, a relevant chunk that ranks 4th in FTS and 1st in embedding never surfaces
  // when both lists are independently capped at `limit`.
  const fetchLimit = limit * 3

  // Strip 2-char Polish stopwords (na, do, ze, są…) from FTS tokens to reduce noise.
  // These match nearly every chunk and push relevant results out of the top-N window.
  // Fall back to all tokens when nothing longer is available (e.g. "co to PD").
  const specificTokens = tokens.filter((t) => t.length > 2)
  const ftsTokens = specificTokens.length > 0 ? specificTokens : tokens

  const tsAndQuery = ftsTokens.map((t) => `${t}:*`).join(' & ')
  const tsOrQuery = ftsTokens.map((t) => `${t}:*`).join(' | ')

  // FTS (AND), trigram, and embedding run in parallel.
  // Embedding is capped at 8 s — OVH cold-start can be slow and FTS+context expansion
  // provides an acceptable fallback.
  const embeddingTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
  const [andResults, trigramResults, queryEmbedding] = await Promise.all([
    runFts(app, tsAndQuery, fetchLimit).catch(() => [] as SearchResult[]),
    runTrigram(app, query, fetchLimit),
    Promise.race([embedText(query).catch(() => null), embeddingTimeout]),
  ])

  // Resolve FTS results (OR fallback if AND returned too few)
  let ftsResults: SearchResult[]
  if (andResults.length >= limit) {
    ftsResults = mergeFts(andResults, trigramResults, fetchLimit)
  } else {
    const orResults = await runFts(app, tsOrQuery, fetchLimit).catch(() => [] as SearchResult[])
    ftsResults = mergeFts(orResults, trigramResults, fetchLimit)
  }

  const finalize = (results: SearchResult[]) => (expand ? expandHits(results) : results)

  // If embedding timed out or failed, fall back to FTS + context expansion
  if (!queryEmbedding) return finalize(ftsResults.slice(0, limit))

  const embeddingResults = await runEmbedding(app, queryEmbedding, fetchLimit).catch(
    () => [] as SearchResult[],
  )

  const merged = mergeHybrid(ftsResults, embeddingResults, limit)
  return finalize(merged)
}
