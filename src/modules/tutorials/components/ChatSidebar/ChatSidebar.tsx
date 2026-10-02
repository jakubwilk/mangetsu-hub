'use client'

import { cn } from 'cn'
import { Button, Separator } from 'common/components/ui'
import { notifyError } from 'common/utils'
import { Plus, Trash2 } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

import { deleteSession } from '../../api'
import { chatStore } from '../../store'
import type { ChatSession, Message } from '../../types'
import { DeleteSessionModal } from '../DeleteSessionModal'

const getSessionPreview = (messages: Message[]): string => {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return 'Nowy czat'
  return first.content.length > 40 ? `${first.content.slice(0, 40)}…` : first.content
}

interface ChatSidebarProps {
  fluid?: boolean
}

const ChatSidebar = ({ fluid = false }: ChatSidebarProps) => {
  const { sessions, activeSessionId, requestsUsed, requestLimit } = useSyncExternalStore(
    chatStore.subscribe,
    chatStore.getSnapshot,
    chatStore.getServerSnapshot,
  )

  const [sessionPendingDelete, setSessionPendingDelete] = useState<ChatSession | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const visibleSessions = sessions.filter((s) => s.messages.length > 0)

  const handleConfirmDelete = async (sessionId: string) => {
    setIsDeleting(true)
    try {
      await deleteSession(sessionId)
      chatStore.deleteSession(sessionId)
      setSessionPendingDelete(null)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Nie udało się usunąć czatu.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <nav
      className={cn(
        'bg-panel flex flex-col overflow-hidden',
        fluid ? 'flex-1' : 'w-[20vw] max-w-75 shrink-0 border-r',
      )}
    >
      <div className="p-4">
        <Button
          className="w-full bg-white text-gray-900 hover:bg-gray-100"
          onClick={chatStore.newSession}
        >
          <Plus />
          Nowy czat
        </Button>
      </div>

      <Separator />

      <div className="flex flex-1 flex-col gap-1 overflow-auto p-4">
        {visibleSessions.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-center text-xs">Brak historii czatów</p>
        ) : (
          visibleSessions.map((session) => {
            const isActive = session.id === activeSessionId
            return (
              <div key={session.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => chatStore.switchSession(session.id)}
                  className={cn(
                    'hover:bg-accent min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs',
                    isActive ? 'bg-secondary text-white' : 'text-muted-foreground',
                  )}
                >
                  {getSessionPreview(session.messages)}
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSessionPendingDelete(session)}
                  aria-label="Usuń czat"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )
          })
        )}
      </div>

      <Separator />

      <div className="p-4">
        <p className="text-muted-foreground text-xs">Zapytania dzisiaj</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-mangetsu-4 text-sm font-bold">
            {requestsUsed}/{requestLimit}
          </span>
          <span className="text-muted-foreground text-xs">wykorzystanych</span>
        </p>
      </div>

      <DeleteSessionModal
        session={sessionPendingDelete}
        preview={sessionPendingDelete ? getSessionPreview(sessionPendingDelete.messages) : ''}
        loading={isDeleting}
        onClose={() => setSessionPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </nav>
  )
}

export default ChatSidebar
