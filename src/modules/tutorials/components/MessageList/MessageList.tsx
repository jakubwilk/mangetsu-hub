'use client'

import { useEffect, useRef } from 'react'

import type { Message } from '../../types'
import { MessageBubble } from '../MessageBubble'
import { TypingIndicator } from '../TypingIndicator'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

const MessageList = ({ messages, isLoading }: MessageListProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-muted-foreground mb-2 text-xl font-light">Zadaj pytanie o poradniki</p>
        <p className="text-muted-foreground text-sm">Wpisz pytanie poniżej i naciśnij Enter</p>
      </div>
    )
  }

  return (
    <div ref={viewportRef} className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 p-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>
    </div>
  )
}

export default MessageList
