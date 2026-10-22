export type ChatStreamEvent =
  | { type: 'thinking'; content: string }
  | { type: 'token'; content: string }
  | { type: 'done'; requestsUsed: number }
  | { type: 'error'; message: string }
