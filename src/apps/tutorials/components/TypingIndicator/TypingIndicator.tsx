'use client'

import { BookOpen } from 'lucide-react'
import { useState } from 'react'

import loadingMessages from '../../data/loading-messages.json'

const TypingIndicator = () => {
  const [text] = useState(() => loadingMessages[Math.floor(Math.random() * loadingMessages.length)])

  return (
    <div className="flex justify-start">
      <div className="bg-card flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-2.5">
        <BookOpen className="text-mangetsu-5 animate-icon-pulse size-4 shrink-0" />
        <span className="text-muted-foreground text-sm italic">{text}</span>
      </div>
    </div>
  )
}

export default TypingIndicator
