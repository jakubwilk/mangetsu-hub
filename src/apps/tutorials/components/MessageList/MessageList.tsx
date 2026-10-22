'use client'

import { useEffect, useRef } from 'react'

import type { Message } from '../../types'
import { MessageBubble } from '../MessageBubble'
import { TypingIndicator } from '../TypingIndicator'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

// Distance from the bottom still treated as "at the bottom", so a few pixels of drift don't unpin.
const PIN_THRESHOLD_PX = 80

const MessageList = ({ messages, isLoading }: MessageListProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  // A ref, not state: it changes on every scroll event and nothing renders from it.
  const isPinnedRef = useRef(true)

  const lastMessageRole = messages.at(-1)?.role

  const handleScroll = () => {
    const el = viewportRef.current
    if (!el) return
    isPinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD_PX
  }

  // Streamed tokens only follow a view the user left at the bottom; sending a question
  // (the user's message is last until the first token arrives) always brings it back down.
  // Instant, not smooth: a smooth scroll's intermediate scroll events would unpin the view.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    if (lastMessageRole === 'user') isPinnedRef.current = true
    if (isPinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages, isLoading, lastMessageRole])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-muted-foreground mb-2 text-xl font-light">Zadaj pytanie o poradniki</p>
        <p className="text-muted-foreground text-sm">Wpisz pytanie poniżej i naciśnij Enter</p>
      </div>
    )
  }

  return (
    <div ref={viewportRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
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
