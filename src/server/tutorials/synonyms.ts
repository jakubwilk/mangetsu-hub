// Maps user-facing terms to canonical stems used in the tutorials.
// Only covers confirmed mismatches between how players write and how rules are written.
// Each entry appends the canonical stem — original tokens are preserved unchanged.
const SYNONYM_RULES: { pattern: RegExp; stem: string }[] = [
  // "posty/post/postów/postami" → "kolejk" (rules use "kolejki/kolejek")
  { pattern: /\bpost(a|y|ów|em|ami|ach|owi|cie)?\b/i, stem: 'kolejk' },
  // "tura/tury" → "kolejk" (tura = turn in fight/challenge, rules use "kolejka")
  { pattern: /\b(tura?|tury|turze|turę|turą|turami|turach)\b/i, stem: 'kolejk' },
  // "runda/rundy" → "kolejk" (runda = round, same concept)
  { pattern: /\b(runda?|rundy|rundzie|rundę|rundą|rundami|rundach)\b/i, stem: 'kolejk' },
  // "rodzaj/typ" → "poziom" (rules describe tiers as "poziomy", e.g. "Poziomy Klątw")
  { pattern: /\b(rodzaj(e|ów|u|ami|ach)?|typ(y|ów|u|ami|ach)?)\b/i, stem: 'poziom' },
]

export const expandWithSynonyms = (query: string): string => {
  const toAppend = new Set<string>()
  for (const { pattern, stem } of SYNONYM_RULES) {
    if (pattern.test(query)) toAppend.add(stem)
  }
  return toAppend.size > 0 ? `${query} ${[...toAppend].join(' ')}` : query
}
