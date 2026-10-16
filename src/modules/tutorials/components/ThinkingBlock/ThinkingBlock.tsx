'use client'

import { cn } from 'cn'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'common/components/ui'
import { Brain, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface ThinkingBlockProps {
  thinking: string
  isThinking: boolean
}

const ThinkingBlock = ({ thinking, isThinking }: ThinkingBlockProps) => {
  // Undefined until the user toggles it: open while the model thinks, collapsed once it answers.
  const [userOpen, setUserOpen] = useState<boolean>()

  const isOpen = userOpen ?? isThinking

  return (
    <Collapsible open={isOpen} onOpenChange={setUserOpen} className="not-prose mb-2">
      <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors">
        <Brain className={cn('size-3.5', isThinking && 'text-mangetsu-5 animate-icon-pulse')} />
        <span className={cn(isThinking && 'italic')}>{isThinking ? 'Myślę…' : 'Rozumowanie'}</span>
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-mangetsu-7 text-muted-foreground mt-1.5 border-l-2 pl-3 text-xs">
        {/* column-reverse keeps the scroll anchored to the newest thinking while it streams in */}
        <div className="flex max-h-60 flex-col-reverse overflow-y-auto">
          <p className="whitespace-pre-wrap">{thinking}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default ThinkingBlock
