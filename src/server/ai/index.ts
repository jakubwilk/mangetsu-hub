import OpenAI from 'openai'

import { normalizeEndpoint } from './endpoint'
import { type ChatProvider, streamWithFallback } from './fallback'
import { requireModel } from './model'

// Shared fallback client — used directly by guardrails.ts, and as the automatic
// fallback client for chat when the primary (LLM_MAIN_AI) fails.
export const openai = new OpenAI({
  apiKey: process.env.LLM_FALLBACK_AI_API_KEY,
  baseURL: normalizeEndpoint(process.env.LLM_FALLBACK_AI_ENDPOINT),
})

// Placeholder instead of '' / undefined: `new OpenAI()` throws at import time without an
// apiKey, which would crash the whole app at startup rather than fail per-request.
const llmClient = new OpenAI({
  apiKey: process.env.LLM_MAIN_AI_API_KEY || 'unset',
  baseURL: normalizeEndpoint(process.env.LLM_MAIN_AI_ENDPOINT),
})

export const streamChatCompletion = (messages: Parameters<typeof streamWithFallback>[2]) => {
  const secondary: ChatProvider = {
    client: openai,
    model: requireModel('LLM_FALLBACK_AI_MODEL'),
    name: 'LLM_FALLBACK_AI',
  }

  // Only LLM_MAIN_AI_ENDPOINT gates the primary attempt: without it, the SDK would default to
  // api.openai.com and hit a real third party with a bogus key on every request.
  if (!process.env.LLM_MAIN_AI_ENDPOINT) {
    return streamWithFallback(undefined, secondary, messages)
  }

  const primary: ChatProvider = {
    client: llmClient,
    model: requireModel('LLM_MAIN_AI_MODEL'),
    name: 'LLM_MAIN_AI',
  }

  return streamWithFallback(primary, secondary, messages)
}
