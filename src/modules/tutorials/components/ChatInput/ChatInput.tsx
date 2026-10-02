'use client'

import { Button, Textarea } from 'common/components/ui'
import { SendHorizontal } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled: boolean
}

const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [value, setValue] = useState('')

  const handleSend = () => {
    if (!value.trim() || disabled) return
    onSend(value)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Autosize fallback for browsers without `field-sizing: content` (Firefox); max-h caps it.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <div className="shrink-0 px-4 pt-3 pb-4 md:px-8 md:pb-6">
      <div className="bg-card border-input mx-auto flex max-w-195 items-end gap-2 rounded-2xl border py-2.5 pr-2.5 pl-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
        <Textarea
          ref={textareaRef}
          rows={1}
          placeholder="Zadaj pytanie…"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent! px-0 py-1.5 text-base shadow-none focus-visible:ring-0"
        />
        <Button
          size="icon-lg"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Wyślij wiadomość"
          className="shrink-0"
        >
          <SendHorizontal />
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 hidden text-center text-xs sm:block">
        Naciśnij Enter, aby wysłać — Shift+Enter wstawia nową linię
      </p>
    </div>
  )
}

export default ChatInput
