import type { RagChatConfig } from 'server/chat'

import { TUTORIALS_APP } from './access'
import { buildSystemPrompt, buildUserMessage } from './prompts'
import { expandWithSynonyms } from './synonyms'

const STAT_ADVANCEMENT_PATTERN =
  /zwi[eę]kszy[ćc]|ulepsz|awanso|wykupi[ćc]|rozwin|podbij|podnie[sś][ćc]|rang[aąię]|poziom|statystyk[aąię]/i

// Advancement questions need the PD cost tables and the rules for summing them.
const needsCostContext = (query: string) => STAT_ADVANCEMENT_PATTERN.test(query)

export const tutorialsChat: RagChatConfig<typeof TUTORIALS_APP> = {
  app: TUTORIALS_APP,
  roles: ['USER', 'EDITOR'],
  buildSystemPrompt: (query) => buildSystemPrompt(needsCostContext(query)),
  buildUserMessage,
  expandQuery: expandWithSynonyms,
  extraSearches: (query) =>
    needsCostContext(query) ? ['koszt PD sklep wykupienie statystyki'] : [],
}
