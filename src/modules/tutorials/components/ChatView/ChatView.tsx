'use client'

import { RequestError } from 'common/api'
import { Alert, AlertDescription, AlertTitle } from 'common/components/ui'
import { notifyError } from 'common/utils'
import { Loader2, ServerOff } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { fetchRateLimit, fetchSessionIds, sendMessage as sendChatMessage } from '../../api'
import { chatStore } from '../../store'
import { ChatInput } from '../ChatInput'
import { MessageList } from '../MessageList'

const ChatView = () => {
  const { sessions, activeSessionId, requestsUsed, requestLimit } = useSyncExternalStore(
    chatStore.subscribe,
    chatStore.getSnapshot,
    chatStore.getServerSnapshot,
  )

  const [isValidating, setIsValidating] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isDbError, setIsDbError] = useState(false)

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = activeSession?.messages ?? []

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || isLoading || requestsUsed >= requestLimit) return

      const userMessageId = crypto.randomUUID()
      let assistantMessageId: string | null = null

      // The server stores an exchange only after it streams in full — on any failure, drop it
      // locally too, so this session doesn't end up with messages the server never saw.
      const rollback = (message: string) => {
        chatStore.removeMessage(userMessageId)
        if (assistantMessageId) chatStore.removeMessage(assistantMessageId)
        notifyError(message)
      }

      chatStore.addMessage({ id: userMessageId, role: 'user', content })
      setIsLoading(true)

      try {
        for await (const event of sendChatMessage(content, activeSessionId)) {
          if (event.type === 'error') {
            rollback(event.message)
            return
          }

          if (event.type === 'token') {
            if (!assistantMessageId) {
              assistantMessageId = crypto.randomUUID()
              chatStore.addMessage({
                id: assistantMessageId,
                role: 'assistant',
                content: event.content,
              })
              setIsLoading(false)
            } else {
              chatStore.appendToMessage(assistantMessageId, event.content)
            }
          }

          if (event.type === 'done') {
            chatStore.setRequestsUsed(event.requestsUsed)
          }
        }

        chatStore.persistCurrentState()
      } catch (err) {
        if (err instanceof RequestError) {
          if (err.status === 429) chatStore.setRequestsUsed(requestLimit)
          rollback(err.message)
        } else {
          rollback('Błąd połączenia z serwerem. Sprawdź swoje połączenie internetowe.')
        }
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, requestsUsed, requestLimit, activeSessionId],
  )

  useEffect(() => {
    chatStore.init()

    Promise.all([fetchSessionIds(), fetchRateLimit()])
      .then(([sessionIds, rateLimit]) => {
        chatStore.pruneSessions(sessionIds)
        chatStore.setRequestsUsed(rateLimit.requestsUsed)
        chatStore.setRequestLimit(rateLimit.limit)
      })
      .catch(() => setIsDbError(true))
      .finally(() => setIsValidating(false))
  }, [])

  if (isValidating) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-primary size-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} isLoading={isLoading} />
      {isDbError ? (
        <Alert variant="destructive" className="m-4 w-auto">
          <ServerOff />
          <AlertTitle>Serwis niedostępny</AlertTitle>
          <AlertDescription>
            Nie można połączyć się z bazą danych. Czat jest tymczasowo wyłączony.
          </AlertDescription>
        </Alert>
      ) : (
        <ChatInput onSend={sendMessage} disabled={isLoading || requestsUsed >= requestLimit} />
      )}
    </div>
  )
}

export default ChatView
