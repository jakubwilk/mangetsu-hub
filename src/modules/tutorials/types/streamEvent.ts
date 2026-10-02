export type ChatStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'done'; requestsUsed: number }
  | { type: 'error'; message: string }
