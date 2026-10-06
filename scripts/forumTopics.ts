export interface ForumTopic {
  topic: number
  category: string
  slug: string
}

// Forum threads behind content/tutorials/<category>/<slug>.md — keep in sync with
// docs/tutorials/documents-info.md, which lists the same threads for users.
export const FORUM_TOPICS: ForumTopic[] = [
  { topic: 2, category: 'realia', slug: 'fabula-forum' },
  { topic: 3, category: 'realia', slug: 'linia-czasu' },
  { topic: 4, category: 'realia', slug: 'mangetsu' },
  { topic: 35, category: 'kompendium', slug: 'domeny' },
  { topic: 85, category: 'kompendium', slug: 'kontrakty-i-restrykcje' },
  { topic: 50, category: 'kompendium', slug: 'kregi-czarownikow' },
  { topic: 49, category: 'kompendium', slug: 'poziomy-klatw' },
  { topic: 20, category: 'kompendium', slug: 'przekleta-energia' },
  { topic: 36, category: 'kompendium', slug: 'standardowy-czarownik-jujutsu' },
  { topic: 436, category: 'mechanika', slug: 'ekwipunek' },
  { topic: 44, category: 'mechanika', slug: 'misje-i-wyzwania' },
  { topic: 38, category: 'mechanika', slug: 'profesje' },
  { topic: 472, category: 'mechanika', slug: 'rzeczy-przeklete' },
  { topic: 39, category: 'mechanika', slug: 'sklep-jujutsu' },
  { topic: 15, category: 'mechanika', slug: 'statystyki' },
  { topic: 37, category: 'mechanika', slug: 'style-walki' },
  { topic: 40, category: 'mechanika', slug: 'system-obrażeń-i-leczenie' },
  { topic: 42, category: 'mechanika', slug: 'system-walki' },
  { topic: 43, category: 'mechanika', slug: 'techniki' },
  { topic: 41, category: 'mechanika', slug: 'waluty' },
]
