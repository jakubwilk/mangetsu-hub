export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  messages: Message[]
  createdAt: number
}
