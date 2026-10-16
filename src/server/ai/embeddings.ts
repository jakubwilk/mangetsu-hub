import OpenAI from 'openai'

import { requireModel } from './model'

const client = new OpenAI({
  apiKey: process.env.LLM_AI_EMBEDDING_API_KEY,
  baseURL: process.env.LLM_AI_EMBEDDING_ENDPOINT,
})

export const embedText = async (text: string): Promise<number[]> => {
  const response = await client.embeddings.create({
    model: requireModel('LLM_AI_EMBEDDING_MODEL'),
    input: text,
  })
  return response.data[0]!.embedding
}
