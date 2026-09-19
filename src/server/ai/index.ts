import OpenAI from 'openai'

import { normalizeEndpoint } from './endpoint'
import { type ChatProvider, streamWithFallback } from './fallback'

// Shared OVH-backed client — used directly by guardrails.ts, and as the automatic
// fallback client for chat when the primary (LLM_AI) fails.
export const openai = new OpenAI({
  apiKey: process.env.OVH_AI_API_KEY,
  baseURL: normalizeEndpoint(process.env.OVH_AI_ENDPOINT),
})

// Placeholder instead of '' / undefined: `new OpenAI()` throws at import time without an
// apiKey, which would crash the whole app at startup rather than fail per-request.
const llmClient = new OpenAI({
  apiKey: process.env.LLM_AI_API_KEY || 'unset',
  baseURL: normalizeEndpoint(process.env.LLM_AI_ENDPOINT),
})

export const streamChatCompletion = (messages: Parameters<typeof streamWithFallback>[2]) => {
  const secondary: ChatProvider = {
    client: openai,
    model: process.env.OVH_AI_MODEL ?? 'Meta-Llama-3.1-70B-Instruct',
    name: 'OVH_AI',
  }

  // Only LLM_AI_ENDPOINT gates the primary attempt: without it, the SDK would default to
  // api.openai.com and hit a real third party with a bogus key on every request.
  if (!process.env.LLM_AI_ENDPOINT) {
    return streamWithFallback(undefined, secondary, messages)
  }

  const primary: ChatProvider = {
    client: llmClient,
    model: process.env.LLM_AI_MODEL ?? '',
    name: 'LLM_AI',
  }

  return streamWithFallback(primary, secondary, messages)
}
