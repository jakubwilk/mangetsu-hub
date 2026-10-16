export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
}

export interface ChatSession {
  id: string
  messages: Message[]
  createdAt: number
}
