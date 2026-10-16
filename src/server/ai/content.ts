// Reasoning models (Mistral) stream `delta.content` as an array of thinking/text parts instead of
// the plain string the openai SDK types promise — appending it as-is yields "[object Object]".
type ContentPart = { type?: unknown; text?: unknown; thinking?: unknown }

const isPart = (value: unknown): value is ContentPart => typeof value === 'object' && value !== null

const joinText = (parts: unknown): string =>
  Array.isArray(parts)
    ? parts
        .filter(isPart)
        .map((p) => (p.type === 'text' && typeof p.text === 'string' ? p.text : ''))
        .join('')
    : ''

export const splitDelta = (content: unknown): { text: string; thinking: string } => {
  if (typeof content === 'string') return { text: content, thinking: '' }

  const parts = Array.isArray(content) ? content.filter(isPart) : []
  return {
    text: joinText(parts),
    thinking: parts.map((p) => (p.type === 'thinking' ? joinText(p.thinking) : '')).join(''),
  }
}
