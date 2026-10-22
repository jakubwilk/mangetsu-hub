'use client'

import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

interface TypingIndicatorProps {
  icon: LucideIcon
  messages: readonly string[]
}

const TypingIndicator = ({ icon: Icon, messages }: TypingIndicatorProps) => {
  const [text] = useState(() => messages[Math.floor(Math.random() * messages.length)])

  return (
    <div className="flex justify-start">
      <div className="bg-card flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-2.5">
        <Icon className="text-mangetsu-5 animate-icon-pulse size-4 shrink-0" />
        <span className="text-muted-foreground text-sm italic">{text}</span>
      </div>
    </div>
  )
}

export default TypingIndicator
